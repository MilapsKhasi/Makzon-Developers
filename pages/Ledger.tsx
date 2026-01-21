import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Loader2, Wallet, 
  ArrowUpRight, ArrowDownLeft, Filter 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, formatDate, formatCurrency } from '../utils/helpers';
import Modal from '../components/Modal';

const Ledger = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const cid = getActiveCompanyId();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    particulars: '',
    category: 'General',
    type: 'IN',
    amount: '',
    payment_mode: 'Cash',
    reference_no: ''
  });

  const fetchLedgerData = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ledgers')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err: any) {
      console.error("Ledger Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => {
    fetchLedgerData();
  }, [fetchLedgerData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('ledgers').insert([{
        company_id: cid,
        ...formData,
        particulars: formData.particulars.toUpperCase(),
        amount: parseFloat(formData.amount)
      }]);
      if (error) throw error;
      setIsModalOpen(false);
      fetchLedgerData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalIn = entries.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalOut = entries.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="p-2 space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total In</span>
            <ArrowDownLeft className="text-green-500" size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono text-green-600">{formatCurrency(totalIn)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Out</span>
            <ArrowUpRight className="text-red-500" size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono text-red-600">{formatCurrency(totalOut)}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Balance</span>
          <p className="text-2xl font-bold text-primary mt-2 font-mono">{formatCurrency(totalIn - totalOut)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search particulars..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-primary text-slate-900 px-6 py-2 rounded-lg font-bold text-xs uppercase flex items-center shadow-md">
          <Plus size={16} className="mr-2" /> Add Entry
        </button>
      </div>
      
      {/* Table Placeholder (Similar to previous version) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Particulars</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
               <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
            ) : entries.length === 0 ? (
               <tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">No transactions yet.</td></tr>
            ) : entries.map(entry => (
              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-xs font-bold text-slate-600">{formatDate(entry.date)}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900">{entry.particulars}</td>
                <td className={`px-6 py-4 text-right font-mono font-bold ${entry.type === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                  {entry.type === 'IN' ? '+' : '-'}{entry.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Transaction">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input required type="number" placeholder="Amount" className="w-full p-3 bg-slate-100 rounded-lg outline-none" onChange={e => setFormData({...formData, amount: e.target.value})} />
          <input required type="text" placeholder="Particulars" className="w-full p-3 bg-slate-100 rounded-lg outline-none uppercase" onChange={e => setFormData({...formData, particulars: e.target.value})} />
          <button type="submit" className="w-full bg-primary py-3 rounded-lg font-bold text-xs uppercase shadow-lg">Save Entry</button>
        </form>
      </Modal>
    </div>
  );
};

export default Ledger;
