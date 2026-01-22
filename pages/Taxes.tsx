import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';

const Taxes = () => {
  // CID is now a direct reflection of localStorage
  const [cid, setCid] = useState<string | null>(localStorage.getItem('active_company_id'));
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start false to avoid initial hang
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTaxes = useCallback(async (companyId: string | null) => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tax_settings')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTaxes(data || []);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Immediate Load
    const currentId = getActiveCompanyId();
    if (currentId) {
      setCid(currentId);
      fetchTaxes(currentId);
    }

    // "The Watcher" - Listens for the Sidebar's shout
    const handleWorkspaceChange = () => {
      const newId = localStorage.getItem('active_company_id');
      console.log("Workspace change detected! New ID:", newId);
      setCid(newId);
      fetchTaxes(newId);
    };

    window.addEventListener('companySelected', handleWorkspaceChange);
    return () => window.removeEventListener('companySelected', handleWorkspaceChange);
  }, [fetchTaxes]);

  // ... (Keep handleSubmit, toggleSelection, deleteTax from previous version)
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const { data: { user } } = await supabase.auth.getUser(); // Get current user
  
  if (!user || !cid) return alert("Session expired or No Company Selected");

  setLoading(true);
  try {
    const { error } = await supabase.from('tax_settings').insert([{
      company_id: cid,
      user_id: user.id, // Direct tagging
      particulars: formData.particulars.toUpperCase(),
      type: formData.type,
      value: parseFloat(formData.value),
      is_selected: false
    }]);
    
    if (error) throw error;
    
    setIsModalOpen(false);
    setFormData({ particulars: '', type: 'Percentage', value: '' });
    fetchTaxes(cid);
  } catch (err: any) {
    alert(err.message);
  } finally {
    setLoading(false);
  }
};

  const [formData, setFormData] = useState({ particulars: '', type: 'Percentage', value: '' });

  const toggleSelection = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase.from('tax_settings').update({ is_selected: !currentState }).eq('id', id);
      if (error) throw error;
      setTaxes(prev => prev.map(t => t.id === id ? { ...t, is_selected: !currentState } : t));
    } catch (err: any) { alert(err.message); }
  };

  const deleteTax = async (id: string) => {
    if (!window.confirm("Delete?")) return;
    try {
      const { error } = await supabase.from('tax_settings').delete().eq('id', id);
      if (error) throw error;
      setTaxes(prev => prev.filter(t => t.id !== id));
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Duties & Taxes</h1>
          {!cid && <p className="text-xs text-amber-600 font-bold flex items-center mt-1"><AlertCircle size={14} className="mr-1"/> Please select a workspace from the sidebar</p>}
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={!cid}
          className="bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:grayscale"
        >
          <Plus size={18} className="mr-2" /> Create New
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium">
          Error: {error}
        </div>
      )}

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4 w-16 text-center">Sr</th>
              <th className="px-6 py-4">Particulars</th>
              <th className="px-6 py-4 text-center">Type</th>
              <th className="px-6 py-4 text-center">Value</th>
              <th className="px-6 py-4 w-32 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
            ) : !cid ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-medium italic">Select a company to view taxes.</td></tr>
            ) : taxes.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic font-medium">No taxes found. Click 'Create New'.</td></tr>
            ) : (
              taxes.map((tax, index) => (
                <tr key={tax.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-slate-400 text-center">{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 uppercase">{tax.particulars}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500 text-center uppercase">{tax.type}</td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-800 text-center">{tax.value}{tax.type === 'Percentage' ? '%' : ''}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-6">
                      <button onClick={() => toggleSelection(tax.id, tax.is_selected)}>
                        {tax.is_selected ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} className="text-slate-300" />}
                      </button>
                      <button onClick={() => deleteTax(tax.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal ... (same as before) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Duty/Tax">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Particulars</label>
            <input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-primary" value={formData.particulars} onChange={e => setFormData({...formData, particulars: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="Percentage">Percentage (%)</option>
              <option value="Amount">Direct Amount (₹)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate/Value</label>
            <input required type="number" step="0.01" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:border-primary" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
          </div>
          <button type="submit" className="w-full bg-[#FCD34D] py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-[#FBBF24]">Confirm Tax</button>
        </form>
      </Modal>
    </div>
  );
};

export default Taxes;
