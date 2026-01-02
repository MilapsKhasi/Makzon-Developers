
import React, { useState, useEffect, useRef } from 'react';
import { Save, Landmark, Globe, Loader2, Mail, Phone, MapPin, Building2, CreditCard, ShieldCheck } from 'lucide-react';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES, getActiveCompanyId, safeSupabaseSave } from '../utils/helpers';
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
    default_duties: []
  });

  const currencySymbol = CURRENCIES[getAppSettings().currency as keyof typeof CURRENCIES]?.symbol || '₹';
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
            balance: toStorageValue(formData.balance), 
            company_id: cid, 
            user_id: user.id, 
            is_deleted: false 
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
    <div className="max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Business Identity Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-slate-400 mb-2">
            <Building2 className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Business Identity</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor Business Name</label>
              <input 
                ref={firstInputRef} 
                required 
                type="text" 
                value={formData.name} 
                onChange={(e) => handleChange('name', e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-bold text-slate-900 outline-none focus:border-slate-400 shadow-sm uppercase" 
                placeholder="LEGAL ENTITY NAME" 
              />
            </div>
            <div className="md:col-span-4 space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Opening Balance ({currencySymbol})</label>
              <input 
                type="number" 
                value={formData.balance} 
                onChange={(e) => handleChange('balance', e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono font-bold text-slate-900 outline-none focus:border-slate-400 shadow-sm" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">GSTIN Number</label>
              <input 
                type="text" 
                value={formData.gstin} 
                onChange={(e) => handleGstinChange(e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono font-bold tracking-widest outline-none focus:border-slate-400 shadow-sm uppercase" 
                placeholder="27AAAAA0000A1Z5" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">PAN Number</label>
              <input 
                type="text" 
                value={formData.pan} 
                onChange={(e) => handleChange('pan', e.target.value.toUpperCase())} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono font-bold tracking-widest outline-none focus:border-slate-400 shadow-sm uppercase" 
                placeholder="ABCDE1234F" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Operating State</label>
              <input 
                type="text" 
                value={formData.state} 
                onChange={(e) => handleChange('state', e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-bold text-slate-900 outline-none focus:border-slate-400 shadow-sm uppercase" 
                placeholder="e.g. MAHARASHTRA" 
              />
            </div>
          </div>
        </div>

        {/* Contact & Logistics */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-slate-400 mb-2">
            <Mail className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Communication & Address</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => handleChange('email', e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 shadow-sm" 
                  placeholder="vendor@company.com" 
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                <input 
                  type="text" 
                  value={formData.phone} 
                  onChange={(e) => handleChange('phone', e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 shadow-sm" 
                  placeholder="+91 98765 43210" 
                />
              </div>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Registered Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-300" />
                <textarea 
                  value={formData.address} 
                  onChange={(e) => handleChange('address', e.target.value)} 
                  rows={2} 
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 shadow-sm resize-none" 
                  placeholder="Complete billing address for records..." 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Settlement Profile */}
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4">
          <div className="flex items-center space-x-2 text-slate-400 mb-2">
            <CreditCard className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Banking Profile</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Account Number</label>
              <input 
                type="text" 
                value={formData.account_number} 
                onChange={(e) => handleChange('account_number', e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono font-bold bg-white outline-none focus:border-slate-400 shadow-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Beneficiary Name</label>
              <input 
                type="text" 
                value={formData.account_name} 
                onChange={(e) => handleChange('account_name', e.target.value)} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-bold bg-white outline-none focus:border-slate-400 shadow-sm" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">IFSC / Swift Code</label>
              <input 
                type="text" 
                value={formData.ifsc_code} 
                onChange={(e) => handleChange('ifsc_code', e.target.value.toUpperCase())} 
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono font-bold bg-white outline-none focus:border-slate-400 shadow-sm" 
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 space-x-3">
          <button 
            type="button" 
            onClick={onCancel} 
            className="px-6 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Discard
          </button>
          <button 
            type="submit" 
            disabled={loading} 
            className="bg-primary text-slate-900 px-10 py-2 rounded-md font-bold text-sm hover:bg-primary-dark transition-all flex items-center shadow-md border border-slate-900 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            SAVE VENDOR PROFILE
          </button>
        </div>
      </form>
    </div>
  );
};

export default VendorForm;
