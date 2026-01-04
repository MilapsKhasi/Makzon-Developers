
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getActiveCompanyId, safeSupabaseSave } from '../utils/helpers';
import { supabase } from '../lib/supabase';

interface VendorFormProps {
  initialData?: any | null;
  prefilledName?: string;
  onSubmit: (vendor: any) => void;
  onCancel: () => void;
}

const VendorForm: React.FC<VendorFormProps> = ({ initialData, prefilledName, onSubmit, onCancel }) => {
  const [loading, setLoading] = useState(false);
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
        const cid = getActiveCompanyId();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const payload = { 
            ...formData, 
            company_id: cid, 
            user_id: user.id, 
            is_deleted: false,
            party_type: 'vendor',
            is_customer: false
        };
        
        const result = await safeSupabaseSave('vendors', payload, initialData?.id);
        onSubmit(result.data[0]);
      } catch (err: any) { 
        alert("Error saving vendor: " + err.message); 
      } finally { 
        setLoading(false); 
      }
  }

  return (
    <div className="bg-white w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden rounded-md border border-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <h2 className="text-[18px] font-normal text-slate-900">Vendor Entry</h2>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-none">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col bg-white">
        <div className="p-8 space-y-6">
          <div className="border border-slate-200 rounded-md p-8 space-y-6 bg-white">
              <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2 space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">Vendor Name</label>
                      <input ref={firstInputRef} type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white" placeholder="Vendor Name here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">Opening Balance</label>
                      <input type="number" value={formData.balance} onChange={e => handleChange('balance', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white font-mono" placeholder="0.00" />
                  </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">GSTIN Number</label>
                      <input type="text" value={formData.gstin} onChange={e => handleChange('gstin', e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white uppercase font-mono" placeholder="GSTIN Number here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">PAN Number</label>
                      <input type="text" value={formData.pan} onChange={e => handleChange('pan', e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white uppercase font-mono" placeholder="PAN Number here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">State</label>
                      <input type="text" value={formData.state} onChange={e => handleChange('state', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white" placeholder="State Name here" />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">Email</label>
                      <input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white" placeholder="Email Address here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">Contact Number</label>
                      <input type="text" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white" placeholder="Phone Number here" />
                  </div>
              </div>

              <div className="space-y-1.5">
                  <label className="text-[14px] font-normal text-slate-900">Business Address</label>
                  <textarea rows={4} value={formData.address} onChange={e => handleChange('address', e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 resize-none bg-white" placeholder="Address here" />
              </div>

              <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">Bank Account Number</label>
                      <input type="text" value={formData.account_number} onChange={e => handleChange('account_number', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white font-mono" placeholder="Account Number here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">Account Holder Name</label>
                      <input type="text" value={formData.account_name} onChange={e => handleChange('account_name', e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white" placeholder="Holder Name here" />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[14px] font-normal text-slate-900">IFSC Code</label>
                      <input type="text" value={formData.ifsc_code} onChange={e => handleChange('ifsc_code', e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 bg-white font-mono uppercase" placeholder="IFSC Code here" />
                  </div>
              </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="px-8 py-4 border-t border-slate-200 flex items-center justify-end space-x-8 bg-white shrink-0">
            <button type="button" onClick={onCancel} className="text-[13px] text-slate-500 hover:text-slate-800 transition-none font-normal">Discard</button>
            <button 
                type="submit"
                disabled={loading}
                className="bg-primary text-slate-900 px-8 py-2.5 rounded font-normal text-[14px] hover:bg-primary-dark transition-none flex items-center"
            >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Statement
            </button>
        </div>
      </form>
    </div>
  );
};

export default VendorForm;
