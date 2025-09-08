const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors")({ origin: true });
const fetch = require("node-fetch"); // Usando require com a versão 2 do node-fetch

admin.initializeApp();

// --- CONFIGURAÇÃO DOS CLIENTES DE API ---
const mercadoPagoAccessToken = functions.config().mercadopago.accesstoken;
const geminiApiKey = functions.config().gemini.apikey;

const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: mercadoPagoAccessToken,
  options: { timeout: 5000 },
});

/**
 * Função para formatar o extrato bancário usando a API Gemini.
 */
exports.formatBankStatement = functions
  .region("southamerica-east1")
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).send({ error: "Método não permitido." });
      }

      const { prompt } = req.body.data;
      if (!prompt) {
        return res.status(400).send({ error: "O 'prompt' é obrigatório." });
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
      const payload = { contents: [{ parts: [{ text: prompt }] }] };

      try {
        const geminiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!geminiResponse.ok) {
          const errorBody = await geminiResponse.text();
          console.error("Erro da API Gemini:", errorBody);
          return res.status(geminiResponse.status).send({ error: "Erro ao comunicar com a API Gemini." });
        }

        const result = await geminiResponse.json();
        
        if (result.candidates && result.candidates[0].content.parts[0].text) {
          const formattedStatement = result.candidates[0].content.parts[0].text;
          return res.status(200).send({ data: { formattedStatement } });
        } else {
            console.error("Resposta inválida da API Gemini:", JSON.stringify(result));
            return res.status(500).send({ error: "Resposta inválida da API Gemini." });
        }

      } catch (error) {
        console.error("Erro interno na função:", error);
        return res.status(500).send({ error: "Ocorreu um erro interno no servidor." });
      }
    });
  });


/**
 * Cria uma preferência de pagamento no Mercado Pago para a assinatura.
 */
exports.createSubscription = functions
  .region("southamerica-east1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Utilizador não autenticado.");
    }
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email || "email@nao-fornecido.com";

    const planDetails = {
      title: "Financeiro PRO - Assinatura Mensal",
      description: "Acesso completo a todas as funcionalidades do Financeiro PRO.",
      price: 49.90,
    };
    
    const notificationUrl = `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/paymentWebhook`;
    
    const preference = new Preference(mercadoPagoClient);

    try {
      const result = await preference.create({
        body: {
          items: [
            {
              id: "PRO_PLAN_MONTHLY_01",
              title: planDetails.title,
              description: planDetails.description,
              quantity: 1,
              currency_id: "BRL",
              unit_price: planDetails.price,
            },
          ],
          payer: { email: userEmail },
          back_urls: {
            success: "https://finaceiropro.netlify.app/",
            failure: "https://finaceiropro.netlify.app/",
            pending: "https://finaceiropro.netlify.app/",
          },
          auto_return: "approved",
          external_reference: userId,
          notification_url: notificationUrl, 
        }
      });
      return { init_point: result.init_point };
    } catch (error) {
      console.error("Erro ao criar preferência no Mercado Pago:", error);
      throw new functions.https.HttpsError("internal", "Não foi possível criar a sua preferência de pagamento.");
    }
  });


/**
 * Webhook para receber notificações de pagamento do Mercado Pago.
 */
exports.paymentWebhook = functions
  .region("southamerica-east1")
  .https.onRequest(async (req, res) => {
      const { query } = req;
      if (query.type === "payment") {
        const paymentId = query["data.id"];
        try {
          const payment = new Payment(mercadoPagoClient);
          const paymentDetails = await payment.get({ id: paymentId });
          const { status, external_reference: userId } = paymentDetails;

          if (userId && status === "approved") {
            const subscriptionRef = admin.firestore().collection("users").doc(userId).collection("subscription").doc("current");
            const newEndDate = new Date();
            newEndDate.setDate(newEndDate.getDate() + 30);
            await subscriptionRef.set({
              status: "active",
              plan: "PRO",
              last_payment_id: paymentId,
              updated_at: new Date(),
              subscription_end: newEndDate,
            }, { merge: true });
            console.log(`Assinatura do utilizador ${userId} atualizada para 'active'.`);
          }
        } catch (error) {
          console.error("Erro ao processar webhook do Mercado Pago:", error);
        }
      }
      res.status(200).send("OK");
  });

