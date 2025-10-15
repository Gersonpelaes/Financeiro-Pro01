import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, writeBatch, query, onSnapshot, deleteDoc, setDoc, where, getDoc, limit, enableIndexedDbPersistence } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PlusCircle, Upload, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, Settings, LayoutDashboard, List, BarChart2, Target, ArrowLeft, ArrowRightLeft, Repeat, CheckCircle, AlertTriangle, Clock, CalendarCheck2, Building, GitCompareArrows, ArrowUp, ArrowDown, Paperclip, FileText, LogOut, Download, UploadCloud, Sun, Moon, FileOutput, CalendarClock, Menu, X, ShieldCheck, CreditCard, RefreshCw, BookCopy, FileJson, Wallet, Percent, Archive, Receipt, Landmark, AreaChart, WifiOff } from 'lucide-react';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
      apiKey: "AIzaSyAssnm4OKxyI_IMFijKcU1wKDf0iGEFYAw",
      authDomain: "meu-financeiro-novo.firebaseapp.com",
      projectId: "meu-financeiro-novo",
      storageBucket: "meu-financeiro-novo.appspot.com",
      messagingSenderId: "367341873139",
      appId: "1:367341873139:web:c2635398782348512132d4"
};

// --- INICIALIZAÇÃO DO FIREBASE E SERVIÇOS ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'southamerica-east1');
const storage = getStorage(app);

// HABILITAR PERSISTÊNCIA OFFLINE DO FIRESTORE
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firebase persistence failed: multiple tabs open.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firebase persistence failed: browser does not support it.');
  }
});


// --- COMPONENTES AUXILIARES ---
const Button = ({ children, onClick, className = 'bg-blue-600 hover:bg-blue-700', type = 'button', disabled = false }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center space-x-2 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

const LoadingScreen = ({ message = "A carregar..." }) => (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">{message}</p>
        </div>
    </div>
);

const StatCard = ({ title, value, icon, color }) => (
    <div className={`p-6 rounded-2xl shadow-lg text-white ${color}`}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-lg font-semibold">{title}</p>
                <p className="text-3xl font-bold">{value}</p>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-full">
                {icon}
            </div>
        </div>
    </div>
);

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{title}</h3>
                </div>
                <div className="p-6">{children}</div>
                <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-b-2xl flex justify-end gap-4">
                    <Button onClick={onClose} className="bg-gray-500 hover:bg-gray-600">Cancelar</Button>
                    <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">Confirmar</Button>
                </div>
            </div>
        </div>
    );
};

// --- FUNÇÕES UTILITÁRIAS ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const getCategoryFullName = (categoryId, categories) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'Sem Categoria';
    if (!category.parentId) return category.name;
    const parent = categories.find(c => c.id === category.parentId);
    return `${parent ? parent.name : ''} > ${category.name}`;
};

// --- COMPONENTES DAS VIEWS ---
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
        { key: 'showNext30DaysProjection', title: "Projeção 30 dias", value: formatCurrency(next30DaysProjection), icon: <AreaChart className="text-white" />, color: "bg-purple-500" },
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
    const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [formData, setFormData] = useState({});
    const [selectedTransactions, setSelectedTransactions] = useState(new Set());
    const [isPayeeModalOpen, setIsPayeeModalOpen] = useState(false);
    const [newlyAddedPayeeName, setNewlyAddedPayeeName] = useState('');
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationRange, setSimulationRange] = useState({ start: '', end: '' });
    const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);


    useEffect(() => {
        if (payees.length > 0 && newlyAddedPayeeName) {
            const newPayee = payees.find(p => p.name === newlyAddedPayeeName);
            if (newPayee) {
                setFormData(prev => ({ ...prev, payeeId: newPayee.id }));
                setNewlyAddedPayeeName('');
            }
        }
    }, [payees, newlyAddedPayeeName]);


    const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

    const filteredTransactions = useMemo(() => {
        if (!selectedAccountId) return [];
        // This logic is simplified; real transfers would involve two entries.
        // For display in a single account, we just filter by accountId.
        return transactions.filter(t => 
            t.accountId === selectedAccountId || // Regular transactions
            (t.isTransfer && (t.sourceAccountId === selectedAccountId || t.destinationAccountId === selectedAccountId)) // Transfers
        );
    }, [transactions, selectedAccountId]);

    const transactionsWithBalance = useMemo(() => {
        if (!selectedAccount) return [];

        let combinedTransactions = [...transactions.filter(t => t.accountId === selectedAccountId)];

        if (isSimulating && simulationRange.start && simulationRange.end) {
            const simStartDate = new Date(simulationRange.start + 'T00:00:00');
            const simEndDate = new Date(simulationRange.end + 'T23:59:59');

            const futureSimulations = futureEntries
                .filter(entry => {
                    const dueDate = new Date(entry.dueDate);
                    return entry.status !== 'reconciled' &&
                           entry.accountId === selectedAccountId &&
                           dueDate >= simStartDate &&
                           dueDate <= simEndDate;
                })
                .map(entry => ({
                    ...entry,
                    id: `sim-${entry.id}`, // Unique key for simulated entries
                    date: entry.dueDate, 
                    isSimulated: true,
                }));
            
            combinedTransactions.push(...futureSimulations);
        }

        combinedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        let runningBalance = selectedAccount.initialBalance || 0;
        
        const allAccountTransactions = transactions
            .filter(t => t.accountId === selectedAccountId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const balanceMap = new Map();
        allAccountTransactions.forEach(t => {
            const amount = t.type === 'revenue' ? t.amount : -t.amount;
            runningBalance += amount;
            balanceMap.set(t.id, runningBalance);
        });

        return combinedTransactions.map(t => ({
            ...t,
            runningBalance: balanceMap.get(t.id) || (t.isSimulated ? 'N/A' : selectedAccount.initialBalance) // Fallback for simulated
        }));
    }, [transactions, selectedAccount, isSimulating, simulationRange, futureEntries, selectedAccountId]);

    const currentBalance = useMemo(() => {
        if (!selectedAccount) return 0;
        return (selectedAccount.initialBalance || 0) + transactions
            .filter(t => t.accountId === selectedAccountId)
            .reduce((acc, t) => acc + (t.type === 'revenue' ? t.amount : -t.amount), 0);
    }, [transactions, selectedAccount]);

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
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleFileChange = (e) => {
        setAttachmentFile(e.target.files[0]);
    };
    
    const handleAddPayee = async () => {
        const payeeName = prompt("Nome do novo beneficiário:");
        if (payeeName) {
            setNewlyAddedPayeeName(payeeName);
            onSave('payees', { name: payeeName });
            setIsPayeeModalOpen(false);
        }
    };
    
    const handleOpenSimulationModal = () => {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        setSimulationRange({
            start: today.toISOString().slice(0, 10),
            end: nextMonth.toISOString().slice(0, 10)
        });
        setIsSimulationModalOpen(true);
    };

    const handleStartSimulation = (e) => {
        e.preventDefault();
        setIsSimulating(true);
        setIsSimulationModalOpen(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { ...formData, amount: parseFloat(formData.amount), date: new Date(formData.date).toISOString() };
        onSave('transactions', dataToSave, editingTransaction?.id, attachmentFile);
        handleCloseModal();
    };
    
    const availableCategories = useMemo(() => {
        if (formData.type === 'expense') return categories.filter(c => c.type === 'expense');
        if (formData.type === 'revenue') return categories.filter(c => c.type === 'revenue');
        return [];
    }, [categories, formData.type]);

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg h-full flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Extrato da Conta</h2>
                        <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="mt-2 p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
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
                                    checked={selectedTransactions.size > 0 && selectedTransactions.size === transactionsWithBalance.filter(t => !t.isSimulated).length}
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
                            <tr key={t.id} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${t.isSimulated ? 'text-yellow-500 italic' : ''} ${selectedTransactions.has(t.id) ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
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
                                <td className="p-4">{formatDate(t.date)}</td>
                                <td className="p-4">
                                    {t.description}
                                    {t.attachmentURL && <a href={t.attachmentURL} target="_blank" rel="noopener noreferrer"><Paperclip className="inline ml-2 text-gray-400" size={14} /></a>}
                                </td>
                                <td className="p-4">{getCategoryFullName(t.categoryId, categories)}</td>
                                <td className={`p-4 font-mono text-right ${t.type === 'revenue' ? 'text-green-500' : 'text-red-500'}`}>
                                    {t.type === 'revenue' ? '+' : '-'} {formatCurrency(t.amount)}
                                </td>
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
                    <label className="block">
                        <span className="text-gray-700 dark:text-gray-300">Data de Início</span>
                        <input type="date" value={simulationRange.start} onChange={e => setSimulationRange(prev => ({...prev, start: e.target.value}))} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" />
                    </label>
                     <label className="block">
                        <span className="text-gray-700 dark:text-gray-300">Data de Fim</span>
                        <input type="date" value={simulationRange.end} onChange={e => setSimulationRange(prev => ({...prev, end: e.target.value}))} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" />
                    </label>
                    <div className="flex justify-end pt-4">
                        <Button type="submit" className="bg-yellow-500 hover:bg-yellow-600">Iniciar Simulação</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTransaction ? "Editar Transação" : "Adicionar Transação"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex space-x-2">
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))} className={`w-full p-2 rounded-lg ${formData.type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Despesa</button>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, type: 'revenue' }))} className={`w-full p-2 rounded-lg ${formData.type === 'revenue' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Receita</button>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, type: 'transfer' }))} className={`w-full p-2 rounded-lg ${formData.type === 'transfer' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Transferência</button>
                    </div>

                    {formData.type === 'transfer' ? (
                        <>
                            <label className="block"><span className="text-gray-700 dark:text-gray-300">Da Conta</span>
                                <select name="sourceAccountId" value={formData.sourceAccountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </label>
                            <label className="block"><span className="text-gray-700 dark:text-gray-300">Para a Conta</span>
                                <select name="destinationAccountId" value={formData.destinationAccountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </label>
                        </>
                    ) : (
                        <>
                            <label className="block"><span className="text-gray-700 dark:text-gray-300">Conta</span>
                                <select name="accountId" value={formData.accountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </label>
                            <label className="block"><span className="text-gray-700 dark:text-gray-300">Categoria</span>
                                <select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>
                                    <option value="">Selecione...</option>
                                    {availableCategories.map(c => <option key={c.id} value={c.id}>{getCategoryFullName(c.id, categories)}</option>)}
                                </select>
                            </label>
                            <label className="block"><span className="text-gray-700 dark:text-gray-300">Beneficiário</span>
                                <div className="flex items-center space-x-2">
                                    <select name="payeeId" value={formData.payeeId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                                        <option value="">Selecione...</option>
                                        {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <button type="button" onClick={handleAddPayee} className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg"><PlusCircle /></button>
                                </div>
                            </label>
                        </>
                    )}

                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Valor</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Data</span><input type="date" name="date" value={formData.date} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Descrição</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="Opcional" /></label>
                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Anexo</span><input type="file" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></label>
                    
                    <div className="flex justify-end pt-4">
                        <Button type="submit">{editingTransaction ? 'Guardar Alterações' : 'Criar Transação'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};


const ReconciliationView = ({ transactions, accounts, categories, payees, onSaveTransaction, allTransactions }) => {
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [statementData, setStatementData] = useState([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    // Novos estados para o modal de transferência
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferData, setTransferData] = useState(null);
    
    const reconciliationResult = useMemo(() => {
        if (!selectedAccountId || statementData.length === 0) {
            return { matched: [], onlyInSystem: [], onlyInStatement: [] };
        }
        
        const systemTransactions = transactions.filter(t => t.accountId === selectedAccountId && !t.isTransfer);
        
        const matched = [];
        const onlyInStatement = [];
        
        for (const st of statementData) {
            const matchIndex = systemTransactions.findIndex(
                (tt) => tt.date.slice(0, 10) === st.date.slice(0, 10) && tt.amount === st.amount
            );
            if (matchIndex > -1) {
                matched.push({ ...st, systemTransaction: systemTransactions.splice(matchIndex, 1)[0] });
            } else {
                onlyInStatement.push(st);
            }
        }
        
        return { matched, onlyInStatement, onlyInSystem: systemTransactions };
    }, [selectedAccountId, statementData, transactions]);

    const handleImport = (importedData) => {
        setStatementData(importedData);
        setIsImportModalOpen(false);
    };

    const handleCreateTransaction = (statementItem) => {
        onSaveTransaction('transactions', {
            accountId: selectedAccountId,
            ...statementItem,
        });
        setStatementData(prev => prev.filter(t => t.id !== statementItem.id));
    };

    // Novas funções para gerir a criação de transferências
    const handleOpenTransferModal = (statementItem) => {
        setTransferData(statementItem);
        setIsTransferModalOpen(true);
    };

    const handleCreateTransfer = async (data) => {
        await onSaveTransaction('transactions', {
            ...data,
            type: 'transfer',
        });
        setStatementData(prev => prev.filter(t => t.id !== data.id));
        setIsTransferModalOpen(false);
    };

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">Conciliação Bancária</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Importe o seu extrato para comparar com os lançamentos do sistema.</p>
                <div className="flex items-center gap-4">
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300 flex-grow">
                        <option value="">Selecione uma conta...</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <Button onClick={() => setIsImportModalOpen(true)} disabled={!selectedAccountId}>
                        <Upload size={20}/>
                        <span>Importar Extrato</span>
                    </Button>
                </div>
            </div>

            {selectedAccountId && statementData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Matched */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-green-600 mb-4">Conciliados ({reconciliationResult.matched.length})</h3>
                        {reconciliationResult.matched.map(item => (
                            <div key={item.id} className="border-b dark:border-gray-700 p-2 opacity-60">
                                <p>{item.description} - {formatCurrency(item.amount)}</p>
                            </div>
                        ))}
                    </div>
                    {/* Only in Statement */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-blue-600 mb-4">Apenas no Extrato ({reconciliationResult.onlyInStatement.length})</h3>
                        {reconciliationResult.onlyInStatement.map(item => (
                            <div key={item.id} className="flex flex-wrap justify-between items-center border-b dark:border-gray-700 p-2 gap-2">
                                <p className="flex-grow">{item.description} - {formatCurrency(item.amount)} em {formatDate(item.date)}</p>
                                <div className="flex gap-2">
                                    <Button onClick={() => handleCreateTransaction(item)} className="bg-green-500 hover:bg-green-600 !py-1 !px-2 text-xs">Criar Lançamento</Button>
                                    <Button onClick={() => handleOpenTransferModal(item)} className="bg-blue-500 hover:bg-blue-600 !py-1 !px-2 text-xs">É uma Transferência</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Only in System */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-yellow-600 mb-4">Apenas no Sistema ({reconciliationResult.onlyInSystem.length})</h3>
                        {reconciliationResult.onlyInSystem.map(item => (
                             <div key={item.id} className="border-b dark:border-gray-700 p-2">
                                <p>{item.description} - {formatCurrency(item.amount)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <ImportStatementModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
                account={accounts.find(a => a.id === selectedAccountId)}
                categories={categories}
                payees={payees}
                allTransactions={allTransactions}
            />

            <ReconciliationTransferModal 
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                onSave={handleCreateTransfer}
                transferData={transferData}
                accounts={accounts}
                currentAccountId={selectedAccountId}
            />
        </div>
    );
};

// --- NOVO COMPONENTE: MODAL PARA CRIAR TRANSFERÊNCIA NA CONCILIAÇÃO ---
const ReconciliationTransferModal = ({ isOpen, onClose, onSave, transferData, accounts, currentAccountId }) => {
    const [formData, setFormData] = useState({ sourceAccountId: '', destinationAccountId: '' });

    useEffect(() => {
        if (transferData && isOpen) {
            const isExpense = transferData.type === 'expense';
            const otherAccountId = accounts.find(a => a.id !== currentAccountId)?.id || '';
            
            setFormData({
                sourceAccountId: isExpense ? currentAccountId : otherAccountId,
                destinationAccountId: !isExpense ? currentAccountId : otherAccountId,
            });
        }
    }, [transferData, accounts, currentAccountId, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.sourceAccountId === formData.destinationAccountId) {
            alert("A conta de origem e destino não podem ser a mesma.");
            return;
        }
        onSave({
            id: transferData.id,
            amount: transferData.amount,
            date: transferData.date,
            description: transferData.description,
            ...formData,
        });
    };

    if (!isOpen || !transferData) return null;
    
    const isExpense = transferData.type === 'expense';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Criar Transferência a partir do Extrato">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="font-bold">{transferData.description}</p>
                    <p>Data: {formatDate(transferData.date)} - Valor: {formatCurrency(transferData.amount)}</p>
                </div>
                
                <label className="block dark:text-gray-300">
                    <span className="text-gray-700 dark:text-gray-300">Conta de Origem</span>
                    <select 
                        name="sourceAccountId" 
                        value={formData.sourceAccountId} 
                        onChange={handleChange} 
                        disabled={isExpense}
                        className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                        required
                    >
                        {accounts.filter(a => a.id !== formData.destinationAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </label>

                <label className="block dark:text-gray-300">
                    <span className="text-gray-700 dark:text-gray-300">Conta de Destino</span>
                    <select 
                        name="destinationAccountId" 
                        value={formData.destinationAccountId} 
                        onChange={handleChange} 
                        disabled={!isExpense}
                        className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                        required
                    >
                        {accounts.filter(a => a.id !== formData.sourceAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </label>

                <div className="flex justify-end pt-4">
                    <Button type="submit">Confirmar Transferência</Button>
                </div>
            </form>
        </Modal>
    );
};

const BudgetsView = ({ budgets, categories, transactions, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ categoryId: '', amount: '', budgetType: 'fixed', percentage: '' });
    const [editingBudget, setEditingBudget] = useState(null);

    const handleOpenModal = (budget = null) => {
        if (budget) {
            setFormData(budget);
            setEditingBudget(budget);
        } else {
            setFormData({ categoryId: '', amount: '', budgetType: 'fixed', percentage: '' });
            setEditingBudget(null);
        }
        setIsModalOpen(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave('budgets', formData, editingBudget?.id);
        setIsModalOpen(false);
    };
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyTransactions = useMemo(() => transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= startOfMonth && tDate <= endOfMonth && !t.isTransfer && t.type === 'expense';
    }), [transactions, startOfMonth, endOfMonth]);
    
    const totalRevenue = useMemo(() => transactions
        .filter(t => t.type === 'revenue' && new Date(t.date) >= startOfMonth && new Date(t.date) <= endOfMonth)
        .reduce((sum, t) => sum + t.amount, 0), [transactions, startOfMonth, endOfMonth]);

    const budgetStatus = useMemo(() => {
        const expensesByCategory = {};
        for (const t of monthlyTransactions) {
            expensesByCategory[t.categoryId] = (expensesByCategory[t.categoryId] || 0) + t.amount;
            const category = categories.find(c => c.id === t.categoryId);
            if (category?.parentId) {
                expensesByCategory[category.parentId] = (expensesByCategory[category.parentId] || 0) + t.amount;
            }
        }

        return budgets.map(budget => {
            const spent = expensesByCategory[budget.categoryId] || 0;
            const budgetAmount = budget.budgetType === 'percentage' 
                ? (totalRevenue * (budget.percentage || 0)) / 100 
                : budget.amount;
            const remaining = budgetAmount - spent;
            const progress = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
            return { ...budget, spent, remaining, progress, budgetAmount };
        });
    }, [budgets, monthlyTransactions, categories, totalRevenue]);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Orçamentos</h2>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={20}/><span>Novo Orçamento</span></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgetStatus.map(b => (
                    <div key={b.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{getCategoryFullName(b.categoryId, categories)}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Orçamento: {formatCurrency(b.budgetAmount)} {b.budgetType === 'percentage' && `(${b.percentage}%)`}
                                </p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => handleOpenModal(b)} className="text-blue-500 hover:text-blue-700"><Edit size={18}/></button>
                                <button onClick={() => onDelete('budgets', b)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-300">
                                <span>Gasto: {formatCurrency(b.spent)}</span>
                                <span className={b.remaining < 0 ? 'text-red-500' : 'text-green-500'}>
                                    {b.remaining >= 0 ? `Sobra: ${formatCurrency(b.remaining)}` : `Excedido: ${formatCurrency(Math.abs(b.remaining))}`}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-2">
                                <div className={`h-3 rounded-full ${b.progress > 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(b.progress, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBudget ? "Editar Orçamento" : "Novo Orçamento"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Tipo de Orçamento</span>
                        <select name="budgetType" value={formData.budgetType} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                            <option value="fixed">Valor Fixo</option>
                            <option value="percentage">Percentagem da Receita</option>
                        </select>
                    </label>
                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Categoria</span>
                        <select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>
                            <option value="">Selecione...</option>
                            {categories.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.id}>{getCategoryFullName(c.id, categories)}</option>)}
                        </select>
                    </label>
                    {formData.budgetType === 'fixed' ? (
                        <label className="block"><span className="text-gray-700 dark:text-gray-300">Valor</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    ) : (
                        <label className="block"><span className="text-gray-700 dark:text-gray-300">Percentagem (%)</span><input type="number" step="0.01" name="percentage" value={formData.percentage} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    )}
                    <div className="flex justify-end pt-4"><Button type="submit">Guardar</Button></div>
                </form>
            </Modal>
        </div>
    );
};

const ReportsView = ({ transactions, categories }) => {
    const [reportType, setReportType] = useState('expense_by_category');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
    });

    const handleDateChange = (e) => {
        setDateRange(prev => ({...prev, [e.target.name]: e.target.value}));
    };

    const filteredData = useMemo(() => {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= start && tDate <= end;
        });
    }, [transactions, dateRange]);

    const chartData = useMemo(() => {
        if(reportType === 'expense_by_category') {
            const grouped = filteredData.filter(t => t.type === 'expense').reduce((acc, t) => {
                const categoryName = getCategoryFullName(t.categoryId, categories);
                acc[categoryName] = (acc[categoryName] || 0) + t.amount;
                return acc;
            }, {});
            return Object.entries(grouped).map(([name, value]) => ({name, value})).sort((a,b) => b.value - a.value);
        }
        if(reportType === 'revenue_vs_expense') {
            const dailyData = {};
            filteredData.forEach(t => {
                const day = t.date.slice(0,10);
                if(!dailyData[day]) dailyData[day] = {date: day, revenue: 0, expense: 0};
                if(t.type === 'revenue') dailyData[day].revenue += t.amount;
                if(t.type === 'expense') dailyData[day].expense += t.amount;
            });
            return Object.values(dailyData).sort((a,b) => new Date(a.date) - new Date(b.date));
        }
        return [];
    }, [filteredData, categories, reportType]);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Relatórios</h2>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="flex flex-wrap gap-4 items-center mb-6">
                    <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                        <option value="expense_by_category">Despesas por Categoria</option>
                        <option value="revenue_vs_expense">Receitas vs Despesas</option>
                    </select>
                    <input type="date" name="start" value={dateRange.start} onChange={handleDateChange} className="p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"/>
                    <input type="date" name="end" value={dateRange.end} onChange={handleDateChange} className="p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"/>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                    {reportType === 'expense_by_category' ? (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={formatCurrency}/>
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="value" fill="#ef4444" name="Despesa" />
                        </BarChart>
                    ) : (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)}/>
                            <YAxis tickFormatter={formatCurrency}/>
                            <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(d) => formatDate(d)}/>
                            <Legend />
                            <Line type="monotone" dataKey="revenue" stroke="#22c55e" name="Receita" />
                            <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Despesa" />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const FutureEntriesView = ({ futureEntries, accounts, categories, payees, onSave, onDelete, onReconcile }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [formData, setFormData] = useState({});

    const handleOpenModal = (entry = null) => {
        if (entry) {
            setFormData({ ...entry, dueDate: entry.dueDate.substring(0, 10) });
            setEditingEntry(entry);
        } else {
            setFormData({
                type: 'expense', status: 'pending', amount: '', description: '',
                dueDate: new Date().toISOString().substring(0, 10), accountId: '', categoryId: '', payeeId: ''
            });
            setEditingEntry(null);
        }
        setIsModalOpen(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave('futureEntries', { ...formData, amount: parseFloat(formData.amount), dueDate: new Date(formData.dueDate).toISOString() }, editingEntry?.id);
        setIsModalOpen(false);
    };

    const sortedEntries = useMemo(() => {
        return [...futureEntries].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }, [futureEntries]);
    
    const availableCategories = useMemo(() => {
        if (formData.type === 'expense') return categories.filter(c => c.type === 'expense');
        if (formData.type === 'revenue') return categories.filter(c => c.type === 'revenue');
        return [];
    }, [categories, formData.type]);
    
    const statusConfig = {
        pending: { label: 'Pendente', color: 'bg-yellow-500' },
        reconciled: { label: 'Conciliado', color: 'bg-green-500' },
        overdue: { label: 'Vencido', color: 'bg-red-500' },
    };
    
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Lançamentos Futuros</h2>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={20}/><span>Novo Lançamento</span></Button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                 <ul className="space-y-4">
                    {sortedEntries.map(entry => {
                        const isOverdue = new Date(entry.dueDate) < new Date() && entry.status === 'pending';
                        const status = isOverdue ? 'overdue' : entry.status;
                        return (
                            <li key={entry.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-wrap items-center justify-between gap-4">
                                <div className="flex-1 min-w-[200px]">
                                    <p className="font-bold text-gray-800 dark:text-gray-200">{entry.description}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{getCategoryFullName(entry.categoryId, categories)}</p>
                                </div>
                                <div className={`text-lg font-bold ${entry.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(entry.amount)}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <p>Vencimento: {formatDate(entry.dueDate)}</p>
                                    <p>Conta: {accounts.find(a => a.id === entry.accountId)?.name || 'N/A'}</p>
                                </div>
                                <div><span className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${statusConfig[status].color}`}>{statusConfig[status].label}</span></div>
                                <div className="flex items-center gap-2">
                                    {entry.status === 'pending' && <Button onClick={() => onReconcile(entry)} className="!py-1 !px-3 bg-green-500 hover:bg-green-600"><CheckCircle size={16}/><span>Conciliar</span></Button>}
                                    <button onClick={() => handleOpenModal(entry)} className="text-blue-500 hover:text-blue-700"><Edit size={18}/></button>
                                    <button onClick={() => onDelete('futureEntries', entry)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                                </div>
                            </li>
                        )
                    })}
                 </ul>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEntry ? "Editar Lançamento" : "Novo Lançamento"}>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex space-x-2">
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))} className={`w-full p-2 rounded-lg ${formData.type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Despesa</button>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, type: 'revenue' }))} className={`w-full p-2 rounded-lg ${formData.type === 'revenue' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Receita</button>
                    </div>
                     <label className="block"><span className="text-gray-700 dark:text-gray-300">Descrição</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                     <label className="block"><span className="text-gray-700 dark:text-gray-300">Valor</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                     <label className="block"><span className="text-gray-700 dark:text-gray-300">Data de Vencimento</span><input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                     <label className="block"><span className="text-gray-700 dark:text-gray-300">Conta</span><select name="accountId" value={formData.accountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                     <label className="block"><span className="text-gray-700 dark:text-gray-300">Categoria</span><select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required><option value="">Selecione...</option>{availableCategories.map(c => <option key={c.id} value={c.id}>{getCategoryFullName(c.id, categories)}</option>)}</select></label>
                     <label className="block"><span className="text-gray-700 dark:text-gray-300">Beneficiário</span><select name="payeeId" value={formData.payeeId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="">Selecione...</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                     <div className="flex justify-end pt-4"><Button type="submit">Guardar</Button></div>
                 </form>
            </Modal>
        </div>
    );
};

const SettingsView = ({ onSave, onDelete, accounts, payees, categories, activeCompanyId, backupConfig, onSaveBackupConfig, subscription, isSubscribed, onSubscribeClick, onManageSubscription, isManagingSubscription }) => {
    const [activeTab, setActiveTab] = useState('general');

    return (
        <div className="space-y-8">
             <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Configurações Gerais</h2>
             <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button onClick={() => setActiveTab('general')} className={`py-2 px-4 ${activeTab === 'general' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Geral</button>
                <button onClick={() => setActiveTab('backup')} className={`py-2 px-4 ${activeTab === 'backup' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Backup / Restauração</button>
                <button onClick={() => setActiveTab('subscription')} className={`py-2 px-4 ${activeTab === 'subscription' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Assinatura</button>
            </div>
            
            {activeTab === 'general' && <GeneralSettingsTab {...{ onSave, onDelete, accounts, payees, categories }} />}
            {activeTab === 'backup' && <BackupSettingsTab {...{ activeCompanyId, backupConfig, onSaveBackupConfig }} />}
            {activeTab === 'subscription' && <SubscriptionSettingsTab {...{ subscription, isSubscribed, onSubscribeClick, onManageSubscription, isManagingSubscription }} />}
        </div>
    );
};

const GeneralSettingsTab = ({ onSave, onDelete, accounts, payees, categories }) => {
    const [itemType, setItemType] = useState('accounts');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});

    const items = { accounts, payees, categories };
    const currentItems = items[itemType] || [];

    const handleOpenModal = (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormData(item);
        } else {
            const defaultData = { name: '' };
            if (itemType === 'accounts') defaultData.initialBalance = 0;
            if (itemType === 'categories') {
                defaultData.type = 'expense';
                defaultData.parentId = null;
            }
            setFormData(defaultData);
        }
        setIsModalOpen(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setFormData(prev => ({...prev, [name]: val}));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        let dataToSave = {...formData};
        if(itemType === 'accounts') dataToSave.initialBalance = parseFloat(dataToSave.initialBalance);
        onSave(itemType, dataToSave, editingItem?.id);
        setIsModalOpen(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <select value={itemType} onChange={(e) => setItemType(e.target.value)} className="p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                        <option value="accounts">Contas</option>
                        <option value="categories">Categorias</option>
                        <option value="payees">Beneficiários</option>
                    </select>
                </div>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={20}/><span>Adicionar Novo</span></Button>
            </div>
            
            <ul className="space-y-3">
                {currentItems.map(item => (
                    <li key={item.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                                {itemType === 'categories' ? getCategoryFullName(item.id, categories) : item.name}
                            </p>
                            {itemType === 'accounts' && <p className="text-sm text-gray-500 dark:text-gray-400">Saldo Inicial: {formatCurrency(item.initialBalance)}</p>}
                        </div>
                        <div className="flex space-x-2">
                            <button onClick={() => handleOpenModal(item)} className="text-blue-500 hover:text-blue-700"><Edit size={18}/></button>
                            <button onClick={() => onDelete(itemType, item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18}/></button>
                        </div>
                    </li>
                ))}
            </ul>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Editar ${itemType}`}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Nome</span><input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required/></label>
                    {itemType === 'accounts' && <label className="block"><span className="text-gray-700 dark:text-gray-300">Saldo Inicial</span><input type="number" step="0.01" name="initialBalance" value={formData.initialBalance} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required/></label>}
                    {itemType === 'categories' && (
                        <>
                            <label className="block"><span className="text-gray-700 dark:text-gray-300">Tipo</span>
                                <select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                                    <option value="expense">Despesa</option>
                                    <option value="revenue">Receita</option>
                                </select>
                            </label>
                             <label className="block"><span className="text-gray-700 dark:text-gray-300">Categoria Principal (Opcional)</span>
                                <select name="parentId" value={formData.parentId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                                    <option value="">Nenhuma</option>
                                    {categories.filter(c => !c.parentId && c.type === formData.type && c.id !== editingItem?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                    <div className="flex justify-end pt-4"><Button type="submit">Guardar</Button></div>
                </form>
            </Modal>
        </div>
    );
};

const BackupSettingsTab = ({ activeCompanyId, backupConfig, onSaveBackupConfig }) => {
    const handleExport = async () => {
        try {
            const getCompanyData = httpsCallable(functions, 'exportCompanyData');
            const result = await getCompanyData({ companyId: activeCompanyId });
            const dataStr = JSON.stringify(result.data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `backup-${activeCompanyId}-${new Date().toISOString().slice(0,10)}.json`;
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        } catch (error) {
            console.error("Erro ao exportar dados:", error);
            alert("Falha ao exportar dados. Verifique o console.");
        }
    };
    
    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const importCompanyData = httpsCallable(functions, 'importCompanyData');
                await importCompanyData({ companyId: activeCompanyId, data });
                alert("Dados importados com sucesso! A página será recarregada.");
                window.location.reload();
            } catch (error) {
                console.error("Erro ao importar dados:", error);
                alert("Falha ao importar dados. Verifique o console e o formato do ficheiro.");
            }
        };
        reader.readAsText(file);
    };
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg mt-4 space-y-6">
            <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Backup Manual</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Crie e descarregue um backup completo dos dados desta empresa.</p>
                <Button onClick={handleExport} className="mt-4 bg-green-600 hover:bg-green-700"><Download size={20}/><span>Criar Backup Agora</span></Button>
            </div>
             <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Restauração Manual</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Importe dados a partir de um ficheiro de backup. Atenção: isto irá substituir os dados existentes.</p>
                <input type="file" accept=".json" onChange={handleImport} className="mt-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
             <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Backup Automático</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure a frequência com que os backups automáticos são criados (simulado no carregamento da aplicação).</p>
                <div className="mt-4 flex items-center gap-4">
                     <select 
                        value={backupConfig?.frequency || 'disabled'} 
                        onChange={(e) => onSaveBackupConfig(e.target.value)} 
                        className="p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300"
                    >
                        <option value="disabled">Desativado</option>
                        <option value="daily">Diariamente</option>
                        <option value="weekly">Semanalmente</option>
                        <option value="monthly">Mensalmente</option>
                    </select>
                     {backupConfig?.lastBackup && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Último backup: {formatDate(backupConfig.lastBackup)}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const SubscriptionSettingsTab = ({ subscription, isSubscribed, onSubscribeClick, onManageSubscription, isManagingSubscription }) => {
    const status = subscription?.status;
    const trialEnd = subscription?.trial_end;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg mt-4 space-y-4">
            <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Estado da Assinatura</h3>
                {status === 'trialing' && (
                    <p className="text-green-600 font-semibold mt-1">
                        Período de teste ativo. Termina em: {formatDate(trialEnd?.toDate())}
                    </p>
                )}
                {isSubscribed && status !== 'trialing' && (
                    <p className="text-blue-600 font-semibold mt-1">Plano PRO Ativo</p>
                )}
                {!isSubscribed && status === 'ended' &&(
                     <p className="text-red-600 font-semibold mt-1">O seu período de teste terminou.</p>
                )}
            </div>
            {!isSubscribed ? (
                <div>
                     <p className="text-gray-600 dark:text-gray-400 mb-4">Atualize para o Plano PRO para continuar a usar todas as funcionalidades sem interrupções.</p>
                     <Button onClick={onSubscribeClick} className="bg-green-600 hover:bg-green-700">
                        <ShieldCheck size={20}/><span>Subscrever ao Plano PRO</span>
                    </Button>
                </div>
            ) : (
                 <div>
                     <p className="text-gray-600 dark:text-gray-400 mb-4">Pode gerir a sua assinatura, atualizar detalhes de pagamento ou cancelar a qualquer momento.</p>
                     <Button onClick={onManageSubscription} disabled={isManagingSubscription}>
                        {isManagingSubscription ? 'A carregar...' : 'Gerir Assinatura'}
                     </Button>
                </div>
            )}
        </div>
    );
};


const CompanySettingsView = ({ companyName, onSave, onDeleteCompany, onImportTransactions, accounts, payees, categories, allTransactions, activeCompanyId }) => {
    const [name, setName] = useState(companyName);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [confirmName, setConfirmName] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ name });
    };

    const handleDelete = () => {
        onDeleteCompany();
        setIsDeleteModalOpen(false);
    };

    const handleImport = (data) => {
        onImportTransactions(data);
        setIsImportModalOpen(false);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Configurações da Empresa</h2>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg space-y-6">
                <form onSubmit={handleSubmit}>
                    <label className="block text-gray-700 dark:text-gray-300 font-bold mb-2">Nome da Empresa</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"/>
                    <Button type="submit" className="mt-4">Guardar Nome</Button>
                </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg space-y-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Importar Transações em Lote</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Importe um extrato (OFX/QIF/CSV) para uma conta específica dentro desta empresa.</p>
                <Button onClick={() => setIsImportModalOpen(true)} className="bg-gray-600 hover:bg-gray-700">
                    <UploadCloud size={20}/>
                    <span>Importar Transações</span>
                </Button>
            </div>

            <div className="bg-red-50 dark:bg-gray-800 border-l-4 border-red-500 p-6 rounded-2xl shadow-lg">
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Zona de Perigo</h3>
                <p className="mt-2 text-sm text-red-600 dark:text-red-300">Apagar a sua empresa é uma ação permanente e não pode ser desfeita. Todos os dados associados serão perdidos.</p>
                <Button onClick={() => setIsDeleteModalOpen(true)} className="mt-4 bg-red-600 hover:bg-red-700">Apagar Empresa</Button>
            </div>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão">
                <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Para confirmar, digite o nome da empresa: <span className="font-bold">{companyName}</span></p>
                    <input type="text" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"/>
                    <div className="flex justify-end pt-4">
                        <Button onClick={handleDelete} disabled={confirmName !== companyName} className="bg-red-600 hover:bg-red-700">Confirmar e Apagar</Button>
                    </div>
                </div>
            </Modal>
            
            <ImportStatementModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
                account={null} // Pass null to allow account selection inside
                categories={categories}
                payees={payees}
                allTransactions={allTransactions}
                accountsForSelection={accounts}
            />
        </div>
    );
};


// --- COMPONENTE DE IMPORTAÇÃO DE EXTRATO (COM IA) ---
const ImportStatementModal = ({ isOpen, onClose, onImport, account, categories, payees, allTransactions, accountsForSelection }) => {
    const [file, setFile] = useState(null);
    const [statementData, setStatementData] = useState([]);
    const [step, setStep] = useState(1);
    const [selectedAccountId, setSelectedAccountId] = useState(account?.id || '');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');


    const handleCloseModalAndReset = () => {
        setFile(null);
        setStatementData([]);
        setStep(1);
        setSelectedAccountId(account?.id || '');
        onClose();
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            
            if (!account && (!accountsForSelection || accountsForSelection.length === 0)) {
                alert("Nenhuma conta disponível para importação.");
                return;
            }
            if (!account && !selectedAccountId) {
                alert("Por favor, selecione uma conta primeiro.");
                return;
            }

            const fileContent = await selectedFile.text();
            let parsedData = [];
            
            // Simple CSV parser (date, description, amount)
            if (selectedFile.name.endsWith('.csv')) {
                const rows = fileContent.split('\n').slice(1); // Skip header
                parsedData = rows.map((row, i) => {
                    const [date, description, amount] = row.split(',');
                    return { id: `csv-${i}`, date, description, amount: parseFloat(amount), type: parseFloat(amount) > 0 ? 'revenue' : 'expense' };
                }).filter(r => r.date && r.description && !isNaN(r.amount));
            } else {
                alert("Formato de ficheiro não suportado. Use CSV (date,description,amount).");
                return;
            }

            setStatementData(parsedData);
            setStep(2);
        }
    };

    const handleTransactionChange = (index, field, value) => {
        const updated = [...statementData];
        updated[index][field] = value;
        setStatementData(updated);
    };

    const handleFinalImport = () => {
        const transactionsToImport = statementData.map(t => ({
            ...t,
            accountId: selectedAccountId,
        }));
        onImport(transactionsToImport);
        handleCloseModalAndReset();
    };
    
    const runAiAnalysis = async (promptToRun) => {
        setIsAnalyzing(true);
        try {
            const geminiApiKey = typeof __gemini_api_key !== 'undefined' ? __gemini_api_key : '';
            if (!geminiApiKey) {
                alert("Chave da API Gemini não configurada.");
                setIsAnalyzing(false);
                return;
            }

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptToRun }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    "date": { "type": "STRING" },
                                    "description": { "type": "STRING" },
                                    "amount": { "type": "NUMBER" },
                                    "categoryName": { "type": "STRING" },
                                    "payeeName": { "type": "STRING" },
                                },
                                required: ["date", "description", "amount"]
                            }
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Erro na API:", errorBody);
                throw new Error(errorBody.error.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const jsonText = result.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(jsonText);

            const updatedStatement = statementData.map((original, index) => {
                const aiData = parsedJson[index];
                if (!aiData) return original;

                const category = categories.find(c => c.name === aiData.categoryName);
                const payee = payees.find(p => p.name === aiData.payeeName);

                return {
                    ...original,
                    categoryId: category ? category.id : null,
                    payeeId: payee ? payee.id : null,
                };
            });
            setStatementData(updatedStatement);
        } catch (error) {
            console.error("Falha ao formatar extrato com IA:", error);
            alert(`Ocorreu um erro ao usar a Análise Inteligente: ${error.message}. Tente novamente ou verifique o console.`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (statementData.length === 0) {
            alert("Não há dados de extrato para analisar.");
            return;
        }

        const prompt = `Formate o seguinte extrato bancário em um JSON. Para cada linha, identifique a data, descrição, e o valor (positivo para receita, negativo para despesa). Tente identificar uma categoria e um beneficiário (payee) a partir da descrição. As categorias possíveis são: ${JSON.stringify(categories.map(c => c.name))}. Os beneficiários possíveis são: ${JSON.stringify(payees.map(p => p.name))}. Se não conseguir identificar, use null. O JSON deve ser um array de objetos com as chaves: "date" (formato AAAA-MM-DD), "description", "amount", "categoryName", "payeeName". Extrato:\n\n${statementData.map(t => `${t.date} | ${t.description} | ${t.amount}`).join('\n')}`;
        
        setAiPrompt(prompt);
        
        const CHAR_LIMIT = 100000;
        if (prompt.length > CHAR_LIMIT) {
            setIsConfirmModalOpen(true);
        } else {
            await runAiAnalysis(prompt);
        }
    };
    
    return (
        <>
            <Modal isOpen={isOpen} onClose={handleCloseModalAndReset} title="Importar Extrato Bancário">
                {step === 1 && (
                    <div className="text-center">
                         {!account && (
                            <div className="mb-4 text-left">
                                 <label className="block text-gray-700 dark:text-gray-300 font-bold mb-2">Selecione a Conta de Destino</label>
                                 <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                                    <option value="">Selecione uma conta...</option>
                                    {accountsForSelection?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                            <UploadCloud className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-200">Selecione o ficheiro de extrato</h3>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Suporta ficheiros CSV (formato: data,descrição,valor).</p>
                        <div className="mt-4">
                            <input type="file" onChange={handleFileChange} accept=".csv" disabled={!selectedAccountId} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"/>
                        </div>
                    </div>
                )}
                {step === 2 && (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200 mb-4">Conciliar Transações Importadas</h3>
                        <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                            {statementData.map((transaction, index) => (
                                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <p className="col-span-2"><span className="font-bold">Descrição:</span> {transaction.description}</p>
                                        <p className="text-right font-bold">{formatCurrency(transaction.amount)}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <select value={transaction.categoryId || ''} onChange={(e) => handleTransactionChange(index, 'categoryId', e.target.value)} className="w-full p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-300">
                                            <option value="">Selecione a Categoria</option>
                                            {categories.filter(c=> c.type === (transaction.amount > 0 ? 'revenue' : 'expense')).map(c => <option key={c.id} value={c.id}>{getCategoryFullName(c.id, categories)}</option>)}
                                        </select>
                                        <select value={transaction.payeeId || ''} onChange={(e) => handleTransactionChange(index, 'payeeId', e.target.value)} className="w-full p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-300">
                                            <option value="">Selecione o Beneficiário</option>
                                            {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                         <div className="flex justify-end pt-4 gap-4">
                            <Button
                                onClick={handleAnalyzeWithAI}
                                disabled={isAnalyzing || statementData.length === 0}
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300"
                            >
                                <TrendingUp size={18} className="mr-2" />
                                {isAnalyzing ? 'A analisar...' : 'Análise Inteligente'}
                            </Button>
                            <Button onClick={handleFinalImport} disabled={statementData.some(t => !t.categoryId || !t.payeeId)}>
                                Importar {statementData.length} Transações
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={async () => {
                    setIsConfirmModalOpen(false);
                    await runAiAnalysis(aiPrompt);
                }}
                title="Confirmar Análise Grande"
            >
                <p className="text-gray-600 dark:text-gray-400">
                    A análise deste extrato é muito grande ({aiPrompt.length.toLocaleString('pt-BR')} caracteres) e pode gerar custos na API do Google. Deseja continuar?
                </p>
            </ConfirmationModal>
        </>
    );
};


// --- TELA DE LOGIN ---
const LoginScreen = ({ onLogin }) => {
    const handleSignIn = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            console.error("Erro no login com Google:", error);
        });
    };
    return (
        <div className="w-full h-screen flex justify-center items-center bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg text-center">
                <h2 className="text-3xl font-bold text-gray-800">Bem-vindo ao Financeiro PRO</h2>
                <p className="text-gray-600">Entre com a sua conta Google para continuar e aproveite 360 dias grátis.</p>
                <button
                    onClick={handleSignIn}
                    className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg shadow-sm transition-all transform hover:scale-105 hover:bg-gray-50"
                >
                    <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v8.51h12.8c-.57 3.02-2.31 5.45-4.92 7.18l7.98 6.19C45.27 38.91 48 32.16 48 24c0-.99-.08-1.95-.22-2.9z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.98-6.19c-2.11 1.45-4.82 2.31-7.91 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                    <span>Entrar com Google</span>
                </button>
            </div>
        </div>
    );
};


// --- HUB DE EMPRESAS ---
const CompanyHub = ({ userId, setActiveCompanyId, onCreateCompany, hubView, setHubView }) => {
    const [companies, setCompanies] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');

    useEffect(() => {
        const q = query(collection(db, `users/${userId}/companies`));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, [userId]);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onCreateCompany(newCompanyName);
        setIsModalOpen(false);
        setNewCompanyName('');
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex justify-center items-center p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Painel de Empresas</h1>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setHubView('global_settings')} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><Settings/></button>
                        <button onClick={() => signOut(auth)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><LogOut/></button>
                    </div>
                </div>

                {hubView === 'companies' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {companies.map(company => (
                                <div key={company.id} onClick={() => setActiveCompanyId(company.id)} className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
                                    <Building size={48} className="mx-auto text-gray-600 dark:text-gray-400 mb-4"/>
                                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{company.name}</h2>
                                </div>
                            ))}
                            <div onClick={() => setIsModalOpen(true)} className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 rounded-lg text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex flex-col justify-center items-center">
                                <PlusCircle size={48} className="text-gray-400 mb-4"/>
                                <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-400">Nova Empresa</h2>
                            </div>
                        </div>
                    </>
                )}

                {hubView === 'global_settings' && (
                    <div>
                        <button onClick={() => setHubView('companies')} className="mb-4 text-blue-500 hover:underline">Voltar</button>
                        <h2 className="text-2xl font-bold mb-4">Em Desenvolvimento</h2>
                        <p>Futuras configurações globais da conta aparecerão aqui.</p>
                    </div>
                )}
                
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Criar Nova Empresa">
                    <form onSubmit={handleSubmit}>
                        <label className="block text-gray-700 dark:text-gray-300 font-bold mb-2">Nome da Empresa</label>
                        <input type="text" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required />
                        <div className="flex justify-end pt-4"><Button type="submit">Criar</Button></div>
                    </form>
                </Modal>
            </div>
        </div>
    );
};

// --- PAINEL PRINCIPAL DA EMPRESA ---
const CompanyDashboard = ({ userId, activeCompanyId, setActiveCompanyId, isOnline }) => {
    const [view, setView] = useState('dashboard');
    const [accounts, setAccounts] = useState([]);
    const [payees, setPayees] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [futureEntries, setFutureEntries] = useState([]);
    const [categories, setCategories] = useState([]);
    const [companyName, setCompanyName] = useState('');
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [isManagingSubscription, setIsManagingSubscription] = useState(false);
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
    
    // Efeito para verificar o estado da subscrição e do perfil
    useEffect(() => {
        if (!userId) return;
        const profileRef = doc(db, `users/${userId}/profile/userProfile`);
        const subRef = doc(db, `users/${userId}/subscription/current`);

        const checkAndCreateProfile = async () => {
            try {
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
            } catch (error) {
                console.error("Erro ao verificar/criar perfil ou subscrição:", error);
            }
        };
        checkAndCreateProfile();
        
        const unsub = onSnapshot(subRef, (doc) => {
            if (doc.exists()) {
                const subData = doc.data();
                // Verificar se o período de teste expirou
                if(subData.status === 'trialing' && subData.trial_end.toDate() < new Date()) {
                    setSubscription({...subData, status: 'ended' });
                } else {
                    setSubscription(subData);
                }
            }
        });
        
        // Simulação de backup automático no carregamento
        const backupConfigRef = doc(db, `users/${userId}/profile/backupConfig`);
        const unsubBackup = onSnapshot(backupConfigRef, (docSnap) => {
            if (docSnap.exists()) {
                const config = docSnap.data();
                setBackupConfig(config);
                const { frequency, lastBackup } = config;
                if(frequency !== 'disabled' && lastBackup) {
                    const lastBackupDate = new Date(lastBackup);
                    const today = new Date();
                    let shouldBackup = false;
                    if(frequency === 'daily' && (today - lastBackupDate) / (1000*60*60*24) >= 1) shouldBackup = true;
                    if(frequency === 'weekly' && (today - lastBackupDate) / (1000*60*60*24) >= 7) shouldBackup = true;
                    if(frequency === 'monthly' && today.getMonth() !== lastBackupDate.getMonth()) shouldBackup = true;

                    if(shouldBackup) {
                        console.log(`BACKUP AUTOMÁTICO (${frequency}) ACIONADO.`);
                        // A lógica de exportação real seria chamada aqui.
                        // Por agora, apenas atualizamos a data do último backup.
                         setDoc(backupConfigRef, { lastBackup: new Date().toISOString() }, { merge: true });
                    }
                }
            } else {
                 setDoc(backupConfigRef, { frequency: 'disabled', lastBackup: null });
            }
        });

        return () => {
            unsub();
            unsubBackup();
        };
    }, [userId]);

    // Carregar dados da empresa ativa
    useEffect(() => {
        if (!activeCompanyId || !userId) {
            setAccounts([]); setPayees([]); setTransactions([]); setBudgets([]); setFutureEntries([]); setCategories([]);
            return;
        };
        const companyDataPath = `users/${userId}/companies/${activeCompanyId}`;
        const companyRef = doc(db, companyDataPath);
        
        getDoc(companyRef).then(doc => {
            if(doc.exists()) setCompanyName(doc.data().name);
        });

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
    }, [activeCompanyId, userId]);

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
            
            const finalData = { ...data, attachmentURL };
            delete finalData.id;

            if (id) {
                await setDoc(docRef, finalData, { merge: true });
            } else {
                await setDoc(docRef, finalData);
            }
        } else {
            const docRef = id ? doc(db, path, id) : doc(collection(db, path));
            const finalData = { ...data };
            delete finalData.id;
            if (id) {
                await setDoc(docRef, finalData, { merge: true });
            } else {
                await addDoc(collection(db, path), finalData);
            }
        }
    };
    
    const handleDelete = async (collectionName, item) => {
        if (!userId) return;
        const id = typeof item === 'string' ? item : item.id;
        const basePath = `users/${userId}/companies/${activeCompanyId}`;
        const path = `${basePath}/${collectionName}/${id}`;
        
        if (item.attachmentURL) {
            try {
                const fileRef = ref(storage, item.attachmentURL);
                await deleteObject(fileRef);
            } catch (error) {
                console.error("Erro ao apagar anexo, mas a transação será apagada:", error);
            }
        }

        if (item.isTransfer) {
            const transferId = item.transferId;
            const q = query(collection(db, `${basePath}/transactions`), where("transferId", "==", transferId));
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            querySnapshot.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        } else {
            await deleteDoc(doc(db, path));
        }
    };

    const handleBatchDeleteTransactions = async (transactionsToDelete) => {
        if (!userId) return;
        const batch = writeBatch(db);
        const basePath = `users/${userId}/companies/${activeCompanyId}/transactions`;

        transactionsToDelete.forEach(t => {
            if (t.isTransfer) {
                // A exclusão de transferências em lote é complexa, melhor apagar individualmente.
                // Por simplicidade, vamos chamar handleDelete para cada uma.
                handleDelete('transactions', t);
            } else {
                const docRef = doc(db, basePath, t.id);
                batch.delete(docRef);
            }
        });
        await batch.commit();
    };
    
    const handleReconcileFutureEntry = async (entry) => {
        const transactionData = {
            accountId: entry.accountId,
            categoryId: entry.categoryId,
            payeeId: entry.payeeId,
            amount: entry.amount,
            date: entry.dueDate,
            description: entry.description,
            type: entry.type
        };
        await handleSave('transactions', transactionData);
        await handleSave('futureEntries', { ...entry, status: 'reconciled' }, entry.id);
    };

    const handleSaveCompanyProfile = async (data) => {
        await setDoc(doc(db, `users/${userId}/companies/${activeCompanyId}`), data, { merge: true });
        setCompanyName(data.name);
    };

    const handleDeleteCompany = async () => {
        const deleteCompany = httpsCallable(functions, 'deleteCompany');
        try {
            await deleteCompany({ companyId: activeCompanyId });
            alert("Empresa apagada com sucesso.");
            setActiveCompanyId(null);
        } catch (error) {
            console.error("Erro ao apagar empresa:", error);
            alert("Falha ao apagar a empresa. Verifique o console.");
        }
    };
    
    const handleImportTransactions = async (dataToImport) => {
        const batch = writeBatch(db);
        const path = `users/${userId}/companies/${activeCompanyId}/transactions`;
        dataToImport.forEach(transaction => {
            const { id, ...data } = transaction; // Remove temp id
            const docRef = doc(collection(db, path));
            batch.set(docRef, data);
        });
        await batch.commit();
        alert(`${dataToImport.length} transações importadas com sucesso!`);
    };

    const handleMigrateData = async () => {
        setIsMigrating(true);
        try {
            const migrateToSubcollections = httpsCallable(functions, 'migrateToSubcollections');
            await migrateToSubcollections();
            alert("Migração concluída com sucesso! A página será recarregada.");
            window.location.reload();
        } catch(error) {
            console.error("Erro de migração:", error);
            alert("Ocorreu um erro ao migrar os seus dados. Por favor, tente novamente.");
        } finally {
            setIsMigrating(false);
        }
    };

    const handleSaveBackupConfig = async (frequency) => {
        if (!userId) return;
        const backupConfigRef = doc(db, `users/${userId}/profile/backupConfig`);
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
            window.location.href = result.data.url;
        } catch (error) {
            console.error("Erro ao criar subscrição:", error);
            alert("Não foi possível iniciar o processo de subscrição.");
        }
    };
    
    const handleManageSubscription = async () => {
        setIsManagingSubscription(true);
        const manageSubscription = httpsCallable(functions, 'manageSubscription');
        try {
            const result = await manageSubscription();
            window.location.href = result.data.url;
        } catch(error) {
            console.error("Erro ao gerir subscrição", error);
            alert("Não foi possível aceder ao portal de gestão.");
        } finally {
            setIsManagingSubscription(false);
        }
    };


    const renderView = () => {
        const AppContent = () => {
            const settingsSaveHandler = (collection, data, id) => {
                handleSave(collection, data, id);
            };
            const settingsDeleteHandler = (collection, id) => {
                handleDelete(collection, {id});
            };

            if (!isSubscribed && view !== 'settings') {
                return <SettingsView 
                    onSave={settingsSaveHandler}
                    onDelete={settingsDeleteHandler}
                    accounts={accounts}
                    payees={payees}
                    categories={categories}
                    activeCompanyId={activeCompanyId}
                    backupConfig={backupConfig}
                    onSaveBackupConfig={handleSaveBackupConfig}
                    subscription={subscription}
                    isSubscribed={isSubscribed}
                    onSubscribeClick={handleSubscribeClick}
                    onManageSubscription={handleManageSubscription}
                    isManagingSubscription={isManagingSubscription}
                />;
            }

            switch (view) {
                case 'dashboard': return <DashboardView {...{ transactions, accounts, categories, futureEntries, budgets, dashboardConfig }} onSaveConfig={handleSaveDashboardConfig} />;
                case 'transactions': return <TransactionsView transactions={transactions} accounts={accounts} categories={categories} payees={payees} futureEntries={futureEntries} onSave={handleSave} onDelete={handleDelete} onBatchDelete={handleBatchDeleteTransactions} />;
                case 'reconciliation': return <ReconciliationView transactions={transactions} accounts={accounts} categories={categories} payees={payees} onSaveTransaction={handleSave} allTransactions={transactions} />;
                case 'futureEntries': return <FutureEntriesView futureEntries={futureEntries} accounts={accounts} categories={categories} payees={payees} onSave={handleSave} onDelete={handleDelete} onReconcile={handleReconcileFutureEntry} />;
                case 'budgets': return <BudgetsView budgets={budgets} categories={categories} transactions={transactions} onSave={handleSave} onDelete={handleDelete} />;
                case 'reports': return <ReportsView transactions={transactions} categories={categories} />;
                case 'settings': return <SettingsView
                    onSave={settingsSaveHandler}
                    onDelete={settingsDeleteHandler}
                    accounts={accounts}
                    payees={payees}
                    categories={categories}
                    activeCompanyId={activeCompanyId}
                    backupConfig={backupConfig}
                    onSaveBackupConfig={handleSaveBackupConfig}
                    subscription={subscription}
                    isSubscribed={isSubscribed}
                    onSubscribeClick={handleSubscribeClick}
                    onManageSubscription={handleManageSubscription}
                    isManagingSubscription={isManagingSubscription}
                    />;
                case 'company_settings': return <CompanySettingsView 
                    companyName={companyName} 
                    onSave={handleSaveCompanyProfile} 
                    onDeleteCompany={handleDeleteCompany} 
                    onImportTransactions={handleImportTransactions} 
                    {...{ accounts, payees, categories, allTransactions: transactions, activeCompanyId }} 
                    />;
                default: return <DashboardView {...{ transactions, accounts, categories, futureEntries, budgets, dashboardConfig }} onSaveConfig={handleSaveDashboardConfig} />;
            }
        };

        return (
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
                <Sidebar
                    view={view}
                    setView={setView}
                    user={{ displayName: auth.currentUser?.displayName }}
                    onLogout={() => signOut(auth)}
                    companyName={companyName}
                    isSidebarOpen={isSidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    companies={allCompaniesData.companies}
                    activeCompanyId={activeCompanyId}
                    setActiveCompanyId={setActiveCompanyId}
                    onCreateCompany={() => {}}
                    theme={theme}
                    setTheme={setTheme}
                />
                <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} ${view === 'transactions' ? 'flex flex-col' : ''}`}>
                    <div className={`p-4 sm:p-6 lg:p-8 ${view === 'transactions' ? 'h-full flex-grow' : ''}`}>
                        <AppContent />
                    </div>
                </main>
            </div>
        );
    };

    return renderView();
};


const Sidebar = ({ view, setView, user, onLogout, companyName, isSidebarOpen, setSidebarOpen, companies, activeCompanyId, setActiveCompanyId, onCreateCompany, theme, setTheme }) => {
    
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'transactions', label: 'Transações', icon: List },
        { id: 'reconciliation', label: 'Conciliação', icon: GitCompareArrows },
        { id: 'futureEntries', label: 'Lanç. Futuros', icon: CalendarClock },
        { id: 'budgets', label: 'Orçamentos', icon: Target },
        { id: 'reports', label: 'Relatórios', icon: BarChart2 },
        { id: 'company_settings', label: 'Empresa', icon: Building },
        { id: 'settings', label: 'Geral', icon: Settings },
    ];

    return (
        <aside className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 shadow-xl z-30 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
            <div className="flex flex-col h-full">
                <div className={`p-4 border-b dark:border-gray-700 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                    {isSidebarOpen && <span className="font-bold text-xl text-gray-800 dark:text-gray-200">{companyName}</span>}
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        {isSidebarOpen ? <ArrowLeft /> : <Menu />}
                    </button>
                </div>
                
                <nav className="flex-1 py-4 space-y-2">
                    {navItems.map(item => <NavItem key={item.id} icon={<item.icon/>} label={item.label} active={view === item.id} onClick={() => setView(item.id)} isSidebarOpen={isSidebarOpen}/>)}
                </nav>
                
                <div className="p-4 border-t dark:border-gray-700">
                     <div className="flex items-center justify-center mb-4">
                        <button onClick={() => setTheme('light')} className={`p-2 rounded-l-lg ${theme === 'light' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}><Sun size={18}/></button>
                        <button onClick={() => setTheme('dark')} className={`p-2 rounded-r-lg ${theme === 'dark' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}><Moon size={18}/></button>
                    </div>
                    <div onClick={() => setActiveCompanyId(null)} className={`flex items-center p-2 rounded-lg cursor-pointer text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${!isSidebarOpen && 'justify-center'}`}>
                        <ArrowRightLeft />
                        {isSidebarOpen && <span className="ml-3">Trocar Empresa</span>}
                    </div>
                     <div onClick={onLogout} className={`flex items-center p-2 rounded-lg cursor-pointer text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mt-2 ${!isSidebarOpen && 'justify-center'}`}>
                        <LogOut />
                        {isSidebarOpen && <span className="ml-3">Sair</span>}
                    </div>
                </div>
            </div>
        </aside>
    );
}

const NavItem = ({ icon, label, active, onClick, isSidebarOpen }) => (
    <div
        onClick={onClick}
        className={`flex items-center mx-2 p-2 rounded-lg cursor-pointer transition-colors ${
            active
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        } ${!isSidebarOpen && 'justify-center'}`}
    >
        {icon}
        {isSidebarOpen && <span className="ml-3 font-medium">{label}</span>}
    </div>
);


// NOVO COMPONENTE: INDICADOR DE MODO OFFLINE
const OfflineIndicator = ({ isOnline }) => {
    if (isOnline) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white py-2 px-4 rounded-lg shadow-lg flex items-center z-50">
            <WifiOff size={20} className="mr-2" />
            <span>Você está offline. As alterações serão sincronizadas.</span>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const App = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeCompanyId, setActiveCompanyId] = useState(localStorage.getItem('activeCompanyId') || null);
    const [hubView, setHubView] = useState('companies'); // companies, global_settings
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
            if (!currentUser) {
                setActiveCompanyId(null);
                localStorage.removeItem('activeCompanyId');
                setHubView('companies');
            }
        });
        
        return () => {
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleSetActiveCompany = (id) => {
        if(id) {
            localStorage.setItem('activeCompanyId', id);
        } else {
            localStorage.removeItem('activeCompanyId');
        }
        setActiveCompanyId(id);
    };

    const handleCreateCompany = async (companyName) => {
        if (!user) return;
        const newCompanyRef = await addDoc(collection(db, `users/${user.uid}/companies`), { name: companyName, createdAt: new Date() });
        handleSetActiveCompany(newCompanyRef.id);
    };

    if (loading) return <LoadingScreen message="A carregar aplicação..." />;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {user ? (
                activeCompanyId ? (
                    <CompanyDashboard 
                        key={activeCompanyId}
                        userId={user.uid} 
                        activeCompanyId={activeCompanyId}
                        setActiveCompanyId={handleSetActiveCompany}
                        isOnline={isOnline}
                    />
                ) : (
                    <CompanyHub 
                        userId={user.uid} 
                        setActiveCompanyId={handleSetActiveCompany}
                        onCreateCompany={handleCreateCompany}
                        hubView={hubView}
                        setHubView={setHubView}
                    />
                )
            ) : (
                <LoginScreen onLogin={() => {
                    const provider = new GoogleAuthProvider();
                    signInWithPopup(auth, provider);
                }} />
            )}
            <OfflineIndicator isOnline={isOnline} />
        </div>
    );
};

export default App;

