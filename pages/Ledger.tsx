import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Trash2, Loader2, Wallet, 
  ArrowUpRight, ArrowDownLeft, Filter, X, ToggleLeft, ToggleRight
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

  // State for Bulk Mode Drafts
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

  // Handle Bulk Row Addition
  const addBulkRow = (type: 'IN' | 'OUT') => {
    const newRow = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      particulars: '',
      type: type,
      amount: 0,
      is_draft: true
    };
    setBulkEntries([...bulkEntries, newRow]);
  };

  // Update Bulk Row Data
  const updateBulkRow = (id: string, field: string, value: any) => {
    setBulkEntries(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  // Save Bulk Entries to Supabase
  const handleBulkSave = async () => {
    if (bulkEntries.length === 0) return alert("No entries to save!");
    setLoading(true);
    try {
      const payload = bulkEntries.map(e => ({
        company_id: cid,
        date: e.date,
        particulars: e.particulars.toUpperCase(),
        type: e.type,
        amount: parseFloat(e.amount.toString()) || 0,
        category: 'General'
      })).filter(e => e.particulars !== "" && e.amount > 0);

      const { error } = await supabase.from('ledgers').insert(payload);
      if (error) throw error;

      setBulkEntries([]);
      setMode('Manual');
      fetchLedgerData();
      alert("Ledger Created Successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalIn = entries.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0) + 
                  bulkEntries.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0);
  
  const totalOut = entries.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0) +
                   bulkEntries.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="p-2 space-y-6">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
           <h1 className="text-xl font-bold text-slate-800">Prime Ledger</h1>
           {/* Mode Toggle */}
           <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button 
                onClick={() => { setMode('Manual'); setBulkEntries([]); }}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${mode === 'Manual' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
              >
                MANUAL
              </button>
              <button 
                onClick={() => setMode('Bulk')}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${mode === 'Bulk' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
              >
                BULK MODE
              </button>
           </div>
        </div>

        {mode === 'Manual' ? (
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-md hover:scale-105 transition-all"
          >
            <Plus size={16} className="mr-2" /> New Entry
          </button>
        ) : (
          <button 
            onClick={handleBulkSave}
            disabled={loading || bulkEntries.length === 0}
            className="bg-[#FCD34D] text-slate-900 px-8 py-2.5 rounded-xl font-black text-xs uppercase flex items-center shadow-lg hover:bg-[#FBBF24] transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet size={16} className="mr-2" />}
            Create Ledger
          </button>
        )}
      </div>

      {/* T-Shape View */}
      <div className={`bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden ${mode === 'Bulk' ? 'ring-4 ring-yellow-100' : ''}`}>
        <div className="flex items-center justify-between bg-slate-50 p-6 border-b border-slate-200">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Closing Balance</p>
            <p className="text-xl font-bold text-blue-600 font-mono">{formatCurrency(totalIn - totalOut)}</p>
          </div>
          {mode === 'Bulk' && (
            <div className="animate-pulse bg-yellow-100 text-yellow-700 px-4 py-1 rounded-full text-[10px] font-black uppercase">
              Draft Mode: Click rows to edit
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-300">
          {/* INCOME SIDE */}
          <div onClick={() => mode === 'Bulk' && addBulkRow('IN')} className={mode === 'Bulk' ? 'cursor-cell' : ''}>
            <div className="bg-green-50/50 px-4 py-2 border-b-2 border-green-500 flex justify-between">
              <span className="text-xs font-black uppercase text-green-700">Income</span>
              {mode === 'Bulk' && <Plus size={14} className="text-green-600" />}
            </div>
            <table className="w-full text-[11px]">
              <tbody className="divide-y divide-slate-100">
                {/* Saved Entries */}
                {entries.filter(e => e.type === 'IN').map((e, i) => (
                  <tr key={e.id} className="divide-x divide-slate-100 h-10 hover:bg-slate-50">
                    <td className="w-10 text-center text-slate-400">{i+1}</td>
                    <td className="px-4 font-bold text-slate-700 uppercase">{e.particulars}</td>
                    <td className="w-24 px-4 text-right font-bold text-green-600 font-mono">{e.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {/* Bulk Draft Entries */}
                {bulkEntries.filter(e => e.type === 'IN').map((e, i) => (
                  <tr key={e.id} className="divide-x divide-slate-100 h-10 bg-yellow-50/30">
                    <td className="w-10 text-center text-yellow-600 font-bold">*</td>
                    <td className="px-2">
                      <input 
                        autoFocus
                        placeholder="TYPE PARTICULARS..."
                        className="w-full bg-transparent outline-none font-bold uppercase placeholder:text-slate-300"
                        value={e.particulars}
                        onChange={(val) => updateBulkRow(e.id, 'particulars', val.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="w-24 px-2">
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-transparent text-right font-mono font-bold text-green-600 outline-none"
                        value={e.amount || ''}
                        onChange={(val) => updateBulkRow(e.id, 'amount', val.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* EXPENSE SIDE */}
          <div onClick={() => mode === 'Bulk' && addBulkRow('OUT')} className={mode === 'Bulk' ? 'cursor-cell' : ''}>
            <div className="bg-red-50/50 px-4 py-2 border-b-2 border-red-500 flex justify-between">
              <span className="text-xs font-black uppercase text-red-700">Expense</span>
              {mode === 'Bulk' && <Plus size={14} className="text-red-600" />}
            </div>
            <table className="w-full text-[11px]">
              <tbody className="divide-y divide-slate-100">
                {entries.filter(e => e.type === 'OUT').map((e, i) => (
                  <tr key={e.id} className="divide-x divide-slate-100 h-10 hover:bg-slate-50">
                    <td className="w-10 text-center text-slate-400">{i+1}</td>
                    <td className="px-4 font-bold text-slate-700 uppercase">{e.particulars}</td>
                    <td className="w-24 px-4 text-right font-bold text-red-600 font-mono">{e.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {bulkEntries.filter(e => e.type === 'OUT').map((e, i) => (
                  <tr key={e.id} className="divide-x divide-slate-100 h-10 bg-yellow-50/30">
                    <td className="w-10 text-center text-yellow-600 font-bold">*</td>
                    <td className="px-2">
                      <input 
                        autoFocus
                        placeholder="TYPE PARTICULARS..."
                        className="w-full bg-transparent outline-none font-bold uppercase placeholder:text-slate-300"
                        value={e.particulars}
                        onChange={(val) => updateBulkRow(e.id, 'particulars', val.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="w-24 px-2">
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-transparent text-right font-mono font-bold text-red-600 outline-none"
                        value={e.amount || ''}
                        onChange={(val) => updateBulkRow(e.id, 'amount', val.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Existing Manual Modal code stays here... */}
    </div>
  );
};

export default Ledger;
