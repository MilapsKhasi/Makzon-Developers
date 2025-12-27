
import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Loader2, Calculator, Info, Percent, Banknote, AlertCircle, ShieldCheck } from 'lucide-react';
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

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    const { data } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');
    setTaxes(data || []);
    setLoading(false);
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
      setErrorMsg(`A ledger named "${formData.name}" already exists. Ledger names must be unique to prevent calculation errors.`);
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

  return (
    <div className="space-y-8">
      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, tax: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Ledger"
        message={`Move "${deleteDialog.tax?.name}" to trash? It can be recovered from settings.`}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Duties & Taxes Master</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Manage unique tax engines, market fees, and GST credit ledgers.</p>
        </div>
        <button onClick={openCreateModal} className="bg-primary text-slate-800 px-5 py-2 rounded-md font-bold text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-primary-dark shadow-sm">+ Create New Ledger</button>
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-6 flex items-start gap-4">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
            <h4 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-tight">Ledger Configuration Rules</h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Unique ledger names ensure correct mapping in the Purchase Voucher. Using "Both" calculation method allows applying a percentage and a fixed handling charge simultaneously.
            </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded p-4 flex items-center space-x-4 boxy-shadow">
          <div className="w-10 h-10 bg-green-50 rounded flex items-center justify-center text-green-600"><ShieldCheck className="w-5 h-5" /></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">GST Credit Ledgers</p><p className="text-lg font-bold text-slate-900">{taxes.filter(t => t.type === 'GST').length}</p></div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-4 flex items-center space-x-4 boxy-shadow">
          <div className="w-10 h-10 bg-blue-50 rounded flex items-center justify-center text-blue-600"><Plus className="w-5 h-5" /></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">Other Charges</p><p className="text-lg font-bold text-slate-900">{taxes.filter(t => t.type === 'Charge').length}</p></div>
        </div>
        <div className="bg-white border border-slate-200 rounded p-4 flex items-center space-x-4 boxy-shadow">
          <div className="w-10 h-10 bg-red-50 rounded flex items-center justify-center text-red-600"><Trash2 className="w-5 h-5" /></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">Deductions</p><p className="text-lg font-bold text-slate-900">{taxes.filter(t => t.type === 'Deduction').length}</p></div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-md overflow-hidden boxy-shadow bg-white">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="py-4 px-6">Ledger Name</th>
                <th className="py-4 px-6">Type</th>
                <th className="py-4 px-6">Calc Method</th>
                <th className="py-4 px-6">Rate/Amount</th>
                <th className="py-4 px-6">Apply On</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxes.map(tax => (
                <tr key={tax.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-semibold text-slate-900">{tax.name}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                      tax.type === 'GST' ? 'bg-green-50 text-green-600 border-green-100' :
                      tax.type === 'Charge' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {tax.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-medium text-slate-500">{tax.calc_method}</td>
                  <td className="py-4 px-6 font-mono font-bold">
                    {tax.calc_method === 'Percentage' && `${tax.rate}%`}
                    {tax.calc_method === 'Fixed' && `₹${tax.fixed_amount}`}
                    {tax.calc_method === 'Both' && `${tax.rate}% + ₹${tax.fixed_amount}`}
                  </td>
                  <td className="py-4 px-6 text-slate-500">{tax.apply_on}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex justify-center space-x-2">
                        <button onClick={() => { setEditingTax(tax); setErrorMsg(null); setFormData(tax); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteDialog({ isOpen: true, tax: tax })} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {taxes.length === 0 && (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No ledgers defined in this master.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTax ? "Edit Ledger" : "New Duty/Tax Ledger"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded text-xs font-medium flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {errorMsg}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ledger Name (Must be Unique)</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded text-sm mt-1 focus:border-slate-400 outline-none" placeholder="e.g. Input GST @ 18%" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ledger Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded text-sm mt-1 bg-white focus:border-slate-400 outline-none">
                <option value="Charge">Charge (Addition +)</option>
                <option value="Deduction">Deduction (Subtraction -)</option>
                <option value="GST">GST Ledger (Mapped to Items)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Calculation Method</label>
              <select value={formData.calc_method} onChange={e => setFormData({...formData, calc_method: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded text-sm mt-1 bg-white focus:border-slate-400 outline-none">
                <option value="Percentage">Percentage Only (%)</option>
                <option value="Fixed">Fixed Amount Only (₹)</option>
                <option value="Both">Both (Percentage + Fixed)</option>
              </select>
            </div>

            {(formData.calc_method === 'Percentage' || formData.calc_method === 'Both') && (
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Default Rate (%)</label>
                <div className="relative mt-1">
                  <input type="number" step="0.01" value={formData.rate} onChange={e => setFormData({...formData, rate: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2.5 border border-slate-200 rounded text-sm focus:border-slate-400 outline-none pr-8 font-mono" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">%</span>
                </div>
              </div>
            )}

            {(formData.calc_method === 'Fixed' || formData.calc_method === 'Both') && (
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Default Fixed Amount (₹)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">₹</span>
                  <input type="number" step="0.01" value={formData.fixed_amount} onChange={e => setFormData({...formData, fixed_amount: parseFloat(e.target.value) || 0})} className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded text-sm focus:border-slate-400 outline-none font-mono" />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Apply Logic On</label>
              <select value={formData.apply_on} onChange={e => setFormData({...formData, apply_on: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded text-sm mt-1 bg-white focus:border-slate-400 outline-none">
                <option value="Subtotal">Taxable Subtotal</option>
                <option value="AfterGST">Value Including GST</option>
                <option value="NetTotal">Final Bill Value</option>
              </select>
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ledger Account</label>
              <input value={formData.ledger_name} onChange={e => setFormData({...formData, ledger_name: e.target.value})} className="w-full px-3 py-2.5 border border-slate-200 rounded text-sm mt-1 focus:border-slate-400 outline-none font-medium" placeholder="e.g. 5001 - Direct Expenses" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">Discard</button>
            <button type="submit" className="bg-primary px-10 py-2.5 rounded text-[11px] font-bold uppercase tracking-widest border border-slate-200 hover:bg-primary-dark shadow-md active:scale-95 transition-all">Save Master Ledger</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DutiesTaxes;
