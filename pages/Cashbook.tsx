
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2, Calendar, Trash2 } from 'lucide-react';
import { getActiveCompanyId, formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import CashbookSheet from '../components/CashbookSheet';

const Cashbook = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbError, setDbError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data, error } = await supabase
        .from('cashbooks')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (error) {
        if (error.message.includes('schema cache') || error.message.includes('not found')) {
          throw new Error("SCHEMA_MISSING");
        }
        throw error;
      }
      setEntries(data || []);
      setDbError(false);
    } catch (e: any) {
      const localData = localStorage.getItem(`local_cashbook_${cid}`);
      if (localData) {
        setEntries(JSON.parse(localData));
      }
      if (e.message === "SCHEMA_MISSING") setDbError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, []);

  const stats = useMemo(() => {
    return entries.reduce((acc, entry) => ({
      income: acc.income + (entry.income_total || 0),
      expense: acc.expense + (entry.expense_total || 0),
      balance: acc.balance + (entry.balance || 0)
    }), { income: 0, expense: 0, balance: 0 });
  }, [entries]);

  const handleSaveSheet = async (data: any) => {
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
        id: Math.random().toString(36).substr(2, 9),
        company_id: cid,
        user_id: user?.id,
        date: data.date,
        income_total: data.incomeTotal,
        expense_total: data.expenseTotal,
        balance: data.balance,
        raw_data: data,
        is_deleted: false,
        created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('cashbooks').insert([payload]);
      if (error) throw error;
      loadData();
    } catch (e) {
      const existing = JSON.parse(localStorage.getItem(`local_cashbook_${cid}`) || '[]');
      const updated = [payload, ...existing];
      localStorage.setItem(`local_cashbook_${cid}`, JSON.stringify(updated));
      setEntries(updated);
    } finally {
      setIsModalOpen(false);
    }
  };

  const deleteEntry = (id: string) => {
      const cid = getActiveCompanyId();
      if (confirm("Permanently delete this statement?")) {
          supabase.from('cashbooks').update({ is_deleted: true }).eq('id', id).then(({error}) => {
              if (error) {
                  const existing = JSON.parse(localStorage.getItem(`local_cashbook_${cid}`) || '[]');
                  const updated = existing.filter((e: any) => e.id !== id);
                  localStorage.setItem(`local_cashbook_${cid}`, JSON.stringify(updated));
                  setEntries(updated);
              } else {
                  loadData();
              }
          });
      }
  };

  const filteredEntries = entries.filter(e => 
    e.date.includes(searchQuery)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 overflow-hidden">
          {/* 30% Opacity Backdrop */}
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setIsModalOpen(false)} />
          <CashbookSheet onSave={handleSaveSheet} onCancel={() => setIsModalOpen(false)} />
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-[20px] font-normal text-slate-900">Cashbook</h1>
        <div className="flex space-x-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50 transition-none uppercase font-medium">Export Data</button>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark shadow-sm flex items-center transition-none uppercase"
            >
                <Plus className="w-4 h-4 mr-2" /> Create Statement
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'TOTAL INCOME', value: stats.income, color: 'text-slate-900' },
          { label: 'TOTAL EXPENSE', value: stats.expense, color: 'text-slate-900' },
          { label: 'NET BALANCE', value: stats.balance, color: 'text-slate-900' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col">
            <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight mb-1 block">{stat.label}</span>
            <span className={`text-[24px] font-normal ${stat.color} leading-none font-mono`}>
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
            placeholder="Search statements by date..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300"
          />
        </div>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="clean-table">
            <thead>
              <tr>
                <th className="w-16">SR NO</th>
                <th>DATE</th>
                <th className="text-right">INCOME</th>
                <th className="text-right">EXPENSE</th>
                <th className="text-right font-medium">BALANCE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-20 text-slate-400">Loading records...</td></tr>
              ) : filteredEntries.map((e, i) => (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td>{i + 1}</td>
                  <td>
                    <div className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                        <span className="text-slate-700">{formatDate(e.date)}</span>
                    </div>
                  </td>
                  <td className="text-right font-mono">{(e.income_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="text-right font-mono">{(e.expense_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="text-right font-medium text-slate-900 font-mono">{(e.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="text-right">
                    <button onClick={() => deleteEntry(e.id)} className="text-slate-400 hover:text-red-500 p-1 transition-none">
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredEntries.length === 0 && (
                <tr><td colSpan={6} className="text-center py-20 text-slate-300 italic">No cashbook entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Cashbook;
