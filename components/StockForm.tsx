
import React, { useState, useEffect, useRef } from 'react';
import { Check, Package, ShieldCheck, Tag, Box, Hash } from 'lucide-react';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES } from '../utils/helpers';

interface StockFormProps {
  initialData?: any;
  onSubmit: (item: any) => void;
  onCancel: () => void;
}

const TAX_RATES = [0, 5, 12, 18, 28];

const StockForm: React.FC<StockFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<any>({
      name: '', sku: '', unit: 'PCS', hsn: '', rate: 0, in_stock: 0, description: '', tax_rate: 18
  });

  const currencySymbol = CURRENCIES[getAppSettings().currency as keyof typeof CURRENCIES]?.symbol || '₹';
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        name: initialData.name || '',
        sku: initialData.sku || '',
        unit: initialData.unit || 'PCS',
        hsn: initialData.hsn || '',
        rate: toDisplayValue(initialData.rate),
        in_stock: toDisplayValue(initialData.in_stock),
        description: initialData.description || '',
        tax_rate: initialData.tax_rate || 18
      });
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => { setFormData({ ...formData, [field]: value }); };

  const handleSubmit = () => {
      if (!formData.name.trim()) return alert("Item name is mandatory.");
      const storageData = { ...formData, rate: toStorageValue(formData.rate), in_stock: toStorageValue(formData.in_stock) };
      onSubmit(storageData);
  }

  return (
    <div className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="col-span-2 space-y-2">
                <label className="text-sm font-bold text-slate-500 capitalize">Product / Item Master Name</label>
                <div className="relative">
                    <Package className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
                    <input ref={firstInputRef} type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full h-16 pl-14 pr-6 border border-slate-200 rounded-xl text-xl font-bold text-slate-900 outline-none focus:border-slate-400 shadow-sm" placeholder="e.g. UltraTech Cement 50kg Grade-A" />
                </div>
            </div>

            <div className="space-y-8">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 capitalize">Stock Keeping Unit (SKU)</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" value={formData.sku} onChange={(e) => handleInputChange('sku', e.target.value)} className="w-full h-12 pl-12 pr-5 border border-slate-200 rounded-lg text-base font-mono font-bold text-slate-700 outline-none focus:border-slate-400" placeholder="SKU-1001" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 capitalize">Unit Of Measure</label>
                    <div className="relative">
                      <Box className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <select value={formData.unit} onChange={(e) => handleInputChange('unit', e.target.value)} className="w-full h-12 pl-12 pr-5 border border-slate-200 rounded-lg text-base font-bold outline-none focus:border-slate-400 bg-white shadow-sm appearance-none">
                          {['PCS', 'NOS', 'KGS', 'LTR', 'BAGS', 'BOX'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 capitalize">HSN / SAC Code</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" value={formData.hsn} onChange={(e) => handleInputChange('hsn', e.target.value)} className="w-full h-12 pl-12 pr-5 border border-slate-200 rounded-lg text-base font-mono font-bold text-slate-700 outline-none focus:border-slate-400" placeholder="HSN-8451" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 capitalize">Applied GST Rate</label>
                    <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                        <select value={formData.tax_rate} onChange={(e) => handleInputChange('tax_rate', Number(e.target.value))} className="w-full h-12 pl-12 pr-5 border border-slate-200 rounded-lg text-base font-bold outline-none focus:border-slate-400 bg-white shadow-sm appearance-none">
                            {TAX_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-10 p-10 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 capitalize">Purchase Valuation Rate</label>
                    <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-bold">{currencySymbol}</span>
                        <input type="number" value={formData.rate} onChange={(e) => handleInputChange('rate', parseFloat(e.target.value) || 0)} className="w-full h-16 pl-12 pr-6 border border-slate-200 rounded-xl text-2xl font-bold text-slate-900 outline-none focus:border-slate-400 font-mono shadow-sm" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 capitalize">Available Opening Stock</label>
                    <div className="relative">
                      <Box className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                      <input type="number" value={formData.in_stock} onChange={(e) => handleInputChange('in_stock', parseFloat(e.target.value) || 0)} className="w-full h-16 pl-14 pr-6 border border-slate-200 rounded-xl text-2xl font-bold text-slate-900 outline-none focus:border-slate-400 font-mono shadow-sm" />
                    </div>
                </div>
            </div>
        </div>

        <div className="pt-10 border-t border-slate-100 flex justify-end space-x-6">
            <button onClick={onCancel} className="px-10 py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors">Discard Changes</button>
            <button onClick={handleSubmit} className="px-14 py-4 bg-primary text-slate-900 font-bold text-sm rounded-lg border border-primary hover:bg-primary-dark transition-all shadow-xl active:scale-95 flex items-center">
                <Check className="w-5 h-5 mr-3" /> Save Stock Details
            </button>
        </div>
    </div>
  );
};

export default StockForm;
