import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Download, Trash2, Edit, Loader2, 
  ArrowUpRight, ArrowDownLeft, Wallet, Calendar, Filter,
  MoreVertical, CheckCircle2, Clock
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
  
  // Form State for v26.1.9
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    particulars: '',
    category: 'General',
    type: 'IN', // 'IN' for Income, 'OUT' for Expense
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
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

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
    if (!formData.particulars || !formData.amount) return alert("Fill required fields!");

    setLoading(true);
    try {
      const { error } = await supabase.from('ledgers').insert([{
        company_id: cid,
        date: formData.date,
        particulars: formData.particulars.toUpperCase(),
        category: formData.category,
        type: formData.type,
        amount: parseFloat(formData.amount),
        payment_mode: formData.payment_mode,
        reference_no: formData.reference_no
      }]);

      if (error) throw error;

      // Reset & Refresh
      setFormData({
        date: new Date().toISOString().split('T')[0],
        particulars: '',
        category: 'General',
        type: 'IN',
        amount: '',
        payment_mode: 'Cash',
        reference_no: ''
      });
      setIsModalOpen(false);
      await fetchLedgerData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if(!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const { error } = await supabase.from('ledgers').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
      await fetchLedgerData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Calculations
  const totalIn = entries.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalOut = entries.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0);
  const balance = totalIn - totalOut;

  const filteredEntries = entries.filter(e => 
    e.particulars.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Prime Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-green-200 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Inflow</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{formatCurrency(totalIn)}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl text-green-600 group-hover:scale-110 transition-transform">
              <ArrowDownLeft size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:border-red-200 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Outflow</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{formatCurrency(totalOut)}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl text-red-600 group-hover:scale-110 transition-transform">
              <ArrowUpRight size={20} />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Cash Balance</p>
            <p className="text-2xl font-bold text-primary mt-1 font-mono">{formatCurrency(balance)}</p>
          </div>
          <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 group-hover:rotate-12 transition-transform duration-500" />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search transactions, categories..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsModalOpen(true)} className="bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center hover:shadow-lg active:scale-95 transition-all">
            <Plus size={18} className="mr-2" /> New Entry
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Ref</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Particulars</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic font-medium">No transactions found in this period.</td></tr>
              ) : filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">{formatDate(entry.date)}</span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{entry.reference_no || 'No Ref'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{entry.particulars}</span>
                      <span className="text-[10px] font-bold text-primary uppercase">{entry.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase">
                      {entry.payment_mode}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold text-sm ${entry.type === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                    {entry.type === 'IN' ? '+' : '-'}{entry.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => deleteEntry(entry.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Ledger Entry" maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button 
              type="button" 
              onClick={() => setFormData({...formData, type: 'IN'})}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.type === 'IN' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}
            >INCOME (IN)</button>
            <button 
              type="button" 
              onClick={() => setFormData({...formData, type: 'OUT'})}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.type === 'OUT' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
            >EXPENSE (OUT)</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-primary transition-all outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount (₹)</label>
              <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:border-primary transition-all outline-none" placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Particulars</label>
            <input required type="text" value={formData.particulars} onChange={e => setFormData({...formData, particulars: e.target.value})} placeholder="E.G. OFFICE RENT PAYMENT" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-primary transition-all outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-primary transition-all outline-none">
                <option value="General">General</option>
                <option value="Sales">Sales</option>
                <option value="Purchase">Purchase</option>
                <option value="Rent">Rent</option>
                <option value="Salary">Salary</option>
                <option value="Electricity">Electricity</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mode</label>
              <select value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-primary transition-all outline-none">
                <option value="Cash">Cash</option>
                <option value="Bank">Bank Transfer</option>
                <option value="UPI">UPI / GPay</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary text-slate-900 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirm Transaction'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Ledger;
