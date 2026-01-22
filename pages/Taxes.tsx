import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';

const Taxes = () => {
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Use state to track the active company ID
  const [cid, setCid] = useState<string | null>(localStorage.getItem('active_company_id'));

  const [formData, setFormData] = useState({
    particulars: '',
    type: 'Percentage',
    value: ''
  });

  /**
   * FIX: Wrapped in useCallback to prevent the 'exhaustive-deps' 
   * build error and ensure stable reference.
   */
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

  /**
   * FIX: The dependency array now correctly includes fetchTaxes.
   * We also added a safety check for the initial 'cid'.
   */
  useEffect(() => {
    const currentId = cid || getActiveCompanyId();
    if (currentId) {
      fetchTaxes(currentId);
    } else {
      setLoading(false);
    }

    const handleCompanyChange = () => {
      const newId = getActiveCompanyId();
      if (newId !== cid) {
        setCid(newId);
        fetchTaxes(newId);
      }
    };

    window.addEventListener('companySelected', handleCompanyChange);
    return () => window.removeEventListener('companySelected', handleCompanyChange);
  }, [cid, fetchTaxes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentCid = cid || getActiveCompanyId();
    if (!currentCid) return alert("Please select a company first");
    
    setLoading(true);
    try {
      const { error } = await supabase.from('tax_settings').insert([{
        company_id: currentCid,
        particulars: formData.particulars.toUpperCase(),
        type: formData.type,
        value: parseFloat(formData.value),
        is_selected: false
      }]);
      
      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({ particulars: '', type: 'Percentage', value: '' });
      fetchTaxes(currentCid);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('tax_settings')
        .update({ is_selected: !currentState })
        .eq('id', id);
      if (error) throw error;
      setTaxes(prev => prev.map(t => t.id === id ? { ...t, is_selected: !currentState } : t));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteTax = async (id: string) => {
    if (!window.confirm("Delete this tax setting?")) return;
    try {
      const { error } = await supabase.from('tax_settings').delete().eq('id', id);
      if (error) throw error;
      setTaxes(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-4">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Duties & Taxes</h1>
          <p className="text-sm text-slate-500">Configure taxes for Sales & Purchase bills</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-slate-900 px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-lg hover:scale-105 transition-all"
        >
          <Plus size={18} className="mr-2" /> Create New
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4 w-16 text-center">Sr No</th>
              <th className="px-6 py-4">Particulars</th>
              <th className="px-6 py-4 text-center">Type</th>
              <th className="px-6 py-4 text-center">Value</th>
              <th className="px-6 py-4 w-32 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
            ) : taxes.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic font-medium">No taxes configured. Click 'Create New' to start.</td></tr>
            ) : taxes.map((tax, index) => (
              <tr key={tax.id} className={`hover:bg-slate-50 transition-colors ${tax.is_selected ? 'bg-amber-50/50' : ''}`}>
                <td className="px-6 py-4 text-xs font-mono text-slate-400 text-center">{index + 1}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900 uppercase tracking-tight">{tax.particulars}</td>
                <td className="px-6 py-4 text-xs font-semibold text-slate-500 text-center uppercase tracking-tighter">{tax.type}</td>
                <td className="px-6 py-4 font-mono font-bold text-slate-800 text-center">
                  {tax.value}{tax.type === 'Percentage' ? '%' : ''}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-6">
                    <button 
                      onClick={() => toggleSelection(tax.id, tax.is_selected)} 
                      title={tax.is_selected ? "Remove from bills" : "Apply to bills"}
                      className="transition-transform hover:scale-110"
                    >
                      {tax.is_selected ? <CheckSquare size={20} className="text-primary fill-primary/10" /> : <Square size={20} className="text-slate-300" />}
                    </button>
                    <button onClick={() => deleteTax(tax.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Duty/Tax">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Particulars Name</label>
            <input 
              required 
              placeholder="E.G. GST @ 18%" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={formData.particulars}
              onChange={e => setFormData({...formData, particulars: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Calculation Type</label>
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none cursor-pointer focus:border-primary transition-all"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
            >
              <option value="Percentage">Percentage (%)</option>
              <option value="Amount">Direct Amount (₹)</option>
              <option value="Fixed Value">Fixed Total Value</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
              {formData.type === 'Percentage' ? 'Tax Rate (%)' : formData.type === 'Amount' ? 'Amount (₹)' : 'Value'}
            </label>
            <input 
              required 
              type="number" 
              step="0.01"
              placeholder="0.00"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={formData.value}
              onChange={e => setFormData({...formData, value: e.target.value})}
            />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#FCD34D] py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-[#FBBF24] active:scale-[0.98] transition-all disabled:opacity-50">
            {loading ? 'Processing...' : 'Add Tax Setting'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Taxes;
