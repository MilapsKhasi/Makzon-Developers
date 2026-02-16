import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2, Calendar, Trash2, Edit, Eye, FileDown, AlertCircle, RefreshCw, ArrowUpRight } from 'lucide-react';
import { formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import CashbookSheet from '../components/CashbookSheet';
import EmptyState from '../components/EmptyState';
import { exportToCSV } from '../utils/exportHelper';
import { useCompany } from '../context/CompanyContext';

const Cashbook = () => {
  const { activeCompany, loading: companyLoading } = useCompany();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState<'list' | 'entry'>('list');
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    if (!activeCompany?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 💡 Hum data ko ASCENDING mangwayenge taaki balance calculation sahi ho
      const { data, error } = await supabase
        .from('cashbooks')
        .select('*')
        .eq('company_id', activeCompany.id)
        .not('is_deleted', 'is', true)
        .order('date', { ascending: true }) 
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setEntries(data || []);
    } catch (e: any) {
      console.error("Fetch error:", e.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyLoading) return;
    if (activeCompany?.id) loadData();
  }, [activeCompany?.id, companyLoading]);

  // Stats Card Calculation
  const stats = useMemo(() => {
    return entries.reduce((acc, entry) => ({
      income: acc.income + (Number(entry.income_total) || 0),
      expense: acc.expense + (Number(entry.expense_total) || 0),
      balance: acc.balance + (Number(entry.balance) || 0)
    }), { income: 0, expense: 0, balance: 0 });
  }, [entries]);

  // 💡 Display ke liye list ko Reverse karenge taaki LATEST upar dikhe
  const displayEntries = useMemo(() => {
    const filtered = entries.filter(e => String(e.date).includes(searchQuery));
    return [...filtered].reverse(); 
  }, [entries, searchQuery]);

  const handleSaveSheet = async (data: any) => {
    setLoading(true);
    const payload = { 
      company_id: activeCompany?.id, 
      date: data.date, 
      income_total: data.incomeTotal, 
      expense_total: data.expenseTotal, 
      balance: data.balance, 
      raw_data: data, 
      is_deleted: false
    };

    try {
      if (data.id && !data.id.startsWith('local_')) {
        await supabase.from('cashbooks').update(payload).eq('id', data.id);
      } else {
        await supabase.from('cashbooks').insert([{ ...payload, created_at: new Date().toISOString() }]);
      }
      await loadData();
      setViewState('list');
    } catch (e) {
      alert("Save Failed.");
    } finally { setLoading(false); }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this statement?")) return;
    setLoading(true);
    try {
      await supabase.from('cashbooks').update({ is_deleted: true }).eq('id', id);
      await loadData();
    } finally { setLoading(false); }
  };

  if (companyLoading || loading && entries.length === 0) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  if (viewState === 'entry') {
    return <CashbookSheet initialData={editingEntry} existingEntries={entries} onSave={handleSaveSheet} onCancel={() => setViewState('list')} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900">Cashbook Register 💸</h1>
        <button onClick={() => { setEditingEntry(null); setViewState('entry'); }} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium text-sm flex items-center hover:bg-indigo-700 transition-all shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Create Daily Statement
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Income</p>
          <p className="text-2xl font-mono font-bold text-emerald-600">₹{stats.income.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Expense</p>
          <p className="text-2xl font-mono font-bold text-rose-600">₹{stats.expense.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm bg-indigo-50/30">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Net Balance</p>
          <p className="text-2xl font-mono font-bold text-indigo-700">₹{stats.balance.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
            <tr>
              <th className="py-4 px-6">Sr</th>
              <th className="py-4 px-6">Statement Details</th>
              <th className="text-right py-4 px-6">Income</th>
              <th className="text-right py-4 px-6">Expense</th>
              <th className="text-right py-4 px-6">Closing Balance</th>
              <th className="text-center py-4 px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayEntries.map((e, i) => {
              // 💡 Calculation: Agla index (kyunki reverse hai) hi pichli entry hai
              const prevEntry = displayEntries[i + 1];
              const openingBal = prevEntry ? prevEntry.balance : 0;
              const openingLabel = prevEntry ? `Opening Balance of ${formatDate(prevEntry.date)}` : 'Opening Balance of Initial Setup';

              return (
                <React.Fragment key={e.id}>
                  {/* --- Opening Balance Row --- */}
                  <tr className="bg-slate-50/50 text-[11px] border-l-2 border-l-indigo-400">
                    <td className="py-2 px-6"></td>
                    <td colSpan={3} className="py-2 px-6 text-slate-500 italic flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1 text-indigo-400" /> {openingLabel}
                    </td>
                    <td className="text-right py-2 px-6 font-mono text-slate-500">
                      {Number(openingBal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>

                  {/* --- Main Transaction Row --- */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-slate-400 font-mono">{displayEntries.length - i}</td>
                    <td className="py-4 px-6 font-semibold text-slate-900">{formatDate(e.date)}</td>
                    <td className="text-right py-4 px-6 text-emerald-600 font-bold font-mono">+{Number(e.income_total).toLocaleString('en-IN')}</td>
                    <td className="text-right py-4 px-6 text-rose-600 font-bold font-mono">-{Number(e.expense_total).toLocaleString('en-IN')}</td>
                    <td className="text-right py-4 px-6 font-bold text-slate-900 font-mono bg-indigo-50/20">₹{Number(e.balance).toLocaleString('en-IN')}</td>
                    <td className="text-center py-4 px-6 flex justify-center space-x-2">
                      <button onClick={() => { setEditingEntry(e); setViewState('entry'); }} className="p-2 hover:bg-indigo-100 rounded-full text-indigo-600"><Edit size={16}/></button>
                      <button onClick={() => deleteEntry(e.id)} className="p-2 hover:bg-rose-100 rounded-full text-rose-600"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {displayEntries.length === 0 && <div className="p-20 text-center text-slate-400 italic">No records found.</div>}
      </div>
    </div>
  );
};

export default Cashbook;
