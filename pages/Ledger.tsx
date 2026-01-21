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
  const [mode, setMode] = useState<'Manual' | 'Bulk'>('Manual');
  const cid = getActiveCompanyId();
  
  // Bulk Mode State
  const [bulkEntries, setBulkEntries] = useState<any[]>([]);

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
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => { fetchLedgerData(); }, [fetchLedgerData]);

  // Initialize 20 empty rows when switching to Bulk Mode
  useEffect(() => {
    if (mode === 'Bulk' && bulkEntries.length === 0) {
      const initialRows = [];
      for (let i = 0; i < 20; i++) {
        initialRows.push({ tempId: `in-${i}`, type: 'IN', particulars: '', amount: '' });
        initialRows.push({ tempId: `out-${i}`, type: 'OUT', particulars: '', amount: '' });
      }
      setBulkEntries(initialRows);
    }
  }, [mode]);

  const addMoreRows = (type: 'IN' | 'OUT', count = 10) => {
    const newRows = [];
    for (let i = 0; i < count; i++) {
      newRows.push({ tempId: `${type}-${Date.now()}-${i}`, type, particulars: '', amount: '' });
    }
    setBulkEntries([...bulkEntries, ...newRows]);
  };

  const updateBulkValue = (tempId: string, field: string, value: any) => {
    setBulkEntries(prev => prev.map(row => 
      row.tempId === tempId ? { ...row, [field]: value } : row
    ));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, type: 'IN' | 'OUT') => {
    if (e.key === 'Enter') {
      const typeEntries = bulkEntries.filter(row => row.type === type);
      if (index === typeEntries.length - 1) {
        addMoreRows(type, 10);
      }
    }
  };

  const handleBulkSave = async () => {
    const validEntries = bulkEntries.filter(e => e.particulars.trim() !== '' && parseFloat(e.amount) > 0);
    if (validEntries.length === 0) return alert("Please enter at least one valid transaction.");

    setLoading(true);
    try {
      const payload = validEntries.map(e => ({
        company_id: cid,
        date: new Date().toISOString().split('T')[0],
        particulars: e.particulars.toUpperCase(),
        type: e.type,
        amount: parseFloat(e.amount),
        category: 'General'
      }));

      const { error } = await supabase.from('ledgers').insert(payload);
      if (error) throw error;

      setBulkEntries([]);
      setMode('Manual');
      fetchLedgerData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentTotalIn = entries.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0) + 
                        bulkEntries.filter(e => e.type === 'IN').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  
  const currentTotalOut = entries.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0) +
                         bulkEntries.filter(e => e.type === 'OUT').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="p-2 space-y-6">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
           <h1 className="text-xl font-bold text-slate-800 tracking-tight">Prime Ledger</h1>
           <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
              <button onClick={() => { setMode('Manual'); setBulkEntries([]); }} className={`px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${mode === 'Manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>MANUAL</button>
              <button onClick={() => setMode('Bulk')} className={`px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${mode === 'Bulk' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}>BULK MODE</button>
           </div>
        </div>

        {mode === 'Manual' ? (
          <button onClick={() => setIsModalOpen(true)} className="bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-md hover:translate-y-[-2px] transition-all">
            <Plus size={16} className="mr-2" /> New Entry
          </button>
        ) : (
          <button onClick={handleBulkSave} disabled={loading} className="bg-[#FCD34D] text-slate-900 px-10 py-2.5 rounded-xl font-black text-xs uppercase flex items-center shadow-lg hover:bg-[#FBBF24] transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet size={16} className="mr-2" />}
            Create Ledger
          </button>
        )}
      </div>

      {/* T-Table Grid */}
      <div className={`bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden`}>
        <div className="flex items-center justify-between bg-slate-50 p-6 border-b border-slate-200">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Closing Balance</p>
            <p className="text-2xl font-bold text-blue-600 font-mono">{formatCurrency(currentTotalIn - currentTotalOut)}</p>
          </div>
          {mode === 'Bulk' && <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 uppercase tracking-tighter animate-pulse">Sheet Editing Active</div>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-300 bg-slate-100">
          {/* INCOME SIDE */}
          <div className="bg-white">
            <div className="bg-green-50/50 px-4 py-2 border-b-2 border-green-500 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-green-700">Income / Debit</span>
              <span className="text-xs font-bold text-green-600 font-mono">{formatCurrency(currentTotalIn)}</span>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-200">
                <tr className="divide-x divide-slate-200 uppercase font-black">
                  <th className="w-10 py-2">#</th>
                  <th className="text-left px-4">Particulars</th>
                  <th className="w-32 text-right px-4">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mode === 'Manual' ? (
                  entries.filter(e => e.type === 'IN').map((e, i) => (
                    <tr key={e.id} className="divide-x divide-slate-100 h-9 hover:bg-slate-50">
                      <td className="text-center text-slate-400 font-mono">{i+1}</td>
                      <td className="px-4 font-bold text-slate-700 uppercase">{e.particulars}</td>
                      <td className="px-4 text-right font-bold text-green-600 font-mono">{e.amount.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  bulkEntries.filter(e => e.type === 'IN').map((e, i) => (
                    <tr key={e.tempId} className="divide-x divide-slate-100 h-10 group bg-white focus-within:bg-blue-50/30">
                      <td className="text-center text-slate-300 font-mono">{i+1}</td>
                      <td className="px-2">
                        <input className="w-full bg-transparent outline-none font-bold uppercase p-1" placeholder="..." value={e.particulars} onChange={v => updateBulkValue(e.tempId, 'particulars', v.target.value)} />
                      </td>
                      <td className="px-2">
                        <input type="number" className="w-full bg-transparent text-right font-mono font-bold text-green-600 outline-none p-1" placeholder="0.00" value={e.amount} onChange={v => updateBulkValue(e.tempId, 'amount', v.target.value)} onKeyDown={ev => handleKeyDown(ev, i, 'IN')} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {mode === 'Bulk' && (
              <button onClick={() => addMoreRows('IN')} className="w-full py-3 text-[10px] font-black text-slate-400 hover:text-green-600 uppercase border-t border-slate-100 transition-colors">
                + Add More Rows (Income)
              </button>
            )}
          </div>

          {/* EXPENSE SIDE */}
          <div className="bg-white">
            <div className="bg-red-50/50 px-4 py-2 border-b-2 border-red-500 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-red-700">Expense / Credit</span>
              <span className="text-xs font-bold text-red-600 font-mono">{formatCurrency(currentTotalOut)}</span>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-200">
                <tr className="divide-x divide-slate-200 uppercase font-black">
                  <th className="w-10 py-2">#</th>
                  <th className="text-left px-4">Particulars</th>
                  <th className="w-32 text-right px-4">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mode === 'Manual' ? (
                  entries.filter(e => e.type === 'OUT').map((e, i) => (
                    <tr key={e.id} className="divide-x divide-slate-100 h-9 hover:bg-slate-50">
                      <td className="text-center text-slate-400 font-mono">{i+1}</td>
                      <td className="px-4 font-bold text-slate-700 uppercase">{e.particulars}</td>
                      <td className="px-4 text-right font-bold text-red-600 font-mono">{e.amount.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  bulkEntries.filter(e => e.type === 'OUT').map((e, i) => (
                    <tr key={e.tempId} className="divide-x divide-slate-100 h-10 bg-white focus-within:bg-blue-50/30">
                      <td className="text-center text-slate-300 font-mono">{i+1}</td>
                      <td className="px-2">
                        <input className="w-full bg-transparent outline-none font-bold uppercase p-1" placeholder="..." value={e.particulars} onChange={v => updateBulkValue(e.tempId, 'particulars', v.target.value)} />
                      </td>
                      <td className="px-2">
                        <input type="number" className="w-full bg-transparent text-right font-mono font-bold text-red-600 outline-none p-1" placeholder="0.00" value={e.amount} onChange={v => updateBulkValue(e.tempId, 'amount', v.target.value)} onKeyDown={ev => handleKeyDown(ev, i, 'OUT')} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {mode === 'Bulk' && (
              <button onClick={() => addMoreRows('OUT')} className="w-full py-3 text-[10px] font-black text-slate-400 hover:text-red-600 uppercase border-t border-slate-100 transition-colors">
                + Add More Rows (Expense)
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Manual Entry Modal - Only accessible in Manual mode */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Ledger Entry">
         {/* ... (Existing Modal Form Code) ... */}
         <p className="p-10 text-center text-xs text-slate-400 uppercase font-black">Standard Entry Form</p>
      </Modal>
    </div>
  );
};

export default Ledger;
