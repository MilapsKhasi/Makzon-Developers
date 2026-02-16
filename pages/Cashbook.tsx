
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2, Calendar, Trash2, Edit, Eye, ArrowLeft, FileDown, AlertCircle, RefreshCw, Landmark } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils/helpers';
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
      const { data, error } = await supabase
        .from('cashbooks')
        .select('*')
        .eq('company_id', activeCompany.id)
        .not('is_deleted', 'is', true)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setEntries(data || []);
    } catch (e: any) {
      console.error("Cashbook API Fetch Failed:", e.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyLoading) return;
    loadData();
    const handleSettingsChange = () => loadData();
    window.addEventListener('appSettingsChanged', handleSettingsChange);
    return () => window.removeEventListener('appSettingsChanged', handleSettingsChange);
  }, [activeCompany?.id, companyLoading]);

  // Logic for Forwarding Balance Card (Hidden in UI but logic preserved)
  const openingBalanceData = useMemo(() => {
    const latest = entries[0]; // Entries are sorted date desc, created_at desc
    if (!latest) {
      return { amount: 0, subtext: 'Initial Setup' };
    }
    return { 
      amount: Number(latest.balance) || 0, 
      subtext: formatDate(latest.date)
    };
  }, [entries]);

  const stats = useMemo(() => {
    return entries.reduce((acc, entry) => ({
      income: acc.income + (Number(entry.income_total) || 0),
      expense: acc.expense + (Number(entry.expense_total) || 0),
      balance: acc.balance + (Number(entry.balance) || 0)
    }), { income: 0, expense: 0, balance: 0 });
  }, [entries]);

  const handleExportCSV = async () => {
    if (!activeCompany?.id || entries.length === 0) return;
    setExporting(true);
    try {
      const headers = ['Sr', 'Stmt Date', 'Income (INR)', 'Expense (INR)', 'Net Balance (INR)'];
      const rows = entries.map((e, i) => [
        i + 1,
        formatDate(e.date),
        (Number(e.income_total) || 0).toFixed(2),
        (Number(e.expense_total) || 0).toFixed(2),
        (Number(e.balance) || 0).toFixed(2)
      ]);
      const config = {
        companyName: activeCompany.name || 'Cashbook Report',
        gstin: activeCompany.gstin || 'N/A',
        email: '', phone: '',
        address: activeCompany.address || 'N/A',
        reportTitle: 'Cashbook Register Statement',
        dateRange: 'Full History'
      };
      exportToCSV(headers, rows, config);
    } catch (err) {
      alert("Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSheet = async (data: any) => {
    if (!data.date) return alert("Please provide a date for the statement.");
    setLoading(true);
    const cid = activeCompany?.id;
    if (!cid) return;
    
    const payload = { 
      company_id: cid, 
      date: data.date, 
      income_total: data.incomeTotal, 
      expense_total: data.expenseTotal, 
      balance: data.balance, 
      raw_data: data, 
      is_deleted: false
    };

    try {
      if (data.id && typeof data.id === 'string' && !data.id.startsWith('local_')) {
        await supabase.from('cashbooks').update(payload).eq('id', data.id);
      } else {
        await supabase.from('cashbooks').insert([{ ...payload, created_at: new Date().toISOString() }]);
      }
      await loadData();
    } catch (e: any) {
      alert("Could not save the statement.");
    } finally { 
      setLoading(false);
      setViewState('list'); 
      setEditingEntry(null); 
    }
  };

  const deleteEntry = async (id: string) => {
      if (!confirm("Permanently delete this statement?")) return;
      setLoading(true);
      try {
        await supabase.from('cashbooks').update({ is_deleted: true }).eq('id', id);
        await loadData();
      } finally {
        setLoading(false);
      }
  };

  if (companyLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!activeCompany?.id) return (
      <div className="h-full flex flex-col items-center justify-center p-10 bg-white border border-slate-200 rounded-md">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-medium text-slate-900 mb-2 capitalize">Workspace Required</h2>
        <p className="text-slate-500 text-center max-w-md">Please select a workspace first from the top menu to view and manage the cashbook.</p>
      </div>
  );

  const filteredEntries = entries.filter(e => String(e.date).includes(searchQuery));

  if (viewState === 'entry') {
    return (
      <div className="h-full flex flex-col animate-in slide-in-from-right duration-300">
        <CashbookSheet 
          initialData={editingEntry} 
          existingEntries={entries}
          onSave={handleSaveSheet} 
          onCancel={() => { setViewState('list'); setEditingEntry(null); }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-3">
          <h1 className="text-[20px] font-medium text-slate-900 capitalize">Cashbook Register</h1>
          <button onClick={loadData} title="Refresh Data" className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex flex-col items-end space-y-4">
            <div className="flex space-x-2">
                <button 
                  onClick={handleExportCSV}
                  disabled={exporting || entries.length === 0}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50 transition-none capitalize font-medium flex items-center disabled:opacity-50"
                >
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <FileDown className="w-3.5 h-3.5 mr-2" />} Export Csv
                </button>
                <button 
                  onClick={() => { setEditingEntry(null); setViewState('entry'); }} 
                  className="bg-primary text-slate-900 px-6 py-2 rounded-md font-medium text-sm hover:bg-primary-dark flex items-center transition-none capitalize shadow-sm"
                >
                <Plus className="w-4 h-4 mr-2" /> Create Statement
                </button>
            </div>

            {/* Current Forwarding Balance logic source - hidden as requested */}
            <div className="hidden">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl min-w-[320px] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Landmark className="w-20 h-20 text-white" />
                  </div>
                  <div className="relative z-10">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Current Forwarding Balance</span>
                      <div className="text-[28px] font-bold text-white font-mono leading-none mb-2">
                          {formatCurrency(openingBalanceData.amount)}
                      </div>
                      <div className="flex items-center text-[10px] font-medium text-slate-500 uppercase tracking-tighter">
                          <Calendar className="w-3 h-3 mr-1" />
                          Carried forward from {openingBalanceData.subtext}
                      </div>
                  </div>
              </div>
            </div>
        </div>
      </div>

      {!loading && entries.length === 0 ? (
        <EmptyState 
          title="No Cashbook Records" 
          message="Keep your digital desk clean by recording daily cash inflows and outflows here." 
          actionLabel="Create Daily Statement" 
          onAction={() => { setEditingEntry(null); setViewState('entry'); }} 
        />
      ) : (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[ 
                { label: 'Cumulative Inward', value: stats.income, color: 'text-emerald-600' }, 
                { label: 'Cumulative Outward', value: stats.expense, color: 'text-rose-600' }, 
                { label: 'Net Cash In Hand', value: stats.balance, color: 'text-slate-900' } 
                ].map((stat, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col hover:border-slate-300 transition-all">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 block">{stat.label}</span>
                    <span className={`text-[22px] font-bold leading-none font-mono ${stat.color}`}>
                    {formatCurrency(stat.value)}
                    </span>
                </div>
                ))}
            </div>

            <div className="space-y-4 pt-4">
                <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Search ledger by date..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300" 
                />
                </div>

                <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 capitalize tracking-widest">
                        <th className="w-16 py-4 px-6 text-center border-r border-slate-100 uppercase">Sr</th>
                        <th className="py-4 px-6 border-r border-slate-100 uppercase">Statement Date</th>
                        <th className="text-right py-4 px-6 border-r border-slate-100 uppercase">Income</th>
                        <th className="text-right py-4 px-6 border-r border-slate-100 uppercase">Expense</th>
                        <th className="text-right py-4 px-6 border-r border-slate-100 uppercase">Closing Balance</th>
                        <th className="text-center py-4 px-6 uppercase">Manage</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {loading && entries.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-20 text-slate-400 font-medium capitalize tracking-widest text-[10px]">Loading...</td></tr>
                    ) : filteredEntries.map((e, i) => (
                        <tr key={e.id} className="hover:bg-slate-50/50 group transition-colors">
                        <td className="py-3 px-6 text-center border-r border-slate-100 font-mono text-slate-400">{i + 1}</td>
                        <td className="py-3 px-6 border-r border-slate-100">
                            <div className="flex items-center text-slate-700 font-bold">
                            <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                            {formatDate(e.date)}
                            </div>
                        </td>
                        <td className="text-right py-3 px-6 border-r border-slate-100 font-mono text-emerald-600 font-bold">
                            {formatCurrency(e.income_total, false)}
                        </td>
                        <td className="text-right py-3 px-6 border-r border-slate-100 font-mono text-rose-600 font-bold">
                            {formatCurrency(e.expense_total, false)}
                        </td>
                        <td className="text-right py-3 px-6 border-r border-slate-100 font-bold text-slate-900 font-mono">
                            {formatCurrency(e.balance, false)}
                        </td>
                        <td className="text-center py-3 px-6">
                            <div className="flex items-center justify-center space-x-2">
                            <button onClick={() => { setEditingEntry(e); setViewState('entry'); }} className="p-1.5 text-slate-400 hover:text-slate-900 rounded"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => { setEditingEntry(e); setViewState('entry'); }} className="p-1.5 text-slate-400 hover:text-slate-900 rounded"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => deleteEntry(e.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default Cashbook;
