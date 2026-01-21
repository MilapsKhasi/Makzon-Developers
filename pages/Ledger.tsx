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
    
    // 1. Validation check
    if (!cid) return alert("No active company selected!");
    if (!formData.particulars || !formData.amount) return alert("Please fill required fields!");

    setLoading(true);
    try {
      // 2. Prepare Payload
      const payload = {
        company_id: cid, // Ensure this is a valid UUID from helper
        date: formData.date,
        particulars: formData.particulars.toUpperCase(),
        category: formData.category,
        type: formData.type,
        amount: parseFloat(formData.amount),
        payment_mode: formData.payment_mode,
        // The Fix: If reference_no is empty, send NULL instead of ""
        reference_no: formData.reference_no.trim() === "" ? null : formData.reference_no
      };

      const { error } = await supabase
        .from('ledgers')
        .insert([payload]);

      if (error) throw error;

      // 3. Reset and Refresh
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
      console.error("Submission Error:", err);
      alert(`Error: ${err.message}`);
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

<Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cashbook Entry" maxWidth="max-w-6xl">
  <div className="p-6 bg-white space-y-4">
    {/* Top Bar: Date & Balance */}
    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
      <div className="flex items-center gap-4">
        <label className="text-xs font-bold text-slate-500">Date</label>
        <input 
          type="date" 
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className="px-3 py-1.5 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="ml-4">
          <span className="text-sm font-medium text-slate-600">Closing Balance: </span>
          <span className="text-sm font-bold text-blue-600">{formatCurrency(totalIn - totalOut)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <select className="text-[10px] border border-slate-300 rounded px-2 py-1 bg-white outline-none">
          <option>Page Size</option>
        </select>
        <select className="text-[10px] border border-slate-300 rounded px-2 py-1 bg-white outline-none">
          <option>Export</option>
        </select>
      </div>
    </div>

    {/* Dual Entry Table Container */}
    <div className="grid grid-cols-2 border border-slate-300 rounded-lg overflow-hidden">
      {/* Income Side (Left) */}
      <div className="border-r border-slate-300">
        <div className="flex justify-between items-center bg-slate-50 px-4 py-2 border-b border-green-500 border-b-2">
          <span className="text-sm font-bold text-slate-700">Income</span>
          <span className="text-sm font-bold text-green-600">Total Income: {formatCurrency(totalIn)}</span>
        </div>
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="divide-x divide-slate-200 text-slate-500 uppercase">
              <th className="w-12 py-2">Sr No</th>
              <th className="text-left px-4">Particulars</th>
              <th className="w-24 text-right px-4">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 min-h-[300px]">
            {/* We map the actual data here, filling empty rows to match your UI */}
            {entries.filter(e => e.type === 'IN').map((e, idx) => (
              <tr key={e.id} className="divide-x divide-slate-100 h-8">
                <td className="text-center text-slate-400">{idx + 1}</td>
                <td className="px-4 font-medium uppercase">{e.particulars}</td>
                <td className="px-4 text-right font-bold text-green-600">{e.amount.toFixed(2)}</td>
              </tr>
            ))}
            {/* Filler rows to match your image style */}
            {[...Array(Math.max(0, 10 - entries.filter(e => e.type === 'IN').length))].map((_, i) => (
              <tr key={`fill-in-${i}`} className="divide-x divide-slate-100 h-8">
                <td></td><td></td><td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expense Side (Right) */}
      <div>
        <div className="flex justify-between items-center bg-slate-50 px-4 py-2 border-b border-red-500 border-b-2">
          <span className="text-sm font-bold text-slate-700">Expense</span>
          <span className="text-sm font-bold text-red-600">Total Expense: {formatCurrency(totalOut)}</span>
        </div>
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="divide-x divide-slate-200 text-slate-500 uppercase">
              <th className="w-12 py-2">Sr No</th>
              <th className="text-left px-4">Particulars</th>
              <th className="w-24 text-right px-4">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.filter(e => e.type === 'OUT').map((e, idx) => (
              <tr key={e.id} className="divide-x divide-slate-100 h-8">
                <td className="text-center text-slate-400">{idx + 1}</td>
                <td className="px-4 font-medium uppercase">{e.particulars}</td>
                <td className="px-4 text-right font-bold text-red-600">{e.amount.toFixed(2)}</td>
              </tr>
            ))}
            {[...Array(Math.max(0, 10 - entries.filter(e => e.type === 'OUT').length))].map((_, i) => (
              <tr key={`fill-out-${i}`} className="divide-x divide-slate-100 h-8">
                <td></td><td></td><td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Bottom Totals Summary */}
    <div className="flex justify-center">
        <div className="w-64 space-y-1 py-4">
            <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-500">Total Income</span>
                <span className="text-green-600">{formatCurrency(totalIn)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-500">Total Expense</span>
                <span className="text-red-600">{formatCurrency(totalOut)}</span>
            </div>
            <div className="h-[1px] bg-slate-200 my-1" />
            <div className="flex justify-between text-sm font-black uppercase tracking-tighter">
                <span className="text-slate-900">Balance</span>
                <span className="text-blue-600">{formatCurrency(totalIn - totalOut)}</span>
            </div>
        </div>
    </div>

    {/* Footer Actions */}
    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
      <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase">Discard</button>
      <button 
        onClick={handleSubmit}
        disabled={loading}
        className="bg-[#FCD34D] text-slate-900 px-8 py-2 rounded font-bold text-xs uppercase shadow-sm hover:bg-[#FBBF24] transition-all"
      >
        {loading ? 'Processing...' : 'Create Statement'}
      </button>
    </div>
  </div>
</Modal>
