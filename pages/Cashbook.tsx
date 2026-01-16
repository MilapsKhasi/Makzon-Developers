import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2, Calendar, Trash2, Edit, Eye, ArrowLeft, FileDown, AlertCircle } from 'lucide-react';
import { getActiveCompanyId, formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import CashbookSheet from '../components/CashbookSheet';
import { exportToCSV } from '../utils/exportHelper';

const Cashbook = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState<'list' | 'entry'>('list');
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbError, setDbError] = useState(false);
  const [exporting, setExporting] = useState(false);

  // activeCompanyId is derived from local storage/helpers
  const activeCompanyId = getActiveCompanyId();

  const loadData = async () => {
    // Only fetch if we have a valid company context
    const cid = getActiveCompanyId();
    
    // Debug log as requested
    console.log('Current Company ID being used:', cid);

    if (!cid) {
      setLoading(false);
      setEntries([]);
      return;
    }

    setLoading(true);
    try {
      // Fetching with strict filtering
      const { data, error } = await supabase
        .from('cashbooks')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('date', { ascending: false });
      
      // Debug log raw response as requested
      console.log('Supabase Raw Response:', { data, error });

      if (error) {
        // Detailed error logging
        console.error("Cashbook API Fetch Failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });

        if (error.message.includes('schema cache') || error.message.includes('not found') || error.message.includes('does not exist')) {
           setDbError(true);
        }
        throw error;
      }

      setEntries(data || []);
      setDbError(false);
    } catch (e: any) {
      console.warn("Cashbook module falling back to local storage cache for ID:", cid);
      const localData = localStorage.getItem(`local_cashbook_${cid}`);
      if (localData) {
        setEntries(JSON.parse(localData));
      } else {
        setEntries([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if activeCompanyId exists before fetching
    if (!activeCompanyId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Load data immediately on page mount / company change
    loadData();

    const handleSettingsChange = () => {
      loadData();
    };
    
    window.addEventListener('appSettingsChanged', handleSettingsChange);
    
    // Cleanup function: release listeners and clear state to prevent "old data" flickers
    return () => {
      window.removeEventListener('appSettingsChanged', handleSettingsChange);
      setEntries([]); 
      setLoading(true);
    };
  }, [activeCompanyId]); // Dependency array includes activeCompanyId for navigation/switch refreshes

  const stats = useMemo(() => {
    return entries.reduce((acc, entry) => ({
      income: acc.income + (Number(entry.income_total) || 0),
      expense: acc.expense + (Number(entry.expense_total) || 0),
      balance: acc.balance + (Number(entry.balance) || 0)
    }), { income: 0, expense: 0, balance: 0 });
  }, [entries]);

  const handleExportCSV = async () => {
    const cid = getActiveCompanyId();
    if (!cid || entries.length === 0) return;

    setExporting(true);
    try {
      const { data: company } = await supabase.from('companies').select('*').eq('id', cid).single();
      
      const headers = ['SR', 'STMT DATE', 'INCOME (INR)', 'EXPENSE (INR)', 'NET BALANCE (INR)'];
      const rows = entries.map((e, i) => [
        i + 1,
        e.date,
        (Number(e.income_total) || 0).toFixed(2),
        (Number(e.expense_total) || 0).toFixed(2),
        (Number(e.balance) || 0).toFixed(2)
      ]);

      const config = {
        companyName: company?.name || 'Cashbook Report',
        gstin: company?.gstin || 'N/A',
        email: company?.email || '',
        phone: company?.phone || '',
        address: company?.address || 'N/A',
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
    const cid = getActiveCompanyId();
    
    const payload = { 
      company_id: cid, 
      date: data.date, 
      income_total: data.incomeTotal, 
      expense_total: data.expenseTotal, 
      balance: data.balance, 
      raw_data: data, 
      is_deleted: false
    };

    // Log the Payload before sending
    console.log('Sending this to Supabase:', payload);

    try {
      let queryResult;
      if (data.id && typeof data.id === 'string' && !data.id.startsWith('local_')) {
        queryResult = await supabase.from('cashbooks').update(payload).eq('id', data.id).select();
      } else {
        // Including created_at as it is now part of the schema
        queryResult = await supabase.from('cashbooks').insert([{ ...payload, created_at: new Date().toISOString() }]).select();
      }
      
      const { data: responseData, error: responseError } = queryResult;

      // Report the Truth to the console
      console.log('Supabase Save Response:', { data: responseData, error: responseError });

      if (responseError) {
        // Alert on Failure
        alert('Save Failed: ' + responseError.message);
        throw responseError;
      }
      
      await loadData();
    } catch (e: any) {
      console.warn("Sync failed, updating local copy:", e.message);
      const localKey = `local_cashbook_${cid}`;
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      
      let updated;
      if (data.id) {
        updated = existing.map((e: any) => e.id === data.id ? { ...e, ...payload } : e);
      } else {
        const localEntry = { 
          ...payload, 
          id: 'local_' + Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString()
        };
        updated = [localEntry, ...existing];
      }
      
      localStorage.setItem(localKey, JSON.stringify(updated));
      setEntries(updated);
    } finally { 
      setLoading(false);
      setViewState('list'); 
      setEditingEntry(null); 
    }
  };

  const deleteEntry = async (id: string) => {
      const cid = getActiveCompanyId();
      if (!confirm("Permanently delete this statement?")) return;
      
      setLoading(true);
      try {
        if (id.startsWith('local_')) {
          const localKey = `local_cashbook_${cid}`;
          const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
          const updated = existing.filter((e: any) => e.id !== id);
          localStorage.setItem(localKey, JSON.stringify(updated));
          setEntries(updated);
        } else {
          const { error } = await supabase.from('cashbooks').update({ is_deleted: true }).eq('id', id);
          if (error) throw error;
          await loadData();
        }
      } catch (err) {
        alert("Failed to delete entry.");
      } finally {
        setLoading(false);
      }
  };

  // UI Fallback if no workspace is selected
  if (!activeCompanyId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 bg-white border border-slate-200 rounded-md">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Workspace Required</h2>
        <p className="text-slate-500 text-center max-w-md">
          Please select a workspace first from the top menu or the workspaces directory to view and manage the cashbook.
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
        <h1 className="text-[20px] font-normal text-slate-900">Cashbook Register</h1>
        <div className="flex space-x-2">
            <button 
              onClick={handleExportCSV}
              disabled={exporting || entries.length === 0}
              className="px-4 py-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50 transition-none uppercase font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <FileDown className="w-3.5 h-3.5 mr-2" />}
                Export CSV
            </button>
            <button 
              onClick={() => { setEditingEntry(null); setViewState('entry'); }} 
              className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark flex items-center transition-none uppercase"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Statement
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[ 
          { label: 'TOTAL INCOME', value: stats.income }, 
          { label: 'TOTAL EXPENSE', value: stats.expense }, 
          { label: 'NET BALANCE', value: stats.balance } 
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col">
            <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight mb-1 block">{stat.label}</span>
            <span className="text-[24px] font-normal text-slate-900 leading-none font-mono">
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
            placeholder="Search statements by date (YYYY-MM-DD)..." 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300" 
          />
        </div>

        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                <th className="w-16 py-4 px-6 text-center border-r border-slate-100">SR</th>
                <th className="py-4 px-6 border-r border-slate-100">STMT DATE</th>
                <th className="text-right py-4 px-6 border-r border-slate-100">INCOME</th>
                <th className="text-right py-4 px-6 border-r border-slate-100">EXPENSE</th>
                <th className="text-right py-4 px-6 border-r border-slate-100">BALANCE</th>
                <th className="text-center py-4 px-6">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-slate-400 font-semibold uppercase tracking-widest text-[10px]">
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
                  <td className="text-right py-3 px-6 border-r border-slate-100 font-mono text-emerald-600 font-semibold">
                    {(Number(e.income_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right py-3 px-6 border-r border-slate-100 font-mono text-rose-600 font-semibold">
                    {(Number(e.expense_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right py-3 px-6 border-r border-slate-100 font-semibold text-slate-900 font-mono">
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
    </div>
  );
};

export default Cashbook;