import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Loader2, Wallet, 
  ArrowUpRight, ArrowDownLeft, Filter, X 
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
    if (!cid) return alert("Select a company first!");
    if (!formData.amount || !formData.particulars) return alert("Please fill all fields!");
    
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
        reference_no: formData.reference_no.trim() === "" ? null : formData.reference_no
      }]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({ ...formData, particulars: '', amount: '', reference_no: '' });
      await fetchLedgerData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalIn = entries.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalOut = entries.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="p-2 space-y-6 animate-in fade-in duration-500">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
           <h1 className="text-xl font-bold text-slate-800">Prime Ledger</h1>
           <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">v26.1.9</div>
        </div>
        <button 
          disabled={!cid}
          onClick={() => setIsModalOpen(true)} 
          className="bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          <Plus size={16} className="mr-2" /> New Entry
        </button>
      </div>

      {/* Main T-Shape Ledger View */}
      <div className="bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden">
        {/* Header Stats */}
        <div className="flex items-center justify-between bg-slate-50 p-6 border-b border-slate-200">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Closing Balance</p>
              <p className="text-xl font-bold text-blue-600 font-mono">{formatCurrency(totalIn - totalOut)}</p>
            </div>
            <div className="h-8 w-[1px] bg-slate-200" />
            <div className="flex gap-4">
               <div className="text-center">
                  <p className="text-[9px] font-bold text-green-500 uppercase">Total Income</p>
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(totalIn)}</p>
               </div>
               <div className="text-center">
                  <p className="text-[9px] font-bold text-red-500 uppercase">Total Expense</p>
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(totalOut)}</p>
               </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* The T-Table Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-300">
          {/* INCOME SIDE */}
          <div className="overflow-hidden">
            <div className="bg-green-50/50 px-4 py-2 border-b-2 border-green-500 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-green-700">Income / Debit</span>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase">
                <tr className="divide-x divide-slate-200">
                  <th className="w-10 py-2">#</th>
                  <th className="text-left px-4">Particulars</th>
                  <th className="w-24 text-right px-4">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.filter(e => e.type === 'IN').map((e, i) => (
                  <tr key={e.id} className="divide-x divide-slate-100 h-9 hover:bg-slate-50">
                    <td className="text-center text-slate-400">{i+1}</td>
                    <td className="px-4 font-bold text-slate-700 uppercase truncate max-w-[150px]">{e.particulars}</td>
                    <td className="px-4 text-right font-bold text-green-600 font-mono">{e.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {[...Array(Math.max(0, 10 - entries.filter(e => e.type === 'IN').length))].map((_, i) => (
                  <tr key={`fill-in-${i}`} className="divide-x divide-slate-50 h-9"><td/><td/><td/></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* EXPENSE SIDE */}
          <div className="overflow-hidden">
            <div className="bg-red-50/50 px-4 py-2 border-b-2 border-red-500 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-red-700">Expense / Credit</span>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase">
                <tr className="divide-x divide-slate-200">
                  <th className="w-10 py-2">#</th>
                  <th className="text-left px-4">Particulars</th>
                  <th className="w-24 text-right px-4">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.filter(e => e.type === 'OUT').map((e, i) => (
                  <tr key={e.id} className="divide-x divide-slate-100 h-9 hover:bg-slate-50">
                    <td className="text-center text-slate-400">{i+1}</td>
                    <td className="px-4 font-bold text-slate-700 uppercase truncate max-w-[150px]">{e.particulars}</td>
                    <td className="px-4 text-right font-bold text-red-600 font-mono">{e.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {[...Array(Math.max(0, 10 - entries.filter(e => e.type === 'OUT').length))].map((_, i) => (
                  <tr key={`fill-out-${i}`} className="divide-x divide-slate-50 h-9"><td/><td/><td/></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Ledger Entry">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button type="button" onClick={() => setFormData({...formData, type: 'IN'})} className={`flex-1 py-2 text-[10px] font-bold rounded transition-all ${formData.type === 'IN' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400'}`}>INCOME</button>
             <button type="button" onClick={() => setFormData({...formData, type: 'OUT'})} className={`flex-1 py-2 text-[10px] font-bold rounded transition-all ${formData.type === 'OUT' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>EXPENSE</button>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Amount (₹)</label>
            <input required type="number" step="0.01" placeholder="0.00" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xl text-center focus:border-primary outline-none transition-all" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Particulars</label>
            <input required type="text" placeholder="E.G. OFFICE RENT" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:border-primary outline-none transition-all" value={formData.particulars} onChange={e => setFormData({...formData, particulars: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Date</label>
               <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
             </div>
             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Ref No</label>
               <input type="text" placeholder="OPTIONAL" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase outline-none" value={formData.reference_no} onChange={e => setFormData({...formData, reference_no: e.target.value})} />
             </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#FCD34D] py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all hover:bg-[#FBBF24]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Transaction'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Ledger;
