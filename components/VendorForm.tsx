
import React, { useState, useEffect, useRef } from 'react';
import { Save, Landmark, Globe, Loader2, Mail, Phone, MapPin } from 'lucide-react';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';

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
    default_duties: []
  });

  const currencySymbol = CURRENCIES[getAppSettings().currency as keyof typeof CURRENCIES]?.symbol || '$';
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        ...initialData, 
        balance: toDisplayValue(initialData.balance)
      });
    } else if (prefilledName) {
      setFormData((prev: any) => ({ ...prev, name: prefilledName }));
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData, prefilledName]);

  const handleChange = (field: string, value: any) => { 
    setFormData((prev: any) => ({ ...prev, [field]: value })); 
  };

  const handleGstinChange = (val: string) => {
    const gstin = val.toUpperCase().trim();
    const updates: any = { gstin };
    if (gstin.length >= 12) updates.pan = gstin.substring(2, 12);
    setFormData((prev: any) => ({ ...prev, ...updates }));
  };

  const saveToSupabase = async (payload: any): Promise<any> => {
      const operation = initialData?.id 
        ? supabase.from('vendors').update(payload).eq('id', initialData.id).select()
        : supabase.from('vendors').insert([payload]).select();
      
      const res = await operation;

      if (res.error) {
          const msg = res.error.message;
          const missingColumnMatch = msg.match(/'(.+?)' column/) || msg.match(/column '(.+?)' of/);
          if (missingColumnMatch) {
              const offendingColumn = missingColumnMatch[1];
              if (offendingColumn && payload.hasOwnProperty(offendingColumn)) {
                  const nextPayload = { ...payload }; delete nextPayload[offendingColumn]; return saveToSupabase(nextPayload);
              }
          }
          throw res.error;
      }
      return res;
  };

  const handleSubmit = async () => {
      if (!formData.name.trim()) return alert("Vendor Name is required.");
      setLoading(true);
      try {
        const cid = getActiveCompanyId();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const payload = { ...formData, balance: toStorageValue(formData.balance), company_id: cid, user_id: user.id, is_deleted: false };
        const result = await saveToSupabase(payload);
        onSubmit(result.data[0]);
      } catch (err: any) { alert("Error saving vendor: " + err.message); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-bold text-slate-500 capitalize">Official Vendor Business Name</label>
          <input ref={firstInputRef} type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full h-14 border border-slate-200 rounded-xl px-6 text-lg font-bold text-slate-900 focus:border-slate-400 outline-none shadow-sm transition-all" placeholder="Enter Full Legal Name" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-500 capitalize">GSTIN Identification Number</label>
          <input type="text" value={formData.gstin} onChange={(e) => handleGstinChange(e.target.value)} className="w-full h-12 border border-slate-200 rounded-lg px-5 text-base focus:border-slate-400 outline-none font-mono font-bold tracking-widest bg-slate-50/50" placeholder="e.g. 27AAAAA0000A1Z5" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-500 capitalize">Business State / Province</label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300" />
            <input type="text" value={formData.state} onChange={(e) => handleChange('state', e.target.value)} className="w-full h-12 pl-12 pr-5 border border-slate-200 rounded-lg text-base focus:border-slate-400 outline-none font-bold text-slate-700" placeholder="e.g. Maharashtra" />
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-50 p-10 rounded-2xl border border-slate-200 space-y-8 shadow-inner">
          <div className="flex items-center space-x-4">
            <Landmark className="w-6 h-6 text-slate-400" />
            <h4 className="text-base font-bold text-slate-700 capitalize">Banking & Settlement Profile</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2"><label className="block text-xs font-bold text-slate-400 capitalize">Account Number</label><input type="text" value={formData.account_number} onChange={(e) => handleChange('account_number', e.target.value)} className="w-full h-11 border border-slate-200 rounded-lg px-4 text-sm focus:border-slate-400 outline-none font-mono font-bold bg-white" /></div>
            <div className="space-y-2"><label className="block text-xs font-bold text-slate-400 capitalize">Beneficiary Name</label><input type="text" value={formData.account_name} onChange={(e) => handleChange('account_name', e.target.value)} className="w-full h-11 border border-slate-200 rounded-lg px-4 text-sm focus:border-slate-400 outline-none font-bold text-slate-700 bg-white" /></div>
            <div className="space-y-2"><label className="block text-xs font-bold text-slate-400 capitalize">IFSC / Swift Code</label><input type="text" value={formData.ifsc_code} onChange={(e) => handleChange('ifsc_code', e.target.value.toUpperCase())} className="w-full h-11 border border-slate-200 rounded-lg px-4 text-sm focus:border-slate-400 outline-none font-mono font-bold bg-white" /></div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-500 capitalize">Contact Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} className="w-full h-12 pl-12 pr-5 border border-slate-200 rounded-lg text-base focus:border-slate-400 outline-none font-medium" placeholder="vendor@business.com" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-500 capitalize">Primary Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full h-12 pl-12 pr-5 border border-slate-200 rounded-lg text-base focus:border-slate-400 outline-none font-medium" placeholder="+91 00000 00000" />
          </div>
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-bold text-slate-500 capitalize">Registered Business Address</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-5 w-4.5 h-4.5 text-slate-300" />
            <textarea value={formData.address} onChange={(e) => handleChange('address', e.target.value)} rows={3} className="w-full pl-12 pr-5 py-4 border border-slate-200 rounded-lg text-base focus:border-slate-400 outline-none resize-none shadow-sm font-medium" placeholder="Complete street address for billing..." />
          </div>
        </div>
      </div>
      
      <div className="pt-10 border-t border-slate-100 flex justify-end space-x-6">
        <button onClick={onCancel} className="px-10 py-4 border border-slate-200 rounded-lg text-slate-400 font-bold text-sm hover:bg-slate-50 transition-colors">Discard</button>
        <button onClick={handleSubmit} disabled={loading} className="px-12 py-4 bg-primary text-slate-900 font-bold rounded-lg hover:bg-primary-dark transition-all flex items-center text-sm shadow-xl active:scale-95 disabled:opacity-50">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
          Save Vendor Profile
        </button>
      </div>
    </div>
  );
};

export default VendorForm;
