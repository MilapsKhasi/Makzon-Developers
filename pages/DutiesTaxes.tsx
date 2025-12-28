
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const DutiesTaxes = () => {
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<any>(null);

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; tax: any | null }>({
    isOpen: false,
    tax: null
  });
  
  const getInitialFormData = () => ({
    name: '', 
    type: 'Charge', 
    calc_method: 'Percentage', 
    rate: 0, 
    fixed_amount: 0, 
    apply_on: 'Subtotal'
  });

  const [formData, setFormData] = useState(getInitialFormData());

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    const { data } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');
    setTaxes(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = { ...formData, name: formData.name.trim(), company_id: cid, user_id: user?.id };
    
    if (editingTax) {
      await supabase.from('duties_taxes').update(payload).eq('id', editingTax.id);
    } else {
      await supabase.from('duties_taxes').insert([payload]);
    }
    
    setIsModalOpen(false);
    loadData();
    window.dispatchEvent(new Event('appSettingsChanged'));
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.tax) return;
    await supabase.from('duties_taxes').update({ is_deleted: true }).eq('id', deleteDialog.tax.id);
    loadData();
    window.dispatchEvent(new Event('appSettingsChanged'));
    setDeleteDialog({ isOpen: false, tax: null });
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, tax: null })}
        onConfirm={handleConfirmDelete}
        title="Archive Ledger"
        message={`Delete "${deleteDialog.tax?.name}"?`}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-[20px] font-normal text-slate-900">Duties & Taxes</h1>
        <button 
          onClick={() => { setEditingTax(null); setFormData(getInitialFormData()); setIsModalOpen(true); }} 
          className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark transition-none"
        >
          NEW LEDGER
        </button>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
        <table className="clean-table">
          <thead>
            <tr>
              <th className="w-16">SR NO</th>
              <th>LEDGER NAME</th>
              <th>CLASSIFICATION</th>
              <th>ENGINE</th>
              <th>VALUE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10">Loading...</td></tr>
            ) : taxes.map((tax, i) => (
              <tr key={tax.id}>
                <td>{i + 1}</td>
                <td className="font-medium text-slate-900">{tax.name}</td>
                <td>
                  <span className="text-[10px] uppercase font-normal text-slate-500">{tax.type}</span>
                </td>
                <td className="text-[10px] uppercase font-normal text-slate-400">{tax.calc_method}</td>
                <td>
                  {tax.calc_method === 'Percentage' ? `${tax.rate}%` : `₹${tax.fixed_amount}`}
                </td>
                <td className="flex space-x-2">
                  <button onClick={() => { setEditingTax(tax); setFormData(tax); setIsModalOpen(true); }} className="text-slate-400 hover:text-slate-900"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteDialog({ isOpen: true, tax })} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {!loading && taxes.length === 0 && (
              <tr><td colSpan={6} className="text-center py-20 text-slate-400">No ledgers defined.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTax ? "Edit Ledger" : "New Ledger"}>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ledger Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white outline-none focus:border-slate-400">
                  <option value="Charge">Charge (+)</option>
                  <option value="Deduction">Deduction (-)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Engine</label>
                <select value={formData.calc_method} onChange={e => setFormData({...formData, calc_method: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white outline-none focus:border-slate-400">
                  <option value="Percentage">Percentage</option>
                  <option value="Fixed">Fixed Amount</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Value {formData.calc_method === 'Percentage' ? '(%)' : '(₹)'}</label>
              <input type="number" step="0.01" value={formData.calc_method === 'Percentage' ? formData.rate : formData.fixed_amount} onChange={e => setFormData({...formData, [formData.calc_method === 'Percentage' ? 'rate' : 'fixed_amount']: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400" />
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" className="bg-primary text-slate-900 px-8 py-2 rounded-md font-normal text-sm hover:bg-primary-dark">SAVE LEDGER</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DutiesTaxes;
