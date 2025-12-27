
import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Percent, Banknote, Package, ShieldCheck } from 'lucide-react';
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
    <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Particulars (Item Name)</label>
                <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input ref={firstInputRef} type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-md text-sm font-bold text-slate-900 outline-none focus:border-slate-400" placeholder="e.g. UltraTech Cement 50kg" />
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">SKU / Item Code</label>
                    <input type="text" value={formData.sku} onChange={(e) => handleInputChange('sku', e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-md text-sm font-mono text-slate-600 outline-none focus:border-slate-400" placeholder="PRO-1001" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Unit of Measure</label>
                    <select value={formData.unit} onChange={(e) => handleInputChange('unit', e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-md text-sm font-bold outline-none focus:border-slate-400 bg-white">
                        {['PCS', 'NOS', 'KGS', 'LTR', 'BAGS', 'BOX'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">HSN / SAC Code</label>
                    <input type="text" value={formData.hsn} onChange={(e) => handleInputChange('hsn', e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-md text-sm font-mono text-slate-600 outline-none focus:border-slate-400" placeholder="HSN-8451" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Default GST %</label>
                    <div className="relative">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-dark" />
                        <select value={formData.tax_rate} onChange={(e) => handleInputChange('tax_rate', Number(e.target.value))} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-md text-sm font-black outline-none focus:border-slate-400 bg-white">
                            {TAX_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-8 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Standard Purchase Rate</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{currencySymbol}</span>
                        <input type="number" value={formData.rate} onChange={(e) => handleInputChange('rate', parseFloat(e.target.value) || 0)} className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-md text-base font-black text-slate-900 outline-none focus:border-slate-400" />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Opening Stock In-Hand</label>
                    <input type="number" value={formData.in_stock} onChange={(e) => handleInputChange('in_stock', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2.5 border border-slate-200 rounded-md text-base font-black text-slate-900 outline-none focus:border-slate-400" />
                </div>
            </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end space-x-3">
            <button onClick={onCancel} className="px-8 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">Discard</button>
            <button onClick={handleSubmit} className="px-12 py-3 bg-primary text-slate-900 font-bold uppercase text-[10px] tracking-widest rounded-md border border-slate-200 hover:bg-primary-dark transition-all shadow-md active:scale-95 flex items-center">
                <Check className="w-4 h-4 mr-2" /> Save Particulars
            </button>
        </div>
    </div>
  );
};

export default StockForm;
