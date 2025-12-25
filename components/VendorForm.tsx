
import React, { useState, useEffect, useRef } from 'react';
import { Save, X, Landmark } from 'lucide-react';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES } from '../utils/helpers';

interface VendorFormProps {
  initialData?: any | null;
  onSubmit: (vendor: any) => void;
  onCancel: () => void;
}

const VendorForm: React.FC<VendorFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<any>({
    id: '', 
    name: '', 
    email: '', 
    phone: '', 
    gstin: '', 
    pan: '',
    account_number: '',
    account_name: '',
    ifsc_code: '',
    address: '', 
    balance: 0
  });

  const currencySymbol = CURRENCIES[getAppSettings().currency as keyof typeof CURRENCIES]?.symbol || '$';
  const firstInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        ...initialData, 
        name: initialData.name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        gstin: initialData.gstin || '',
        pan: initialData.pan || '',
        address: initialData.address || '',
        balance: toDisplayValue(initialData.balance),
        account_number: initialData.account_number || '',
        account_name: initialData.account_name || '',
        ifsc_code: initialData.ifsc_code || ''
      });
    } else {
      setFormData({ 
        id: Date.now().toString(), 
        name: '', 
        email: '', 
        phone: '', 
        gstin: '', 
        pan: '',
        account_number: '',
        account_name: '',
        ifsc_code: '',
        address: '', 
        balance: 0 
      });
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData]);

  const handleChange = (field: string, value: any) => { 
    setFormData((prev: any) => ({ ...prev, [field]: value })); 
  };

  const handleGstinChange = (val: string) => {
    const gstin = val.toUpperCase().trim();
    handleChange('gstin', gstin);
    
    // Auto-extract PAN from GSTIN (Indices 2 to 12 - which is 10 characters)
    if (gstin.length >= 12) {
      const extractedPan = gstin.substring(2, 12);
      handleChange('pan', extractedPan);
    }
  };

  const handleSubmit = () => {
      const storageData = { ...formData, balance: toStorageValue(formData.balance) };
      onSubmit(storageData);
  }

  return (
    <div ref={formRef} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendor / Business Name</label>
          <input 
            ref={firstInputRef} 
            type="text" 
            value={formData.name} 
            onChange={(e) => handleChange('name', e.target.value)} 
            className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none shadow-sm" 
            placeholder="Enter legal business name" 
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN Number</label>
          <input 
            type="text" 
            value={formData.gstin} 
            onChange={(e) => handleGstinChange(e.target.value)} 
            className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none font-mono uppercase" 
            placeholder="e.g. 22AAAAA0000A1Z5" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PAN Number</label>
          <input 
            type="text" 
            value={formData.pan} 
            onChange={(e) => handleChange('pan', e.target.value.toUpperCase())} 
            className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none font-mono uppercase" 
            placeholder="Auto-detected from GSTIN" 
          />
        </div>

        <div className="md:col-span-2 bg-slate-50 p-5 rounded-md border border-slate-200">
          <div className="flex items-center space-x-2 mb-4">
            <Landmark className="w-4 h-4 text-slate-400" />
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Banking Details</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Account Number</label>
              <input 
                type="text" 
                value={formData.account_number} 
                onChange={(e) => handleChange('account_number', e.target.value)} 
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:border-slate-500 outline-none bg-white" 
                placeholder="Bank Account No"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Beneficiary Name</label>
              <input 
                type="text" 
                value={formData.account_name} 
                onChange={(e) => handleChange('account_name', e.target.value)} 
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:border-slate-500 outline-none bg-white" 
                placeholder="Name as per Bank"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">IFSC Code</label>
              <input 
                type="text" 
                value={formData.ifsc_code} 
                onChange={(e) => handleChange('ifsc_code', e.target.value.toUpperCase())} 
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:border-slate-500 outline-none font-mono bg-white" 
                placeholder="e.g. SBIN0001234"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
          <input 
            type="email" 
            value={formData.email} 
            onChange={(e) => handleChange('email', e.target.value)} 
            className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none shadow-sm" 
            placeholder="vendor@business.com" 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
          <input 
            type="text" 
            value={formData.phone} 
            onChange={(e) => handleChange('phone', e.target.value)} 
            className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none shadow-sm" 
            placeholder="+91 00000 00000" 
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Office Address</label>
          <textarea 
            value={formData.address} 
            onChange={(e) => handleChange('address', e.target.value)} 
            rows={2} 
            className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none resize-none shadow-sm" 
            placeholder="Registered billing address" 
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Opening Balance</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">{currencySymbol}</span>
            <input 
              type="number" 
              value={formData.balance} 
              onChange={(e) => handleChange('balance', parseFloat(e.target.value) || 0)} 
              className="w-full pl-8 border border-slate-300 rounded px-3 py-2.5 text-sm focus:border-slate-500 outline-none font-medium shadow-sm" 
              placeholder="0.00" 
            />
          </div>
        </div>
      </div>
      <div className="pt-6 border-t border-slate-200 flex justify-end space-x-3">
        <button onClick={onCancel} className="px-8 py-2.5 border border-slate-300 rounded text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors">Cancel</button>
        <button onClick={handleSubmit} className="px-10 py-2.5 bg-primary text-slate-900 font-bold rounded-md hover:bg-yellow-400 transition-all flex items-center text-xs uppercase tracking-widest shadow-sm">
          <Save className="w-4 h-4 mr-2" />Save Vendor
        </button>
      </div>
    </div>
  );
};

export default VendorForm;
