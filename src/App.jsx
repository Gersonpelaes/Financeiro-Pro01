import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, writeBatch, query, onSnapshot, deleteDoc, setDoc, where, getDoc, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PlusCircle, Upload, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, Settings, LayoutDashboard, List, BarChart2, Target, ArrowLeft, ArrowRightLeft, Repeat, CheckCircle, AlertTriangle, Clock, CalendarCheck2, Building, GitCompareArrows, ArrowUp, ArrowDown, Paperclip, FileText, LogOut, Download, UploadCloud, Sun, Moon, FileOutput, CalendarClock, Menu, X, ShieldCheck, CreditCard, RefreshCw, BookCopy, FileJson } from 'lucide-react';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
      apiKey: "AIzaSyAssnm4OKxyI_IMFijKcU1wKDf0iGEFYAw",
      authDomain: "meu-finaceiro.firebaseapp.com",
      projectId: "meu-finaceiro",
      storageBucket: "meu-finaceiro.firebasestorage.app",
      messagingSenderId: "204846182105",
      appId: "1:204846182105:web:695589e7181040bf5958c8",
    };

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
            <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${sizeClass} p-8 m-4 transform transition-all`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
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
                <p className="text-gray-600">Entre com a sua conta Google para continuar e aproveite 30 dias grátis.</p>
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


// --- COMPONENTES DAS VIEWS ---
const DashboardView = ({ transactions, accounts, categories, futureEntries, budgets }) => {
    const totalBalance = useMemo(() =>
        accounts.reduce((acc, account) => acc + (account.initialBalance || 0), 0) +
        transactions.reduce((acc, t) => {
            if (t.type === 'revenue') return acc + t.amount;
            if (t.type === 'expense') return acc - t.amount;
            return acc;
        }, 0),
        [accounts, transactions]);

    const monthlyData = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions.filter(t => new Date(t.date) >= firstDayOfMonth && !t.isTransfer);
    }, [transactions]);

    const totalRevenue = useMemo(() => monthlyData.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0), [monthlyData]);
    const totalExpense = useMemo(() => monthlyData.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0), [monthlyData]);

    const expenseByCategory = useMemo(() => {
        const expenses = monthlyData.filter(t => t.type === 'expense');
        const grouped = expenses.reduce((acc, t) => {
            const categoryName = getCategoryFullName(t.categoryId, categories);
            acc[categoryName] = (acc[categoryName] || 0) + t.amount;
            return acc;
        }, {});
        return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [monthlyData, categories]);

    const dueToday = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        return futureEntries.filter(e => e.dueDate.slice(0, 10) === today && e.status !== 'reconciled');
    }, [futureEntries]);
    
    const budgetOverview = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthlyRevenue = transactions
            .filter(t => t.type === 'revenue' && !t.isTransfer && new Date(t.date) >= startOfMonth && new Date(t.date) <= endOfMonth)
            .reduce((sum, t) => sum + t.amount, 0);

        const expensesThisMonth = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth && new Date(t.date) <= endOfMonth && !t.isTransfer);
        
        const expensesByCat = {};
        for(const expense of expensesThisMonth) {
            expensesByCat[expense.categoryId] = (expensesByCat[expense.categoryId] || 0) + expense.amount;
            const category = categories.find(c => c.id === expense.categoryId);
            if(category?.parentId) {
                expensesByCat[category.parentId] = (expensesByCat[category.parentId] || 0) + expense.amount;
            }
        }
        
        let totalBudget = 0;
        let totalSpent = 0;

        budgets.forEach(b => {
            const budgetAmount = b.budgetType === 'percentage' ? (monthlyRevenue * (b.percentage || 0)) / 100 : b.amount;
            const spent = expensesByCat[b.categoryId] || 0;
            totalBudget += budgetAmount;
            totalSpent += spent;
        });

        const progress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        return { totalBudget, totalSpent, progress };
    }, [budgets, transactions, categories]);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Saldo Total" value={formatCurrency(totalBalance)} icon={<DollarSign className="text-white" />} color="bg-green-500" />
                <StatCard title="Receitas (Mês)" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="text-white" />} color="bg-blue-500" />
                <StatCard title="Despesas (Mês)" value={formatCurrency(totalExpense)} icon={<TrendingDown className="text-white" />} color="bg-red-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            </div>
        </div>
    );
};

const TransactionsView = ({ transactions, accounts, categories, payees, onSave, onDelete }) => {
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [formData, setFormData] = useState({});
    const [attachmentFile, setAttachmentFile] = useState(null);

    // Estados para o modal de adicionar favorecido
    const [isAddPayeeModalOpen, setIsAddPayeeModalOpen] = useState(false);
    const [newPayeeName, setNewPayeeName] = useState('');
    const [newlyAddedPayeeName, setNewlyAddedPayeeName] = useState(null);

    useEffect(() => {
        if (accounts.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts, selectedAccountId]);
    
    // Efeito para auto-selecionar o novo favorecido
    useEffect(() => {
        if (newlyAddedPayeeName && payees.length > 0) {
            const newPayee = payees.find(p => p.name === newlyAddedPayeeName);
            if (newPayee) {
                setFormData(prev => ({ ...prev, payeeId: newPayee.id }));
                setNewlyAddedPayeeName(null); // Reset after setting
            }
        }
    }, [payees, newlyAddedPayeeName]);


    const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

    const filteredTransactions = useMemo(() => {
        if (!selectedAccountId) return [];
        return transactions.filter(t => t.accountId === selectedAccountId);
    }, [transactions, selectedAccountId]);

    const transactionsWithBalance = useMemo(() => {
        if (!selectedAccount) return [];
        let runningBalance = selectedAccount.initialBalance || 0;
        const processed = filteredTransactions
            .slice()
            .reverse()
            .map(t => {
                const amount = t.type === 'revenue' ? t.amount : -t.amount;
                runningBalance += amount;
                return { ...t, runningBalance };
            });
        return processed.reverse();
    }, [filteredTransactions, selectedAccount]);

    const currentBalance = useMemo(() => {
        if (!selectedAccount) return 0;
        if (transactionsWithBalance.length === 0) return selectedAccount.initialBalance || 0;
        return transactionsWithBalance[0].runningBalance;
    }, [transactionsWithBalance, selectedAccount]);

    const handleOpenModal = (transaction = null) => {
        setAttachmentFile(null);
        if (transaction && !transaction.isTransfer) {
            setEditingTransaction(transaction);
            setFormData({ ...transaction, date: transaction.date.substring(0, 10) });
        } else {
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

    const groupedCategories = useMemo(() => {
        const type = formData.type || 'expense';
        const parents = categories.filter(c => !c.parentId && c.type === type);
        return parents.map(parent => ({
            ...parent,
            subcategories: categories.filter(sub => sub.parentId === parent.id)
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, formData.type]);

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Extrato da Conta</h2>
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="mt-2 p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div className="text-right">
                    <p className="text-gray-500 dark:text-gray-400">Saldo Atual</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(currentBalance)}</p>
                </div>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={20} /><span>Adicionar Transação</span></Button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead><tr className="border-b-2 border-gray-200 dark:border-gray-700"><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Categoria</th><th className="p-4 text-right">Valor</th><th className="p-4 text-right">Saldo</th><th className="p-4">Ações</th></tr></thead>
                    <tbody>
                        {transactionsWithBalance.map(t => (
                            <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 text-gray-600 dark:text-gray-400">{formatDate(t.date)}</td>
                                <td className="p-4 font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                    {t.description}
                                    {t.attachmentURL && (
                                        <a href={t.attachmentURL} target="_blank" rel="noopener noreferrer" title="Ver anexo">
                                            <Paperclip className="text-blue-500" size={16}/>
                                        </a>
                                    )}
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-400">{t.isTransfer ? <span className="flex items-center gap-2 text-blue-600 font-medium"><ArrowRightLeft size={14}/> Transferência</span> : getCategoryFullName(t.categoryId, categories)}</td>
                                <td className={`p-4 font-bold text-right ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'revenue' ? '+' : '-'} {formatCurrency(t.amount)}</td>
                                <td className="p-4 font-mono text-right text-gray-700 dark:text-gray-300">{formatCurrency(t.runningBalance)}</td>
                                <td className="p-4">
                                    <div className="flex space-x-2">
                                        {!t.isTransfer && <button onClick={() => handleOpenModal(t)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>}
                                        <button onClick={() => onDelete('transactions', t)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingTransaction ? "Editar Transação" : "Nova Transação"}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex space-x-4">
                        <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Tipo</span><select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="expense">Despesa</option><option value="revenue">Receita</option><option value="transfer">Transferência</option></select></label>
                        <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Data</span><input type="date" name="date" value={formData.date} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    </div>

                    {formData.type === 'transfer' ? (
                        <>
                            <div className="flex space-x-4">
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Conta de Origem</span><select name="sourceAccountId" value={formData.sourceAccountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Conta de Destino</span><select name="destinationAccountId" value={formData.destinationAccountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>{accounts.filter(a => a.id !== formData.sourceAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                            </div>
                             <div><label className="block"><span className="text-gray-700 dark:text-gray-300">Descrição (Opcional)</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" /></label></div>
                            <div><label className="block"><span className="text-gray-700 dark:text-gray-300">Valor (R$)</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="0.00" required /></label></div>
                        </>
                    ) : (
                        <>
                            <div><label className="block"><span className="text-gray-700 dark:text-gray-300">Descrição</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="Ex: Salário, Aluguer" required /></label></div>
                            <div className="flex space-x-4">
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Valor (R$)</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="0.00" required /></label>
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Conta</span><select name="accountId" value={formData.accountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
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

// --- VIEW DE RELATÓRIOS MELHORADA ---
const ReportsView = ({ transactions, categories, accounts }) => {
    const [compareMonths, setCompareMonths] = useState({
        month1: getYearMonth(new Date()),
        month2: getYearMonth(new Date(new Date().setMonth(new Date().getMonth() - 1))),
    });

    const handleCompareMonthChange = (e) => {
        setCompareMonths(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const netWorthData = useMemo(() => {
        if (transactions.length === 0 && accounts.length === 0) return [];
        
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        const initialBalance = accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
        
        const monthlyBalances = {};
        
        let currentBalance = initialBalance;
        for (const t of sortedTransactions) {
            const month = getYearMonth(new Date(t.date));
            if (!monthlyBalances[month]) {
                const prevMonthDate = new Date(`${month}-01T12:00:00.000Z`);
                prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
                const prevMonthKey = getYearMonth(prevMonthDate);
                monthlyBalances[month] = monthlyBalances[prevMonthKey] || currentBalance;
            }
            const amount = t.type === 'revenue' ? t.amount : -t.amount;
            currentBalance += amount;
            monthlyBalances[month] = currentBalance;
        }

        // Fill in missing months
        if (sortedTransactions.length > 0) {
            let currentDate = new Date(sortedTransactions[0].date);
            const lastDate = new Date();
            let lastBalance = initialBalance;
            while(currentDate <= lastDate) {
                const monthKey = getYearMonth(currentDate);
                if(monthlyBalances[monthKey]) {
                    lastBalance = monthlyBalances[monthKey];
                } else {
                    monthlyBalances[monthKey] = lastBalance;
                }
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        
        return Object.entries(monthlyBalances)
            .map(([month, balance]) => ({ month, balance }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [transactions, accounts]);

    const comparisonData = useMemo(() => {
        const { month1, month2 } = compareMonths;
        const getDataForMonth = (month) => {
            return transactions
                .filter(t => getYearMonth(new Date(t.date)) === month && t.type === 'expense')
                .reduce((acc, t) => {
                    const catName = getCategoryFullName(t.categoryId, categories);
                    acc[catName] = (acc[catName] || 0) + t.amount;
                    return acc;
                }, {});
        };

        const data1 = getDataForMonth(month1);
        const data2 = getDataForMonth(month2);
        const allKeys = [...new Set([...Object.keys(data1), ...Object.keys(data2)])];

        return allKeys.map(key => {
            const val1 = data1[key] || 0;
            const val2 = data2[key] || 0;
            const change = val1 - val2;
            const percentChange = val2 !== 0 ? (change / val2) * 100 : (val1 > 0 ? 100 : 0);
            return { category: key, value1: val1, value2: val2, change, percentChange };
        }).sort((a,b) => b.value1 - a.value1);
    }, [compareMonths, transactions, categories]);

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Evolução do Património Líquido</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={netWorthData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="balance" name="Património Líquido" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">Análise Comparativa de Despesas</h2>
                <div className="flex gap-4 mb-6 items-center flex-wrap">
                    <label className="dark:text-gray-300">Comparar: <input type="month" name="month1" value={compareMonths.month1} onChange={handleCompareMonthChange} className="p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" /></label>
                    <label className="dark:text-gray-300">Com: <input type="month" name="month2" value={compareMonths.month2} onChange={handleCompareMonthChange} className="p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" /></label>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b-2 dark:border-gray-700">
                                <th className="p-3">Categoria</th>
                                <th className="p-3 text-right">{compareMonths.month1}</th>
                                <th className="p-3 text-right">{compareMonths.month2}</th>
                                <th className="p-3 text-right">Variação (R$)</th>
                                <th className="p-3 text-right">Variação (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonData.map(item => (
                                <tr key={item.category} className="border-b dark:border-gray-700">
                                    <td className="p-3 font-medium">{item.category}</td>
                                    <td className="p-3 text-right">{formatCurrency(item.value1)}</td>
                                    <td className="p-3 text-right">{formatCurrency(item.value2)}</td>
                                    <td className="p-3 text-right">{formatCurrency(item.change)}</td>
                                    <td className={`p-3 text-right font-bold ${item.percentChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        <span className="flex items-center justify-end gap-1">
                                            {item.percentChange !== 0 && (item.percentChange > 0 ? <ArrowUp size={14}/> : <ArrowDown size={14}/>)}
                                            {item.percentChange.toFixed(2)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- VIEW DE CONCILIAÇÃO BANCÁRIA ---
const ReconciliationView = ({ transactions, accounts, categories, payees, onSaveTransaction, allTransactions }) => {
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [statementData, setStatementData] = useState([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    const reconciliationResult = useMemo(() => {
        if (!selectedAccountId || statementData.length === 0) {
            return { matched: [], onlyInStatement: [], onlyInSystem: [] };
        }

        const accountTransactions = transactions.filter(t => t.accountId === selectedAccountId && !t.reconciled);
        const statementTransactions = [...statementData];
        
        const matched = [];
        const onlyInSystem = [];

        for (const sysTrans of accountTransactions) {
            let foundMatch = false;
            for (let i = 0; i < statementTransactions.length; i++) {
                const statTrans = statementTransactions[i];
                const amountDiff = Math.abs(sysTrans.amount - Math.abs(statTrans.amount));
                const date1 = new Date(sysTrans.date);
                const date2 = new Date(statTrans.date);
                const timeDiff = Math.abs(date1.getTime() - date2.getTime());
                const dayDiff = timeDiff / (1000 * 3600 * 24);

                if (sysTrans.type === statTrans.type && amountDiff < 0.01 && dayDiff <= 3) {
                    matched.push({ system: sysTrans, statement: statTrans });
                    statementTransactions.splice(i, 1); // Remove matched item
                    foundMatch = true;
                    break;
                }
            }
            if (!foundMatch) {
                onlyInSystem.push(sysTrans);
            }
        }
        
        return { matched, onlyInStatement: statementTransactions, onlyInSystem };
    }, [selectedAccountId, statementData, transactions]);

    const handleImport = (parsedTransactions) => {
        setStatementData(parsedTransactions);
        setIsImportModalOpen(false);
    };

    const handleCreateTransaction = (statementItem) => {
        const newTransaction = {
            ...statementItem,
            accountId: selectedAccountId,
            reconciled: true,
        };
        onSaveTransaction('transactions', newTransaction);
        // Remove from list after creating
        setStatementData(prev => prev.filter(t => t.id !== statementItem.id));
    };

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">Conciliação Bancária</h2>
                <div className="flex gap-4 items-center">
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="p-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-300 flex-grow">
                        <option value="">Selecione uma conta...</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <Button onClick={() => setIsImportModalOpen(true)} disabled={!selectedAccountId}>
                        <Upload size={18}/> Importar Extrato
                    </Button>
                </div>
            </div>

            {selectedAccountId && statementData.length > 0 && (
                <div className="space-y-6">
                    {/* Matched Transactions */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-green-600 mb-4">Correspondências Sugeridas ({reconciliationResult.matched.length})</h3>
                        {reconciliationResult.matched.map(pair => (
                            <div key={pair.system.id} className="grid grid-cols-2 gap-4 border-b dark:border-gray-700 p-2">
                                <div><p><strong>Sistema:</strong> {pair.system.description} - {formatCurrency(pair.system.amount)} em {formatDate(pair.system.date)}</p></div>
                                <div><p><strong>Extrato:</strong> {pair.statement.description} - {formatCurrency(pair.statement.amount)} em {formatDate(pair.statement.date)}</p></div>
                            </div>
                        ))}
                    </div>
                    {/* Only in Statement */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-blue-600 mb-4">Apenas no Extrato ({reconciliationResult.onlyInStatement.length})</h3>
                        {reconciliationResult.onlyInStatement.map(item => (
                            <div key={item.id} className="flex justify-between items-center border-b dark:border-gray-700 p-2">
                                <p>{item.description} - {formatCurrency(item.amount)} em {formatDate(item.date)}</p>
                                <Button onClick={() => handleCreateTransaction(item)} className="bg-green-500 hover:bg-green-600 !py-1 !px-2">Criar no Sistema</Button>
                            </div>
                        ))}
                    </div>
                    {/* Only in System */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-yellow-600 mb-4">Apenas no Sistema ({reconciliationResult.onlyInSystem.length})</h3>
                        {reconciliationResult.onlyInSystem.map(item => (
                            <div key={item.id} className="border-b dark:border-gray-700 p-2">
                                <p>{item.description} - {formatCurrency(item.amount)} em {formatDate(item.date)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <TransactionImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
                account={accounts.find(a => a.id === selectedAccountId)}
                categories={categories}
                payees={payees}
                allTransactions={allTransactions}
            />
        </div>
    );
};

const BudgetsView = ({ budgets, categories, transactions, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ categoryId: '', amount: '', budgetType: 'fixed', percentage: '' });

    const monthlyRevenue = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return transactions
            .filter(t => t.type === 'revenue' && !t.isTransfer && new Date(t.date) >= startOfMonth && new Date(t.date) <= endOfMonth)
            .reduce((sum, t) => sum + t.amount, 0);
    }, [transactions]);

    const handleOpenModal = () => {
        setFormData({ categoryId: categories.filter(c => c.type === 'expense')[0]?.id || '', amount: '', budgetType: 'fixed', percentage: '' });
        setIsModalOpen(true);
    };
    const handleCloseModal = () => setIsModalOpen(false);
    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = {
            categoryId: formData.categoryId,
            budgetType: formData.budgetType,
            amount: formData.budgetType === 'fixed' ? parseFloat(formData.amount || 0) : 0,
            percentage: formData.budgetType === 'percentage' ? parseFloat(formData.percentage || 0) : 0,
        };
        onSave('budgets', dataToSave);
        handleCloseModal();
    };

    const monthlyExpenses = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const expensesThisMonth = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= startOfMonth && new Date(t.date) <= endOfMonth && !t.isTransfer);
        
        const expensesByCat = {};
        for(const expense of expensesThisMonth) {
            expensesByCat[expense.categoryId] = (expensesByCat[expense.categoryId] || 0) + expense.amount;
            const category = categories.find(c => c.id === expense.categoryId);
            if(category?.parentId) {
                expensesByCat[category.parentId] = (expensesByCat[category.parentId] || 0) + expense.amount;
            }
        }
        return expensesByCat;
    }, [transactions, categories]);

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Orçamentos Mensais</h2>
                <Button onClick={handleOpenModal}><PlusCircle size={20} /><span>Novo Orçamento</span></Button>
            </div>
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
                <p className="text-sm text-blue-700 dark:text-blue-300">Faturamento do mês atual (para cálculo de %): <span className="font-bold">{formatCurrency(monthlyRevenue)}</span></p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgets.map(b => {
                    const spent = monthlyExpenses[b.categoryId] || 0;
                    const category = categories.find(c => c.id === b.categoryId);
                    const budgetAmount = b.budgetType === 'percentage' ? (monthlyRevenue * (b.percentage || 0)) / 100 : b.amount;
                    const progress = budgetAmount > 0 ? Math.min((spent / budgetAmount) * 100, 100) : 0;
                    const isOverBudget = spent > budgetAmount;
                    return (
                        <div key={b.id} className="border dark:border-gray-700 p-4 rounded-lg shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-lg">{category?.name || 'Categoria Removida'}</span>
                                <button onClick={() => onDelete('budgets', b.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                            </div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className={isOverBudget ? 'text-red-600 font-bold' : 'text-gray-600 dark:text-gray-400'}>Gasto: {formatCurrency(spent)}</span>
                                <span className="text-gray-600 dark:text-gray-400">Orçamento: {formatCurrency(budgetAmount)} {b.budgetType === 'percentage' && `(${b.percentage}%)`}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div className={`h-4 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div></div>
                        </div>
                    );
                })}
                 {budgets.length === 0 && <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-8">Nenhum orçamento definido.</p>}
            </div>
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Novo Orçamento">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="dark:text-gray-300">Categoria de Despesa<select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">{categories.filter(c => c.type === 'expense' && !budgets.find(b => b.categoryId === c.id)).map(c => <option key={c.id} value={c.id}>{getCategoryFullName(c.id, categories)}</option>)}</select></label>
                    <label className="dark:text-gray-300">Tipo de Orçamento
                        <select name="budgetType" value={formData.budgetType} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                            <option value="fixed">Valor Fixo</option>
                            <option value="percentage">Percentual do Faturamento</option>
                        </select>
                    </label>
                    {formData.budgetType === 'fixed' ? (
                        <label className="dark:text-gray-300">Valor do Orçamento (R$)<input type="number" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="500.00" required /></label>
                    ) : (
                        <label className="dark:text-gray-300">Percentual do Faturamento (%)<input type="number" name="percentage" value={formData.percentage} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="30" required /></label>
                    )}
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
        </div>
    );
};

const FutureEntriesView = ({ futureEntries, accounts, categories, payees, onSave, onDelete, onReconcile }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [entryToReconcile, setEntryToReconcile] = useState(null);
    const [formData, setFormData] = useState({});
    const [reconcileFormData, setReconcileFormData] = useState({});
    const [filter, setFilter] = useState('a_vencer'); // a_vencer, vencidos, reconciliados
    
    // Estados para o modal de adicionar favorecido
    const [isAddPayeeModalOpen, setIsAddPayeeModalOpen] = useState(false);
    const [newPayeeName, setNewPayeeName] = useState('');
    const [newlyAddedPayeeName, setNewlyAddedPayeeName] = useState(null);
    
    // Efeito para auto-selecionar o novo favorecido
    useEffect(() => {
        if (newlyAddedPayeeName && payees.length > 0) {
            const newPayee = payees.find(p => p.name === newlyAddedPayeeName);
            if (newPayee) {
                setFormData(prev => ({ ...prev, payeeId: newPayee.id }));
                setNewlyAddedPayeeName(null);
            }
        }
    }, [payees, newlyAddedPayeeName]);


    const handleOpenModal = (entry = null) => {
        setEditingEntry(entry);
        if (entry) {
            setFormData({ ...entry, dueDate: entry.dueDate.substring(0, 10) });
        } else {
            setFormData({
                description: '', amount: '', type: 'expense', dueDate: new Date().toISOString().substring(0, 10),
                entryType: 'unico', frequency: 'monthly', categoryId: '', payeeId: ''
            });
        }
        setIsModalOpen(true);
    };
    const handleCloseModal = () => setIsModalOpen(false);

    const handleOpenReconcileModal = (entry) => {
        setEntryToReconcile(entry);
        setReconcileFormData({
            id: entry.id,
            finalAmount: entry.amount,
            paymentDate: new Date().toISOString().substring(0, 10),
            accountId: accounts[0]?.id || '',
            notes: '',
            originalEntry: entry,
        });
        setIsReconcileModalOpen(true);
    };
    const handleCloseReconcileModal = () => setIsReconcileModalOpen(false);

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
    const handleReconcileChange = (e) => setReconcileFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { ...formData, amount: parseFloat(formData.amount), dueDate: new Date(formData.dueDate).toISOString() };
        if (dataToSave.entryType === 'unico') delete dataToSave.frequency;
        onSave('futureEntries', dataToSave, editingEntry?.id);
        handleCloseModal();
    };

    const handleReconcileSubmit = (e) => {
        e.preventDefault();
        onReconcile({ ...reconcileFormData, finalAmount: parseFloat(reconcileFormData.finalAmount) });
        handleCloseReconcileModal();
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

    const groupedCategories = useMemo(() => {
        const type = formData.type || 'expense';
        const parents = categories.filter(c => !c.parentId && c.type === type);
        return parents.map(parent => ({ ...parent, subcategories: categories.filter(sub => sub.parentId === parent.id) })).sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, formData.type]);
    
    const filteredEntries = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return futureEntries.filter(entry => {
            if (filter === 'reconciliados') return entry.status === 'reconciled';
            if (entry.status === 'reconciled') return false;

            const dueDate = new Date(entry.dueDate);
            if (filter === 'vencidos') return dueDate < today;
            if (filter === 'a_vencer') return dueDate >= today;
            return true;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }, [futureEntries, filter]);

    const FilterButton = ({ a_filter, label, count }) => (
        <button onClick={() => setFilter(a_filter)} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filter === a_filter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
            {label} <span className="text-xs bg-white/20 rounded-full px-2 py-1">{count}</span>
        </button>
    );

    const getStatusBadge = (entry) => {
        if (entry.status === 'reconciled') return <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full"><CheckCircle size={14}/> Reconciliado</span>;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dueDate = new Date(entry.dueDate);
        if (dueDate < today) return <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full"><AlertTriangle size={14}/> Vencido</span>;
        return <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full"><Clock size={14}/> A Vencer</span>;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Lançamentos Futuros</h2>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={20} /><span>Novo Lançamento</span></Button>
            </div>

            <div className="flex space-x-2 mb-6 border-b dark:border-gray-700 pb-4">
                <FilterButton a_filter="a_vencer" label="A Vencer" count={futureEntries.filter(e => e.status !== 'reconciled' && new Date(e.dueDate) >= new Date()).length} />
                <FilterButton a_filter="vencidos" label="Vencidos" count={futureEntries.filter(e => e.status !== 'reconciled' && new Date(e.dueDate) < new Date()).length} />
                <FilterButton a_filter="reconciliados" label="Reconciliados" count={futureEntries.filter(e => e.status === 'reconciled').length} />
            </div>

            <div className="space-y-4">
                {filteredEntries.map(entry => (
                    <div key={entry.id} className="p-4 border dark:border-gray-700 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex-1">
                            <div className="flex items-center gap-4">
                                {getStatusBadge(entry)}
                                <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{entry.description}</p>
                            </div>
                            <div className="flex items-center gap-6 mt-2 text-sm text-gray-600 dark:text-gray-400">
                                <span>Vencimento: <strong>{formatDate(entry.dueDate)}</strong></span>
                                <span>Valor: <strong className={entry.type === 'revenue' ? 'text-green-600' : 'text-red-600'}>{formatCurrency(entry.amount)}</strong></span>
                                {entry.entryType !== 'unico' && <span className="capitalize flex items-center gap-1"><Repeat size={14}/> {entry.frequency}</span>}
                            </div>
                            {entry.status === 'reconciled' && (
                                <div className="mt-2 text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-200 dark:border-green-800">
                                    Reconciliado em {formatDate(entry.reconciliation.paymentDate)} no valor de {formatCurrency(entry.reconciliation.finalAmount)} na conta {accounts.find(a => a.id === entry.reconciliation.accountId)?.name}.
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            {entry.status !== 'reconciled' && <Button onClick={() => handleOpenReconcileModal(entry)} className="bg-green-600 hover:bg-green-700"><CheckCircle size={16} /> Reconciliar</Button>}
                            <button onClick={() => handleOpenModal(entry)} className="text-blue-500 hover:text-blue-700 p-2"><Edit size={18} /></button>
                            <button onClick={() => onDelete('futureEntries', entry.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
                {filteredEntries.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-12">Nenhum lançamento encontrado para este filtro.</p>}
            </div>

            {/* Modal de Novo/Editar Lançamento */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingEntry ? 'Editar Lançamento' : 'Novo Lançamento'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="dark:text-gray-300">Descrição<input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <div className="flex gap-4">
                        <label className="flex-1 dark:text-gray-300">Valor (R$)<input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                        <label className="flex-1 dark:text-gray-300">Tipo<select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="expense">Despesa</option><option value="revenue">Receita</option></select></label>
                    </div>
                    <div className="flex gap-4">
                        <label className="flex-1 dark:text-gray-300">Tipo de Lançamento<select name="entryType" value={formData.entryType} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="unico">Único</option><option value="recorrente">Recorrente</option></select></label>
                        {formData.entryType === 'recorrente' && (
                            <label className="flex-1 dark:text-gray-300">Frequência<select name="frequency" value={formData.frequency} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label>
                        )}
                    </div>
                    <label className="dark:text-gray-300">Data de Vencimento {formData.entryType === 'recorrente' && '(próximo vencimento)'}<input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <div className="flex gap-4">
                        <label className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-700 dark:text-gray-300">Favorecido (Opcional)</span>
                                <button type="button" onClick={() => setIsAddPayeeModalOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1">
                                    <PlusCircle size={14}/> Novo
                                </button>
                            </div>
                            <select name="payeeId" value={formData.payeeId} onChange={handleChange} className="block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                                <option value="">Nenhum</option>
                                {payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </label>
                        <label className="flex-1 dark:text-gray-300">Categoria<select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required><option value="">Selecione...</option>{groupedCategories.map(parent => (<optgroup key={parent.id} label={parent.name}><option value={parent.id}>{parent.name} (Principal)</option>{parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</optgroup>))}</select></label>
                    </div>
                    <div className="flex justify-end pt-4"><Button type="submit">Guardar</Button></div>
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

            {/* Modal de Reconciliação */}
            <Modal isOpen={isReconcileModalOpen} onClose={handleCloseReconcileModal} title="Reconciliar Lançamento">
                <form onSubmit={handleReconcileSubmit} className="space-y-4">
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                        <p className="font-bold">{entryToReconcile?.description}</p>
                        <p>Vencimento: {formatDate(entryToReconcile?.dueDate || '')} - Valor Original: {formatCurrency(entryToReconcile?.amount)}</p>
                    </div>
                    <label className="dark:text-gray-300">Conta de Pagamento<select name="accountId" value={reconcileFormData.accountId} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                    <div className="flex gap-4">
                        <label className="flex-1 dark:text-gray-300">Valor Final Pago (com juros/desconto)<input type="number" step="0.01" name="finalAmount" value={reconcileFormData.finalAmount} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                        <label className="flex-1 dark:text-gray-300">Data do Pagamento<input type="date" name="paymentDate" value={reconcileFormData.paymentDate} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    </div>
                    <label className="dark:text-gray-300">Notas (Opcional)<input type="text" name="notes" value={reconcileFormData.notes} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="Ex: Juros por atraso" /></label>
                    <div className="flex justify-end pt-4"><Button type="submit" className="bg-green-600 hover:bg-green-700">Confirmar Pagamento</Button></div>
                </form>
            </Modal>
        </div>
    );
};

// --- NOVA VIEW: DRE ---
const DREView = ({ transactions, categories, accounts, payees, onSave, onDelete }) => {
    const [period, setPeriod] = useState(getYearMonth(new Date().toISOString()));
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalTransactions, setModalTransactions] = useState([]);

    const dreData = useMemo(() => {
        const filtered = transactions.filter(t => getYearMonth(t.date) === period && !t.isTransfer);
        
        const revenues = filtered.filter(t => t.type === 'revenue');
        const expenses = filtered.filter(t => t.type === 'expense');

        const totalRevenue = revenues.reduce((sum, t) => sum + t.amount, 0);

        const groupByCategory = (trans, type) => {
            const parentCategories = categories.filter(c => !c.parentId && c.type === type);
            const data = parentCategories.map(parent => {
                const subcategories = categories.filter(sub => sub.parentId === parent.id);
                const childIds = [parent.id, ...subcategories.map(s => s.id)];
                
                const total = trans.filter(t => childIds.includes(t.categoryId)).reduce((sum, t) => sum + t.amount, 0);

                return {
                    id: parent.id,
                    name: parent.name,
                    value: total,
                    percentage: totalRevenue > 0 ? (total / totalRevenue) * 100 : 0,
                    subItems: subcategories.map(sub => {
                        const subTotal = trans.filter(t => t.categoryId === sub.id).reduce((sum, t) => sum + t.amount, 0);
                        return {
                            id: sub.id,
                            name: sub.name,
                            value: subTotal,
                            percentage: totalRevenue > 0 ? (subTotal / totalRevenue) * 100 : 0,
                        }
                    }).filter(s => s.value > 0)
                }
            }).filter(p => p.value > 0);
            return data;
        };
        
        const revenueData = groupByCategory(revenues, 'revenue');
        const expenseData = groupByCategory(expenses, 'expense');
        const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
        const netResult = totalRevenue - totalExpense;

        return { revenueData, expenseData, totalRevenue, totalExpense, netResult };

    }, [period, transactions, categories]);

    const handleCategoryClick = (item) => {
        const filtered = transactions.filter(t => {
            const isSamePeriod = getYearMonth(t.date) === period;
            // If it's a parent category, include all subcategories
            const subIds = categories.filter(c => c.parentId === item.id).map(c => c.id);
            const isInCategory = t.categoryId === item.id || subIds.includes(t.categoryId);
            return isSamePeriod && isInCategory;
        });
        setModalTransactions(filtered);
        setModalTitle(`Detalhes de: ${item.name}`);
        setDetailModalOpen(true);
    };

    const handleExportPDF = () => {
        if (typeof window.jspdf === 'undefined') {
            alert("A funcionalidade de PDF não está pronta. Por favor, aguarde um momento e tente novamente.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(`DRE - ${period}`, 14, 16);
        
        const head = [['Descrição', 'Valor', '% Faturamento']];
        const body = [];

        // Receitas
        body.push([{ content: 'Receita Operacional Bruta', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [230, 255, 230] } }]);
        dreData.revenueData.forEach(item => {
            body.push([item.name, formatCurrency(item.value), `${item.percentage.toFixed(2)}%`]);
        });
        body.push([{ content: '(=) Total de Receitas', styles: { fontStyle: 'bold' } }, { content: formatCurrency(dreData.totalRevenue), styles: { halign: 'right', fontStyle: 'bold' } }, { content: '100.00%', styles: { halign: 'right', fontStyle: 'bold' } }]);

        // Despesas
        body.push([{ content: 'Custos e Despesas Operacionais', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [255, 230, 230] } }]);
        dreData.expenseData.forEach(parent => {
            body.push([{ content: parent.name, styles: { fontStyle: 'bold' } }, { content: formatCurrency(parent.value), styles: { halign: 'right' } }, { content: `${parent.percentage.toFixed(2)}%`, styles: { halign: 'right' } }]);
            parent.subItems.forEach(sub => {
                body.push([`  ${sub.name}`, { content: formatCurrency(sub.value), styles: { halign: 'right' } }, { content: `${sub.percentage.toFixed(2)}%`, styles: { halign: 'right' } }]);
            });
        });
        body.push([{ content: '(-) Total de Despesas', styles: { fontStyle: 'bold' } }, { content: formatCurrency(dreData.totalExpense), styles: { halign: 'right', fontStyle: 'bold' } }, { content: `${(dreData.totalRevenue > 0 ? (dreData.totalExpense / dreData.totalRevenue) * 100 : 0).toFixed(2)}%`, styles: { halign: 'right', fontStyle: 'bold' } }]);
        
        // Resultado
        body.push([{ content: '(=) Resultado Líquido do Período', styles: { fontStyle: 'bold', fontSize: 12 } }, { content: formatCurrency(dreData.netResult), styles: { halign: 'right', fontStyle: 'bold', fontSize: 12 } }, { content: `${(dreData.totalRevenue > 0 ? (dreData.netResult / dreData.totalRevenue) * 100 : 0).toFixed(2)}%`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 12 } }]);

        doc.autoTable({
            head: head,
            body: body,
            startY: 22,
        });

        doc.save(`DRE_${period}.pdf`);
    };

    const TableRow = ({ item, isSub = false }) => (
        <tr className={`border-b dark:border-gray-700 ${isSub ? 'bg-gray-50 dark:bg-gray-700/50' : 'bg-white dark:bg-gray-800'}`}>
            <td className={`p-3 ${isSub ? 'pl-8' : 'font-semibold'}`}>
                <button onClick={() => handleCategoryClick(item)} className="text-left w-full hover:text-blue-600 dark:hover:text-blue-400">
                    {item.name}
                </button>
            </td>
            <td className="p-3 text-right">{formatCurrency(item.value)}</td>
            <td className="p-3 text-right font-mono">{item.percentage.toFixed(2)}%</td>
        </tr>
    );

    return (
        <>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">DRE - Demonstrativo de Resultados</h2>
                    <div className="flex items-center gap-4">
                        <input 
                            type="month" 
                            value={period} 
                            onChange={(e) => setPeriod(e.target.value)}
                            className="p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"
                        />
                        <Button onClick={handleExportPDF} className="bg-green-600 hover:bg-green-700"><FileOutput size={18}/> Exportar PDF</Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 dark:border-gray-700 text-left">
                                <th className="p-3 w-2/3">Descrição</th>
                                <th className="p-3 text-right">Valor</th>
                                <th className="p-3 text-right">% Faturamento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Receitas */}
                            <tr className="bg-green-50 dark:bg-green-900/20"><td colSpan="3" className="p-2 font-bold text-green-800 dark:text-green-300">Receita Operacional Bruta</td></tr>
                            {dreData.revenueData.map(item => <TableRow key={item.id} item={item} />)}
                            <tr className="bg-gray-100 dark:bg-gray-700 font-bold border-y-2 dark:border-gray-600">
                                <td className="p-3">(=) Total de Receitas</td>
                                <td className="p-3 text-right">{formatCurrency(dreData.totalRevenue)}</td>
                                <td className="p-3 text-right font-mono">100.00%</td>
                            </tr>

                            {/* Despesas */}
                            <tr className="bg-red-50 dark:bg-red-900/20"><td colSpan="3" className="p-2 font-bold text-red-800 dark:text-red-300 mt-4">Custos e Despesas Operacionais</td></tr>
                            {dreData.expenseData.map(parent => (
                                <React.Fragment key={parent.id}>
                                    <TableRow item={parent} />
                                    {parent.subItems.map(sub => <TableRow key={sub.id} item={sub} isSub />)}
                                </React.Fragment>
                            ))}
                            <tr className="bg-gray-100 dark:bg-gray-700 font-bold border-y-2 dark:border-gray-600">
                                <td className="p-3">(-) Total de Despesas</td>
                                <td className="p-3 text-right">{formatCurrency(dreData.totalExpense)}</td>
                                <td className="p-3 text-right font-mono">{(dreData.totalRevenue > 0 ? (dreData.totalExpense / dreData.totalRevenue) * 100 : 0).toFixed(2)}%</td>
                            </tr>

                            {/* Resultado */}
                            <tr className={`font-extrabold text-lg border-t-4 dark:border-gray-600 ${dreData.netResult >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200'}`}>
                                <td className="p-4">(=) Resultado Líquido do Período</td>
                                <td className="p-4 text-right">{formatCurrency(dreData.netResult)}</td>
                                <td className="p-4 text-right font-mono">{(dreData.totalRevenue > 0 ? (dreData.netResult / dreData.totalRevenue) * 100 : 0).toFixed(2)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <TransactionDetailModal 
                isOpen={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title={modalTitle}
                transactions={modalTransactions}
                accounts={accounts}
                categories={categories}
                payees={payees}
                onSave={onSave}
                onDelete={onDelete}
            />
        </>
    );
};


// --- COMPONENTES DE GESTÃO (REUTILIZÁVEIS) ---
const CompaniesManager = ({ companies, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [formData, setFormData] = useState({});

    const handleOpenModal = (company = null) => {
        setEditingCompany(company);
        setFormData(company || { name: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);
    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave('companies', formData, editingCompany?.id);
        handleCloseModal();
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Gerir Empresas</h2>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={18}/><span>Nova Empresa</span></Button>
            </div>
            <ul className="space-y-3">
                {companies.map(c => (
                    <li key={c.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-700">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">{c.name}</p>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => handleOpenModal(c)} className="text-blue-500 hover:text-blue-700 p-1" title="Renomear Empresa"><Edit size={16}/></button>
                            <button onClick={() => onDelete('companies', c.id)} className="text-red-500 hover:text-red-700 p-1" title="Excluir Empresa"><Trash2 size={16}/></button>
                        </div>
                    </li>
                ))}
                {companies.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhuma empresa criada.</p>}
            </ul>
             <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCompany ? 'Renomear Empresa' : 'Nova Empresa'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Nome da Empresa</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
        </>
    );
};

const CategoryManager = ({ categories, onSave, onDelete, onApplyTemplate }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [preselectedParent, setPreselectedParent] = useState(null);
    const [formData, setFormData] = useState({});

    const { revenueCategories, expenseCategories } = useMemo(() => {
        const revenue = categories.filter(c => c.type === 'revenue');
        const expense = categories.filter(c => c.type === 'expense');
        
        const buildHierarchy = (list) => {
            const parents = list.filter(c => !c.parentId);
            return parents.map(p => ({
                ...p,
                subcategories: list.filter(sub => sub.parentId === p.id)
            })).sort((a,b) => a.name.localeCompare(b.name));
        };
        
        return {
            revenueCategories: buildHierarchy(revenue),
            expenseCategories: buildHierarchy(expense),
        };
    }, [categories]);

    const handleOpenModal = ({ category = null, parent = null, type = 'expense' }) => {
        setEditingCategory(category);
        setPreselectedParent(parent);

        if (category) {
            setFormData(category);
        } else {
            setFormData({
                name: '',
                type: parent ? parent.type : type,
                parentId: parent ? parent.id : null,
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setPreselectedParent(null);
        setFormData({});
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave('categories', formData, editingCategory?.id);
        handleCloseModal();
    };
    
    const handleExportCategories = () => {
        if (categories.length === 0) {
            alert("Não há categorias para exportar.");
            return;
        }
        // We only need these fields for a clean export/import
        const exportData = categories.map(({ id, name, type, parentId }) => ({
            id,
            name,
            type,
            parentId: parentId || null,
        }));

        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(exportData, null, 2)
        )}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = "plano_de_contas.json";
        link.click();
    };

    const handleDelete = (id) => {
        if (window.confirm('Tem a certeza? Se for uma categoria principal, as suas subcategorias tornar-se-ão categorias principais.')) {
            onDelete('categories', id);
        }
    };

    const CategorySection = ({ title, categoryList }) => (
        <div>
            <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">{title}</h3>
            <div className="space-y-4">
                {categoryList.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">Nenhuma categoria encontrada.</p>}
                {categoryList.map(parent => (
                    <div key={parent.id} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{parent.name}</span>
                            <div className="flex items-center space-x-2">
                                <Button onClick={() => handleOpenModal({ parent })} className="bg-green-500 hover:bg-green-600 !p-2" title="Adicionar Subcategoria">
                                    <PlusCircle size={16}/>
                                </Button>
                                <button onClick={() => handleOpenModal({ category: parent })} className="text-blue-500 hover:text-blue-700 p-2" title="Editar Categoria"><Edit size={18}/></button>
                                <button onClick={() => handleDelete(parent.id)} className="text-red-500 hover:text-red-700 p-2" title="Excluir Categoria"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <ul className="mt-3 space-y-2 pl-4">
                            {parent.subcategories.map(sub => (
                                <li key={sub.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-lg border dark:border-gray-600">
                                    <span className="text-gray-700 dark:text-gray-300">{sub.name}</span>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => handleOpenModal({ category: sub })} className="text-blue-500 hover:text-blue-700 p-1" title="Editar Subcategoria"><Edit size={16}/></button>
                                        <button onClick={() => handleDelete(sub.id)} className="text-red-500 hover:text-red-700 p-1" title="Excluir Subcategoria"><Trash2 size={16}/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-extrabold text-gray-800 dark:text-gray-200">Gerenciador de Categorias</h2>
                <div className="flex gap-2">
                    {categories.length > 0 && (
                         <Button onClick={handleExportCategories} className="bg-teal-600 hover:bg-teal-700">
                            <Download size={18}/>
                            <span>Exportar</span>
                        </Button>
                    )}
                    <Button onClick={() => handleOpenModal({})}><PlusCircle size={18}/><span>Nova Categoria</span></Button>
                </div>
            </div>
            
            <div className="p-6 bg-blue-50 dark:bg-gray-700/50 rounded-xl border-2 border-blue-200 dark:border-blue-800 mb-8">
                <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300">Plano de Contas</h3>
                {categories.length > 0 ? (
                    <p className="mt-2 text-sm text-blue-700 dark:text-blue-400">O seu plano de contas personalizado está ativo. Para usar um modelo ou importar um novo, primeiro precisa de apagar todas as categorias existentes.</p>
                ) : (
                    <>
                        <p className="mt-2 text-sm text-blue-700 dark:text-blue-400">Comece rapidamente usando um modelo pronto ou importe o seu próprio plano de contas.</p>
                        <div className="mt-4 flex gap-4">
                             <Button onClick={() => setIsTemplateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                                <BookCopy size={16} />
                                <span>Escolher Modelo</span>
                            </Button>
                        </div>
                    </>
                )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <CategorySection title="Despesas" categoryList={expenseCategories} />
                <CategorySection title="Receitas" categoryList={revenueCategories} />
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {preselectedParent && <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg"><p className="text-sm text-gray-600 dark:text-gray-400">Subcategoria de: <span className="font-bold">{preselectedParent.name}</span></p></div>}
                    <label className="block dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Nome</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <label className="block dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Tipo</span><select name="type" value={formData.type || 'expense'} onChange={handleChange} disabled={!!formData.parentId || !!preselectedParent} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-gray-300 disabled:cursor-not-allowed"><option value="expense">Despesa</option><option value="revenue">Receita</option></select></label>
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
            
            <TemplateModal 
                isOpen={isTemplateModalOpen} 
                onClose={() => setIsTemplateModalOpen(false)} 
                onApply={onApplyTemplate} 
            />
        </>
    );
};

const AccountsManager = ({ accounts, onSave, onDelete, onImport, allTransactions }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [formData, setFormData] = useState({});

    const handleOpenModal = (account = null) => {
        if (account) {
            setEditingAccount(account);
            setFormData(account);
        } else {
            setEditingAccount(null);
            setFormData({ name: '', initialBalance: 0, accountType: 'corrente', closingDay: '', paymentDay: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);
    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { ...formData, initialBalance: parseFloat(formData.initialBalance || 0) };
        onSave('accounts', dataToSave, editingAccount?.id);
        handleCloseModal();
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Contas</h3>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={18}/><span>Nova Conta</span></Button>
            </div>
            <ul className="space-y-3">
                {accounts.map(acc => (
                    <li key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                            <p className="font-semibold">{acc.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{(acc.accountType || 'corrente').replace(/_/g, ' ')}</p>
                            {acc.accountType === 'cartao_credito' && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">Fecha dia {acc.closingDay}, Paga dia {acc.paymentDay}</p>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                             <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(acc.initialBalance)}</span>
                             {acc.accountType === 'dinheiro' && (
                                <button onClick={() => onImport(acc)} className="text-teal-500 hover:text-teal-700 p-1" title="Importar extrato para esta conta"><Upload size={16}/></button>
                             )}
                            <button onClick={() => handleOpenModal(acc)} className="text-blue-500 hover:text-blue-700 p-1" title="Editar Conta"><Edit size={16}/></button>
                            <button onClick={() => onDelete('accounts', acc.id)} className="text-red-500 hover:text-red-700 p-1" title="Excluir Conta"><Trash2 size={16}/></button>
                        </div>
                    </li>
                ))}
            </ul>
             <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingAccount ? 'Editar Conta' : 'Nova Conta'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Nome da Conta</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                     <label className="block dark:text-gray-300">
                        <span className="text-gray-700 dark:text-gray-300">Tipo de Conta</span>
                        <select name="accountType" value={formData.accountType || 'corrente'} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                            <option value="corrente">Conta Corrente</option>
                            <option value="cartao_credito">Cartão de Crédito</option>
                            <option value="lancamentos_futuros">Lançamentos Futuros</option>
                            <option value="dinheiro">Dinheiro (Importação)</option>
                        </select>
                    </label>
                    {formData.accountType === 'cartao_credito' && (
                        <div className="flex space-x-4">
                            <label className="block flex-1 dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Dia de Fecho</span><input type="number" name="closingDay" value={formData.closingDay || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" min="1" max="31" /></label>
                            <label className="block flex-1 dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Dia de Pagamento</span><input type="number" name="paymentDay" value={formData.paymentDay || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" min="1" max="31" /></label>
                        </div>
                    )}
                    <label className="block dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Saldo Inicial</span><input type="number" step="0.01" name="initialBalance" value={formData.initialBalance || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
        </div>
    );
};

const PayeesManager = ({ payees, categories, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPayee, setEditingPayee] = useState(null);
    const [formData, setFormData] = useState({});

    const groupedCategories = useMemo(() => {
        if (!categories) return [];
        const parents = categories.filter(c => !c.parentId);
        return parents.map(parent => ({
            ...parent,
            subcategories: categories.filter(sub => sub.parentId === parent.id)
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    const handleOpenModal = (payee = null) => {
        if (payee) {
            setEditingPayee(payee);
            setFormData(payee);
        } else {
            setEditingPayee(null);
            setFormData({ name: '', categoryId: '' });
        }
        setIsModalOpen(true);
    };
    const handleCloseModal = () => setIsModalOpen(false);
    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { ...formData };
        if (!dataToSave.categoryId) delete dataToSave.categoryId;
        onSave('payees', dataToSave, editingPayee?.id);
        handleCloseModal();
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Favorecidos</h3>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={18}/><span>Novo Favorecido</span></Button>
            </div>
             <ul className="space-y-3">
                {payees.map(p => (
                    <li key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                            <p className="font-semibold">{p.name}</p>
                            {p.categoryId && <p className="text-xs text-gray-500 dark:text-gray-400">{getCategoryFullName(p.categoryId, categories)}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => handleOpenModal(p)} className="text-blue-500 hover:text-blue-700 p-1" title="Editar Favorecido"><Edit size={16}/></button>
                            <button onClick={() => onDelete('payees', p.id)} className="text-red-500 hover:text-red-700 p-1" title="Excluir Favorecido"><Trash2 size={16}/></button>
                        </div>
                    </li>
                ))}
            </ul>
             <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingPayee ? 'Editar Favorecido' : 'Novo Favorecido'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <label className="block dark:text-gray-300"><span className="text-gray-700 dark:text-gray-300">Nome do Favorecido</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    <label className="block dark:text-gray-300">
                        <span className="text-gray-700 dark:text-gray-300">Categoria Padrão (Opcional)</span>
                        <select name="categoryId" value={formData.categoryId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300">
                            <option value="">Nenhuma</option>
                            {groupedCategories.map(parent => (
                                <optgroup key={parent.id} label={parent.name}>
                                    <option value={parent.id}>{parent.name} (Principal)</option>
                                    {parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </label>
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
        </div>
    );
};

// --- MODAL DE IMPORTAÇÃO DE TRANSAÇÕES (ATUALIZADO) ---
const TransactionImportModal = ({ isOpen, onClose, onImport, account, categories, payees, allTransactions }) => {
    const [step, setStep] = useState(1);
    const [csvData, setCsvData] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [error, setError] = useState('');
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
        }
    }, [isOpen]);
    
    const handleFormatStatement = async () => {
        setError('');
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
        
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        };

        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                console.error("Erro na API:", result);
                throw new Error(result.error?.message || `A API retornou o status ${response.status}`);
            }

            const candidate = result.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text;

            if (text) {
                const cleanedText = text.replace(/```csv/g, '').replace(/```/g, '').trim();
                setCsvData(cleanedText);
            } else {
                console.error("Resposta inesperada da API:", result);
                if (candidate?.finishReason === 'SAFETY') {
                    setError("A solicitação foi bloqueada por motivos de segurança. Tente reformular o texto do extrato.");
                } else {
                     throw new Error(result.error?.message || "A resposta da API não continha o texto esperado.");
                }
            }
        } catch (error) {
            console.error("Falha ao formatar extrato com IA:", error);
            setError(`Erro: ${error.message}. Tente novamente ou verifique o console.`);
        } finally {
            setIsFormatting(false);
        }
    };


    const handleParse = () => {
        setError('');
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
        }
    };
    
    const handleCategorizeAllWithAI = async () => {
        if (transactions.length === 0) return;
        setIsCategorizingAI(true);
        setError('');

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
                1.  **Tipo é Prioridade:** Analise se a transação é (Despesa) ou (Receita). Use a lista de categorias correspondente.
                2.  **Aprenda com o Histórico:** Os exemplos do utilizador são a sua referência principal. Imite os padrões de categorização dele.
                3.  **Use os IDs:** Forneça o 'categoryId' e 'payeeId' exatos das listas abaixo.

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

            const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
            };
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.error?.message || `API Error: ${response.status}`);
            
            const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) throw new Error("A API retornou uma resposta vazia.");
            
            const parsedResponse = JSON.parse(textResponse);
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
                    {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-md">{error}</p>}
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
                {activeTab === 'accounts' && <AccountsManager accounts={accounts} onSave={onSaveEntity} onDelete={onDeleteEntity} onImport={handleOpenImportModal} allTransactions={allTransactions} />}
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

const ConsolidatedReportsView = ({ allCompaniesData, companies, onBack }) => {
    const chartData = useMemo(() => {
        return companies.map(company => {
            const data = allCompaniesData[company.id] || { revenue: 0, expense: 0, balance: 0 };
            return {
                name: company.name,
                Receita: data.revenue,
                Despesa: data.expense,
                Saldo: data.balance,
            };
        });
    }, [allCompaniesData, companies]);

    const totalConsolidatedBalance = useMemo(() => {
        return Object.values(allCompaniesData).reduce((sum, data) => sum + data.balance, 0);
    }, [allCompaniesData]);

    return (
        <div className="p-8 space-y-8 bg-gray-100 dark:bg-gray-900 min-h-screen">
            <div className="flex items-center justify-between">
                 <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">Relatório Consolidado</h1>
                 <Button onClick={onBack} className="bg-gray-600 hover:bg-gray-700"><ArrowLeft size={18}/> Voltar</Button>
            </div>

            <StatCard title="Saldo Total Consolidado" value={formatCurrency(totalConsolidatedBalance)} icon={<DollarSign className="text-white" />} color="bg-purple-600" />

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">Receita vs. Despesa por Empresa</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="Receita" fill="#22c55e" />
                        <Bar dataKey="Despesa" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">Saldo por Empresa</h2>
                <ResponsiveContainer width="100%" height={400}>
                     <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="Saldo" fill="#3b82f6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// --- NOVA VIEW: CONFIGURAÇÕES GLOBAIS ---
const GlobalSettingsView = ({ companies, onSave, onDelete, onBack, onBackup, onRestore, subscription, onSubscribe }) => {
    const [activeTab, setActiveTab] = useState('empresas');

    const TabButton = ({ tabName, label, active }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-6 py-3 font-semibold rounded-t-lg transition-colors focus:outline-none ${
                active
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-0'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="p-8 space-y-8 bg-gray-100 dark:bg-gray-900 min-h-screen">
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">Configurações Globais</h1>
                <Button onClick={onBack} className="bg-gray-600 hover:bg-gray-700"><ArrowLeft size={18}/> Voltar ao Hub</Button>
            </div>

            <div>
                <div className="border-b border-gray-300 dark:border-gray-700">
                    <TabButton tabName="empresas" label="Empresas" active={activeTab === 'empresas'} />
                    <TabButton tabName="assinatura" label="Assinatura" active={activeTab === 'assinatura'} />
                    <TabButton tabName="backup" label="Backup / Restauração" active={activeTab === 'backup'} />
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-b-2xl rounded-r-2xl shadow-lg">
                    {activeTab === 'empresas' && (
                        <CompaniesManager companies={companies} onSave={onSave} onDelete={onDelete} />
                    )}
                    {activeTab === 'assinatura' && (
                        <SubscriptionView subscription={subscription} onSubscribe={onSubscribe} />
                    )}
                    {activeTab === 'backup' && (
                        <BackupManager onBackup={onBackup} onRestore={onRestore} />
                    )}
                </div>
            </div>
        </div>
    );
};

const BackupManager = ({ onBackup, onRestore }) => {
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleBackup = async () => {
        setIsLoading(true);
        await onBackup();
        setIsLoading(false);
    };

    const handleRestoreClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (window.confirm("Tem a certeza que deseja restaurar este backup? TODOS os seus dados atuais serão apagados e substituídos. Esta ação não pode ser desfeita.")) {
                setIsLoading(true);
                onRestore(file).finally(() => setIsLoading(false));
            }
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Backup e Restauração</h2>
            <div className="space-y-6">
                <div className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="font-bold text-blue-800 dark:text-blue-300">Criar Backup</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 mb-3">Guarde todos os seus dados (empresas, contas, transações, etc.) num único ficheiro seguro.</p>
                    <Button onClick={handleBackup} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                        <Download size={18} />
                        <span>{isLoading ? 'A criar...' : 'Criar Backup'}</span>
                    </Button>
                </div>
                <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <h3 className="font-bold text-red-800 dark:text-red-300">Restaurar Backup</h3>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1 mb-3">Substitua todos os dados atuais por um ficheiro de backup. Esta ação é irreversível.</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                    <Button onClick={handleRestoreClick} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                        <UploadCloud size={18} />
                        <span>{isLoading ? 'A restaurar...' : 'Restaurar Backup'}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};


const HubScreen = ({ companies, onSelect, onShowReports, onManageCompanies }) => {
    return (
        <div className="w-full h-screen flex flex-col justify-center items-center bg-gray-800 bg-cover bg-center" style={{backgroundImage: "url(https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2574&auto=format&fit=crop)"}}>
            <div className="absolute inset-0 bg-black/60"></div>
            <div className="relative z-10 w-full max-w-4xl text-center p-8">
                <button onClick={onManageCompanies} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" title="Gerir Empresas e Categorias">
                    <Settings size={24} />
                </button>
                <h1 className="text-5xl font-extrabold text-white mb-4">Bem-vindo ao Financeiro PRO</h1>
                <p className="text-xl text-white/80 mb-12">Selecione uma empresa para começar ou veja os seus relatórios consolidados.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companies.map(company => (
                        <button key={company.id} onClick={() => onSelect(company.id)} className="group bg-white/10 hover:bg-white/20 backdrop-blur-md p-6 rounded-2xl text-white text-left transition-all transform hover:scale-105">
                            <Building size={32} className="mb-4 text-blue-300 group-hover:text-white transition-colors" />
                            <h2 className="text-xl font-bold">{company.name}</h2>
                            <p className="text-sm text-white/70">Aceder ao painel</p>
                        </button>
                    ))}
                </div>

                {companies.length > 0 && (
                     <div className="mt-12">
                        <Button onClick={onShowReports} className="bg-purple-600 hover:bg-purple-700">
                            <BarChart2 size={20} />
                            <span>Ver Relatório Consolidado</span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- NOVA VIEW: ASSINATURA ---
const SubscriptionView = ({ subscription, onSubscribe }) => {
    const [isSubscribing, setIsSubscribing] = useState(false);
    const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
    const endDate = subscription?.trial_end?.toDate ? formatDate(subscription.trial_end.toDate()) : 'N/A';

    const handleSubscriptionClick = async () => {
        setIsSubscribing(true);
        try {
            await onSubscribe();
        } catch (error) {
            console.error("Erro ao iniciar assinatura:", error);
            alert("Não foi possível iniciar o processo de assinatura. Tente novamente.");
        } finally {
            setIsSubscribing(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">A Minha Assinatura</h2>
            
            <div className={`p-6 rounded-lg border ${isActive ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                <div className="flex items-center space-x-4">
                    {isActive ? <ShieldCheck className="text-green-500" size={32}/> : <AlertTriangle className="text-red-500" size={32}/>}
                    <div>
                        <p className="text-lg font-semibold">{isActive ? 'Assinatura Ativa' : 'Assinatura Expirada'}</p>
                        {subscription?.status === 'trialing' && <p className="text-sm">O seu período de teste termina em: <strong>{endDate}</strong></p>}
                        {subscription?.status === 'active' && <p className="text-sm">A sua assinatura é válida até: <strong>{endDate}</strong></p>}
                        {!isActive && <p className="text-sm">O seu acesso às funcionalidades está limitado. Renove a sua assinatura para continuar.</p>}
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center">
                <h3 className="text-xl font-semibold mb-4">Plano PRO</h3>
                <p className="text-4xl font-bold mb-2">R$ 49,90<span className="text-lg font-normal">/mês</span></p>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Acesso ilimitado a todas as funcionalidades.</p>
                <Button onClick={handleSubscriptionClick} disabled={isSubscribing} className="bg-green-600 hover:bg-green-700 w-full max-w-xs mx-auto">
                    {isSubscribing ? <RefreshCw className="animate-spin" /> : <CreditCard size={20}/>}
                    <span>{isSubscribing ? 'A redirecionar...' : (isActive ? 'Gerir Assinatura' : 'Assinar Agora')}</span>
                </Button>
                 <p className="text-xs text-gray-500 mt-4">Pagamentos seguros processados pelo Mercado Pago.</p>
            </div>
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
                    trialEndDate.setDate(trialEndDate.getDate() + 30);
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
    
    // eslint-disable-next-line no-undef
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userId = user?.uid;
    
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
        return () => unsubscribes.forEach(unsub => unsub());
    }, [activeCompanyId, userId, appId]);

    const handleSave = async (collectionName, data, id, file = null) => {
        if (!userId) return;
        const isGlobal = ['companies'].includes(collectionName);
        const basePath = `users/${userId}`;
        let path = isGlobal ? `${basePath}/${collectionName}` : `${basePath}/companies/${activeCompanyId}/${collectionName}`;
        
        if (collectionName === 'transactions' && data.type === 'transfer') {
            const { sourceAccountId, destinationAccountId, amount, date, description } = data;
            const transferId = crypto.randomUUID();
            const batch = writeBatch(db);
            const fullPath = `${basePath}/companies/${activeCompanyId}/transactions`;

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
                return <GlobalSettingsView companies={companies} onSave={handleSave} onDelete={(coll, id) => handleDelete(coll, {id})} onBack={() => setHubView('selector')} onBackup={handleBackup} onRestore={handleRestore} subscription={subscription} onSubscribe={handleSubscribeClick} />;
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
            case 'dashboard': return <DashboardView transactions={transactions} accounts={accounts} categories={categories} futureEntries={futureEntries} budgets={budgets} />;
            case 'transactions': return <TransactionsView transactions={transactions} accounts={accounts} categories={categories} payees={payees} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} />;
            case 'reconciliation': return <ReconciliationView transactions={transactions} accounts={accounts} categories={categories} payees={payees} onSaveTransaction={handleSaveWithCompanyId} allTransactions={transactions} />;
            case 'futureEntries': return <FutureEntriesView futureEntries={futureEntries} accounts={accounts} categories={categories} payees={payees} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} onReconcile={handleReconcileWithCompanyId} />;
            case 'budgets': return <BudgetsView budgets={budgets} categories={categories} transactions={transactions} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} />;
            case 'reports': return <ReportsView transactions={transactions} categories={categories} accounts={accounts} />;
            case 'dre': return <DREView transactions={transactions} categories={categories} accounts={accounts} payees={payees} onSave={handleSaveWithCompanyId} onDelete={handleDeleteWithCompanyId} />;
            case 'weeklyCashFlow': return <WeeklyCashFlowView futureEntries={futureEntries} categories={categories} />;
            case 'settings': return <SettingsView 
                onSaveEntity={settingsSaveHandler}
                onDeleteEntity={settingsDeleteHandler}
                onImportTransactions={handleImportWithCompanyId} 
                {...{ accounts, payees, categories, allTransactions: transactions, activeCompanyId }} 
                />;
            default: return <DashboardView transactions={transactions} accounts={accounts} categories={categories} futureEntries={futureEntries} budgets={budgets} />;
        }
    };

    const NavItem = ({ icon, label, active, onClick }) => (
        <button onClick={onClick} className={`flex items-center space-x-3 w-full text-left px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {icon}<span className="font-medium">{label}</span>
        </button>
    );
    
    const activeCompany = companies.find(c => c.id === activeCompanyId);

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
                        <NavItem icon={<GitCompareArrows />} label="Conciliação" active={view === 'reconciliation'} onClick={() => setView('reconciliation')} />
                        <NavItem icon={<CalendarCheck2 />} label="Lançamentos Futuros" active={view === 'futureEntries'} onClick={() => setView('futureEntries')} />
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
            <main className="flex-1 p-8 overflow-y-auto relative">
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
                <div className={!isSubscribed ? 'blur-sm' : ''}>
                    {renderView()}
                </div>
            </main>
        </div>
    );
}

// --- NOVO COMPONENTE: MODAL DE DETALHES DE TRANSAÇÃO ---
const TransactionDetailModal = ({ isOpen, onClose, title, transactions, accounts, categories, payees, onSave, onDelete }) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);

    const handleOpenEditModal = (transaction) => {
        setEditingTransaction(transaction);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setEditingTransaction(null);
        setIsEditModalOpen(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b-2 dark:border-gray-700">
                            <th className="p-2">Data</th>
                            <th className="p-2">Descrição</th>
                            <th className="p-2 text-right">Valor</th>
                            <th className="p-2">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(t => (
                            <tr key={t.id} className="border-b dark:border-gray-700">
                                <td className="p-2">{formatDate(t.date)}</td>
                                <td className="p-2">{t.description}</td>
                                <td className={`p-2 text-right font-semibold ${t.type === 'revenue' ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatCurrency(t.amount)}
                                </td>
                                <td className="p-2">
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleOpenEditModal(t)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                                        <button onClick={() => onDelete('transactions', t)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {editingTransaction && (
                 <TransactionEditModal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    editingTransaction={editingTransaction}
                    accounts={accounts}
                    categories={categories}
                    payees={payees}
                    onSave={onSave}
                />
            )}
        </Modal>
    );
};

// --- NOVO COMPONENTE: MODAL DE EDIÇÃO DE TRANSAÇÃO (REUTILIZÁVEL) ---
const TransactionEditModal = ({ isOpen, onClose, editingTransaction, accounts, categories, payees, onSave }) => {
    const [formData, setFormData] = useState({});
    const [attachmentFile, setAttachmentFile] = useState(null);

    useEffect(() => {
        if (editingTransaction) {
            setFormData({ ...editingTransaction, date: editingTransaction.date.substring(0, 10) });
        }
    }, [editingTransaction]);

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
        onClose();
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
         <Modal isOpen={isOpen} onClose={onClose} title="Editar Transação">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div><label className="block"><span className="text-gray-700 dark:text-gray-300">Descrição</span><input type="text" name="description" value={formData.description || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label></div>
                <div className="flex space-x-4">
                    <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Valor (R$)</span><input type="number" step="0.01" name="amount" value={formData.amount || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="0.00" required /></label>
                    <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Data</span><input type="date" name="date" value={formData.date || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                </div>
                <div className="flex space-x-4">
                    <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Conta</span><select name="accountId" value={formData.accountId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                    <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Favorecido</span><select name="payeeId" value={formData.payeeId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="">Nenhum</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                </div>
                <div>
                    <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Categoria</span><select name="categoryId" value={formData.categoryId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required><option value="">Selecione...</option>{groupedCategories.map(parent => (<optgroup key={parent.id} label={parent.name}><option value={parent.id}>{parent.name} (Principal)</option>{parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</optgroup>))}</select></label>
                </div>
                <div>
                    <label className="block"><span className="text-gray-700 dark:text-gray-300">Anexar Comprovativo</span>
                    <input type="file" onChange={(e) => setAttachmentFile(e.target.files[0])} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </label>
                    {formData.attachmentURL && !attachmentFile && <div className="text-xs mt-1">Anexo atual: <a href={formData.attachmentURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver anexo</a>. Selecione um novo ficheiro para o substituir.</div>}
                </div>
                <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar Alterações</span></Button></div>
            </form>
        </Modal>
    );
};

// --- NOVA VIEW: FLUXO DE CAIXA SEMANAL ---
const WeeklyCashFlowView = ({ futureEntries, categories }) => {
    const weeklyData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay();
        const startOfCurrentWeek = new Date(today.setDate(today.getDate() - dayOfWeek));

        const weeks = [];
        for (let i = -2; i <= 4; i++) {
            const weekStart = new Date(startOfCurrentWeek);
            weekStart.setDate(weekStart.getDate() + i * 7);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            const entries = futureEntries.filter(e => {
                const dueDate = new Date(e.dueDate);
                return e.status !== 'reconciled' && dueDate >= weekStart && dueDate <= weekEnd;
            });

            const total = entries.reduce((sum, e) => sum + e.amount, 0);
            const isOverdue = new Date() > weekEnd && entries.length > 0;

            weeks.push({
                range: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
                entries,
                total,
                isOverdue
            });
        }
        return weeks;
    }, [futureEntries]);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Fluxo de Caixa Semanal (Despesas Futuras)</h2>
            <div className="grid grid-cols-1 gap-6">
                {weeklyData.map((week, index) => (
                    <div key={index} className={`p-6 rounded-2xl shadow-lg ${week.isOverdue ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={`text-xl font-bold ${week.isOverdue ? 'text-red-800 dark:text-red-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                {week.range}
                                {index === 2 && <span className="text-sm font-normal text-blue-500 ml-2">(Semana Atual)</span>}
                            </h3>
                            <span className={`text-2xl font-bold ${week.isOverdue ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>{formatCurrency(week.total)}</span>
                        </div>
                        {week.entries.length > 0 ? (
                            <ul className="space-y-2">
                                {week.entries.map(entry => (
                                    <li key={entry.id} className="flex justify-between items-center text-sm border-t dark:border-gray-700 pt-2">
                                        <div>
                                            <p className="font-semibold">{entry.description}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{getCategoryFullName(entry.categoryId, categories)}</p>
                                        </div>
                                        <span className="font-semibold">{formatCurrency(entry.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhuma despesa programada para esta semana.</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- NOVO COMPONENTE: MODAL DE MODELOS DE CATEGORIA ---
const TemplateModal = ({ isOpen, onClose, onApply }) => {
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const TEMPLATE_DEFINITIONS = {
      personal: { name: 'Finanças Pessoais', description: 'Plano de contas para uso pessoal e familiar.', type: 'Finanças Pessoais' },
      commerce: { name: 'Comércio', description: 'Plano de contas para empresas comerciais.', type: 'Pequeno Comércio Varejista' },
      industry: { name: 'Indústria', description: 'Plano de contas para pequenas indústrias.', type: 'Pequena Indústria' },
      restaurant: { name: 'Restaurante', description: 'Plano de contas focado em restaurantes e lancherias.', type: 'Restaurante e Lancheria' },
      rural: { name: 'Propriedade Rural', description: 'Para gestão de atividades agrícolas e pecuárias.', type: 'Propriedade Rural (Agronegócio)' },
    };

    const handleGenerateTemplate = async (templateKey) => {
        const template = TEMPLATE_DEFINITIONS[templateKey];
        if (!window.confirm(`Tem a certeza de que deseja gerar e aplicar o modelo "${template.name}"? A IA criará um plano de contas para si.`)) return;
        
        setIsLoading(true);
        setError('');
        
        const prompt = `
            Você é um contador especialista em sistemas financeiros no Brasil. Sua tarefa é criar um "Plano de Contas" para um tipo de negócio específico.
            O resultado DEVE ser um array de objetos JSON VÁLIDO.
            Cada objeto representa uma categoria e deve conter as seguintes chaves:
            - "id": uma string única e curta em inglês para referência (ex: 'despesa_aluguel', 'receita_vendas').
            - "name": o nome da categoria em português (ex: 'Aluguel', 'Vendas de Produtos').
            - "type": deve ser 'expense' para despesa ou 'revenue' para receita.
            - "parentId": deve ser null para categorias principais, ou o "id" da categoria pai para subcategorias.

            Gere um plano de contas completo e bem estruturado para: "${template.type}".
            Inclua as principais categorias de receitas e despesas, com subcategorias relevantes.
        `;

        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        try {
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" },
            };
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error?.message || `API Error: ${response.status}`);
            const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) throw new Error("A API retornou uma resposta vazia.");
            
            const generatedCategories = JSON.parse(textResponse);
            onApply(generatedCategories);
            onClose();

        } catch (e) {
            console.error("Erro ao gerar plano de contas com IA:", e);
            setError(`Ocorreu um erro: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleImportClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (!Array.isArray(importedData) || !importedData.every(cat => cat.name && cat.type && cat.id)) {
                       throw new Error("Formato de ficheiro inválido. O ficheiro JSON deve ser um array e cada categoria deve ter 'id', 'name' e 'type'.");
                    }
                    if(window.confirm("Tem a certeza que deseja importar este plano de contas?")) {
                        onApply(importedData);
                        onClose();
                    }
                } catch (error) {
                    alert(`Erro ao ler o ficheiro: ${error.message}`);
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Escolher um Plano de Contas" size="lg">
            <div className="space-y-6">
                {isLoading && <LoadingScreen message="A IA está a criar o seu plano de contas..." />}
                {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-md">{error}</p>}
                {!isLoading && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(TEMPLATE_DEFINITIONS).map(([key, template]) => (
                                <div key={key} className="p-4 border dark:border-gray-700 rounded-lg flex flex-col items-center text-center">
                                    <h3 className="font-bold text-lg">{template.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 flex-grow my-2">{template.description}</p>
                                    <Button onClick={() => handleGenerateTemplate(key)} className="w-full mt-auto">Gerar com IA</Button>
                                </div>
                            ))}
                        </div>
                         <div className="p-4 border-2 border-dashed dark:border-gray-600 rounded-lg flex flex-col items-center text-center">
                            <h3 className="font-bold text-lg">Importar o seu Próprio Plano</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 my-2">Importe um plano de contas de um ficheiro JSON.</p>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                            <Button onClick={handleImportClick} className="w-full max-w-xs bg-green-600 hover:bg-green-700">
                                <FileJson size={16}/>
                                <span>Importar de Ficheiro</span>
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};


