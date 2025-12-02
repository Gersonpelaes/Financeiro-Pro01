import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, writeBatch, query, onSnapshot, deleteDoc, setDoc, where, getDoc, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PlusCircle, Upload, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, Settings, LayoutDashboard, List, BarChart2, Target, ArrowLeft, ArrowRightLeft, Repeat, CheckCircle, AlertTriangle, Clock, CalendarCheck, Building, GitCompare, ArrowUp, ArrowDown, Paperclip, FileText, LogOut, Download, UploadCloud, Sun, Moon, FileOutput, CalendarClock, Menu, X, ShieldCheck, CreditCard, RefreshCw, BookCopy, FileJson, Wallet, Percent, Archive, Receipt, Landmark } from 'lucide-react';

// --- CONFIGURAÇÃO DO FIREBASE ---
// Se as variáveis globais não estiverem definidas, usa objeto vazio para evitar crash inicial
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'southamerica-east1'); 

// --- UTILITÁRIOS ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const getYearMonth = (dateStr) => new Date(dateStr).toISOString().slice(0, 7);

const getCategoryFullName = (categoryId, categories) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'Sem Categoria';
    if (category.parentId) {
        const parent = categories.find(p => p.id === category.parentId);
        return `${parent?.name || 'Pai'}: ${category.name}`;
    }
    return category.name;
};

// --- COMPONENTES DE UI REUTILIZÁVEIS ---
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const sizeClass = { md: 'max-w-md', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size] || 'max-w-md';
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${sizeClass} p-8 m-4 transform transition-all max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 sticky top-0 bg-white dark:bg-gray-800 z-10 pb-4 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const Button = ({ onClick, children, className = 'bg-blue-600 hover:bg-blue-700', type = 'button', disabled = false }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={`flex items-center justify-center space-x-2 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
        {children}
    </button>
);

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg flex items-center space-x-4 transition-transform transform hover:scale-105">
        <div className={`p-3 rounded-full ${color}`}>{icon}</div>
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
        </div>
    </div>
);

// --- COMPONENTES DE ESTADO DA APLICAÇÃO ---
const LoadingScreen = ({ message }) => (
    <div className="flex flex-col justify-center items-center h-screen w-screen bg-gray-100 dark:bg-gray-900">
        <RefreshCw className="animate-spin text-blue-500 h-12 w-12 mb-4" />
        <p className="text-lg dark:text-gray-300">{message || 'A carregar...'}</p>
    </div>
);

const MigrationScreen = ({ onMigrate, isMigrating }) => (
    <div className="w-full h-screen flex flex-col justify-center items-center bg-gray-100 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-2xl">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Atualização Importante da Conta</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
                Olá! Para melhorar a sua experiência e permitir a gestão de múltiplas empresas, atualizámos a estrutura dos seus dados.
            </p>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
                Precisamos de migrar os seus dados existentes para o novo formato. Este é um processo único, rápido e seguro. Os seus dados não serão perdidos.
            </p>
            <Button onClick={onMigrate} disabled={isMigrating} className="mt-8 bg-blue-600 hover:bg-blue-700 !text-white text-lg px-8 py-3">
                <RefreshCw className={isMigrating ? 'animate-spin' : ''} size={20} />
                <span>{isMigrating ? 'A migrar os seus dados...' : 'Iniciar a Migração'}</span>
            </Button>
        </div>
    </div>
);


// --- VIEW DE AUTENTICAÇÃO ---
const AuthView = ({ onGoogleSignIn }) => {
    const [error, setError] = useState('');

    const handleSignIn = async () => {
        try {
            await onGoogleSignIn();
        } catch (err) {
            setError('Ocorreu um erro ao tentar entrar com o Google. Tente novamente.');
            console.error(err);
        }
    };

    const GoogleIcon = () => (
        <svg className="w-6 h-6" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
        </svg>
    );

    return (
        <div className="w-full h-screen flex justify-center items-center bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg text-center">
                <h2 className="text-3xl font-bold text-gray-800">Bem-vindo ao Financeiro PRO</h2>
                <p className="text-gray-600">Entre com a sua conta Google para continuar e aproveite 360 dias grátis.</p>
                <button
                    onClick={handleSignIn}
                    className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-sm transition-all transform hover:scale-105 hover:bg-gray-50"
                >
                    <GoogleIcon />
                    <span>Entrar com o Google</span>
                </button>
                {error && <p className="text-red-500 text-sm text-center pt-4">{error}</p>}
            </div>
        </div>
    );
};

// NOVO COMPONENTE REUTILIZÁVEL PARA SELEÇÃO DE CONTA HIERÁRQUICA
const AccountSelector = ({ accounts, selectedAccountId, onChange, required = true, name = "accountId", className = "", filter, allowNone = false, excludeId = null }) => {
    const hierarchicalAccounts = useMemo(() => {
        const topLevelAccounts = accounts.filter(a => !a.parentId);
        
        return topLevelAccounts.map(p => ({
            ...p,
            subAccounts: accounts.filter(s => s.parentId === p.id).sort((a,b) => a.name.localeCompare(b.name))
        })).sort((a,b) => a.name.localeCompare(b.name));
    }, [accounts]);

    let accountsToDisplay = hierarchicalAccounts;
    if (filter) {
        accountsToDisplay = hierarchicalAccounts.filter(filter);
    }

    return (
        <select name={name} value={selectedAccountId} onChange={onChange} className={`block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300 ${className}`} required={required}>
            {allowNone ? <option value="">Nenhuma</option> : <option value="">Selecione...</option>}
            {accountsToDisplay.map(account => {
                if (account.subAccounts.length > 0) {
                    return (
                        <optgroup key={account.id} label={account.name}>
                            {account.id !== excludeId && <option value={account.id}>{account.name} (Conta Principal)</option>}
                            {account.subAccounts.map(sub => (
                                sub.id !== excludeId && <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>
                            ))}
                        </optgroup>
                    );
                }
                return account.id !== excludeId && <option key={account.id} value={account.id}>{account.name}</option>;
            })}
        </select>
    );
};


// --- MODAL DE IMPORTAÇÃO DE TRANSAÇÕES (ATUALIZADO COM CORREÇÕES) ---
const TransactionImportModal = ({ isOpen, onClose, onImport, account, categories, payees, allTransactions }) => {
    const [step, setStep] = useState(1);
    const [csvData, setCsvData] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [error, setError] = useState('');
    const [badLineContent, setBadLineContent] = useState(null); // Novo estado para linha com erro
    const [isFormatting, setIsFormatting] = useState(false);
    const [isCategorizingAI, setIsCategorizingAI] = useState(false);

    const groupedCategories = useMemo(() => {
        const buildHierarchy = (type) => {
            const allCats = categories.filter(c => c.type === type);
            const parents = allCats.filter(c => !c.parentId);
            return parents.map(p => ({
                ...p,
                subcategories: allCats.filter(sub => sub.parentId === p.id)
            })).sort((a, b) => a.name.localeCompare(b.name));
        };
        return {
            expense: buildHierarchy('expense'),
            revenue: buildHierarchy('revenue'),
        };
    }, [categories]);

    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setCsvData('');
            setTransactions([]);
            setError('');
            setBadLineContent(null);
        }
    }, [isOpen]);
    
    const handleFormatStatement = async () => {
        setError('');
        setBadLineContent(null);
        if (!csvData.trim()) {
            setError('A área de texto está vazia. Cole o seu extrato primeiro.');
            return;
        }
        setIsFormatting(true);

        const prompt = `
            Analise o seguinte texto de um extrato bancário e converta CADA transação encontrada para o formato CSV.
            O formato de saída OBRIGATÓRIO para cada linha é: DD/MM/YYYY,Descrição Curta,Valor

            REGRAS IMPORTANTES:
            1.  **DATA**: Use estritamente o formato DD/MM/YYYY.
            2.  **DESCRIÇÃO**: Crie uma descrição curta e objetiva. NÃO use vírgulas na descrição.
            3.  **VALOR**: Use ponto como separador decimal. Despesas DEVEM ser negativas (ex: -50.25). Receitas DEVEM ser positivas (ex: 1200.00).
            4.  **IGNORAR**: Ignore completamente linhas que não são transações, como saldos, informações de cabeçalho, rodapés, etc.
            5.  **SAÍDA**: Retorne apenas as linhas CSV, sem nenhum texto ou explicação adicional.

            Texto do extrato para processar:
            \`\`\`
            ${csvData}
            \`\`\`
        `;
        
        const apiKey = ""; // A chave da API é injetada pelo ambiente
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        try {
            let response;
            let delay = 1000;
            for (let i = 0; i < 3; i++) {
                response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) break;
                if (response.status === 429 || response.status >= 500) await new Promise(r => setTimeout(r, delay *= 2));
                else throw new Error(`API Error: ${response.statusText}`);
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                const cleanedText = text.replace(/```csv/g, '').replace(/```/g, '').trim();
                setCsvData(cleanedText);
            } else {
                throw new Error("A resposta da API não continha o texto esperado.");
            }
        } catch (error) {
            console.error("Falha ao formatar extrato com IA:", error);
            setError(`Erro: ${error.message}. Tente novamente ou verifique o console.`);
            setBadLineContent(null);
        } finally {
            setIsFormatting(false);
        }
    };


    const handleParse = () => {
        setError('');
        setBadLineContent(null);
        if (!csvData.trim()) {
            setError('A área de texto está vazia.');
            return;
        }
        try {
            const lines = csvData.trim().split('\n');
            const parsed = lines.map((line, index) => {
                const parts = line.split(',');
                if (parts.length !== 3) {
                    throw new Error(`Linha ${index + 1} inválida. Use o formato exato: data,descrição,valor. A descrição não pode conter vírgulas.`);
                }
                const [dateStr, description, amountStr] = parts.map(p => p.trim());
                
                const amount = parseFloat(amountStr.replace(',', '.'));
                if (isNaN(amount)) {
                    throw new Error(`Valor inválido na linha ${index + 1}: "${amountStr}"`);
                }
                 let date;
                 if (dateStr.includes('/')) {
                     const [day, month, year] = dateStr.split('/');
                     if (!day || !month || !year || year.length < 4) {
                         throw new Error(`Formato de data inválido na linha ${index + 1}. Use DD/MM/YYYY.`);
                     }
                     date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`);
                 } else {
                     date = new Date(dateStr + "T12:00:00.000Z");
                 }
                if (isNaN(date.getTime())) {
                    throw new Error(`Data inválida na linha ${index + 1}: "${dateStr}"`);
                }
                
                let guessedPayeeId = '';
                let guessedCategoryId = '';
                const lowerCaseDescription = description.toLowerCase();

                for (const payee of payees) {
                    if (lowerCaseDescription.includes(payee.name.toLowerCase())) {
                        guessedPayeeId = payee.id;
                        if (payee.categoryId) {
                            guessedCategoryId = payee.categoryId;
                        }
                        break; 
                    }
                }

                if (!guessedCategoryId) {
                     for (const category of categories) {
                         const categoryNamePattern = new RegExp(`\\b${category.name.toLowerCase()}\\b`);
                         if (categoryNamePattern.test(lowerCaseDescription)) {
                             guessedCategoryId = category.id;
                             break;
                         }
                    }
                }

                return {
                    id: crypto.randomUUID(),
                    date: date.toISOString(),
                    description: description,
                    amount: Math.abs(amount),
                    type: amount >= 0 ? 'revenue' : 'expense',
                    categoryId: guessedCategoryId,
                    payeeId: guessedPayeeId,
                };
            });
            setTransactions(parsed);
            setStep(2);
        } catch (e) {
            setError(`Erro ao processar: ${e.message}`);
            
            // CORREÇÃO: Regex 'case insensitive' (/i) para capturar 'Linha' ou 'linha'
            const lineMatch = e.message.match(/Linha (\d+)/i);
            if (lineMatch && lineMatch[1]) {
                const lineNumber = parseInt(lineMatch[1], 10);
                const lines = csvData.trim().split('\n');
                if (lines[lineNumber - 1]) {
                    setBadLineContent(lines[lineNumber - 1]);
                }
            }
        }
    };
    
    const handleCategorizeAllWithAI = async () => {
        if (transactions.length === 0) return;
        setIsCategorizingAI(true);
        setError('');
        setBadLineContent(null);

        try {
            const examples = allTransactions
                .filter(t => t.categoryId && t.payeeId)
                .slice(0, 15)
                .map(t => {
                    const categoryName = getCategoryFullName(t.categoryId, categories);
                    const payeeName = payees.find(p => p.id === t.payeeId)?.name;
                    return `- Descrição: "${t.description}", Categoria: "${categoryName}", Favorecido: "${payeeName}"`;
                })
                .join('\n');

            const expenseCategoriesList = categories.filter(c => c.type === 'expense').map(c => `- ${getCategoryFullName(c.id, categories)} (ID: ${c.id})`).join('\n');
            const revenueCategoriesList = categories.filter(c => c.type === 'revenue').map(c => `- ${getCategoryFullName(c.id, categories)} (ID: ${c.id})`).join('\n');
            const payeeList = payees.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
            const newTransactionsList = transactions.map((t, index) => `${index + 1}. (${t.type === 'expense' ? 'Despesa' : 'Receita'}) ${t.description}`).join('\n');

            const prompt = `
                Você é um assistente financeiro especialista. Sua tarefa é analisar novas transações e sugerir o 'categoryId' e o 'payeeId' mais prováveis.
                **Regras Cruciais:**
                1. **Tipo é Prioridade:** Analise se a transação é (Despesa) ou (Receita). Use a lista de categorias correspondente.
                2. **Aprenda com o Histórico:** Os exemplos do utilizador são a sua referência principal. Imite os padrões de categorização dele.
                3. **Use os IDs:** Forneça o 'categoryId' e 'payeeId' exatos das listas abaixo.
                **Exemplos do Histórico do Utilizador:**
                ${examples || "Nenhum exemplo disponível."}
                **Listas Disponíveis:**
                **Categorias de Despesa:**
                ${expenseCategoriesList}
                **Categorias de Receita:**
                ${revenueCategoriesList}
                **Favorecidos:**
                ${payeeList}
                **Novas Transações para Analisar:**
                ${newTransactionsList}
                **Formato de Resposta OBRIGATÓRIO:**
                Responda APENAS com um objeto JSON com uma chave "sugestoes", que é um array de objetos. Cada objeto deve ter "index", "categoryId" e "payeeId". Se não tiver certeza, use uma string vazia ("").
            `;

            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            };
            
            let response;
            let delay = 1000;
            for (let i = 0; i < 3; i++) {
                 response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) break;
                 if (response.status === 429 || response.status >= 500) await new Promise(r => setTimeout(r, delay *= 2));
                 else throw new Error(`API Error: ${response.statusText}`);
            }
            const result = await response.json();
            const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) throw new Error("A API retornou uma resposta vazia.");
            
            // CORREÇÃO ROBUSTA PARA EXTRAIR JSON
            const startIndex = textResponse.indexOf('{');
            const endIndex = textResponse.lastIndexOf('}');
            
            if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
                console.error("Resposta da IA não continha um JSON válido:", textResponse);
                throw new Error("Formato de resposta da IA inválido. Não foi possível encontrar o objeto JSON.");
            }
    
            const jsonString = textResponse.substring(startIndex, endIndex + 1);
            const parsedResponse = JSON.parse(jsonString); 
            
            const suggestions = parsedResponse.sugestoes;

            if (!suggestions || !Array.isArray(suggestions)) throw new Error("Formato de resposta da IA inválido.");

            setTransactions(currentTransactions => {
                const updatedTransactions = [...currentTransactions];
                suggestions.forEach(suggestion => {
                    const index = suggestion.index - 1;
                    if (updatedTransactions[index]) {
                        if(suggestion.categoryId) updatedTransactions[index].categoryId = suggestion.categoryId;
                        if(suggestion.payeeId) updatedTransactions[index].payeeId = suggestion.payeeId;
                    }
                });
                return updatedTransactions;
            });

        } catch (e) {
            console.error("Erro na categorização por IA:", e);
            setError(`Erro na categorização por IA: ${e.message}`);
        } finally {
            setIsCategorizingAI(false);
        }
    };


    const handleRowChange = (id, field, value) => {
        setTransactions(prev => prev.map(t => (t.id === id ? { ...t, [field]: value } : t)));
    };

    const handleConfirmImport = () => {
        onImport(transactions);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Importar Transações para ${account?.name}`} size="xl">
            {step === 1 && (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cole o seu extrato de qualquer banco abaixo. Depois, clique em "Formatar Extrato com IA" para converter os dados automaticamente.</p>
                    <textarea
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                        rows="10"
                        className="w-full p-2 border dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-gray-300"
                        placeholder="Cole o seu extrato bancário bruto aqui..."
                    ></textarea>
                    {error && (
                        <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                            <p className="font-bold">Erro: {error}</p>
                            {badLineContent && (
                                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded border border-red-300 dark:border-red-700">
                                    <p className="font-semibold text-red-700 dark:text-red-200 mb-1">Linha com erro:</p>
                                    <code className="text-red-700 dark:text-red-200 font-mono text-xs break-all block bg-white/50 dark:bg-black/20 p-1 rounded">{badLineContent}</code>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-4">
                         <Button onClick={handleFormatStatement} disabled={isFormatting} className="w-full bg-purple-600 hover:bg-purple-700">
                            {isFormatting ? <RefreshCw className="animate-spin" /> : '✨'}
                            <span>{isFormatting ? 'A formatar...' : 'Formatar Extrato com IA'}</span>
                         </Button>
                         <Button onClick={handleParse} className="w-full bg-blue-600 hover:bg-blue-700">Analisar Dados</Button>
                    </div>
                </div>
            )}
            {step === 2 && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Verifique e categorize as transações</h3>
                        <Button onClick={handleCategorizeAllWithAI} disabled={isCategorizingAI} className="bg-purple-600 hover:bg-purple-700">
                            {isCategorizingAI ? <RefreshCw className="animate-spin" /> : '🤖'}
                            <span>{isCategorizingAI ? 'A sugerir...' : 'Sugerir com IA'}</span>
                        </Button>
                    </div>
                     {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-md">{error}</p>}
                    <div className="max-h-[60vh] overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="p-2">Data</th>
                                    <th className="p-2 w-1/3">Descrição</th>
                                    <th className="p-2">Valor</th>
                                    <th className="p-2 w-1/4">Categoria</th>
                                    <th className="p-2 w-1/4">Favorecido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.id} className="border-b dark:border-gray-700">
                                        <td className="p-2">{formatDate(t.date)}</td>
                                        <td className="p-2">
                                            <input type="text" value={t.description} onChange={e => handleRowChange(t.id, 'description', e.target.value)} className="w-full p-1 border dark:border-gray-600 rounded-md dark:bg-gray-800" />
                                        </td>
                                        <td className={`p-2 font-semibold ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</td>
                                        <td className="p-2">
                                            <select value={t.categoryId} onChange={e => handleRowChange(t.id, 'categoryId', e.target.value)} className="w-full p-1 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                                                <option value="">Selecione...</option>
                                                {(groupedCategories[t.type] || []).map(parent => (
                                                    <optgroup key={parent.id} label={parent.name}>
                                                        <option value={parent.id}>{parent.name} (Principal)</option>
                                                        {parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select value={t.payeeId} onChange={e => handleRowChange(t.id, 'payeeId', e.target.value)} className="w-full p-1 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                                                <option value="">Nenhum</option>
                                                {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                        <Button onClick={() => setStep(1)} className="bg-gray-600 hover:bg-gray-700">Voltar</Button>
                        <Button onClick={handleConfirmImport} className="bg-green-600 hover:bg-green-700">Confirmar e Importar {transactions.length} Transações</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

const SettingsView = ({ onSaveEntity, onDeleteEntity, onImportTransactions, accounts, payees, categories, allTransactions, activeCompanyId }) => {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [accountToImport, setAccountToImport] = useState(null);
    const [activeTab, setActiveTab] = useState('accounts');

    const handleOpenImportModal = (account) => {
        setAccountToImport(account);
        setIsImportModalOpen(true);
    };
    
    const handleImportConfirm = (transactions) => {
        onImportTransactions(transactions, accountToImport.id);
    };
    
    const handleApplyTemplate = async (templateData) => {
        const batch = writeBatch(db);
        const idMap = new Map();

        // Salvar primeiro as categorias pai para obter os seus IDs
        const parents = templateData.filter(cat => !cat.parentId);
        for (const cat of parents) {
            const { id: oldId, ...data } = cat;
            const docRef = doc(collection(db, `users/${auth.currentUser.uid}/companies/${activeCompanyId}/categories`));
            idMap.set(oldId, docRef.id); // Mapeia o ID antigo para o novo
            batch.set(docRef, data);
        }
        
        // Agora, salvar as categorias filhas, usando os novos IDs dos pais
        const children = templateData.filter(cat => cat.parentId);
        for (const child of children) {
            const { id: oldId, parentId: oldParentId, ...data } = child;
            const newParentId = idMap.get(oldParentId);
            if (newParentId) {
                data.parentId = newParentId;
                const docRef = doc(collection(db, `users/${auth.currentUser.uid}/companies/${activeCompanyId}/categories`));
                batch.set(docRef, data);
            } else {
                 console.warn(`Categoria filha "${child.name}" não encontrou o ID do pai "${oldParentId}". Será salva como categoria principal.`);
                 const docRef = doc(collection(db, `users/${auth.currentUser.uid}/companies/${activeCompanyId}/categories`));
                 batch.set(docRef, data);
            }
        }
        await batch.commit();
    };


    const TabButton = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-semibold rounded-t-lg transition-colors focus:outline-none ${activeTab === tab ? 'bg-white dark:bg-gray-800 border-b-0' : 'bg-gray-100 dark:bg-gray-700'}`}
        >{label}</button>
    );

    return (
        <div className="space-y-8">
            <h2 className="text-4xl font-bold text-gray-800 dark:text-gray-200">Configurações da Empresa</h2>
            
            <div className="border-b dark:border-gray-700">
                <TabButton tab="accounts" label="Contas" />
                <TabButton tab="payees" label="Favorecidos" />
                <TabButton tab="categories" label="Categorias" />
            </div>

            <div className="mt-4">
                {activeTab === 'accounts' && <AccountsManager accounts={accounts} onSave={onSaveEntity} onDelete={onDeleteEntity} onImport={handleOpenImportModal} />}
                {activeTab === 'payees' && <PayeesManager payees={payees} categories={categories} onSave={onSaveEntity} onDelete={onDeleteEntity} />}
                {activeTab === 'categories' && <CategoryManager categories={categories} onSave={onSaveEntity} onDelete={onDeleteEntity} onApplyTemplate={handleApplyTemplate} />}
            </div>
            
            <TransactionImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onImport={handleImportConfirm} 
                account={accountToImport}
                categories={categories}
                payees={payees}
                allTransactions={allTransactions}
            />
        </div>
    );
};

const DashboardView = ({ transactions, accounts, categories, futureEntries, budgets, dashboardConfig, onSaveConfig }) => {
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [tempConfig, setTempConfig] = useState(dashboardConfig);

    useEffect(() => {
        setTempConfig(dashboardConfig);
    }, [dashboardConfig]);

    const handleConfigChange = (key) => {
        setTempConfig(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSaveSettings = () => {
        onSaveConfig(tempConfig);
        setIsSettingsModalOpen(false);
    };

    // --- CÁLCULOS DOS KPIs ---
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const totalBalance = useMemo(() =>
        accounts.reduce((acc, account) => acc + (account.initialBalance || 0), 0) +
        transactions.reduce((acc, t) => {
            if (t.type === 'revenue') return acc + t.amount;
            if (t.type === 'expense') return acc - t.amount;
            return acc;
        }, 0), [accounts, transactions]);

    const monthlyTransactions = useMemo(() => transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= startOfMonth && tDate <= endOfMonth && !t.isTransfer;
    }), [transactions, startOfMonth, endOfMonth]);
    
    const totalRevenue = useMemo(() => monthlyTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0), [monthlyTransactions]);
    const totalExpense = useMemo(() => monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0), [monthlyTransactions]);
    const monthlyCashFlow = useMemo(() => totalRevenue - totalExpense, [totalRevenue, totalExpense]);
    const profitMargin = useMemo(() => totalRevenue > 0 ? (monthlyCashFlow / totalRevenue) * 100 : 0, [monthlyCashFlow, totalRevenue]);

    const cmv = useMemo(() => {
        const cmvCategoryIds = categories.filter(c => c.name && (c.name.toLowerCase().includes('mercadorias vendidas') || c.name.toLowerCase().includes('cmv'))).map(c => c.id);
        if (cmvCategoryIds.length === 0) return 0;
        return monthlyTransactions.filter(t => t.type === 'expense' && cmvCategoryIds.includes(t.categoryId)).reduce((sum, t) => sum + t.amount, 0);
    }, [monthlyTransactions, categories]);
    
    const operationalExpenses = useMemo(() => {
        const parentOpExId = categories.find(c => c.name && c.name.toLowerCase().includes('despesas operacionais') && !c.parentId)?.id;
        if (!parentOpExId) return 0;
        const opExCategoryIds = [parentOpExId, ...categories.filter(c => c.parentId === parentOpExId).map(c => c.id)];
        return monthlyTransactions.filter(t => t.type === 'expense' && opExCategoryIds.includes(t.categoryId)).reduce((sum, t) => sum + t.amount, 0);
    }, [monthlyTransactions, categories]);

    const accountsPayable = useMemo(() => {
        return futureEntries
            .filter(e => e.status !== 'reconciled' && e.type === 'expense')
            .reduce((sum, e) => sum + e.amount, 0);
    }, [futureEntries]);
    
    const taxes = useMemo(() => {
        const taxCategoryIds = categories.filter(c => c.name && (c.name.toLowerCase().includes('impostos') || c.name.toLowerCase().includes('obrigações fiscais'))).map(c => c.id);
        if (taxCategoryIds.length === 0) return 0;
        return monthlyTransactions.filter(t => t.type === 'expense' && taxCategoryIds.includes(t.categoryId)).reduce((sum, t) => sum + t.amount, 0);
    }, [monthlyTransactions, categories]);
    
    const next30DaysProjection = useMemo(() => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        const futureCashFlow = futureEntries
            .filter(e => e.status !== 'reconciled' && new Date(e.dueDate) <= endDate)
            .reduce((sum, e) => sum + (e.type === 'revenue' ? e.amount : -e.amount), 0);
        return totalBalance + futureCashFlow;
    }, [futureEntries, totalBalance]);

    const expenseByCategory = useMemo(() => {
        const grouped = monthlyTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
            const categoryName = getCategoryFullName(t.categoryId, categories);
            acc[categoryName] = (acc[categoryName] || 0) + t.amount;
            return acc;
        }, {});
        return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [monthlyTransactions, categories]);

    const dueToday = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        return futureEntries.filter(e => e.dueDate.slice(0, 10) === today && e.status !== 'reconciled');
    }, [futureEntries]);
    
    const budgetOverview = useMemo(() => {
        const expensesByCat = {};
        for(const expense of monthlyTransactions) {
            expensesByCat[expense.categoryId] = (expensesByCat[expense.categoryId] || 0) + expense.amount;
            const category = categories.find(c => c.id === expense.categoryId);
            if(category?.parentId) expensesByCat[category.parentId] = (expensesByCat[category.parentId] || 0) + expense.amount;
        }
        
        let totalBudget = 0;
        let totalSpent = 0;
        budgets.forEach(b => {
            const budgetAmount = b.budgetType === 'percentage' ? (totalRevenue * (b.percentage || 0)) / 100 : b.amount;
            totalBudget += budgetAmount;
            totalSpent += expensesByCat[b.categoryId] || 0;
        });
        const progress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        return { totalBudget, totalSpent, progress };
    }, [budgets, monthlyTransactions, categories, totalRevenue]);

    const kpiCards = [
        { key: 'showTotalBalance', title: "Saldo Total", value: formatCurrency(totalBalance), icon: <DollarSign className="text-white" />, color: "bg-green-500" },
        { key: 'showMonthlyRevenue', title: "Receitas (Mês)", value: formatCurrency(totalRevenue), icon: <TrendingUp className="text-white" />, color: "bg-blue-500" },
        { key: 'showMonthlyExpense', title: "Despesas (Mês)", value: formatCurrency(totalExpense), icon: <TrendingDown className="text-white" />, color: "bg-red-500" },
        { key: 'showCashFlow', title: "Fluxo de Caixa (Mês)", value: formatCurrency(monthlyCashFlow), icon: <Wallet className="text-white" />, color: "bg-cyan-500" },
        { key: 'showProfitMargin', title: "Margem de Lucro", value: `${profitMargin.toFixed(2)}%`, icon: <Percent className="text-white" />, color: "bg-teal-500" },
        { key: 'showCMV', title: "CMV (Mês)", value: formatCurrency(cmv), icon: <Archive className="text-white" />, color: "bg-orange-500" },
        { key: 'showOperationalExpenses', title: "Desp. Operacionais", value: formatCurrency(operationalExpenses), icon: <Receipt className="text-white" />, color: "bg-yellow-500" },
        { key: 'showAccountsPayable', title: "Contas a Pagar", value: formatCurrency(accountsPayable), icon: <Landmark className="text-white" />, color: "bg-pink-500" },
        { key: 'showTaxes', title: "Impostos (Mês)", value: formatCurrency(taxes), icon: <FileText className="text-white" />, color: "bg-indigo-500" },
        { key: 'showNext30DaysProjection', title: "Projeção 30 dias", value: formatCurrency(next30DaysProjection), icon: <TrendingUp className="text-white" />, color: "bg-purple-500" },
    ];
    
    if (!dashboardConfig) return <LoadingScreen message="A carregar dashboard..." />;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Dashboard</h2>
                <Button onClick={() => setIsSettingsModalOpen(true)} className="bg-gray-600 hover:bg-gray-700 !p-2">
                    <Settings />
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {kpiCards.filter(kpi => dashboardConfig && dashboardConfig[kpi.key]).map(kpi => (
                    <StatCard key={kpi.key} {...kpi} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {dashboardConfig.showExpenseByCategory && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Despesas do Mês por Categoria</h3>
                        {expenseByCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                               <BarChart data={expenseByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={formatCurrency} />
                                    <YAxis type="category" dataKey="name" width={150} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="value" fill="#ef4444" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p className="text-center text-gray-500 dark:text-gray-400 py-12">Sem despesas este mês.</p>}
                    </div>
                )}
                 {dashboardConfig.showDueToday && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Contas a Vencer Hoje</h3>
                        {dueToday.length > 0 ? (
                            <ul className="space-y-3 max-h-[300px] overflow-y-auto">
                                {dueToday.map(item => (
                                    <li key={item.id} className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                                        <div>
                                            <p className="font-semibold text-gray-700 dark:text-gray-300">{item.description}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{getCategoryFullName(item.categoryId, categories)}</p>
                                        </div>
                                        <span className="font-bold text-red-600">{formatCurrency(item.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-center text-gray-500 dark:text-gray-400 py-12">Nenhuma conta vence hoje.</p>}
                    </div>
                 )}
                 {dashboardConfig.showBudgetSummary && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg lg:col-span-2">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Resumo dos Orçamentos do Mês</h3>
                        {budgetOverview.totalBudget > 0 ? (
                            <div>
                                <div className="flex justify-between text-lg mb-2">
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Gasto: <span className={budgetOverview.totalSpent > budgetOverview.totalBudget ? 'text-red-500' : 'text-green-500'}>{formatCurrency(budgetOverview.totalSpent)}</span></span>
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">Orçamento: {formatCurrency(budgetOverview.totalBudget)}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6">
                                    <div 
                                        className={`h-6 rounded-full text-white text-sm flex items-center justify-center ${budgetOverview.progress > 100 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${Math.min(budgetOverview.progress, 100)}%` }}
                                    >
                                        {budgetOverview.progress.toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        ) : <p className="text-center text-gray-500 dark:text-gray-400 py-12">Nenhum orçamento definido para este mês.</p>}
                    </div>
                 )}
            </div>
            
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Configurar Dashboard">
                <div className="space-y-2">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Selecione os indicadores que deseja ver no seu dashboard.</p>
                    <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
                        {[
                            ...kpiCards.map(k => ({ key: k.key, label: k.title})),
                            { key: 'showExpenseByCategory', label: 'Gráfico de Despesas' },
                            { key: 'showDueToday', label: 'Contas a Vencer Hoje' },
                            { key: 'showBudgetSummary', label: 'Resumo de Orçamentos' },
                        ].map(item => (
                            <label key={item.key} className="flex items-center space-x-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer">
                                <input type="checkbox" checked={!!(tempConfig && tempConfig[item.key])} onChange={() => handleConfigChange(item.key)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-gray-800 dark:text-gray-300 font-medium">{item.label}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end pt-6">
                        <Button onClick={handleSaveSettings}>Guardar Configuração</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const TransactionsView = ({ transactions, accounts, categories, payees, onSave, onDelete, onBatchDelete, futureEntries }) => {
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [formData, setFormData] = useState({});
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [selectedTransactions, setSelectedTransactions] = useState(new Set());
    const [isAddPayeeModalOpen, setIsAddPayeeModalOpen] = useState(false);
    const [newPayeeName, setNewPayeeName] = useState('');
    const [newlyAddedPayeeName, setNewlyAddedPayeeName] = useState(null);

    // Estados de Simulação
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationRange, setSimulationRange] = useState({ start: '', end: '' });
    const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);


    useEffect(() => {
        if (accounts.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accounts.find(a => !a.parentId)?.id || accounts[0].id);
        }
        setSelectedTransactions(new Set());
        setIsSimulating(false); // Reset simulation on account change
    }, [accounts, selectedAccountId]);
    
    useEffect(() => {
        if (newlyAddedPayeeName && payees.length > 0) {
            const newPayee = payees.find(p => p.name === newlyAddedPayeeName);
            if (newPayee) {
                setFormData(prev => ({ ...prev, payeeId: newPayee.id }));
                setNewlyAddedPayeeName(null); 
            }
        }
    }, [payees, newlyAddedPayeeName]);


    const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

    const subAccountIds = useMemo(() => {
        if (!selectedAccount) return [];
        return accounts.filter(a => a.parentId === selectedAccount.id).map(a => a.id);
    }, [accounts, selectedAccount]);

    const accountIdsToFilter = useMemo(() => {
        if (!selectedAccountId) return [];
        return [selectedAccountId, ...subAccountIds];
    }, [selectedAccountId, subAccountIds]);

    const filteredTransactions = useMemo(() => {
        if (accountIdsToFilter.length === 0) return [];
        return transactions.filter(t => accountIdsToFilter.includes(t.accountId));
    }, [transactions, accountIdsToFilter]);

    const groupInitialBalance = useMemo(() => {
        if (!selectedAccount) return 0;
        const parentBalance = selectedAccount.initialBalance || 0;
        const subBalances = accounts
            .filter(a => a.parentId === selectedAccount.id)
            .reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
        return parentBalance + subBalances;
    }, [accounts, selectedAccount]);

    const transactionsWithBalance = useMemo(() => {
        if (!selectedAccount) return [];

        let combinedTransactions = [...filteredTransactions];

        if (isSimulating && simulationRange.start && simulationRange.end) {
            const simStartDate = new Date(simulationRange.start + 'T00:00:00');
            const simEndDate = new Date(simulationRange.end + 'T23:59:59');

            const futureSimulations = futureEntries
                .filter(entry => {
                    const dueDate = new Date(entry.dueDate);
                    return entry.status !== 'reconciled' &&
                           dueDate >= simStartDate &&
                           dueDate <= simEndDate;
                })
                .map(entry => ({
                    ...entry,
                    id: `sim-${entry.id}`, // Unique key for simulated entries
                    date: entry.dueDate, 
                    accountId: selectedAccountId, 
                    isSimulated: true,
                }));
            
            combinedTransactions.push(...futureSimulations);
        }

        combinedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        let runningBalance = groupInitialBalance;
        
        const processed = combinedTransactions
            .slice()
            .reverse()
            .map(t => {
                const amount = t.type === 'revenue' ? t.amount : -t.amount;
                runningBalance += amount;
                return { ...t, runningBalance };
            });
        
        return processed.reverse();
    }, [filteredTransactions, selectedAccount, isSimulating, simulationRange, futureEntries, groupInitialBalance]);

    const currentBalance = useMemo(() => {
        if (!selectedAccount) return 0;
        if (transactionsWithBalance.length === 0) return groupInitialBalance;
        return transactionsWithBalance[0].runningBalance;
    }, [transactionsWithBalance, selectedAccount, groupInitialBalance]);

    const handleSelectTransaction = (id) => {
        setSelectedTransactions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = transactionsWithBalance.filter(t => !t.isSimulated).map(t => t.id);
            setSelectedTransactions(new Set(allIds));
        } else {
            setSelectedTransactions(new Set());
        }
    };

    const handleDeleteSelected = () => {
        const toDelete = transactions.filter(t => selectedTransactions.has(t.id));
        onBatchDelete(toDelete);
        setSelectedTransactions(new Set());
    };

    const handleOpenModal = (transaction = null) => {
        setAttachmentFile(null);
        if (transaction) { // Editing
            setEditingTransaction(transaction);
            if (transaction.isTransfer) {
                const transferPair = transactions.filter(t => t.transferId === transaction.transferId);
                const expenseSide = transferPair.find(t => t.type === 'expense');
                const revenueSide = transferPair.find(t => t.type === 'revenue');

                let commonDescription = '';
                if (expenseSide?.description) {
                    const sourceAccountName = accounts.find(a => a.id === revenueSide?.accountId)?.name || 'outra conta';
                    const prefix = `Transferência para ${sourceAccountName}`;
                    commonDescription = expenseSide.description.replace(prefix, '').replace(' - ', '').trim();
                }
                
                setFormData({
                    type: 'transfer',
                    amount: transaction.amount,
                    date: transaction.date.substring(0, 10),
                    description: commonDescription,
                    sourceAccountId: expenseSide?.accountId || '',
                    destinationAccountId: revenueSide?.accountId || '',
                    transferId: transaction.transferId,
                });
            } else { // Regular transaction
                setFormData({ ...transaction, date: transaction.date.substring(0, 10) });
            }
        } else { // New transaction
            setEditingTransaction(null);
            setFormData({
                type: 'expense', amount: '', description: '', date: new Date().toISOString().substring(0, 10),
                accountId: selectedAccountId || accounts[0]?.id || '',
                categoryId: '',
                payeeId: '',
                sourceAccountId: selectedAccountId || accounts[0]?.id || '',
                destinationAccountId: accounts.find(a => a.id !== selectedAccountId)?.id || accounts[0]?.id || '',
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'payeeId') {
                const selectedPayee = payees.find(p => p.id === value);
                if (selectedPayee?.categoryId) newState.categoryId = selectedPayee.categoryId;
            }
            if (name === 'type') newState.categoryId = '';
            return newState;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { ...formData, amount: parseFloat(formData.amount), date: new Date(formData.date).toISOString() };
        onSave('transactions', dataToSave, editingTransaction?.id, attachmentFile);
        handleCloseModal();
    };
    
    const handleAddPayee = async () => {
        const trimmedName = newPayeeName.trim();
        if (!trimmedName) {
            alert('O nome do favorecido não pode estar vazio.');
            return;
        }
        if (payees.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
            alert('Este favorecido já existe.');
            return;
        }
        await onSave('payees', { name: trimmedName });
        setNewlyAddedPayeeName(trimmedName);
        setNewPayeeName('');
        setIsAddPayeeModalOpen(false);
    };
    
    const handleOpenSimulationModal = () => {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 30);
        
        setSimulationRange({
            start: today.toISOString().substring(0, 10),
            end: endDate.toISOString().substring(0, 10),
        });
        setIsSimulationModalOpen(true);
    };
    
    const handleSimRangeChange = (e) => {
        const { name, value } = e.target;
        setSimulationRange(prev => ({ ...prev, [name]: value }));
    };

    const handleStartSimulation = (e) => {
        e.preventDefault();
        setIsSimulating(true);
        setIsSimulationModalOpen(false);
    };

    const groupedCategories = useMemo(() => {
        const type = formData.type || 'expense';
        const parents = categories.filter(c => !c.parentId && c.type === type);
        return parents.map(parent => ({
            ...parent,
            subcategories: categories.filter(sub => sub.parentId === parent.id)
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, formData.type]);

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg h-full flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Extrato da Conta</h2>
                        <AccountSelector 
                            accounts={accounts} 
                            selectedAccountId={selectedAccountId} 
                            onChange={(e) => setSelectedAccountId(e.target.value)} 
                            className="!mt-2"
                        />
                    </div>
                    <div className="text-right">
                        <p className="text-gray-500 dark:text-gray-400">{isSimulating ? 'Saldo Simulado' : 'Saldo Atual'}</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(currentBalance)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {selectedTransactions.size > 0 && (
                            <Button onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700">
                                <Trash2 size={20} />
                                <span>Apagar ({selectedTransactions.size})</span>
                            </Button>
                        )}
                        {isSimulating ? (
                            <Button onClick={() => setIsSimulating(false)} className="bg-gray-600 hover:bg-gray-700">
                                <ArrowLeft size={20} /><span>Voltar ao Extrato</span>
                            </Button>
                        ) : (
                            <Button onClick={handleOpenSimulationModal} className="bg-yellow-500 hover:bg-yellow-600">
                                <Clock size={20} /><span>Simular Futuro</span>
                            </Button>
                        )}
                        <Button onClick={() => handleOpenModal()}><PlusCircle size={20} /><span>Adicionar Transação</span></Button>
                    </div>
                </div>
            </div>
            <div className="overflow-auto flex-grow">
                <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                            <th className="p-4 w-12 text-center">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                    onChange={handleSelectAll}
                                    checked={transactionsWithBalance.filter(t => !t.isSimulated).length > 0 && selectedTransactions.size === transactionsWithBalance.filter(t => !t.isSimulated).length}
                                    ref={input => { if (input) { input.indeterminate = selectedTransactions.size > 0 && selectedTransactions.size < transactionsWithBalance.filter(t => !t.isSimulated).length; } }}
                                />
                            </th>
                            <th className="p-4">Data</th>
                            <th className="p-4">Descrição</th>
                            <th className="p-4">Categoria</th>
                            <th className="p-4 text-right">Valor</th>
                            <th className="p-4 text-right">Saldo</th>
                            <th className="p-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactionsWithBalance.map(t => (
                            <tr key={t.id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedTransactions.has(t.id) ? 'bg-blue-50 dark:bg-blue-900/40' : ''} ${t.isSimulated ? 'bg-yellow-50 dark:bg-yellow-900/20 italic' : ''}`}>
                                <td className="p-4 text-center">
                                    {!t.isSimulated && (
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            checked={selectedTransactions.has(t.id)}
                                            onChange={() => handleSelectTransaction(t.id)}
                                        />
                                    )}
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-400">{formatDate(t.date)}</td>
                                <td className="p-4 font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    {t.description}
                                    {t.attachmentURL && (
                                        <a href={t.attachmentURL} target="_blank" rel="noopener noreferrer" title="Ver anexo">
                                            <Paperclip className="text-blue-500" size={16}/>
                                        </a>
                                    )}
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-400">
                                    {t.isTransfer ? <span className="flex items-center gap-2 text-blue-600 font-medium"><ArrowRightLeft size={14}/> Transferência</span> : getCategoryFullName(t.categoryId, categories)}
                                    {t.isSimulated && <span className="text-xs ml-2 text-yellow-700 dark:text-yellow-400 font-bold">[SIMULAÇÃO]</span>}
                                </td>
                                <td className={`p-4 font-bold text-right ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'revenue' ? '+' : '-'} {formatCurrency(t.amount)}</td>
                                <td className="p-4 font-mono text-right text-gray-700 dark:text-gray-300">{formatCurrency(t.runningBalance)}</td>
                                <td className="p-4">
                                    {!t.isSimulated && (
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleOpenModal(t)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                                            <button onClick={() => onDelete('transactions', t)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal isOpen={isSimulationModalOpen} onClose={() => setIsSimulationModalOpen(false)} title="Simular Lançamentos Futuros">
                <form onSubmit={handleStartSimulation} className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Selecione o período para incluir os lançamentos futuros no extrato.</p>
                    <div className="flex gap-4">
                        <label className="flex-1 text-gray-700 dark:text-gray-300">Data Inicial
                            <input type="date" name="start" value={simulationRange.start} onChange={handleSimRangeChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required />
                        </label>
                        <label className="flex-1 text-gray-700 dark:text-gray-300">Data Final
                            <input type="date" name="end" value={simulationRange.end} onChange={handleSimRangeChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required />
                        </label>
                    </div>
                    <div className="flex justify-end pt-4"><Button type="submit" className="bg-yellow-500 hover:bg-yellow-600">Simular</Button></div>
                </form>
            </Modal>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTransaction ? "Editar Transação" : "Nova Transação"}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex space-x-4">
                        <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Tipo</span><select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="expense">Despesa</option><option value="revenue">Receita</option><option value="transfer">Transferência</option></select></label>
                        <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Data</span><input type="date" name="date" value={formData.date} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    </div>

                    {formData.type === 'transfer' ? (
                        <>
                            <div className="flex space-x-4">
                               <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Conta de Origem</span><AccountSelector accounts={accounts} selectedAccountId={formData.sourceAccountId} onChange={handleChange} name="sourceAccountId" excludeId={formData.destinationAccountId} /></label>
                               <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Conta de Destino</span><AccountSelector accounts={accounts} selectedAccountId={formData.destinationAccountId} onChange={handleChange} name="destinationAccountId" excludeId={formData.sourceAccountId} /></label>
                            </div>
                             <div><label className="block"><span className="text-gray-700 dark:text-gray-300">Descrição (Opcional)</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" /></label></div>
                            <div><label className="block"><span className="text-gray-700 dark:text-gray-300">Valor (R$)</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="0.00" required /></label></div>
                        </>
                    ) : (
                        <>
                            <div><label className="block"><span className="text-gray-700 dark:text-gray-300">Descrição</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="Ex: Salário, Aluguer" required /></label></div>
                            <div className="flex space-x-4">
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Valor (R$)</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="0.00" required /></label>
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Conta</span><AccountSelector accounts={accounts} selectedAccountId={formData.accountId} onChange={handleChange} /></label>
                            </div>
                            <div className="flex space-x-4">
                                <label className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-gray-700 dark:text-gray-300">Favorecido</span>
                                        <button type="button" onClick={() => setIsAddPayeeModalOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1">
                                            <PlusCircle size={14}/> Novo
                                        </button>
                                    </div>
                                    <select name="payeeId" value={formData.payeeId} onChange={handleChange} className="block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                                        <option value="">Nenhum</option>
                                        {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </label>
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Categoria</span><select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required><option value="">Selecione...</option>{groupedCategories.map(parent => (<optgroup key={parent.id} label={parent.name}><option value={parent.id}>{parent.name} (Principal)</option>{parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</optgroup>))}</select></label>
                            </div>
                            <div>
                                <label className="block"><span className="text-gray-700 dark:text-gray-300">Anexar Comprovativo</span>
                                <input type="file" onChange={(e) => setAttachmentFile(e.target.files[0])} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                </label>
                                {formData.attachmentURL && !attachmentFile && <div className="text-xs mt-1">Anexo atual: <a href={formData.attachmentURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver anexo</a>. Selecione um novo ficheiro para o substituir.</div>}
                            </div>
                        </>
                    )}
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
            <Modal isOpen={isAddPayeeModalOpen} onClose={() => setIsAddPayeeModalOpen(false)} title="Novo Favorecido">
                <div className="space-y-4">
                    <label className="block">
                        <span className="text-gray-700 dark:text-gray-300">Nome do Favorecido</span>
                        <input type="text" value={newPayeeName} onChange={(e) => setNewPayeeName(e.target.value)} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" autoFocus />
                    </label>
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleAddPayee}>Salvar Favorecido</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---
export default function App() {
    const [view, setView] = useState('dashboard');
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

    const [companies, setCompanies] = useState([]);
    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [hubView, setHubView] = useState('selector'); // selector, reports, global_settings
    
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [payees, setPayees] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [futureEntries, setFutureEntries] = useState([]);
    
    const [allCompaniesData, setAllCompaniesData] = useState({});
    const [subscription, setSubscription] = useState(null);
    const isSubscribed = subscription?.status === 'active' || subscription?.status === 'trialing';
    
    // --- LÓGICA DE MIGRAÇÃO ---
    const [migrationStatus, setMigrationStatus] = useState('checking'); // checking, needed, not_needed
    const [isMigrating, setIsMigrating] = useState(false);
    const [backupConfig, setBackupConfig] = useState({ frequency: 'disabled', lastBackup: null });
    const [dashboardConfig, setDashboardConfig] = useState(null);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Autenticação e criação de trial
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const userId = currentUser.uid;

                // --- CHECK MIGRATION AND SUBSCRIPTION ---
                const profileRef = doc(db, `users/${userId}/profile`, 'userProfile');
                const subRef = doc(db, `users/${userId}/subscription`, 'current');
                
                const [profileSnap, subSnap] = await Promise.all([getDoc(profileRef), getDoc(subRef)]);

                // Setup subscription if it doesn't exist
                if (!subSnap.exists()) {
                    const trialEndDate = new Date();
                    trialEndDate.setDate(trialEndDate.getDate() + 360);
                    await setDoc(subRef, {
                        status: 'trialing',
                        trial_end: trialEndDate,
                        plan: 'PRO',
                    });
                }

                // Check for migration
                if (profileSnap.exists() && profileSnap.data().migrationCompleted) {
                    setMigrationStatus('not_needed');
                } else {
                    const oldTransactionsQuery = query(collection(db, `users/${userId}/transactions`), limit(1));
                    const oldTransactionsSnap = await getDocs(oldTransactionsQuery);
                    if (!oldTransactionsSnap.empty) {
                        setMigrationStatus('needed');
                    } else {
                        // New user or user with no old data, mark migration as complete
                        await setDoc(profileRef, { migrationCompleted: true, createdAt: new Date().toISOString() }, { merge: true });
                        setMigrationStatus('not_needed');
                    }
                }
                
            } else {
                setUser(null);
                setMigrationStatus('checking');
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);
    
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userId = user?.uid;
    
    // Listener da configuração de backup
    useEffect(() => {
        if (!userId) return;
        const backupConfigRef = doc(db, `users/${userId}/profile`, 'backupConfig');
        const unsub = onSnapshot(backupConfigRef, (doc) => {
            if (doc.exists()) {
                setBackupConfig(doc.data());
            } else {
                // If no config exists, create a default one
                setDoc(backupConfigRef, { frequency: 'disabled', lastBackup: null });
            }
        });
        return () => unsub();
    }, [userId]);
    
    // Listener da subscrição
    useEffect(() => {
        if (!userId) return;
        const subRef = doc(db, `users/${userId}/subscription`, 'current');
        const unsub = onSnapshot(subRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                // Verificar se o trial expirou
                if (data.status === 'trialing' && new Date() > data.trial_end.toDate()) {
                    setSubscription({ ...data, status: 'expired' });
                } else {
                    setSubscription(data);
                }
            }
        });
        return () => unsub();
    }, [userId]);

    // Carregar lista de empresas
    useEffect(() => {
        if (!isAuthReady || !userId || migrationStatus !== 'not_needed') {
            return;
        };
        
        const qCompanies = query(collection(db, `users/${userId}/companies`));
        const unsubCompanies = onSnapshot(qCompanies, async (snapshot) => {
            const companyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCompanies(companyList);
        });

        return () => {
            unsubCompanies();
        };
    }, [isAuthReady, userId, appId, migrationStatus]);

    // Carregar dados consolidados para relatórios
    useEffect(() => {
        if (companies.length === 0 || !isAuthReady || !userId) return;

        const fetchAllData = async () => {
            const data = {};
            for (const company of companies) {
                const basePath = `users/${userId}/companies/${company.id}`;
                const accountsQuery = query(collection(db, `${basePath}/accounts`));
                const transactionsQuery = query(collection(db, `${basePath}/transactions`));

                const [accountsSnap, transactionsSnap] = await Promise.all([
                    getDocs(accountsQuery),
                    getDocs(transactionsQuery)
                ]);
                
                const companyAccounts = accountsSnap.docs.map(d => d.data());
                const companyTransactions = transactionsSnap.docs.map(d => d.data());

                const revenue = companyTransactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
                const expense = companyTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                const balance = companyAccounts.reduce((s, a) => s + (a.initialBalance || 0), 0) + revenue - expense;

                data[company.id] = { revenue, expense, balance };
            }
            setAllCompaniesData(data);
        };

        fetchAllData();
    }, [companies, userId, appId, isAuthReady]);


    // Carregar dados da empresa ativa
    useEffect(() => {
        if (!activeCompanyId || !userId) {
            setAccounts([]); setPayees([]); setTransactions([]); setBudgets([]); setFutureEntries([]); setCategories([]);
            return;
        };
        const companyDataPath = `users/${userId}/companies/${activeCompanyId}`;
        const collections = { accounts: setAccounts, payees: setPayees, transactions: setTransactions, budgets: setBudgets, futureEntries: setFutureEntries, categories: setCategories };
        
        const unsubscribes = Object.entries(collections).map(([name, setter]) => {
            const q = query(collection(db, `${companyDataPath}/${name}`));
            return onSnapshot(q, (snapshot) => {
                let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (name === 'transactions') items.sort((a, b) => new Date(b.date) - new Date(a.date));
                setter(items);
            });
        });

        // Listener para configuração do Dashboard
        const configRef = doc(db, companyDataPath, 'profile/dashboardConfig');
        const unsubConfig = onSnapshot(configRef, (doc) => {
            if (doc.exists()) {
                setDashboardConfig(doc.data());
            } else {
                // Configuração Padrão
                const defaultConfig = {
                    showTotalBalance: true, showMonthlyRevenue: true, showMonthlyExpense: true,
                    showCashFlow: true, showProfitMargin: true, showCMV: false, showOperationalExpenses: false,
                    showAccountsPayable: true, showTaxes: false, showNext30DaysProjection: true,
                    showExpenseByCategory: true, showDueToday: true, showBudgetSummary: true,
                };
                setDoc(configRef, defaultConfig);
                setDashboardConfig(defaultConfig);
            }
        });
        unsubscribes.push(unsubConfig);

        return () => unsubscribes.forEach(unsub => unsub());
    }, [activeCompanyId, userId, appId]);

    const handleSave = async (collectionName, data, id, file = null) => {
        if (!userId) return;
        const isGlobal = ['companies'].includes(collectionName);
        const basePath = `users/${userId}`;
        let path = isGlobal ? `${basePath}/${collectionName}` : `${basePath}/companies/${activeCompanyId}/${collectionName}`;
        
        if (collectionName === 'transactions' && data.type === 'transfer') {
            const { sourceAccountId, destinationAccountId, amount, date, description, transferId: existingTransferId } = data;
            const transferId = existingTransferId || crypto.randomUUID();
            const batch = writeBatch(db);
            const fullPath = `${basePath}/companies/${activeCompanyId}/transactions`;

            if (existingTransferId) {
                const q = query(collection(db, fullPath), where("transferId", "==", existingTransferId));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => batch.delete(doc.ref));
            }

            // Saída da conta de origem
            const sourceAccountName = accounts.find(a => a.id === destinationAccountId)?.name || 'outra conta';
            const expenseData = {
                amount, date, description: `Transferência para ${sourceAccountName}${description ? ` - ${description}` : ''}`,
                type: 'expense', accountId: sourceAccountId, isTransfer: true, transferId
            };
            const expenseRef = doc(collection(db, fullPath));
            batch.set(expenseRef, expenseData);

            // Entrada na conta de destino
            const destAccountName = accounts.find(a => a.id === sourceAccountId)?.name || 'outra conta';
            const revenueData = {
                amount, date, description: `Transferência de ${destAccountName}${description ? ` - ${description}` : ''}`,
                type: 'revenue', accountId: destinationAccountId, isTransfer: true, transferId
            };
            const revenueRef = doc(collection(db, fullPath));
            batch.set(revenueRef, revenueData);
            
            await batch.commit();

        } else if (collectionName === 'transactions') {
            const docRef = id ? doc(db, path, id) : doc(collection(db, path));
            const docId = docRef.id;
            let attachmentURL = data.attachmentURL || null;

            if (file) {
                const storageRef = ref(storage, `attachments/${userId}/${activeCompanyId}/${docId}/${file.name}`);
                await uploadBytes(storageRef, file);
                attachmentURL = await getDownloadURL(storageRef);
            }
            
            const dataToSave = { ...data, attachmentURL };
            delete dataToSave.id; // Remover ID temporário se existir
            await setDoc(docRef, dataToSave);

        } else {
            const dataToSave = { ...data };
            if (dataToSave.parentId === null || dataToSave.parentId === '') delete dataToSave.parentId;
            if (dataToSave.categoryId === null || dataToSave.categoryId === '') delete dataToSave.categoryId;
            try {
                await (id ? setDoc(doc(db, path, id), dataToSave) : addDoc(collection(db, path), dataToSave));
            } catch (error) { console.error(`Error saving to ${collectionName}:`, error); }
        }
    };
    
    const handleDelete = async (collectionName, item) => {
        if (!userId || !window.confirm('Tem a certeza que deseja apagar este item? Esta ação não pode ser desfeita.')) return;

        const isGlobal = ['companies'].includes(collectionName);
        const basePath = `users/${userId}`;
        const path = isGlobal ? `${basePath}/${collectionName}` : `${basePath}/companies/${activeCompanyId}/${collectionName}`;
        const itemId = typeof item === 'string' ? item : item.id;


        if (collectionName === 'transactions' && item.isTransfer) {
            const batch = writeBatch(db);
            const q = query(collection(db, path), where("transferId", "==", item.transferId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        } else {
            if (collectionName === 'transactions' && item.attachmentURL) {
                try {
                    const storageRef = ref(storage, item.attachmentURL);
                    await deleteObject(storageRef);
                } catch (error) {
                    console.error("Error deleting attachment:", error);
                }
            }
            if (isGlobal && collectionName === 'companies' && itemId === activeCompanyId) setActiveCompanyId(null);
            try { await deleteDoc(doc(db, path, itemId)); } catch (error) { console.error(`Error deleting from ${collectionName}:`, error); }
        }
    };
    
    const handleBatchDeleteTransactions = async (transactionsToDelete) => {
        if (!userId || transactionsToDelete.length === 0) return;
        if (!window.confirm(`Tem a certeza que deseja apagar ${transactionsToDelete.length} transações? Esta ação não pode ser desfeita.`)) return;

        const path = `users/${userId}/companies/${activeCompanyId}/transactions`;
        const batch = writeBatch(db);
        const storageDeletePromises = [];
        const transferIdsProcessed = new Set(); 

        for (const item of transactionsToDelete) {
            if (item.attachmentURL) {
                try {
                    const storageRef = ref(storage, item.attachmentURL);
                    storageDeletePromises.push(deleteObject(storageRef));
                } catch (error) {
                    console.error("Error creating promise for attachment deletion:", error);
                }
            }

            if (item.isTransfer && item.transferId) {
                if (!transferIdsProcessed.has(item.transferId)) {
                    transferIdsProcessed.add(item.transferId);
                    const q = query(collection(db, path), where("transferId", "==", item.transferId));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach((doc) => {
                        batch.delete(doc.ref);
                    });
                }
            } else if (!item.isTransfer) {
                 batch.delete(doc(db, path, item.id));
            }
        }
        
        try {
            await Promise.all(storageDeletePromises);
            await batch.commit();
        } catch(error) {
            console.error("Erro ao apagar transações em lote:", error);
            alert("Ocorreu um erro ao apagar as transações.");
        }
    };

    const handleImportTransactions = async (transactionsToImport, accountId) => {
        if (!userId) return;
        const path = `users/${userId}/companies/${activeCompanyId}/transactions`;
        const batch = writeBatch(db);
        transactionsToImport.forEach(t => {
            const docRef = doc(collection(db, path));
            // Remove o id temporário usado para o React key
            const { id, ...transactionData } = t; 
            batch.set(docRef, { ...transactionData, accountId });
        });
        await batch.commit();
    };
    
    const handleReconcile = async (reconciliationData) => {
        if (!userId) return;
        const { id, finalAmount, paymentDate, accountId, notes, originalEntry } = reconciliationData;
        
        const batch = writeBatch(db);
        const companyPath = `users/${userId}/companies/${activeCompanyId}`;

        // 1. Criar a transação real
        const newTransaction = {
            description: originalEntry.description + (notes ? ` (${notes})` : ''),
            amount: finalAmount,
            date: new Date(paymentDate).toISOString(),
            type: originalEntry.type,
            accountId: accountId,
            categoryId: originalEntry.categoryId,
            payeeId: originalEntry.payeeId,
            isReconciled: true,
        };
        const transRef = doc(collection(db, `${companyPath}/transactions`));
        batch.set(transRef, newTransaction);

        // 2. Atualizar o lançamento futuro
        const entryRef = doc(db, `${companyPath}/futureEntries`, id);
        const updateData = {
            status: 'reconciled',
            reconciliation: {
                paymentDate: new Date(paymentDate).toISOString(),
                finalAmount: finalAmount,
                accountId: accountId,
                notes: notes,
                transactionId: transRef.id
            }
        };

        // Se for recorrente, calcular o próximo vencimento
        if (originalEntry.entryType === 'recorrente') {
            const nextDueDate = new Date(originalEntry.dueDate);
            switch (originalEntry.frequency) {
                case 'daily': nextDueDate.setDate(nextDueDate.getDate() + 1); break;
                case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + 7); break;
                case 'monthly': nextDueDate.setMonth(nextDueDate.getMonth() + 1); break;
                case 'yearly': nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); break;
                default: break;
            }
            updateData.dueDate = nextDueDate.toISOString();
            updateData.status = 'pending'; // Volta a ficar pendente para o próximo ciclo
        }
        
        batch.update(entryRef, updateData);

        try {
            await batch.commit();
        } catch(error) {
            console.error("Error during reconciliation:", error);
        }
    };

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    };

    const handleBackup = async () => {
        if (!userId) return;
        const userPath = `users/${userId}`;
        const backupData = {
            backupDate: new Date().toISOString(),
            data: {
                companies: []
            }
        };

        // Backup companies and their subcollections
        const companiesQuery = query(collection(db, `${userPath}/companies`));
        const companiesSnap = await getDocs(companiesQuery);
        for (const companyDoc of companiesSnap.docs) {
            const companyData = { id: companyDoc.id, ...companyDoc.data(), subcollections: {} };
            const subcollections = ['accounts', 'transactions', 'payees', 'budgets', 'futureEntries', 'categories'];
            for (const sub of subcollections) {
                const subQuery = query(collection(db, `${userPath}/companies/${companyDoc.id}/${sub}`));
                const subSnap = await getDocs(subQuery);
                companyData.subcollections[sub] = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            backupData.data.companies.push(companyData);
        }
        
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `financeiro_pro_backup_${new Date().toISOString().slice(0,10)}.json`;
        link.click();

        // Atualiza a data do último backup na configuração
        const backupConfigRef = doc(db, `users/${userId}/profile`, 'backupConfig');
        await setDoc(backupConfigRef, { lastBackup: new Date().toISOString() }, { merge: true });
    };

    const handleRestore = async (file) => {
        if (!userId) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backupData = JSON.parse(event.target.result);
                if (!backupData.data || !backupData.data.companies) {
                    throw new Error("Formato de backup inválido.");
                }

                const userPath = `users/${userId}`;
                
                // Delete all existing companies data
                const batch = writeBatch(db);
                const companiesQuery = query(collection(db, `${userPath}/companies`));
                const companiesSnap = await getDocs(companiesQuery);
                for(const docToDelete of companiesSnap.docs) {
                    const subcollections = ['accounts', 'transactions', 'payees', 'budgets', 'futureEntries', 'categories'];
                    for (const sub of subcollections) {
                        const subQuery = query(collection(db, `${userPath}/companies/${docToDelete.id}/${sub}`));
                        const subSnap = await getDocs(subQuery);
                        subSnap.forEach(subDoc => batch.delete(subDoc.ref));
                    }
                    batch.delete(docToDelete.ref);
                }
                await batch.commit();

                // Restore new data
                const restoreBatch = writeBatch(db);
                backupData.data.companies.forEach(comp => {
                    const { id, subcollections, ...data } = comp;
                    restoreBatch.set(doc(db, `${userPath}/companies`, id), data);
                    Object.keys(subcollections).forEach(subName => {
                        subcollections[subName].forEach(subDoc => {
                            const { id: subId, ...subData } = subDoc;
                            restoreBatch.set(doc(db, `${userPath}/companies/${id}/${subName}`, subId), subData);
                        });
                    });
                });

                await restoreBatch.commit();
                alert("Backup restaurado com sucesso!");
                window.location.reload();

            } catch (error) {
                console.error("Erro ao restaurar backup:", error);
                alert("Erro ao restaurar backup. Verifique o ficheiro e tente novamente.");
            }
        };
        reader.readAsText(file);
    };

    const handleMigration = async () => {
        if (!userId) return;
        setIsMigrating(true);
        try {
            const userPath = `users/${userId}`;
            
            const newCompanyRef = doc(collection(db, `${userPath}/companies`));
            await setDoc(newCompanyRef, { name: "Minha Empresa Principal (Migrada)", createdAt: new Date().toISOString() });
            
            // CORREÇÃO: Adicionada a coleção 'categories' à lista de migração.
            const collectionsToMigrate = ['accounts', 'transactions', 'payees', 'budgets', 'futureEntries', 'categories'];
            for (const collName of collectionsToMigrate) {
                const oldCollPath = `${userPath}/${collName}`;
                const newCollPath = `${userPath}/companies/${newCompanyRef.id}/${collName}`;
                
                const oldDocsSnap = await getDocs(collection(db, oldCollPath));
                if (!oldDocsSnap.empty) {
                    const batch = writeBatch(db);
                    oldDocsSnap.forEach(oldDoc => {
                        const newDocRef = doc(db, newCollPath, oldDoc.id);
                        batch.set(newDocRef, oldDoc.data());
                    });
                    await batch.commit();
                }
            }
            
            const profileRef = doc(db, `users/${userId}/profile`, 'userProfile');
            await setDoc(profileRef, { migrationCompleted: true }, { merge: true });

            alert("Os seus dados foram migrados com sucesso! A página será recarregada.");
            setMigrationStatus('not_needed');
            window.location.reload();

        } catch (error) {
            console.error("Erro durante a migração:", error);
            alert("Ocorreu um erro ao migrar os seus dados. Por favor, tente novamente.");
        } finally {
            setIsMigrating(false);
        }
    };

    const handleSaveBackupConfig = async (frequency) => {
        if (!userId) return;
        const backupConfigRef = doc(db, `users/${userId}/profile`, 'backupConfig');
        await setDoc(backupConfigRef, { frequency }, { merge: true });
    };

    const handleSaveDashboardConfig = async (newConfig) => {
        if (!userId || !activeCompanyId) return;
        const configRef = doc(db, `users/${userId}/companies/${activeCompanyId}/profile/dashboardConfig`);
        await setDoc(configRef, newConfig);
    };

    const handleSubscribeClick = async () => {
        const createSubscription = httpsCallable(functions, 'createSubscription');
        try {
            const result = await createSubscription();
            const { init_point } = result.data;
            window.location.href = init_point;
        } catch (error) {
            console.error("Erro ao criar a preferência de pagamento:", error);
            alert("Ocorreu um erro ao tentar iniciar a sua assinatura. Tente novamente mais tarde.");
        }
    };
    
    if (!isAuthReady) {
        return <LoadingScreen message="A autenticar..." />;
    }
    
    if (!user) {
        return <AuthView onGoogleSignIn={handleGoogleSignIn} />;
    }

    if (migrationStatus === 'checking') {
        return <LoadingScreen message="A verificar a sua conta..." />;
    }

    if (migrationStatus === 'needed') {
        return <MigrationScreen onMigrate={handleMigration} isMigrating={isMigrating} />;
    }

    if (!activeCompanyId) {
        switch (hubView) {
            case 'reports':
                return <ConsolidatedReportsView allCompaniesData={allCompaniesData} companies={companies} onBack={() => setHubView('selector')} />;
            case 'global_settings':
                return <GlobalSettingsView companies={companies} onSave={handleSave} onDelete={(coll, id) => handleDelete(coll, {id})} onBack={() => setHubView('selector')} onBackup={handleBackup} onRestore={handleRestore} subscription={subscription} onSubscribe={handleSubscribeClick} backupConfig={backupConfig} onSaveBackupConfig={handleSaveBackupConfig} />;
            case 'selector':
            default:
                return <HubScreen companies={companies} onSelect={setActiveCompanyId} onShowReports={() => setHubView('reports')} onManageCompanies={() => setHubView('global_settings')} />;
        }
    }

    const renderView = () => {
        const handleSaveWithCompanyId = (collection, data, id, file) => handleSave(collection, data, id, file);
        const handleDeleteWithCompanyId = (collection, item) => handleDelete(collection, item);
        const handleImportWithCompanyId = (importedTransactions, accountId) => handleImportTransactions(importedTransactions, accountId);
        const handleReconcileWithCompanyId = (reconciliationData) => handleReconcile(reconciliationData);

        const settingsSaveHandler = (collection, data, id) => {
             handleSave(collection, data, id);
        };

        const settingsDeleteHandler = (collection, id) => {
            handleDelete(collection, {id});
        };

        switch (view) {
            case 'dashboard': return <DashboardView {...{ transactions, accounts, categories, futureEntries, budgets, dashboardConfig }} onSaveConfig={handleSaveDashboardConfig} />;
            case 'transactions': return <TransactionsView transactions={transactions} accounts={accounts} categories={categories} payees={payees} futureEntries={futureEntries} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} onBatchDelete={handleBatchDeleteTransactions} />;
            // case 'reconciliation': return <ReconciliationView transactions={transactions} accounts={accounts} categories={categories} payees={payees} onSaveTransaction={handleSaveWithCompanyId} allTransactions={transactions} />;
            // case 'futureEntries': return <FutureEntriesView futureEntries={futureEntries} accounts={accounts} categories={categories} payees={payees} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} onReconcile={handleReconcileWithCompanyId} />;
            // case 'budgets': return <BudgetsView budgets={budgets} categories={categories} transactions={transactions} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} />;
            // case 'reports': return <ReportsView transactions={transactions} categories={categories} accounts={accounts} />;
            // case 'dre': return <DREView transactions={transactions} categories={categories} accounts={accounts} payees={payees} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} />;
            // case 'weeklyCashFlow': return <WeeklyCashFlowView futureEntries={futureEntries} categories={categories} />;
            case 'settings': return <SettingsView 
                onSaveEntity={settingsSaveHandler} 
                onDeleteEntity={settingsDeleteHandler}
                onImportTransactions={handleImportWithCompanyId} 
                {...{ accounts, payees, categories, allTransactions: transactions, activeCompanyId }} 
                />;
            case 'reconciliation': return <ReconciliationView transactions={transactions} accounts={accounts} categories={categories} payees={payees} onSaveTransaction={handleSaveWithCompanyId} allTransactions={transactions} />;
            case 'futureEntries': return <FutureEntriesView futureEntries={futureEntries} accounts={accounts} categories={categories} payees={payees} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} onReconcile={handleReconcileWithCompanyId} />;
            case 'budgets': return <BudgetsView budgets={budgets} categories={categories} transactions={transactions} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} />;
            case 'reports': return <ReportsView transactions={transactions} categories={categories} accounts={accounts} />;
            case 'dre': return <DREView transactions={transactions} categories={categories} accounts={accounts} payees={payees} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} />;
            case 'weeklyCashFlow': return <WeeklyCashFlowView futureEntries={futureEntries} categories={categories} />;
            default: return <DashboardView {...{ transactions, accounts, categories, futureEntries, budgets, dashboardConfig }} onSaveConfig={handleSaveDashboardConfig} />;
        }
    };

    const NavItem = ({ icon, label, active, onClick }) => (
        <button onClick={onClick} className={`flex items-center space-x-3 w-full text-left px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {icon}<span className="font-medium">{label}</span>
        </button>
    );
    
    const activeCompany = companies.find(c => c.id === activeCompanyId);
    
    const isTransactionsView = view === 'transactions';

    return (
        <div className={`flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans`}>
            <aside className="w-72 bg-white dark:bg-gray-800 p-6 flex-shrink-0 flex flex-col shadow-lg">
                <div className="flex-grow">
                    <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-4">Financeiro PRO</h1>
                    <div className="mb-8 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Empresa Ativa</p>
                        <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{activeCompany?.name}</p>
                        <button onClick={() => setActiveCompanyId(null)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">Trocar de empresa</button>
                    </div>
                    <nav className="space-y-2">
                        <NavItem icon={<LayoutDashboard />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                        <NavItem icon={<List />} label="Transações" active={view ==='transactions'} onClick={() => setView('transactions')} />
                        <NavItem icon={<CalendarClock />} label="Fluxo de Caixa Semanal" active={view === 'weeklyCashFlow'} onClick={() => setView('weeklyCashFlow')} />
                        <NavItem icon={<GitCompare />} label="Conciliação" active={view === 'reconciliation'} onClick={() => setView('reconciliation')} />
                        <NavItem icon={<CalendarCheck />} label="Lançamentos Futuros" active={view === 'futureEntries'} onClick={() => setView('futureEntries')} />
                        <NavItem icon={<Target />} label="Orçamentos" active={view === 'budgets'} onClick={() => setView('budgets')} />
                        <NavItem icon={<BarChart2 />} label="Relatórios" active={view === 'reports'} onClick={() => setView('reports')} />
                        <NavItem icon={<FileText />} label="DRE" active={view === 'dre'} onClick={() => setView('dre')} />
                        <NavItem icon={<Settings />} label="Configurações" active={view === 'settings'} onClick={() => setView('settings')} />
                    </nav>
                </div>
                <div className="pt-4 border-t dark:border-gray-700">
                    <button onClick={toggleTheme} className="flex items-center space-x-3 w-full text-left px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium">
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        <span>Mudar para tema {theme === 'light' ? 'Escuro' : 'Claro'}</span>
                    </button>
                     <button onClick={() => signOut(auth)} className="flex items-center space-x-3 w-full text-left px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium">
                        <LogOut size={20} />
                        <span>Terminar Sessão</span>
                    </button>
                </div>
            </aside>
            <main className={`flex-1 p-8 relative ${isTransactionsView ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {!isSubscribed && (
                    <div className="absolute inset-0 bg-black/70 z-40 flex flex-col justify-center items-center text-white p-8 text-center">
                        <AlertTriangle size={64} className="text-yellow-400 mb-4" />
                        <h2 className="text-3xl font-bold mb-2">O seu período de teste terminou!</h2>
                        <p className="text-lg mb-6">Para continuar a usar todas as funcionalidades, por favor, ative a sua assinatura.</p>
                        <Button onClick={() => { setActiveCompanyId(null); setHubView('global_settings'); }} className="bg-green-600 hover:bg-green-700">
                            <CreditCard size={20}/>
                            <span>Ver Plano de Assinatura</span>
                        </Button>
                    </div>
                )}
                <div className={`${isTransactionsView ? 'h-full' : ''} ${!isSubscribed ? 'blur-sm' : ''}`}>
                    {renderView()}
                </div>
            </main>
        </div>
    );
}