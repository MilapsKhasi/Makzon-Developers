
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, Save, Check, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, safeSupabaseSave, getSelectedLedgerIds, toggleSelectedLedgerId } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const DutiesTaxes = () => {
  const [taxes, setTaxes] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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
    is_default: false
  });

  const [formData, setFormData] = useState(getInitialFormData());

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    try {
      const currentSelected = getSelectedLedgerIds();
      setSelectedIds(currentSelected);
      
      const { data, error } = await supabase
        .from('duties_taxes')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('name');
      
      if (error) throw error;
      setTaxes(data || []);
    } catch (err) {
      console.error("Error loading taxes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = getActiveCompanyId();
    if (!cid) return alert("No active workspace selected.");
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { 
        ...formData, 
        name: formData.name.trim(), 
        company_id: cid, 
        user_id: user?.id,
        is_deleted: false 
      };
      
      // Use safe save utility to handle missing columns gracefully
      await safeSupabaseSave('duties_taxes', payload, editingTax?.id);

      setIsModalOpen(false);
      await loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    } catch (err: any) {
      alert("Error saving ledger: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = async (tax: any) => {
    // 1. Toggle in Local Storage for immediate UI reliability
    const nextIds = toggleSelectedLedgerId(tax.id);
    setSelectedIds(nextIds);

    // 2. Try to update DB (this column might be missing in schema)
    try {
        await safeSupabaseSave('duties_taxes', { is_default: nextIds.includes(tax.id) }, tax.id);
    } catch (e) {
        // Silently continue if column is missing, local storage handles it
    }
    
    // 3. Dispatch event so BillForm knows to refresh its active ledger list
    window.dispatchEvent(new Event('appSettingsChanged'));
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.tax) return;
    try {
      const { error } = await supabase.from('duties_taxes').update({ is_deleted: true }).eq('id', deleteDialog.tax.id);
      if (error) throw error;
      await loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
      setDeleteDialog({ isOpen: false, tax: null });
    } catch (err: any) {
      alert("Error deleting: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, tax: null })}
        onConfirm={handleConfirmDelete}
        title="Archive Ledger"
        message={`Are you sure you want to delete "${deleteDialog.tax?.name}"?`}
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

      <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
        <table className="clean-table">
          <thead>
            <tr>
              <th className="w-20 text-center">SELECT</th>
              <th>LEDGER NAME</th>
              <th>CLASSIFICATION</th>
              <th>ENGINE</th>
              <th>VALUE</th>
              <th className="text-right w-32 px-6">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" /></td></tr>
            ) : taxes.map((tax, i) => {
              const isSelected = selectedIds.includes(tax.id) || tax.is_default;
              return (
                <tr key={tax.id} className={`${isSelected ? 'bg-primary/10' : ''} transition-all duration-200 group`}>
                  <td className="text-center">
                    <div className="flex items-center justify-center py-2">
                      <button
                        onClick={() => toggleSelection(tax)}
                        className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${
                          isSelected 
                            ? 'bg-primary border-slate-900 text-slate-900 shadow-md transform scale-110' 
                            : 'bg-white border-slate-300 text-transparent hover:border-slate-500'
                        }`}
                        title={isSelected ? "Unselect" : "Select for Billing"}
                      >
                        <Check className={`w-4 h-4 stroke-[4] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                      </button>
                    </div>
                  </td>
                  <td className="font-medium text-slate-900">
                    <div className="flex items-center">
                      <span className={isSelected ? 'text-slate-900 font-bold' : 'text-slate-600'}>{tax.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-2 text-slate-900" />}
                    </div>
                  </td>
                  <td>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${tax.type === 'Charge' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {tax.type}
                    </span>
                  </td>
                  <td className="text-[10px] uppercase font-medium text-slate-400">{tax.calc_method}</td>
                  <td className="font-mono text-xs text-slate-700 font-bold">
                    {tax.calc_method === 'Percentage' ? `${tax.rate}%` : `₹${tax.fixed_amount}`}
                  </td>
                  <td className="px-6">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => { setEditingTax(tax); setFormData(tax); setIsModalOpen(true); }} 
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteDialog({ isOpen: true, tax })} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && taxes.length === 0 && (
              <tr><td colSpan={6} className="text-center py-20 text-slate-400 italic font-medium">No ledgers found. Create one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTax ? "Edit Ledger" : "Create New Tax/Charge Ledger"}>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ledger Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 shadow-sm" placeholder="e.g. Loading Charges, Market Fee" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-400 shadow-sm">
                  <option value="Charge">Charge (+ Additive)</option>
                  <option value="Deduction">Deduction (- Subtractive)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calculation Engine</label>
                <select value={formData.calc_method} onChange={e => setFormData({...formData, calc_method: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-400 shadow-sm">
                  <option value="Percentage">Percentage (%)</option>
                  <option value="Fixed">Fixed Amount (₹)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Default Value {formData.calc_method === 'Percentage' ? '(%)' : '(₹)'}</label>
              <input type="number" step="0.01" value={formData.calc_method === 'Percentage' ? formData.rate : formData.fixed_amount} onChange={e => setFormData({...formData, [formData.calc_method === 'Percentage' ? 'rate' : 'fixed_amount']: parseFloat(e.target.value) || 0})} className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 font-mono font-bold shadow-sm" />
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" disabled={saving} className="bg-primary text-slate-900 px-10 py-3 rounded-lg font-bold text-sm hover:bg-primary-dark disabled:opacity-50 shadow-md">
              {saving ? 'PROCESSING...' : 'SAVE LEDGER MASTER'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DutiesTaxes;
