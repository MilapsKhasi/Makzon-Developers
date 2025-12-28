
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, Calculator, Percent, Banknote, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const DutiesTaxes = () => {
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    apply_on: 'Subtotal', 
    ledger_name: ''
  });

  const [formData, setFormData] = useState(getInitialFormData());

  const seedDefaults = async (existingTaxes: any[]) => {
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!cid || !user) return;

    const defaults = [
      { name: 'Market Fee', type: 'Charge', calc_method: 'Percentage', rate: 1.0, fixed_amount: 0, apply_on: 'Subtotal' },
      { name: 'Labor Charges', type: 'Charge', calc_method: 'Fixed', rate: 0, fixed_amount: 50, apply_on: 'Subtotal' },
      { name: 'Commission', type: 'Deduction', calc_method: 'Percentage', rate: 2.0, fixed_amount: 0, apply_on: 'Subtotal' }
    ];

    const toCreate = defaults.filter(d => 
      !existingTaxes.some(et => et.name.toLowerCase() === d.name.toLowerCase())
    );

    if (toCreate.length > 0) {
      await supabase.from('duties_taxes').insert(
        toCreate.map(d => ({ ...d, company_id: cid, user_id: user.id }))
      );
      loadData();
    }
  };

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    const { data: taxData } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');
    const items = taxData || [];
    setTaxes(items);

    setLoading(false);
    seedDefaults(items);
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    
    const normalizedName = formData.name.trim().toLowerCase();
    const isDuplicate = taxes.some(t => 
      t.name.trim().toLowerCase() === normalizedName && (!editingTax || t.id !== editingTax.id)
    );

    if (isDuplicate) {
      setErrorMsg(`A ledger named "${formData.name}" already exists.`);
      return;
    }
    
    const payload = { ...formData, name: formData.name.trim(), company_id: cid, user_id: user?.id };
    
    let res;
    if (editingTax) {
      res = await supabase.from('duties_taxes').update(payload).eq('id', editingTax.id);
    } else {
      res = await supabase.from('duties_taxes').insert([payload]);
    }
    
    if (!res.error) {
      setIsModalOpen(false);
      loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    } else {
      setErrorMsg(res.error.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.tax) return;
    const { error } = await supabase.from('duties_taxes').update({ is_deleted: true }).eq('id', deleteDialog.tax.id);
    if (!error) {
      loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    } else {
      alert(error.message);
    }
    setDeleteDialog({ isOpen: false, tax: null });
  };

  const openCreateModal = () => {
    setEditingTax(null);
    setErrorMsg(null);
    setFormData(getInitialFormData());
    setIsModalOpen(true);
  };

  const isRateEnabled = formData.calc_method === 'Percentage' || formData.calc_method === 'Both';
  const isFixedEnabled = formData.calc_method === 'Fixed' || formData.calc_method === 'Both';

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, tax: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Ledger"
        message={`Move "${deleteDialog.tax?.name}" to trash? It can be recovered from settings.`}
      />

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">Duties & Taxes Master</h1>
          <p className="text-slate-500 font-medium text-sm">Configure global engines for automated tax calculation and surcharges.</p>
        </div>
        <button onClick={openCreateModal} className="bg-primary text-slate-900 px-8 py-3 rounded-lg font-bold text-sm border border-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 flex items-center">
            <Plus className="w-4.5 h-4.5 mr-2" /> Define New Ledger
        </button>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-8 flex items-start gap-6 shadow-inner">
        <div className="p-3 bg-blue-50 text-blue-500 rounded-xl shrink-0">
           <Calculator className="w-8 h-8" />
        </div>
        <div>
            <h4 className="text-base font-bold text-slate-900 uppercase tracking-tight mb-2">Automation Notice</h4>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Ledgers defined here are automatically available as additional charges in the billing section. Changes made to master rules will apply to all new vouchers created hereafter.
            </p>
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden boxy-shadow bg-white">
        {loading ? (
          <div className="py-40 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
        ) : (
          <table className="w-full text-left text-base border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="py-5 px-8">Ledger Name</th>
                <th className="py-5 px-8">Classification</th>
                <th className="py-5 px-8">Calc Engine</th>
                <th className="py-5 px-8">Default Value</th>
                <th className="py-5 px-8 text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxes.map(tax => (
                <tr key={tax.id} className="hover:bg-slate-50 transition-all duration-200 group">
                  <td className="py-5 px-8 font-bold text-slate-900">{tax.name}</td>
                  <td className="py-5 px-8">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      tax.type === 'GST' ? 'bg-green-50 text-green-600 border-green-100' :
                      tax.type === 'Charge' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {tax.type}
                    </span>
                  </td>
                  <td className="py-5 px-8 font-bold text-slate-500 uppercase text-[10px] tracking-tight">{tax.calc_method}</td>
                  <td className="py-5 px-8 font-mono font-bold text-slate-900">
                    {tax.calc_method === 'Percentage' && `${tax.rate}%`}
                    {tax.calc_method === 'Fixed' && `₹${tax.fixed_amount}`}
                    {tax.calc_method === 'Both' && `${tax.rate}% + ₹${tax.fixed_amount}`}
                  </td>
                  <td className="py-5 px-8 text-center">
                    <div className="flex justify-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTax(tax); setErrorMsg(null); setFormData(tax); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-900 transition-all bg-white border border-slate-100 rounded-lg shadow-sm"><Edit className="w-5 h-5" /></button>
                        <button onClick={() => setDeleteDialog({ isOpen: true, tax: tax })} className="p-2.5 text-slate-400 hover:text-red-500 transition-all bg-white border border-slate-100 rounded-lg shadow-sm"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {taxes.length === 0 && (
                <tr><td colSpan={5} className="py-40 text-center text-slate-300 italic font-medium">No tax engines configured yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTax ? "Edit Ledger Rule" : "Define Master Rule"}>
        <form onSubmit={handleSubmit} className="space-y-8">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-xl text-sm font-bold flex items-center shadow-inner">
              <AlertCircle className="w-5 h-5 mr-3" />
              {errorMsg}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-8">
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-500 capitalize">Ledger Identifier</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 outline-none focus:border-slate-400 shadow-sm transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 capitalize">Ledger Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-5 h-14 border border-slate-200 rounded-xl text-base font-bold bg-white focus:border-slate-400 outline-none shadow-sm appearance-none">
                <option value="Charge">Charge (Markup +)</option>
                <option value="Deduction">Deduction (Discount -)</option>
                <option value="GST">GST Ledger</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 capitalize">Calculation Engine</label>
              <select value={formData.calc_method} onChange={e => setFormData({...formData, calc_method: e.target.value})} className="w-full px-5 h-14 border border-slate-200 rounded-xl text-base font-bold bg-white focus:border-slate-400 outline-none shadow-sm appearance-none">
                <option value="Percentage">Percentage Only</option>
                <option value="Fixed">Fixed Amount Only</option>
                <option value="Both">Both (Hybrid)</option>
              </select>
            </div>

            <div className={`space-y-2 relative transition-opacity ${isRateEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <label className="text-sm font-bold text-slate-500 capitalize">Default Rate (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01" 
                  disabled={!isRateEnabled}
                  value={formData.rate} 
                  onChange={e => setFormData({...formData, rate: parseFloat(e.target.value) || 0})} 
                  className="w-full px-5 h-14 border border-slate-200 rounded-xl text-base font-mono font-bold focus:border-slate-400 outline-none shadow-sm" 
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
            </div>

            <div className={`space-y-2 relative transition-opacity ${isFixedEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <label className="text-sm font-bold text-slate-500 capitalize">Default Fixed Amount</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input 
                  type="number" 
                  step="0.01" 
                  disabled={!isFixedEnabled}
                  value={formData.fixed_amount} 
                  onChange={e => setFormData({...formData, fixed_amount: parseFloat(e.target.value) || 0})} 
                  className="w-full pl-10 pr-5 h-14 border border-slate-200 rounded-xl text-base font-mono font-bold focus:border-slate-400 outline-none shadow-sm" 
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-5 pt-8 border-t border-slate-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Discard</button>
            <button type="submit" className="bg-primary text-slate-900 px-12 py-4 rounded-xl text-xs font-bold uppercase tracking-widest border border-primary hover:bg-primary-dark shadow-xl active:scale-95 transition-all">Save Ledger</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DutiesTaxes;
