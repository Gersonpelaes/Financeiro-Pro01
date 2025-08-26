import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, writeBatch, query, onSnapshot, deleteDoc, setDoc, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PlusCircle, Upload, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, Settings, LayoutDashboard, List, BarChart2, Target, ArrowLeft, ArrowRightLeft, Repeat, CheckCircle, AlertTriangle, Clock, CalendarCheck2, Building, GitCompareArrows, ArrowUp, ArrowDown, Paperclip, FileText, LogOut, Download, UploadCloud, Sun, Moon, FileOutput, CalendarClock, Menu, X } from 'lucide-react';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';


// --- CONFIGURAÇÃO DO FIREBASE (PARA TESTE LOCAL) ---
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

// --- COMPONENTE: MODAL DE EDIÇÃO DE TRANSAÇÃO (REUTILIZÁVEL) ---
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

// --- COMPONENTE: MODAL DE DETALHES DE TRANSAÇÃO ---
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

// --- NOVA VIEW DE AUTENTICAÇÃO ---
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
                <p className="text-gray-600">Entre com a sua conta Google para continuar.</p>
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

    useEffect(() => {
        if (accounts.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts, selectedAccountId]);

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
                                <label className="flex-1"><span className="text-gray-700 dark:text-gray-300">Favorecido</span><select name="payeeId" value={formData.payeeId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="">Nenhum</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
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
const ReconciliationView = ({ transactions, accounts, categories, payees, onSaveTransaction }) => {
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
                 {budgets.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 col-span-full text-center py-8">Nenhum orçamento definido.</p>}
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
                        <label className="flex-1 dark:text-gray-300">Favorecido (Opcional)<select name="payeeId" value={formData.payeeId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"><option value="">Nenhum</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                        <label className="flex-1 dark:text-gray-300">Categoria<select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required><option value="">Selecione...</option>{groupedCategories.map(parent => (<optgroup key={parent.id} label={parent.name}><option value={parent.id}>{parent.name} (Principal)</option>{parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</optgroup>))}</select></label>
                    </div>
                    <div className="flex justify-end pt-4"><Button type="submit">Guardar</Button></div>
                </form>
            </Modal>

            {/* Modal de Reconciliação */}
            <Modal isOpen={isReconcileModalOpen} onClose={handleCloseReconcileModal} title="Reconciliar Lançamento">
                <form onSubmit={handleReconcileSubmit} className="space-y-4">
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                        <p className="font-bold">{entryToReconcile?.description}</p>
                        <p>Vencimento: {formatDate(entryToReconcile?.dueDate || '')} - Valor Original: {formatCurrency(entryToReconcile?.amount)}</p>
                    </div>
                    <label className="dark:text-gray-300">Conta de Pagamento<select name="accountId" value={reconcileFormData.accountId} onChange={handleChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                    <div className="flex gap-4">
                        <label className="flex-1 dark:text-gray-300">Valor Final Pago (com juros/desconto)<input type="number" step="0.01" name="finalAmount" value={reconcileFormData.finalAmount} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                        <label className="flex-1 dark:text-gray-300">Data do Pagamento<input type="date" name="paymentDate" value={reconcileFormData.paymentDate} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" required /></label>
                    </div>
                    <label className="dark:text-gray-300">Notas (Opcional)<input type="text" name="notes" value={reconcileFormData.notes} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300" placeholder="Ex: Juros por atraso" /></label>
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
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">DRE (Caixa)</h2>
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

// --- NOVA VIEW: DRE POR COMPETÊNCIA ---
const DRECompetenciaView = ({ futureEntries, categories }) => {
    const [period, setPeriod] = useState(getYearMonth(new Date().toISOString()));

    const dreData = useMemo(() => {
        const filtered = futureEntries.filter(e => getYearMonth(e.dueDate) === period);
        
        const revenues = filtered.filter(e => e.type === 'revenue');
        const expenses = filtered.filter(e => e.type === 'expense');

        const totalRevenue = revenues.reduce((sum, e) => sum + e.amount, 0);

        const groupByCategory = (entries, type) => {
            const parentCategories = categories.filter(c => !c.parentId && c.type === type);
            return parentCategories.map(parent => {
                const subcategories = categories.filter(sub => sub.parentId === parent.id);
                const childIds = [parent.id, ...subcategories.map(s => s.id)];
                
                const total = entries.filter(e => childIds.includes(e.categoryId)).reduce((sum, e) => sum + e.amount, 0);

                return {
                    id: parent.id,
                    name: parent.name,
                    value: total,
                    percentage: totalRevenue > 0 ? (total / totalRevenue) * 100 : 0,
                };
            }).filter(p => p.value > 0);
        };
        
        const revenueData = groupByCategory(revenues, 'revenue');
        const expenseData = groupByCategory(expenses, 'expense');
        const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
        const netResult = totalRevenue - totalExpense;

        return { revenueData, expenseData, totalRevenue, totalExpense, netResult };

    }, [period, futureEntries, categories]);

    const TableRow = ({ item }) => (
        <tr className="border-b dark:border-gray-700 bg-white dark:bg-gray-800">
            <td className="p-3 font-semibold">{item.name}</td>
            <td className="p-3 text-right">{formatCurrency(item.value)}</td>
            <td className="p-3 text-right font-mono">{item.percentage.toFixed(2)}%</td>
        </tr>
    );

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">DRE (Competência)</h2>
                <input 
                    type="month" 
                    value={period} 
                    onChange={(e) => setPeriod(e.target.value)}
                    className="p-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-300"
                />
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
                        <tr className="bg-green-50 dark:bg-green-900/20"><td colSpan="3" className="p-2 font-bold text-green-800 dark:text-green-300">Receitas por Competência</td></tr>
                        {dreData.revenueData.map(item => <TableRow key={item.id} item={item} />)}
                        <tr className="bg-gray-100 dark:bg-gray-700 font-bold border-y-2 dark:border-gray-600">
                            <td className="p-3">(=) Total de Receitas</td>
                            <td className="p-3 text-right">{formatCurrency(dreData.totalRevenue)}</td>
                            <td className="p-3 text-right font-mono">100.00%</td>
                        </tr>

                        <tr className="bg-red-50 dark:bg-red-900/20"><td colSpan="3" className="p-2 font-bold text-red-800 dark:text-red-300 mt-4">Despesas por Competência</td></tr>
                        {dreData.expenseData.map(item => <TableRow key={item.id} item={item} />)}
                         <tr className="bg-gray-100 dark:bg-gray-700 font-bold border-y-2 dark:border-gray-600">
                            <td className="p-3">(-) Total de Despesas</td>
                            <td className="p-3 text-right">{formatCurrency(dreData.totalExpense)}</td>
                            <td className="p-3 text-right font-mono">{(dreData.totalRevenue > 0 ? (dreData.totalExpense / dreData.totalRevenue) * 100 : 0).toFixed(2)}%</td>
                        </tr>

                         <tr className={`font-extrabold text-lg border-t-4 dark:border-gray-600 ${dreData.netResult >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200'}`}>
                            <td className="p-4">(=) Resultado por Competência</td>
                            <td className="p-4 text-right">{formatCurrency(dreData.netResult)}</td>
                            <td className="p-4 text-right font-mono">{(dreData.totalRevenue > 0 ? (dreData.netResult / dreData.totalRevenue) * 100 : 0).toFixed(2)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
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
                return e.status !== 'reconciled' && dueDate >= weekStart && dueDate <= weekEnd && e.type === 'expense';
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
};
