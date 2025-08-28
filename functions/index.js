// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const mercadopago = require("mercadopago");

admin.initializeApp();

// Configure o Mercado Pago com o seu Access Token.
// É ALTAMENTE RECOMENDADO guardar o seu token nas variáveis de ambiente do Firebase.
// Para configurar, execute no seu terminal:
// firebase functions:config:set mercadopago.accesstoken="SEU_ACCESS_TOKEN_DE_PRODUCAO"
mercadopago.configure({
  access_token: functions.config().mercadopago.accesstoken,
});

/**
 * Cria uma ASSINATURA no Mercado Pago para o plano PRO.
 */
exports.createSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "A função deve ser chamada por um utilizador autenticado.");
  }

  const userId = context.auth.uid;
  const userEmail = context.auth.token.email || "email@nao-fornecido.com";
  
  // 1. SUBSTITUA ABAIXO PELO ID DO PLANO QUE VOCÊ CRIOU NO PAINEL DO MERCADO PAGO
  const planId = "SEU_PLAN_ID_AQUI"; 

  if (planId === "SEU_PLAN_ID_AQUI") {
    throw new functions.https.HttpsError("failed-precondition", "O ID do plano do Mercado Pago não foi configurado na função.");
  }

  const subscriptionData = {
    reason: "Assinatura Financeiro PRO",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 49.90,
      currency_id: "BRL",
    },
    // 2. SUBSTITUA pelo URL do seu site
    back_url: "https://seu-site.netlify.app/", 
    payer_email: userEmail,
    external_reference: userId, 
    preapproval_plan_id: planId,
    status: "pending",
  };

  try {
    const response = await mercadopago.preapproval.create(subscriptionData);
    return { init_point: response.body.init_point };
  } catch (error) {
    console.error("Erro ao criar assinatura no Mercado Pago:", error);
    throw new functions.https.HttpsError("internal", "Não foi possível criar o link da assinatura.");
  }
});

/**
 * Webhook para receber notificações de pagamento do Mercado Pago.
 */
exports.mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
    const paymentId = req.query["data.id"];
    const topic = req.query.topic || req.body.topic;

    if (topic === 'payment' && paymentId) {
        try {
            const payment = await mercadopago.payment.get(paymentId);
            if (payment.body.status === 'approved') {
                const userId = payment.body.external_reference;
                if (userId) {
                    const subscriptionRef = admin.firestore().doc(`users/${userId}/subscription/current`);
                    
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + 1);

                    await subscriptionRef.set({
                        status: 'active',
                        plan: 'PRO',
                        paymentId: payment.body.id,
                        updatedAt: new Date(),
                        current_period_end: endDate,
                        mercadoPagoSubscriptionId: payment.body.order?.id,
                    }, { merge: true });

                    console.log(`Assinatura ativada para o utilizador: ${userId}`);
                }
            }
        } catch (error) {
            console.error('Erro no webhook do Mercado Pago:', error);
            res.status(500).send('Erro ao processar o webhook.');
            return;
        }
    }
    res.status(200).send('Webhook recebido.');
});


/**
 * Ativa ou estende manualmente a assinatura de um utilizador (para pagamentos em dinheiro).
 * Apenas pode ser chamada por um utilizador com a permissão de admin.
 */
exports.manualActivateSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError("permission-denied", "Apenas administradores podem executar esta função.");
  }

  const userIdToActivate = data.userId;
  if (!userIdToActivate) {
    throw new functions.https.HttpsError("invalid-argument", "O ID do utilizador é obrigatório.");
  }

  const subscriptionRef = admin.firestore().doc(`users/${userIdToActivate}/subscription/current`);
    
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const subscriptionData = {
    status: 'active',
    plan: 'PRO',
    paymentMethod: 'manual',
    activatedBy: context.auth.uid,
    updatedAt: new Date(),
    current_period_end: endDate,
  };

  try {
    await subscriptionRef.set(subscriptionData, { merge: true });
    console.log(`Assinatura ativada manualmente para o utilizador: ${userIdToActivate} pelo admin: ${context.auth.uid}`);
    return { success: true, message: "Assinatura ativada com sucesso!" };
  } catch (error) {
    console.error("Erro ao ativar assinatura manualmente:", error);
    throw new functions.https.HttpsError("internal", "Não foi possível ativar a assinatura.");
  }
});
