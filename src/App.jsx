mport { getFirestore, collection, doc, addDoc, getDocs, writeBatch, query, onSnapshot, deleteDoc, setDoc, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { PlusCircle, Upload, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, Settings, LayoutDashboard, List, BarChart2, Target, ArrowLeft, ArrowRightLeft, Repeat, CheckCircle, AlertTriangle, Clock, CalendarCheck2, Building, GitCompareArrows, ArrowUp, ArrowDown, Paperclip, FileText, LogOut, Download, UploadCloud, Sun, Moon, FileOutput } from 'lucide-react';
import { PlusCircle, Upload, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, Settings, LayoutDashboard, List, BarChart2, Target, ArrowLeft, ArrowRightLeft, Repeat, CheckCircle, AlertTriangle, Clock, CalendarCheck2, Building, GitCompareArrows, ArrowUp, ArrowDown, Paperclip, FileText, LogOut, Download, UploadCloud, Sun, Moon, FileOutput, CalendarClock } from 'lucide-react';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';


// --- CONFIGURAÇÃO DO FIREBASE (PARA TESTE LOCAL) ---
const firebaseConfig = {
@@ -2280,6 +2283,7 @@ export default function App() {
            case 'budgets': return <BudgetsView budgets={budgets} categories={categories} transactions={transactions} onSave={handleSave} onDelete={(coll, id) => handleDelete(coll, {id})} />;
            case 'reports': return <ReportsView transactions={transactions} categories={categories} accounts={accounts} />;
            case 'dre': return <DREView transactions={transactions} categories={categories} accounts={accounts} payees={payees} onSave={handleSave} onDelete={handleDelete} />;
            case 'weeklyCashFlow': return <WeeklyCashFlowView futureEntries={futureEntries} categories={categories} />;
            case 'settings': return <SettingsView onSaveEntity={handleSave} onDeleteEntity={(coll, id) => handleDelete(coll, {id})} onImportTransactions={handleImportTransactions} {...{ accounts, payees, categories }} />;
            default: return <DashboardView transactions={transactions} accounts={accounts} categories={categories} futureEntries={futureEntries} budgets={budgets} />;
        }
@@ -2306,6 +2310,7 @@ export default function App() {
                    <nav className="space-y-2">
                        <NavItem icon={<LayoutDashboard />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                        <NavItem icon={<List />} label="Transações" active={view ==='transactions'} onClick={() => setView('transactions')} />
                        <NavItem icon={<CalendarClock />} label="Fluxo de Caixa Semanal" active={view === 'weeklyCashFlow'} onClick={() => setView('weeklyCashFlow')} />
                        <NavItem icon={<GitCompareArrows />} label="Conciliação" active={view === 'reconciliation'} onClick={() => setView('reconciliation')} />
                        <NavItem icon={<CalendarCheck2 />} label="Lançamentos Futuros" active={view === 'futureEntries'} onClick={() => setView('futureEntries')} />
                        <NavItem icon={<Target />} label="Orçamentos" active={view === 'budgets'} onClick={() => setView('budgets')} />
@@ -2457,3 +2462,73 @@ const TransactionEditModal = ({ isOpen, onClose, editingTransaction, accounts, c
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
};