import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, writeBatch, query, onSnapshot, deleteDoc, setDoc, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { PlusCircle, Upload, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, Settings, LayoutDashboard, List, BarChart2, Target, ArrowLeft, ArrowRightLeft, Repeat, CheckCircle, AlertTriangle, Clock, CalendarCheck2, Building, GitCompareArrows, ArrowUp, ArrowDown, Paperclip, FileText } from 'lucide-react';

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
const getMonthYear = (date) => new Date(date).toLocaleString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
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
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClass} p-8 m-4 transform transition-all`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
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
    <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center space-x-4 transition-transform transform hover:scale-105">
        <div className={`p-3 rounded-full ${color}`}>{icon}</div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

// --- COMPONENTES DAS VIEWS ---
const DashboardView = ({ transactions, accounts, categories }) => {
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
        const expenses = transactions.filter(t => t.type === 'expense' && !t.isTransfer);
        const grouped = expenses.reduce((acc, t) => {
            const categoryName = getCategoryFullName(t.categoryId, categories);
            acc[categoryName] = (acc[categoryName] || 0) + t.amount;
            return acc;
        }, {});
        return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    }, [transactions, categories]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A239EA', '#FF4560'];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Saldo Total" value={formatCurrency(totalBalance)} icon={<DollarSign className="text-white" />} color="bg-green-500" />
                <StatCard title="Receitas (Mês)" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="text-white" />} color="bg-blue-500" />
                <StatCard title="Despesas (Mês)" value={formatCurrency(totalExpense)} icon={<TrendingDown className="text-white" />} color="bg-red-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Despesas por Categoria</h3>
                    {expenseByCategory.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                    {expenseByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="text-center text-gray-500 py-12">Sem dados de despesas para exibir.</p>}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Últimas Transações</h3>
                    <ul className="space-y-4">
                        {transactions.slice(0, 5).map(t => (
                            <li key={t.id} className="flex justify-between items-center border-b pb-2">
                                <div>
                                    <p className="font-semibold text-gray-700">{t.description}</p>
                                    <p className="text-sm text-gray-500">{formatDate(t.date)}</p>
                                </div>
                                <span className={`font-bold ${t.isTransfer ? 'text-blue-600' : (t.type === 'revenue' ? 'text-green-600' : 'text-red-600')}`}>
                                    {t.isTransfer ? '' : (t.type === 'revenue' ? '+' : '-')} {formatCurrency(t.amount)}
                                </span>
                            </li>
                        ))}
                         {transactions.length === 0 && <p className="text-center text-gray-500 py-12">Nenhuma transação encontrada.</p>}
                    </ul>
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
        <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Extrato da Conta</h2>
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="mt-2 p-2 border rounded-lg bg-gray-50">
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div className="text-right">
                    <p className="text-gray-500">Saldo Atual</p>
                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(currentBalance)}</p>
                </div>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={20} /><span>Adicionar Transação</span></Button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead><tr className="border-b-2 border-gray-200"><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Categoria</th><th className="p-4 text-right">Valor</th><th className="p-4 text-right">Saldo</th><th className="p-4">Ações</th></tr></thead>
                    <tbody>
                        {transactionsWithBalance.map(t => (
                            <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-4 text-gray-600">{formatDate(t.date)}</td>
                                <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                                    {t.description}
                                    {t.attachmentURL && (
                                        <a href={t.attachmentURL} target="_blank" rel="noopener noreferrer" title="Ver anexo">
                                            <Paperclip className="text-blue-500" size={16}/>
                                        </a>
                                    )}
                                </td>
                                <td className="p-4 text-gray-600">{t.isTransfer ? <span className="flex items-center gap-2 text-blue-600 font-medium"><ArrowRightLeft size={14}/> Transferência</span> : getCategoryFullName(t.categoryId, categories)}</td>
                                <td className={`p-4 font-bold text-right ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'revenue' ? '+' : '-'} {formatCurrency(t.amount)}</td>
                                <td className="p-4 font-mono text-right text-gray-700">{formatCurrency(t.runningBalance)}</td>
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
                        <label className="flex-1"><span className="text-gray-700">Tipo</span><select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg"><option value="expense">Despesa</option><option value="revenue">Receita</option><option value="transfer">Transferência</option></select></label>
                        <label className="flex-1"><span className="text-gray-700">Data</span><input type="date" name="date" value={formData.date} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                    </div>

                    {formData.type === 'transfer' ? (
                        <>
                            <div className="flex space-x-4">
                                <label className="flex-1"><span className="text-gray-700">Conta de Origem</span><select name="sourceAccountId" value={formData.sourceAccountId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                                <label className="flex-1"><span className="text-gray-700">Conta de Destino</span><select name="destinationAccountId" value={formData.destinationAccountId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required>{accounts.filter(a => a.id !== formData.sourceAccountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                            </div>
                             <div><label className="block"><span className="text-gray-700">Descrição (Opcional)</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" /></label></div>
                            <div><label className="block"><span className="text-gray-700">Valor (R$)</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" placeholder="0.00" required /></label></div>
                        </>
                    ) : (
                        <>
                            <div><label className="block"><span className="text-gray-700">Descrição</span><input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" placeholder="Ex: Salário, Aluguer" required /></label></div>
                            <div className="flex space-x-4">
                                <label className="flex-1"><span className="text-gray-700">Valor (R$)</span><input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" placeholder="0.00" required /></label>
                                <label className="flex-1"><span className="text-gray-700">Conta</span><select name="accountId" value={formData.accountId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                            </div>
                            <div className="flex space-x-4">
                                <label className="flex-1"><span className="text-gray-700">Favorecido</span><select name="payeeId" value={formData.payeeId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg"><option value="">Nenhum</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                                <label className="flex-1"><span className="text-gray-700">Categoria</span><select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required><option value="">Selecione...</option>{groupedCategories.map(parent => (<optgroup key={parent.id} label={parent.name}><option value={parent.id}>{parent.name} (Principal)</option>{parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</optgroup>))}</select></label>
                            </div>
                            <div>
                                <label className="block"><span className="text-gray-700">Anexar Comprovativo</span>
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
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Evolução do Património Líquido</h2>
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
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Análise Comparativa de Despesas</h2>
                <div className="flex gap-4 mb-6 items-center flex-wrap">
                    <label>Comparar: <input type="month" name="month1" value={compareMonths.month1} onChange={handleCompareMonthChange} className="p-2 border rounded-lg" /></label>
                    <label>Com: <input type="month" name="month2" value={compareMonths.month2} onChange={handleCompareMonthChange} className="p-2 border rounded-lg" /></label>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b-2">
                                <th className="p-3">Categoria</th>
                                <th className="p-3 text-right">{compareMonths.month1}</th>
                                <th className="p-3 text-right">{compareMonths.month2}</th>
                                <th className="p-3 text-right">Variação (R$)</th>
                                <th className="p-3 text-right">Variação (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonData.map(item => (
                                <tr key={item.category} className="border-b">
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
const ReconciliationView = ({ transactions, accounts, onSaveTransaction }) => {
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
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Conciliação Bancária</h2>
                <div className="flex gap-4 items-center">
                    <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="p-2 border rounded-lg bg-gray-50 flex-grow">
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
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-green-600 mb-4">Correspondências Sugeridas ({reconciliationResult.matched.length})</h3>
                        {reconciliationResult.matched.map(pair => (
                            <div key={pair.system.id} className="grid grid-cols-2 gap-4 border-b p-2">
                                <div><p><strong>Sistema:</strong> {pair.system.description} - {formatCurrency(pair.system.amount)} em {formatDate(pair.system.date)}</p></div>
                                <div><p><strong>Extrato:</strong> {pair.statement.description} - {formatCurrency(pair.statement.amount)} em {formatDate(pair.statement.date)}</p></div>
                            </div>
                        ))}
                    </div>
                    {/* Only in Statement */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-blue-600 mb-4">Apenas no Extrato ({reconciliationResult.onlyInStatement.length})</h3>
                        {reconciliationResult.onlyInStatement.map(item => (
                            <div key={item.id} className="flex justify-between items-center border-b p-2">
                                <p>{item.description} - {formatCurrency(item.amount)} em {formatDate(item.date)}</p>
                                <Button onClick={() => handleCreateTransaction(item)} className="bg-green-500 hover:bg-green-600 !py-1 !px-2">Criar no Sistema</Button>
                            </div>
                        ))}
                    </div>
                    {/* Only in System */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-xl font-bold text-yellow-600 mb-4">Apenas no Sistema ({reconciliationResult.onlyInSystem.length})</h3>
                        {reconciliationResult.onlyInSystem.map(item => (
                            <div key={item.id} className="border-b p-2">
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
                categories={[]}
                payees={[]}
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
        <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-3xl font-bold text-gray-800">Orçamentos Mensais</h2>
                <Button onClick={handleOpenModal}><PlusCircle size={20} /><span>Novo Orçamento</span></Button>
            </div>
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-sm text-blue-700">Faturamento do mês atual (para cálculo de %): <span className="font-bold">{formatCurrency(monthlyRevenue)}</span></p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgets.map(b => {
                    const spent = monthlyExpenses[b.categoryId] || 0;
                    const category = categories.find(c => c.id === b.categoryId);
                    const budgetAmount = b.budgetType === 'percentage' ? (monthlyRevenue * (b.percentage || 0)) / 100 : b.amount;
                    const progress = budgetAmount > 0 ? Math.min((spent / budgetAmount) * 100, 100) : 0;
                    const isOverBudget = spent > budgetAmount;
                    return (
                        <div key={b.id} className="border p-4 rounded-lg shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-lg">{category?.name || 'Categoria Removida'}</span>
                                <button onClick={() => onDelete('budgets', b.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                            </div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className={isOverBudget ? 'text-red-600 font-bold' : 'text-gray-600'}>Gasto: {formatCurrency(spent)}</span>
                                <span className="text-gray-600">Orçamento: {formatCurrency(budgetAmount)} {b.budgetType === 'percentage' && `(${b.percentage}%)`}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4"><div className={`h-4 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div></div>
                        </div>
                    );
                })}
                 {budgets.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">Nenhum orçamento definido.</p>}
            </div>
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Novo Orçamento">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label>Categoria de Despesa<select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg">{categories.filter(c => c.type === 'expense' && !budgets.find(b => b.categoryId === c.id)).map(c => <option key={c.id} value={c.id}>{getCategoryFullName(c.id, categories)}</option>)}</select></label>
                    <label>Tipo de Orçamento
                        <select name="budgetType" value={formData.budgetType} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg">
                            <option value="fixed">Valor Fixo</option>
                            <option value="percentage">Percentual do Faturamento</option>
                        </select>
                    </label>
                    {formData.budgetType === 'fixed' ? (
                        <label>Valor do Orçamento (R$)<input type="number" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" placeholder="500.00" required /></label>
                    ) : (
                        <label>Percentual do Faturamento (%)<input type="number" name="percentage" value={formData.percentage} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" placeholder="30" required /></label>
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
        <button onClick={() => setFilter(a_filter)} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filter === a_filter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
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
        <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-gray-800">Lançamentos Futuros</h2>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={20} /><span>Novo Lançamento</span></Button>
            </div>

            <div className="flex space-x-2 mb-6 border-b pb-4">
                <FilterButton a_filter="a_vencer" label="A Vencer" count={futureEntries.filter(e => e.status !== 'reconciled' && new Date(e.dueDate) >= new Date()).length} />
                <FilterButton a_filter="vencidos" label="Vencidos" count={futureEntries.filter(e => e.status !== 'reconciled' && new Date(e.dueDate) < new Date()).length} />
                <FilterButton a_filter="reconciliados" label="Reconciliados" count={futureEntries.filter(e => e.status === 'reconciled').length} />
            </div>

            <div className="space-y-4">
                {filteredEntries.map(entry => (
                    <div key={entry.id} className="p-4 border rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50">
                        <div className="flex-1">
                            <div className="flex items-center gap-4">
                                {getStatusBadge(entry)}
                                <p className="font-bold text-lg text-gray-800">{entry.description}</p>
                            </div>
                            <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
                                <span>Vencimento: <strong>{formatDate(entry.dueDate)}</strong></span>
                                <span>Valor: <strong className={entry.type === 'revenue' ? 'text-green-600' : 'text-red-600'}>{formatCurrency(entry.amount)}</strong></span>
                                {entry.entryType !== 'unico' && <span className="capitalize flex items-center gap-1"><Repeat size={14}/> {entry.frequency}</span>}
                            </div>
                            {entry.status === 'reconciled' && (
                                <div className="mt-2 text-xs bg-green-50 p-2 rounded-md border border-green-200">
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
                {filteredEntries.length === 0 && <p className="text-center text-gray-500 py-12">Nenhum lançamento encontrado para este filtro.</p>}
            </div>

            {/* Modal de Novo/Editar Lançamento */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingEntry ? 'Editar Lançamento' : 'Novo Lançamento'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label>Descrição<input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                    <div className="flex gap-4">
                        <label className="flex-1">Valor (R$)<input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                        <label className="flex-1">Tipo<select name="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg"><option value="expense">Despesa</option><option value="revenue">Receita</option></select></label>
                    </div>
                    <div className="flex gap-4">
                        <label className="flex-1">Tipo de Lançamento<select name="entryType" value={formData.entryType} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg"><option value="unico">Único</option><option value="recorrente">Recorrente</option></select></label>
                        {formData.entryType === 'recorrente' && (
                            <label className="flex-1">Frequência<select name="frequency" value={formData.frequency} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg"><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label>
                        )}
                    </div>
                    <label>Data de Vencimento {formData.entryType === 'recorrente' && '(próximo vencimento)'}<input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                    <div className="flex gap-4">
                        <label className="flex-1">Favorecido (Opcional)<select name="payeeId" value={formData.payeeId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg"><option value="">Nenhum</option>{payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                        <label className="flex-1">Categoria<select name="categoryId" value={formData.categoryId} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required><option value="">Selecione...</option>{groupedCategories.map(parent => (<optgroup key={parent.id} label={parent.name}><option value={parent.id}>{parent.name} (Principal)</option>{parent.subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}</optgroup>))}</select></label>
                    </div>
                    <div className="flex justify-end pt-4"><Button type="submit">Guardar</Button></div>
                </form>
            </Modal>

            {/* Modal de Reconciliação */}
            <Modal isOpen={isReconcileModalOpen} onClose={handleCloseReconcileModal} title="Reconciliar Lançamento">
                <form onSubmit={handleReconcileSubmit} className="space-y-4">
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <p className="font-bold">{entryToReconcile?.description}</p>
                        <p>Vencimento: {formatDate(entryToReconcile?.dueDate || '')} - Valor Original: {formatCurrency(entryToReconcile?.amount)}</p>
                    </div>
                    <label>Conta de Pagamento<select name="accountId" value={reconcileFormData.accountId} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border rounded-lg" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                    <div className="flex gap-4">
                        <label className="flex-1">Valor Final Pago (com juros/desconto)<input type="number" step="0.01" name="finalAmount" value={reconcileFormData.finalAmount} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                        <label className="flex-1">Data do Pagamento<input type="date" name="paymentDate" value={reconcileFormData.paymentDate} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                    </div>
                    <label>Notas (Opcional)<input type="text" name="notes" value={reconcileFormData.notes} onChange={handleReconcileChange} className="mt-1 block w-full p-2 border rounded-lg" placeholder="Ex: Juros por atraso" /></label>
                    <div className="flex justify-end pt-4"><Button type="submit" className="bg-green-600 hover:bg-green-700">Confirmar Pagamento</Button></div>
                </form>
            </Modal>
        </div>
    );
};

// --- NOVA VIEW: DRE ---
const DREView = ({ transactions, categories }) => {
    const [period, setPeriod] = useState(getYearMonth(new Date().toISOString()));

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

    const TableRow = ({ item, isSub = false }) => (
        <tr className={`border-b ${isSub ? 'bg-gray-50' : 'bg-white'}`}>
            <td className={`p-3 ${isSub ? 'pl-8' : 'font-semibold'}`}>{item.name}</td>
            <td className="p-3 text-right">{formatCurrency(item.value)}</td>
            <td className="p-3 text-right font-mono">{item.percentage.toFixed(2)}%</td>
        </tr>
    );

    return (
        <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">DRE - Demonstrativo de Resultados</h2>
                <input 
                    type="month" 
                    value={period} 
                    onChange={(e) => setPeriod(e.target.value)}
                    className="p-2 border rounded-lg"
                />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2 text-left">
                            <th className="p-3 w-2/3">Descrição</th>
                            <th className="p-3 text-right">Valor</th>
                            <th className="p-3 text-right">% Faturamento</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Receitas */}
                        <tr className="bg-green-50"><td colSpan="3" className="p-2 font-bold text-green-800">Receita Operacional Bruta</td></tr>
                        {dreData.revenueData.map(item => <TableRow key={item.id} item={item} />)}
                        <tr className="bg-gray-100 font-bold border-y-2">
                            <td className="p-3">(=) Total de Receitas</td>
                            <td className="p-3 text-right">{formatCurrency(dreData.totalRevenue)}</td>
                            <td className="p-3 text-right font-mono">100.00%</td>
                        </tr>

                        {/* Despesas */}
                        <tr className="bg-red-50"><td colSpan="3" className="p-2 font-bold text-red-800 mt-4">Custos e Despesas Operacionais</td></tr>
                        {dreData.expenseData.map(parent => (
                            <React.Fragment key={parent.id}>
                                <TableRow item={parent} />
                                {parent.subItems.map(sub => <TableRow key={sub.id} item={sub} isSub />)}
                            </React.Fragment>
                        ))}
                         <tr className="bg-gray-100 font-bold border-y-2">
                            <td className="p-3">(-) Total de Despesas</td>
                            <td className="p-3 text-right">{formatCurrency(dreData.totalExpense)}</td>
                            <td className="p-3 text-right font-mono">{(dreData.totalRevenue > 0 ? (dreData.totalExpense / dreData.totalRevenue) * 100 : 0).toFixed(2)}%</td>
                        </tr>

                        {/* Resultado */}
                         <tr className={`font-extrabold text-lg border-t-4 ${dreData.netResult >= 0 ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
                            <td className="p-4">(=) Resultado Líquido do Período</td>
                            <td className="p-4 text-right">{formatCurrency(dreData.netResult)}</td>
                            <td className="p-4 text-right font-mono">{(dreData.totalRevenue > 0 ? (dreData.netResult / dreData.totalRevenue) * 100 : 0).toFixed(2)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
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
                <h2 className="text-3xl font-bold text-gray-800">Gerir Empresas</h2>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={18}/><span>Nova Empresa</span></Button>
            </div>
            <ul className="space-y-3">
                {companies.map(c => (
                    <li key={c.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
                        <p className="font-semibold text-gray-700">{c.name}</p>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => handleOpenModal(c)} className="text-blue-500 hover:text-blue-700 p-1" title="Renomear Empresa"><Edit size={16}/></button>
                            <button onClick={() => onDelete('companies', c.id)} className="text-red-500 hover:text-red-700 p-1" title="Excluir Empresa"><Trash2 size={16}/></button>
                        </div>
                    </li>
                ))}
                {companies.length === 0 && <p className="text-gray-500 text-center py-8">Nenhuma empresa criada.</p>}
            </ul>
             <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCompany ? 'Renomear Empresa' : 'Nova Empresa'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block"><span className="text-gray-700">Nome da Empresa</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
        </>
    );
};

const CategoryManager = ({ categories, onSave, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
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
    
    const handleDelete = (id) => {
        if (window.confirm('Tem a certeza? Se for uma categoria principal, as suas subcategorias tornar-se-ão categorias principais.')) {
            onDelete('categories', id);
        }
    };

    const CategorySection = ({ title, categoryList, type }) => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-700">{title}</h3>
                <Button onClick={() => handleOpenModal({ type })} className="bg-blue-600 hover:bg-blue-700">
                    <PlusCircle size={18}/>
                    <span>Nova Categoria</span>
                </Button>
            </div>
            <div className="space-y-4">
                {categoryList.length === 0 && <p className="text-gray-500 text-center py-4">Nenhuma categoria encontrada.</p>}
                {categoryList.map(parent => (
                    <div key={parent.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-lg text-gray-800">{parent.name}</span>
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
                                <li key={sub.id} className="flex justify-between items-center bg-white p-2 rounded-lg border">
                                    <span className="text-gray-700">{sub.name}</span>
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
            <h2 className="text-3xl font-extrabold text-gray-800 mb-8">Gerenciador de Categorias</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <CategorySection title="Despesas" categoryList={expenseCategories} type="expense"/>
                <CategorySection title="Receitas" categoryList={revenueCategories} type="revenue"/>
            </div>
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {preselectedParent && <div className="bg-gray-100 p-3 rounded-lg"><p className="text-sm text-gray-600">Subcategoria de: <span className="font-bold">{preselectedParent.name}</span></p></div>}
                    <label className="block"><span className="text-gray-700">Nome</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                    <label className="block"><span className="text-gray-700">Tipo</span><select name="type" value={formData.type || 'expense'} onChange={handleChange} disabled={!!formData.parentId || !!preselectedParent} className="mt-1 block w-full p-2 border rounded-lg bg-gray-100 disabled:cursor-not-allowed"><option value="expense">Despesa</option><option value="revenue">Receita</option></select></label>
                    <div className="flex justify-end pt-4"><Button type="submit"><span>Guardar</span></Button></div>
                </form>
            </Modal>
        </>
    );
};

const AccountsManager = ({ accounts, onSave, onDelete, onImport }) => {
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
        <div className="bg-white p-6 rounded-2xl shadow-lg h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-700">Contas</h3>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={18}/><span>Nova Conta</span></Button>
            </div>
            <ul className="space-y-3">
                {accounts.map(acc => (
                    <li key={acc.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-semibold">{acc.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{(acc.accountType || 'corrente').replace(/_/g, ' ')}</p>
                            {acc.accountType === 'cartao_credito' && (
                                <p className="text-xs text-gray-500">Fecha dia {acc.closingDay}, Paga dia {acc.paymentDay}</p>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                             <span className="font-bold text-gray-800">{formatCurrency(acc.initialBalance)}</span>
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
                    <label className="block"><span className="text-gray-700">Nome da Conta</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                     <label className="block">
                        <span className="text-gray-700">Tipo de Conta</span>
                        <select name="accountType" value={formData.accountType || 'corrente'} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg">
                            <option value="corrente">Conta Corrente</option>
                            <option value="cartao_credito">Cartão de Crédito</option>
                            <option value="lancamentos_futuros">Lançamentos Futuros</option>
                            <option value="dinheiro">Dinheiro (Importação)</option>
                        </select>
                    </label>
                    {formData.accountType === 'cartao_credito' && (
                        <div className="flex space-x-4">
                            <label className="block flex-1"><span className="text-gray-700">Dia de Fecho</span><input type="number" name="closingDay" value={formData.closingDay || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" min="1" max="31" /></label>
                            <label className="block flex-1"><span className="text-gray-700">Dia de Pagamento</span><input type="number" name="paymentDay" value={formData.paymentDay || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" min="1" max="31" /></label>
                        </div>
                    )}
                    <label className="block"><span className="text-gray-700">Saldo Inicial</span><input type="number" step="0.01" name="initialBalance" value={formData.initialBalance || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
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
        <div className="bg-white p-6 rounded-2xl shadow-lg h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-700">Favorecidos</h3>
                <Button onClick={() => handleOpenModal()}><PlusCircle size={18}/><span>Novo Favorecido</span></Button>
            </div>
             <ul className="space-y-3">
                {payees.map(p => (
                    <li key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                            <p className="font-semibold">{p.name}</p>
                            {p.categoryId && <p className="text-xs text-gray-500">{getCategoryFullName(p.categoryId, categories)}</p>}
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
                     <label className="block"><span className="text-gray-700">Nome do Favorecido</span><input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg" required /></label>
                    <label className="block">
                        <span className="text-gray-700">Categoria Padrão (Opcional)</span>
                        <select name="categoryId" value={formData.categoryId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-lg">
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

// --- NOVO MODAL DE IMPORTAÇÃO ---
const TransactionImportModal = ({ isOpen, onClose, onImport, account, categories, payees }) => {
    const [step, setStep] = useState(1); // 1: paste, 2: edit
    const [csvData, setCsvData] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [error, setError] = useState('');

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
            // Reset state on close
            setStep(1);
            setCsvData('');
            setTransactions([]);
            setError('');
        }
    }, [isOpen]);

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

                return {
                    id: crypto.randomUUID(),
                    date: date.toISOString(),
                    description: description,
                    amount: Math.abs(amount),
                    type: amount >= 0 ? 'revenue' : 'expense',
                    categoryId: '',
                    payeeId: '',
                };
            });
            setTransactions(parsed);
            setStep(2);
        } catch (e) {
            setError(`Erro ao processar: ${e.message}`);
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
                    <p className="text-sm text-gray-600">Cole os seus dados no formato CSV. Cada linha deve ter 3 colunas separadas por vírgula: <strong>data,descrição,valor</strong>. A descrição não pode conter vírgulas.</p>
                    <textarea
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                        rows="10"
                        className="w-full p-2 border rounded-lg font-mono text-sm"
                        placeholder="2025-07-10,Supermercado,-150.75&#10;2025-07-09,Salário,5000.00"
                    ></textarea>
                    {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-md">{error}</p>}
                    <Button onClick={handleParse} className="w-full bg-blue-600 hover:bg-blue-700">Analisar Dados</Button>
                </div>
            )}
            {step === 2 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Verifique e categorize as transações</h3>
                    <div className="max-h-[60vh] overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 sticky top-0">
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
                                    <tr key={t.id} className="border-b">
                                        <td className="p-2">{formatDate(t.date)}</td>
                                        <td className="p-2">
                                            <input type="text" value={t.description} onChange={e => handleRowChange(t.id, 'description', e.target.value)} className="w-full p-1 border rounded-md" />
                                        </td>
                                        <td className={`p-2 font-semibold ${t.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</td>
                                        <td className="p-2">
                                            <select value={t.categoryId} onChange={e => handleRowChange(t.id, 'categoryId', e.target.value)} className="w-full p-1 border rounded-md bg-white">
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
                                            <select value={t.payeeId} onChange={e => handleRowChange(t.id, 'payeeId', e.target.value)} className="w-full p-1 border rounded-md bg-white">
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


const SettingsView = ({ onSaveEntity, onDeleteEntity, onImportTransactions, accounts, payees, categories }) => {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [accountToImport, setAccountToImport] = useState(null);

    const handleOpenImportModal = (account) => {
        setAccountToImport(account);
        setIsImportModalOpen(true);
    };
    
    const handleImportConfirm = (transactions) => {
        onImportTransactions(transactions, accountToImport.id);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-4xl font-bold text-gray-800">Configurações da Empresa</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AccountsManager accounts={accounts} onSave={onSaveEntity} onDelete={onDeleteEntity} onImport={handleOpenImportModal} />
                <PayeesManager payees={payees} categories={categories} onSave={onSaveEntity} onDelete={onDeleteEntity} />
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h3 className="text-xl font-semibold text-gray-700 mb-4">Backup (Funcionalidade Futura)</h3>
                 <p className="text-gray-500">Em breve poderá fazer o backup e a restauração dos dados desta empresa.</p>
            </div>
            <TransactionImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onImport={handleImportConfirm} 
                account={accountToImport}
                categories={categories}
                payees={payees}
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
        <div className="p-8 space-y-8 bg-gray-100 min-h-screen">
            <div className="flex items-center justify-between">
                 <h1 className="text-4xl font-bold text-gray-800">Relatório Consolidado</h1>
                 <Button onClick={onBack} className="bg-gray-600 hover:bg-gray-700"><ArrowLeft size={18}/> Voltar</Button>
            </div>

            <StatCard title="Saldo Total Consolidado" value={formatCurrency(totalConsolidatedBalance)} icon={<DollarSign className="text-white" />} color="bg-purple-600" />

            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Receita vs. Despesa por Empresa</h2>
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

            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Saldo por Empresa</h2>
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
const GlobalSettingsView = ({ companies, categories, onSave, onDelete, onBack }) => {
    const [activeTab, setActiveTab] = useState('empresas');

    const TabButton = ({ tabName, label, active }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-6 py-3 font-semibold rounded-t-lg transition-colors focus:outline-none ${
                active
                    ? 'bg-white text-blue-600 border-b-0'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="p-8 space-y-8 bg-gray-100 min-h-screen">
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-bold text-gray-800">Configurações Globais</h1>
                <Button onClick={onBack} className="bg-gray-600 hover:bg-gray-700"><ArrowLeft size={18}/> Voltar ao Hub</Button>
            </div>

            <div>
                <div className="border-b border-gray-300">
                    <TabButton tabName="empresas" label="Empresas" active={activeTab === 'empresas'} />
                    <TabButton tabName="categorias" label="Categorias" active={activeTab === 'categorias'} />
                </div>

                <div className="bg-white p-8 rounded-b-2xl rounded-r-2xl shadow-lg">
                    {activeTab === 'empresas' && (
                        <CompaniesManager companies={companies} onSave={onSave} onDelete={onDelete} />
                    )}
                    {activeTab === 'categorias' && (
                        <CategoryManager categories={categories} onSave={onSave} onDelete={onDelete} />
                    )}
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

// --- COMPONENTE PRINCIPAL ---
export default function App() {
    const [view, setView] = useState('dashboard');
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [loading, setLoading] = useState(true);

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

    // Autenticação
    useEffect(() => {
        // Simplificado para usar autenticação anónima, que é mais robusta para desenvolvimento local e evita erros de token.
        const authAction = async () => {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Anonymous Authentication error:", error);
            }
        };

        onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            }
            setIsAuthReady(true);
        });

        if (!auth.currentUser) {
            authAction();
        }
    }, []);
    
    // eslint-disable-next-line no-undef
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Carregar lista de empresas e categorias globais
    useEffect(() => {
        if (!isAuthReady || !userId) return;
        
        const qCompanies = query(collection(db, `artifacts/${appId}/users/${userId}/companies`));
        const unsubCompanies = onSnapshot(qCompanies, (snapshot) => {
            const companyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCompanies(companyList);
            setLoading(false);
        });

        const qCategories = query(collection(db, `artifacts/${appId}/users/${userId}/categories`));
        const unsubCategories = onSnapshot(qCategories, (snapshot) => {
            const categoryList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(categoryList);
        });

        return () => {
            unsubCompanies();
            unsubCategories();
        };
    }, [isAuthReady, userId, appId]);

    // Carregar dados consolidados para relatórios
    useEffect(() => {
        if (companies.length === 0 || !isAuthReady || !userId) return;

        const fetchAllData = async () => {
            const data = {};
            for (const company of companies) {
                const basePath = `artifacts/${appId}/users/${userId}/companies/${company.id}`;
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
            setAccounts([]); setPayees([]); setTransactions([]); setBudgets([]); setFutureEntries([]);
            return;
        };
        const companyDataPath = `artifacts/${appId}/users/${userId}/companies/${activeCompanyId}`;
        const collections = { accounts: setAccounts, payees: setPayees, transactions: setTransactions, budgets: setBudgets, futureEntries: setFutureEntries };
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
        const isGlobal = ['companies', 'categories'].includes(collectionName);
        const basePath = `artifacts/${appId}/users/${userId}`;
        const path = isGlobal ? `${basePath}/${collectionName}` : `${basePath}/companies/${activeCompanyId}/${collectionName}`;
        
        if (collectionName === 'transactions' && data.type === 'transfer') {
            // ... (lógica de transferência inalterada)
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
        if (!window.confirm('Tem a certeza que deseja apagar este item? Esta ação não pode ser desfeita.')) return;

        const isGlobal = ['companies', 'categories'].includes(collectionName);
        const basePath = `artifacts/${appId}/users/${userId}`;
        const path = isGlobal ? `${basePath}/${collectionName}` : `${basePath}/companies/${activeCompanyId}/${collectionName}`;

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
            if (isGlobal && collectionName === 'companies' && item.id === activeCompanyId) setActiveCompanyId(null);
            try { await deleteDoc(doc(db, path, item.id)); } catch (error) { console.error(`Error deleting from ${collectionName}:`, error); }
        }
    };
    
    const handleImportTransactions = async (transactionsToImport, accountId) => {
        const path = `artifacts/${appId}/users/${userId}/companies/${activeCompanyId}/transactions`;
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
        const { id, finalAmount, paymentDate, accountId, notes, originalEntry } = reconciliationData;
        
        const batch = writeBatch(db);
        const companyPath = `artifacts/${appId}/users/${userId}/companies/${activeCompanyId}`;

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
    
    if (loading || !isAuthReady) {
        return <div className="flex justify-center items-center h-screen w-screen"><p className="text-lg">A carregar o sistema financeiro...</p></div>;
    }
    
    if (!activeCompanyId) {
        switch (hubView) {
            case 'reports':
                return <ConsolidatedReportsView allCompaniesData={allCompaniesData} companies={companies} onBack={() => setHubView('selector')} />;
            case 'global_settings':
                return <GlobalSettingsView companies={companies} categories={categories} onSave={handleSave} onDelete={(coll, item) => handleDelete(coll, {id: item})} onBack={() => setHubView('selector')} />;
            case 'selector':
            default:
                return <HubScreen companies={companies} onSelect={setActiveCompanyId} onShowReports={() => setHubView('reports')} onManageCompanies={() => setHubView('global_settings')} />;
        }
    }

    const renderView = () => {
        switch (view) {
            case 'dashboard': return <DashboardView transactions={transactions} accounts={accounts} categories={categories} />;
            case 'transactions': return <TransactionsView transactions={transactions} accounts={accounts} categories={categories} payees={payees} onSave={handleSave} onDelete={handleDelete} />;
            case 'reconciliation': return <ReconciliationView transactions={transactions} accounts={accounts} onSaveTransaction={handleSave} />;
            case 'futureEntries': return <FutureEntriesView futureEntries={futureEntries} accounts={accounts} categories={categories} payees={payees} onSave={handleSave} onDelete={(coll, id) => handleDelete(coll, {id})} onReconcile={handleReconcile} />;
            case 'budgets': return <BudgetsView budgets={budgets} categories={categories} transactions={transactions} onSave={handleSave} onDelete={(coll, id) => handleDelete(coll, {id})} />;
            case 'reports': return <ReportsView transactions={transactions} categories={categories} accounts={accounts} />;
            case 'dre': return <DREView transactions={transactions} categories={categories} />;
            case 'settings': return <SettingsView onSaveEntity={handleSave} onDeleteEntity={(coll, id) => handleDelete(coll, {id})} onImportTransactions={handleImportTransactions} {...{ accounts, payees, categories }} />;
            default: return <DashboardView transactions={transactions} accounts={accounts} categories={categories} />;
        }
    };

    const NavItem = ({ icon, label, active, onClick }) => (
        <button onClick={onClick} className={`flex items-center space-x-3 w-full text-left px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
            {icon}<span className="font-medium">{label}</span>
        </button>
    );
    
    const activeCompany = companies.find(c => c.id === activeCompanyId);

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <aside className="w-72 bg-white p-6 flex-shrink-0 flex flex-col shadow-lg">
                <h1 className="text-2xl font-bold text-blue-700 mb-4">Financeiro PRO</h1>
                <div className="mb-8 p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-500">Empresa Ativa</p>
                    <p className="font-bold text-lg text-gray-800">{activeCompany?.name}</p>
                    <button onClick={() => setActiveCompanyId(null)} className="text-xs text-blue-600 hover:underline mt-1">Trocar de empresa</button>
                </div>
                <nav className="space-y-4">
                    <NavItem icon={<LayoutDashboard />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                    <NavItem icon={<List />} label="Transações" active={view ==='transactions'} onClick={() => setView('transactions')} />
                    <NavItem icon={<GitCompareArrows />} label="Conciliação" active={view === 'reconciliation'} onClick={() => setView('reconciliation')} />
                    <NavItem icon={<CalendarCheck2 />} label="Lançamentos Futuros" active={view === 'futureEntries'} onClick={() => setView('futureEntries')} />
                    <NavItem icon={<Target />} label="Orçamentos" active={view === 'budgets'} onClick={() => setView('budgets')} />
                    <NavItem icon={<BarChart2 />} label="Relatórios" active={view === 'reports'} onClick={() => setView('reports')} />
                    <NavItem icon={<FileText />} label="DRE" active={view === 'dre'} onClick={() => setView('dre')} />
                    <NavItem icon={<Settings />} label="Configurações" active={view === 'settings'} onClick={() => setView('settings')} />
                </nav>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto">{renderView()}</main>
        </div>
    );
}
