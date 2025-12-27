
import React, { useState, useEffect, useRef } from 'react';
import { Save, Landmark, Globe } from 'lucide-react';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES } from '../utils/helpers';

interface VendorFormProps {
  initialData?: any | null;
  onSubmit: (vendor: any) => void;
  onCancel: () => void;
}

const VendorForm: React.FC<VendorFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<any>({
    name: '', email: '', phone: '', gstin: '', pan: '', state: '',
    account_number: '', account_name: '', ifsc_code: '', address: '', balance: 0
  });

  const currencySymbol = CURRENCIES[getAppSettings().currency as keyof typeof CURRENCIES]?.symbol || '$';
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        ...initialData, 
        balance: toDisplayValue(initialData.balance)
      });
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData]);

  const handleChange = (field: string, value: any) => { 
    setFormData((prev: any) => ({ ...prev, [field]: value })); 
  };

  const handleGstinChange = (val: string) => {
    const gstin = val.toUpperCase().trim();
    const updates: any = { gstin };
    if (gstin.length >= 12) updates.pan = gstin.substring(2, 12);
    setFormData((prev: any) => ({ ...prev, ...updates }));
  };

  const handleSubmit = () => {
      if (!formData.name.trim()) return alert("Vendor Name is required.");
      onSubmit({ ...formData, balance: toStorageValue(formData.balance) });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendor Name</label>
          <input ref={firstInputRef} type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none shadow-sm" placeholder="Legal Business Name" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN</label>
          <input type="text" value={formData.gstin} onChange={(e) => handleGstinChange(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none font-mono uppercase" placeholder="e.g. 22AAAAA0000A1Z5" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">State / Location</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input type="text" value={formData.state} onChange={(e) => handleChange('state', e.target.value)} className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded text-sm focus:border-slate-500 outline-none uppercase" placeholder="e.g. Maharashtra" />
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-50 p-5 rounded-md border border-slate-200">
          <div className="flex items-center space-x-2 mb-4">
            <Landmark className="w-4 h-4 text-slate-400" />
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Settlement Banking Details</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Account Number</label><input type="text" value={formData.account_number} onChange={(e) => handleChange('account_number', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:border-slate-500 outline-none font-mono" /></div>
            <div><label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Beneficiary Name</label><input type="text" value={formData.account_name} onChange={(e) => handleChange('account_name', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:border-slate-500 outline-none" /></div>
            <div><label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">IFSC Code</label><input type="text" value={formData.ifsc_code} onChange={(e) => handleChange('ifsc_code', e.target.value.toUpperCase())} className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:border-slate-500 outline-none font-mono uppercase" /></div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
          <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none" placeholder="vendor@business.com" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
          <input type="text" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none" placeholder="+91 00000 00000" />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Registered Address</label>
          <textarea value={formData.address} onChange={(e) => handleChange('address', e.target.value)} rows={2} className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none resize-none shadow-sm" placeholder="Complete billing address" />
        </div>
      </div>
      <div className="pt-6 border-t border-slate-200 flex justify-end space-x-3">
        <button onClick={onCancel} className="px-8 py-2.5 border border-slate-300 rounded text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50">Cancel</button>
        <button onClick={handleSubmit} className="px-10 py-2.5 bg-primary text-slate-900 font-bold rounded-md hover:bg-yellow-400 transition-all flex items-center text-xs uppercase tracking-widest shadow-sm">
          <Save className="w-4 h-4 mr-2" />Save Vendor
        </button>
      </div>
    </div>
  );
};

export default VendorForm;
