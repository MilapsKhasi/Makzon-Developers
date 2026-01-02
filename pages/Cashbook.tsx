
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Loader2, Calendar, FileText, Download, Filter, Wallet } from 'lucide-react';
import { getActiveCompanyId, formatDate, formatCurrency } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import CashbookSheet from '../components/CashbookSheet';

const Cashbook = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data } = await supabase
        .from('cashbooks')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      setEntries(data || []);
    } catch (e) {
      console.error("Cashbook load error:", e);
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
    
    try {
      const payload = {
        company_id: cid,
        user_id: user?.id,
        date: data.date,
        income_total: data.incomeTotal,
        expense_total: data.expenseTotal,
        balance: data.balance,
        raw_data: data,
        is_deleted: false
      };

      const { error } = await supabase.from('cashbooks').insert([payload]);
      if (error) throw error;
      
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      alert("Error saving: " + e.message);
    }
  };

  const filteredEntries = entries.filter(e => 
    e.date.includes(searchQuery)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
      {/* Full scale modal for the entry form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-900/10 flex items-center justify-center p-4">
          <CashbookSheet onSave={handleSaveSheet} onCancel={() => setIsModalOpen(false)} />
        </div>
      )}

      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-[20px] font-normal text-slate-900">Cashbook</h1>
        <div className="flex space-x-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50">EXPORT DATA</button>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark shadow-sm flex items-center"
            >
                <Plus className="w-4 h-4 mr-2" /> CREATE STATEMENT
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        {[
          { label: 'TOTAL INCOME', value: formatCurrency(stats.income), color: 'text-green-600' },
          { label: 'TOTAL EXPENSE', value: formatCurrency(stats.expense), color: 'text-red-500' },
          { label: 'NET BALANCE', value: formatCurrency(stats.balance), color: 'text-slate-900 font-black' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md p-6 flex flex-col shadow-sm">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">{stat.label}</span>
            <span className={`text-2xl font-normal ${stat.color} font-mono leading-none`}>{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4 flex-1 flex flex-col min-h-0">
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search statements by date..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300 shadow-sm"
          />
        </div>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm flex-1 overflow-y-auto custom-scrollbar">
          <table className="clean-table w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-16">SR NO</th>
                <th>STATEMENT DATE</th>
                <th className="text-right">INCOME</th>
                <th className="text-right">EXPENSE</th>
                <th className="text-right">BALANCE</th>
                <th className="text-center">DOCS</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-20 text-slate-400">Loading cashbook history...</td></tr>
              ) : filteredEntries.map((e, i) => (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td>{i + 1}</td>
                  <td>
                    <div className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                        <span className="font-bold text-slate-700">{formatDate(e.date)}</span>
                    </div>
                  </td>
                  <td className="text-right font-mono text-green-600">{(e.income_total || 0).toFixed(2)}</td>
                  <td className="text-right font-mono text-red-400">{(e.expense_total || 0).toFixed(2)}</td>
                  <td className="text-right font-mono font-bold text-slate-900">{(e.balance || 0).toFixed(2)}</td>
                  <td className="text-center">
                    <button className="text-slate-400 hover:text-primary transition-colors">
                        <FileText className="w-4 h-4 mx-auto" />
                    </button>
                  </td>
                  <td className="text-right">
                    <button className="text-slate-400 hover:text-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-tighter border border-slate-100 rounded hover:bg-white transition-all shadow-sm">VIEW SHEET</button>
                  </td>
                </tr>
              ))}
              {!loading && filteredEntries.length === 0 && (
                <tr><td colSpan={7} className="text-center py-32 text-slate-300 italic">
                    <div className="flex flex-col items-center">
                        <Wallet className="w-12 h-12 opacity-5 mb-4" />
                        <p>No cashbook entries found. Start by creating a statement.</p>
                    </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Cashbook;
