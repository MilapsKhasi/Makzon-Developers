
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2, Calendar, Trash2, Edit, Eye, ArrowLeft, FileDown, AlertCircle, RefreshCw } from 'lucide-react';
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
  const [dbError, setDbError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    // Safety check for active company context
    if (!activeCompany?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Query refined to avoid 400 errors and handle RLS null/false logic efficiently
      const { data, error } = await supabase
        .from('cashbooks')
        .select('*')
        .eq('company_id', activeCompany.id)
        .not('is_deleted', 'is', true)
        .order('date', { ascending: false });
      
      if (error) {
        console.error("Cashbook API Fetch Failed:", error);
        if (error.message.includes('schema cache') || error.message.includes('not found')) {
           setDbError(true);
        }
        throw error;
      }

      setEntries(data || []);
      setDbError(false);
    } catch (e: any) {
      console.error("Cashbook synchronization error:", e.message);
      // Removed local cache fallback logic as requested to prevent stale/empty results on reload
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Explicitly wait for company profile to load before initiating data fetch
    if (companyLoading) return;

    if (!activeCompany?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }

    loadData();

    const handleSettingsChange = () => {
      loadData();
    };
    
    window.addEventListener('appSettingsChanged', handleSettingsChange);
    return () => {
      window.removeEventListener('appSettingsChanged', handleSettingsChange);
    };
  }, [activeCompany?.id, companyLoading]);

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
      const headers = ['Sr', 'Stmt Date', 'Income (Inr)', 'Expense (Inr)', 'Net Balance (Inr)'];
      const rows = entries.map((e, i) => [
        i + 1,
        e.date,
        (Number(e.income_total) || 0).toFixed(2),
        (Number(e.expense_total) || 0).toFixed(2),
        (Number(e.balance) || 0).toFixed(2)
      ]);

      const config = {
        companyName: activeCompany.name || 'Cashbook Report',
        gstin: activeCompany.gstin || 'N/A',
        email: '',
        phone: '',
        address: activeCompany.address || 'N/A',
        reportTitle: 'Cashbook Register Statement',
        dateRange: 'Full History'
      };

      exportToCSV(headers, rows, config);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSheet = async (data: any) => {
    if (!data.date) {
      alert("Please provide a date for the statement.");
      return;
    }

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
      let queryResult;
      if (data.id && typeof data.id === 'string' && !data.id.startsWith('local_')) {
        queryResult = await supabase.from('cashbooks').update(payload).eq('id', data.id).select();
      } else {
        queryResult = await supabase.from('cashbooks').insert([{ ...payload, created_at: new Date().toISOString() }]).select();
      }
      
      const { error: responseError } = queryResult;

      if (responseError) {
        alert('Save Failed: ' + responseError.message);
        throw responseError;
      }
      
      await loadData();
    } catch (e: any) {
      console.error("Cashbook Save Error:", e.message);
      alert("Could not save the statement to the server.");
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
        const { error } = await supabase.from('cashbooks').update({ is_deleted: true }).eq('id', id);
        if (error) throw error;
        await loadData();
      } catch (err) {
        alert("Failed to delete entry.");
      } finally {
        setLoading(false);
      }
  };

  if (companyLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeCompany?.id) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 bg-white border border-slate-200 rounded-md">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-medium text-slate-900 mb-2 capitalize">Workspace Required</h2>
        <p className="text-slate-500 text-center max-w-md">
          Please select a workspace first from the top menu to view and manage the cashbook.
        </p>
      </div>
    );
  }

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
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h1 className="text-[20px] font-medium text-slate-900 capitalize">Cashbook Register</h1>
          <button 
            onClick={loadData} 
            title="Refresh Data"
            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex space-x-2">
            <button 
              onClick={handleExportCSV}
              disabled={exporting || entries.length === 0}
              className="px-4 py-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50 transition-none capitalize font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <FileDown className="w-3.5 h-3.5 mr-2" />}
                Export Csv
            </button>
            {entries.length > 0 && (
                <button 
                onClick={() => { setEditingEntry(null); setViewState('entry'); }} 
                className="bg-primary text-slate-900 px-6 py-2 rounded-md font-medium text-sm hover:bg-primary-dark flex items-center transition-none capitalize"
                >
                <Plus className="w-4 h-4 mr-2" /> Create Statement
                </button>
            )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[ 
                { label: 'Total Income', value: stats.income, color: 'text-emerald-600' }, 
                { label: 'Total Expense', value: stats.expense, color: 'text-rose-600' }, 
                { label: 'Net Balance', value: stats.balance, color: 'text-slate-900' } 
                ].map((stat, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col">
                    <span className="text-[11px] text-slate-500 font-medium capitalize tracking-tight mb-1 block">{stat.label}</span>
                    <span className={`text-[24px] font-medium leading-none font-mono ${stat.color}`}>
                    {stat.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                </div>
                ))}
            </div>

            <div className="space-y-4">
                <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Search statements..." 
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300" 
                />
                </div>

                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-medium text-slate-400 capitalize tracking-widest">
                        <th className="w-16 py-4 px-6 text-center border-r border-slate-100 font-medium capitalize">Sr</th>
                        <th className="py-4 px-6 border-r border-slate-100 font-medium capitalize">Stmt Date</th>
                        <th className="text-right py-4 px-6 border-r border-slate-100 font-medium capitalize">Income</th>
                        <th className="text-right py-4 px-6 border-r border-slate-100 font-medium capitalize">Expense</th>
                        <th className="text-right py-4 px-6 border-r border-slate-100 font-medium capitalize">Balance</th>
                        <th className="text-center py-4 px-6 font-medium capitalize">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading && entries.length === 0 ? (
                        <tr>
                        <td colSpan={6} className="text-center py-20 text-slate-400 font-medium capitalize tracking-widest text-[10px]">
                            <div className="flex items-center justify-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Loading records...</span>
                            </div>
                        </td>
                        </tr>
                    ) : filteredEntries.map((e, i) => (
                        <tr key={e.id} className="hover:bg-slate-50/50 group transition-colors border-b border-slate-100 last:border-0">
                        <td className="py-3 px-6 text-center border-r border-slate-100 font-mono text-slate-400">{i + 1}</td>
                        <td className="py-3 px-6 border-r border-slate-100">
                            <div className="flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                            <span className="text-slate-700 font-medium">{e.date}</span>
                            </div>
                        </td>
                        <td className="text-right py-3 px-6 border-r border-slate-100 font-mono text-emerald-600 font-medium">
                            {(Number(e.income_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-3 px-6 border-r border-slate-100 font-mono text-rose-600 font-medium">
                            {(Number(e.expense_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-3 px-6 border-r border-slate-100 font-medium text-slate-900 font-mono">
                            {(Number(e.balance) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-center py-3 px-6">
                            <div className="flex items-center justify-center space-x-2">
                            <button onClick={() => { setEditingEntry(e); setViewState('entry'); }} title="View Statement" className="p-1.5 text-slate-400 hover:text-link hover:bg-link/10 rounded transition-all"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => { setEditingEntry(e); setViewState('entry'); }} title="Edit Statement" className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded transition-all"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => deleteEntry(e.id)} title="Delete Statement" className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-rose-50 rounded transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </td>
                        </tr>
                    ))}
                    {!loading && filteredEntries.length === 0 && (
                        <tr>
                        <td colSpan={6} className="text-center py-24 text-slate-300 italic">
                            {searchQuery ? `No statements found for "${searchQuery}"` : "No cashbook entries registered yet."}
                        </td>
                        </tr>
                    )}
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
