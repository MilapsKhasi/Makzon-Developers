
import React, { useState, useEffect, useRef } from 'react';
import { Save, X } from 'lucide-react';
import { Vendor } from '../types';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES } from '../utils/helpers';

interface VendorFormProps {
  initialData?: any | null;
  onSubmit: (vendor: any) => void;
  onCancel: () => void;
}

const VendorForm: React.FC<VendorFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<any>({
    id: '', name: '', email: '', phone: '', gstin: '', address: '', balance: 0
  });

  const currencySymbol = CURRENCIES[getAppSettings().currency as keyof typeof CURRENCIES]?.symbol || '$';
  const firstInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData, balance: toDisplayValue(initialData.balance) });
    } else {
      setFormData({ id: Date.now().toString(), name: '', email: '', phone: '', gstin: '', address: '', balance: 0 });
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData]);

  const handleChange = (field: string, value: any) => { setFormData((prev: any) => ({ ...prev, [field]: value })); };

  const handleSubmit = () => {
      const storageData = { ...formData, balance: toStorageValue(formData.balance) };
      onSubmit(storageData);
  }

  return (
    <div ref={formRef} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendor Name</label>
          <input ref={firstInputRef} type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-slate-500 outline-none" placeholder="Enter business or person name" />
        </div>
        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN</label><input type="text" value={formData.gstin} onChange={(e) => handleChange('gstin', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-slate-500 outline-none font-mono uppercase" placeholder="GST Number" /></div>
        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-slate-500 outline-none" placeholder="email@example.com" /></div>
        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label><input type="text" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-slate-500 outline-none" placeholder="+91 00000 00000" /></div>
        <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label><textarea value={formData.address} onChange={(e) => handleChange('address', e.target.value)} rows={3} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-slate-500 outline-none resize-none" placeholder="Billing Address" /></div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Balance</label>
          <div className="relative"><span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">{currencySymbol}</span><input type="number" value={formData.balance} onChange={(e) => handleChange('balance', parseFloat(e.target.value) || 0)} className="w-full pl-8 border border-slate-300 rounded px-3 py-2 text-sm focus:border-slate-500 outline-none font-medium" placeholder="0.00" /></div>
        </div>
      </div>
      <div className="pt-6 border-t border-slate-200 flex justify-end space-x-3">
        <button onClick={onCancel} className="px-6 py-2 border border-slate-300 rounded text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={handleSubmit} className="px-6 py-2 bg-primary text-slate-900 font-bold rounded hover:bg-yellow-400 transition-all flex items-center text-sm shadow-none"><Save className="w-4 h-4 mr-2" />Save Vendor</button>
      </div>
    </div>
  );
};

export default VendorForm;
