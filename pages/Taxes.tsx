import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';

const Taxes = () => {
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 1. Move CID into state so the UI updates when the Sidebar finishes loading
  const [cid, setCid] = useState<string | null>(getActiveCompanyId());

  const [formData, setFormData] = useState({
    particulars: '',
    type: 'Percentage',
    value: ''
  });

  // 2. Modified fetch function that accepts an ID directly
  const fetchTaxes = async (companyId: string | null) => {
    if (!companyId) {
      // If no ID yet, keep loading false so we don't show a spinner forever
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
      console.error("Tax Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Effect to handle initial load and "Listen" for Sidebar updates
  useEffect(() => {
    // Fetch immediately with whatever is in localStorage
    fetchTaxes(cid);

    // This listener catches the "shout" from the Sidebar
    const handleCompanyChange = () => {
      const newId = getActiveCompanyId();
      setCid(newId);
      fetchTaxes(newId);
    };

    window.addEventListener('companySelected', handleCompanyChange);
    return () => window.removeEventListener('companySelected', handleCompanyChange);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cid) return alert("Please select a company first");
    
    setLoading(true);
    try {
      const { error } = await supabase.from('tax_settings').insert([{
        company_id: cid,
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

  const toggleSelection = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('tax_settings')
        .update({ is_selected: !currentState })
        .eq('id', id);
      if (error) throw error;
      setTaxes(taxes.map(t => t.id === id ? { ...t, is_selected: !currentState } : t));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteTax = async (id: string) => {
    if (!window.confirm("Delete this tax setting?")) return;
    try {
      const { error } = await supabase.from('tax_settings').delete().eq('id', id);
      if (error) throw error;
      setTaxes(taxes.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-6 py-4 w-16">Sr No</th>
              <th className="px-6 py-4">Particulars</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Value</th>
              <th className="px-6 py-4 w-32 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
            ) : taxes.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic">No taxes configured. Click 'Create New' to start.</td></tr>
            ) : taxes.map((tax, index) => (
              <tr key={tax.id} className={`hover:bg-slate-50 transition-colors ${tax.is_selected ? 'bg-blue-50/30' : ''}`}>
                <td className="px-6 py-4 text-xs font-mono text-slate-400">{index + 1}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900 uppercase">{tax.particulars}</td>
                <td className="px-6 py-4 text-xs font-medium text-slate-500">{tax.type}</td>
                <td className="px-6 py-4 font-mono font-bold text-slate-800">
                  {tax.value}{tax.type === 'Percentage' ? '%' : ''}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={() => toggleSelection(tax.id, tax.is_selected)} title="Select for billing">
                      {tax.is_selected ? <CheckSquare size={20} className="text-primary" /> : <Square size={20} className="text-slate-300" />}
                    </button>
                    <button onClick={() => deleteTax(tax.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Duty/Tax">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Particulars Name</label>
            <input 
              required 
              placeholder="E.G. CGST @ 9%" 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:border-primary outline-none"
              value={formData.particulars}
              onChange={e => setFormData({...formData, particulars: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tax Type</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
            >
              <option value="Percentage">Percentage (%)</option>
              <option value="Amount">Amount (₹)</option>
              <option value="Fixed Value">Fixed Value</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
              {formData.type === 'Percentage' ? 'Percentage Rate' : formData.type === 'Amount' ? 'Amount Value' : 'Fixed Value'}
            </label>
            <input 
              required 
              type="number" 
              step="0.01"
              placeholder="0.00"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:border-primary outline-none"
              value={formData.value}
              onChange={e => setFormData({...formData, value: e.target.value})}
            />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#FCD34D] py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-[#FBBF24] transition-all">
            {loading ? 'Saving...' : 'Confirm Tax Setting'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Taxes;
