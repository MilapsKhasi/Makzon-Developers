import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';

const Taxes = () => {
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ particulars: '', type: 'Percentage', value: '' });

  // 1. Fetching is now simple: Just get everything for the logged-in user
  const fetchTaxes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tax_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTaxes(data || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('tax_settings').insert([{
        particulars: formData.particulars.toUpperCase(),
        type: formData.type,
        value: parseFloat(formData.value)
      }]);
      if (error) throw error;
      setIsModalOpen(false);
      setFormData({ particulars: '', type: 'Percentage', value: '' });
      fetchTaxes();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = async (id: string, currentState: boolean) => {
    const { error } = await supabase.from('tax_settings').update({ is_selected: !currentState }).eq('id', id);
    if (!error) setTaxes(prev => prev.map(t => t.id === id ? { ...t, is_selected: !currentState } : t));
  };

  const deleteTax = async (id: string) => {
    if (!window.confirm("Delete this tax?")) return;
    const { error } = await supabase.from('tax_settings').delete().eq('id', id);
    if (!error) setTaxes(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold">Duties & Taxes</h1>
          <p className="text-sm text-slate-500">Universal tax settings for your account</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-primary px-6 py-2 rounded-xl font-bold text-xs uppercase shadow-lg">
          <Plus size={18} className="inline mr-2" /> Create New
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
            <tr>
              <th className="px-6 py-4">Particulars</th>
              <th className="px-6 py-4">Value</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={3} className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
            ) : taxes.map((tax) => (
              <tr key={tax.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold text-slate-900 uppercase">{tax.particulars}</td>
                <td className="px-6 py-4 font-mono">{tax.value}{tax.type === 'Percentage' ? '%' : ''}</td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-4">
                    <button onClick={() => toggleSelection(tax.id, tax.is_selected)}>
                      {tax.is_selected ? <CheckSquare className="text-primary" /> : <Square className="text-slate-300" />}
                    </button>
                    <button onClick={() => deleteTax(tax.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Tax">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input required placeholder="NAME (e.g. GST 18%)" className="w-full p-3 bg-slate-50 border rounded-xl font-bold uppercase" value={formData.particulars} onChange={e => setFormData({...formData, particulars: e.target.value})} />
          <select className="w-full p-3 bg-slate-50 border rounded-xl font-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
            <option value="Percentage">Percentage (%)</option>
            <option value="Amount">Amount (₹)</option>
          </select>
          <input required type="number" step="0.01" className="w-full p-3 bg-slate-50 border rounded-xl font-mono" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
          <button type="submit" className="w-full bg-primary py-4 rounded-xl font-black text-xs uppercase tracking-widest">Confirm</button>
        </form>
      </Modal>
    </div>
  );
};

export default Taxes;
