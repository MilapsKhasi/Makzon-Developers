
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getActiveCompanyId, safeSupabaseSave, toStorageValue, toDisplayValue } from '../utils/helpers';
import { supabase, getAuthUser } from '../lib/supabase';
import { recordActivity } from '../utils/activityTracker';

interface VendorFormProps {
  initialData?: any | null;
  prefilledName?: string;
  onSubmit: (vendor: any, isSaveAndNew?: boolean) => void;
  onCancel: () => void;
}

const VendorForm: React.FC<VendorFormProps> = ({ initialData, prefilledName, onSubmit, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [isSaveAndNew, setIsSaveAndNew] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: prefilledName || '', email: '', phone: '', gstin: '', pan: '', state: '',
    account_number: '', account_name: '', ifsc_code: '', address: '', balance: 0,
    party_type: 'vendor'
  });

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData, party_type: 'vendor' });
    } else if (prefilledName) {
      setFormData((prev: any) => ({ ...prev, name: prefilledName }));
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData, prefilledName]);

  const handleChange = (field: string, value: any) => { 
    setFormData((prev: any) => ({ ...prev, [field]: value })); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) return alert("Vendor Name is required.");
      setLoading(true);
      try {
        const user = await getAuthUser();
        if (user) recordActivity(user.id, user.email || '');

        const cid = getActiveCompanyId();
        const payload = { 
            ...formData, 
            balance: toStorageValue(formData.balance),
            company_id: cid, 
            is_deleted: false,
            party_type: 'vendor',
            is_customer: false
        };
        
        const result = await safeSupabaseSave('vendors', payload, initialData?.id);
        onSubmit(result.data[0], isSaveAndNew);
        if (isSaveAndNew) {
          setFormData({
            name: '', email: '', phone: '', gstin: '', pan: '', state: '',
            account_number: '', account_name: '', ifsc_code: '', address: '', balance: 0,
            party_type: 'vendor'
          });
          setTimeout(() => firstInputRef.current?.focus(), 100);
        }
      } catch (err: any) { 
        alert("Error saving vendor: " + err.message); 
      } finally { 
        setLoading(false); 
      }
  }

  return (
    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden rounded-md border border-slate-300 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 className="text-[18px] font-normal text-slate-900 dark:text-white">Vendor Entry</h2>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-none">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col bg-white dark:bg-slate-900">
        <div className="p-4 sm:p-8 space-y-6">
          <div className="border border-slate-200 dark:border-slate-800 rounded-md p-4 sm:p-8 space-y-6 bg-white dark:bg-slate-900">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">Vendor Name</label>
                      <input ref={firstInputRef} type="text" value={toDisplayValue(formData.name)} onChange={e => handleChange('name', e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Vendor Name here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">Opening Balance</label>
                      <input type="number" value={toDisplayValue(formData.balance)} onChange={e => handleChange('balance', e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono" placeholder="0.00" />
                  </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">GSTIN Number</label>
                      <input type="text" value={toDisplayValue(formData.gstin)} onChange={e => handleChange('gstin', e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono" placeholder="GSTIN Number here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">PAN Number</label>
                      <input type="text" value={toDisplayValue(formData.pan)} onChange={e => handleChange('pan', e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono" placeholder="PAN Number here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">State</label>
                      <input type="text" value={toDisplayValue(formData.state)} onChange={e => handleChange('state', e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="State Name here" />
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">Email</label>
                      <input type="email" value={toDisplayValue(formData.email)} onChange={e => handleChange('email', e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Email Address here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">Contact Number</label>
                      <input type="text" value={toDisplayValue(formData.phone)} onChange={e => handleChange('phone', e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Phone Number here" />
                  </div>
              </div>

              <div className="space-y-1.5">
                  <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">Business Address</label>
                  <textarea rows={4} value={toDisplayValue(formData.address)} onChange={e => handleChange('address', e.target.value)} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Address here" />
              </div>

              <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">Bank Account Number</label>
                      <input type="text" value={toDisplayValue(formData.account_number)} onChange={e => handleChange('account_number', e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono" placeholder="Account Number here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">Account Holder Name</label>
                      <input type="text" value={toDisplayValue(formData.account_name)} onChange={e => handleChange('account_name', e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" placeholder="Holder Name here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900 dark:text-slate-300">IFSC Code</label>
                      <input type="text" value={toDisplayValue(formData.ifsc_code)} onChange={e => handleChange('ifsc_code', e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] focus:border-slate-400 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase" placeholder="IFSC Code here" />
                  </div>
              </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-4 bg-white dark:bg-slate-900 shrink-0">
            <button type="button" onClick={onCancel} className="text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-none font-normal">Discard</button>
            <button 
                type="submit"
                onClick={() => setIsSaveAndNew(true)}
                disabled={loading}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded font-normal text-[14px] hover:bg-emerald-700 transition-none flex items-center shadow-lg"
            >
                {loading && isSaveAndNew && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save & New
            </button>
            <button 
                type="submit"
                onClick={() => setIsSaveAndNew(false)}
                disabled={loading}
                className="bg-primary text-white px-8 py-2.5 rounded font-normal text-[14px] hover:bg-primary-dark transition-none flex items-center shadow-lg"
            >
                {loading && !isSaveAndNew && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Statement
            </button>
        </div>
      </form>
    </div>
  );
};

export default VendorForm;
