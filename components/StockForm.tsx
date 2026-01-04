
import React, { useState, useEffect, useRef } from 'react';
import { Save, Package, Tag, Box, Hash, Scale, X } from 'lucide-react';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES } from '../utils/helpers';

interface StockFormProps {
  initialData?: any;
  onSubmit: (item: any) => void;
  onCancel: () => void;
}

const TAX_RATES = [0, 5, 12, 18, 28];

const StockForm: React.FC<StockFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<any>({
      name: '', sku: '', unit: 'PCS', hsn: '', rate: 0, in_stock: 0, description: '', tax_rate: 18, kg_per_bag: 0
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
        tax_rate: initialData.tax_rate || 18,
        kg_per_bag: toDisplayValue(initialData.kg_per_bag)
      });
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => { 
    setFormData({ ...formData, [field]: value }); 
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) return alert("Item name is mandatory.");
      const storageData = { 
        ...formData, 
        name: formData.name.trim(),
        rate: toStorageValue(formData.rate), 
        in_stock: toStorageValue(formData.in_stock),
        kg_per_bag: toStorageValue(formData.kg_per_bag)
      };
      onSubmit(storageData);
  }

  return (
    <div className="bg-white flex flex-col max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 bg-white custom-scrollbar">
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Item / Product Name</label>
                    <input 
                        ref={firstInputRef} 
                        type="text" 
                        required
                        value={formData.name} 
                        onChange={(e) => handleInputChange('name', e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-base font-bold text-slate-900 focus:border-slate-400 uppercase" 
                        placeholder="e.g. PREMIUM RICE" 
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-[14px] font-normal text-slate-900">SKU Code</label>
                        <input 
                            type="text" 
                            value={formData.sku} 
                            onChange={(e) => handleInputChange('sku', e.target.value)} 
                            className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-sm font-mono focus:border-slate-400" 
                            placeholder="Optional" 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[14px] font-normal text-slate-900">HSN Code</label>
                        <input 
                            type="text" 
                            value={formData.hsn} 
                            onChange={(e) => handleInputChange('hsn', e.target.value)} 
                            className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-sm font-mono focus:border-slate-400" 
                            placeholder="Optional" 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-[14px] font-normal text-slate-900">Unit</label>
                        <div className="relative">
                            <select 
                                value={formData.unit} 
                                onChange={(e) => handleInputChange('unit', e.target.value)} 
                                className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-sm bg-white appearance-none focus:border-slate-400"
                            >
                                {['PCS', 'NOS', 'KGS', 'LTR', 'BAGS', 'BOX', 'DRUMS', 'PACKS'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <Box className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[14px] font-normal text-slate-900">Opening Stock</label>
                        <input 
                            type="number" 
                            step="any" 
                            value={formData.in_stock} 
                            onChange={(e) => handleInputChange('in_stock', e.target.value)} 
                            className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-sm font-mono font-bold focus:border-slate-400" 
                        />
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 grid grid-cols-2 gap-6 shadow-inner">
                    <div className="space-y-1.5">
                        <label className="text-[14px] font-normal text-slate-700">Valuation Rate ({currencySymbol})</label>
                        <input 
                            type="number" 
                            step="any" 
                            value={formData.rate} 
                            onChange={(e) => handleInputChange('rate', e.target.value)} 
                            className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-lg font-bold text-slate-900 bg-white" 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[14px] font-normal text-slate-700">Default GST %</label>
                        <select 
                            value={formData.tax_rate} 
                            onChange={(e) => handleInputChange('tax_rate', Number(e.target.value))} 
                            className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-lg font-bold text-slate-900 bg-white appearance-none"
                        >
                            {TAX_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Item Description</label>
                    <textarea 
                        rows={3} 
                        value={formData.description} 
                        onChange={(e) => handleInputChange('description', e.target.value)} 
                        className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-sm focus:border-slate-400 resize-none" 
                        placeholder="Optional remarks..." 
                    />
                </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end space-x-6">
                <button type="button" onClick={onCancel} className="text-[13px] text-slate-400 font-normal hover:text-slate-700 transition-none">Discard Changes</button>
                <button type="submit" className="bg-primary text-slate-900 px-10 py-2.5 rounded font-normal text-[14px] hover:bg-primary-dark transition-none flex items-center">
                    <Save className="w-4 h-4 mr-2" /> {initialData ? 'Update Record' : 'Create Item'}
                </button>
            </div>
        </form>
    </div>
  );
};

export default StockForm;
