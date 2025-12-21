
import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { toDisplayValue, toStorageValue, getAppSettings, CURRENCIES } from '../utils/helpers';

interface StockFormProps {
  initialData?: any;
  onSubmit: (item: any) => void;
  onCancel: () => void;
}

const StockForm: React.FC<StockFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<any>({
      name: '', sku: '', unit: '', hsn: '', rate: 0, in_stock: 0, description: '', taxRate: ''
  });

  const currencySymbol = CURRENCIES[getAppSettings().currency as keyof typeof CURRENCIES]?.symbol || '$';
  const firstInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        name: initialData.name || '',
        sku: initialData.sku || '',
        unit: initialData.unit || '',
        hsn: initialData.hsn || '',
        rate: toDisplayValue(initialData.rate),
        in_stock: toDisplayValue(initialData.in_stock),
        description: initialData.description || '',
        taxRate: initialData.taxRate || ''
      });
    }
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [initialData]);

  const handleInputChange = (field: string, value: any) => { setFormData({ ...formData, [field]: value }); };

  const handleSubmit = () => {
      const storageData = { ...formData, rate: toStorageValue(formData.rate), in_stock: toStorageValue(formData.in_stock) };
      onSubmit(storageData);
  }

  return (
    <div ref={formRef} className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-6">
            <div className="flex-1 mr-8">
                <div className="mb-4">
                    <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Item Name</label>
                    <input ref={firstInputRef} type="text" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full text-sm font-medium text-slate-900 border border-slate-200 rounded p-2 focus:border-slate-400 outline-none transition-all" placeholder="Product Name" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">SKU</label>
                    <input type="text" value={formData.sku || ''} onChange={(e) => handleInputChange('sku', e.target.value)} className="text-sm font-mono text-slate-600 border border-slate-200 rounded p-2 w-48 focus:border-slate-400 outline-none transition-all" placeholder="SKU-000" />
                </div>
            </div>
            <div className="flex space-x-2">
                <button onClick={handleSubmit} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Save"><Check className="w-6 h-6" /></button>
                <button onClick={onCancel} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-colors" title="Cancel"><X className="w-6 h-6" /></button>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div><label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Unit of Measure</label><input type="text" value={formData.unit || ''} onChange={(e) => handleInputChange('unit', e.target.value)} className="w-full text-base font-medium text-slate-900 border border-slate-200 rounded p-2 focus:border-slate-400 outline-none transition-all" /></div>
            <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Purchase Rate</label>
                <div className="relative"><span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">{currencySymbol}</span><input type="number" value={formData.rate || 0} onChange={(e) => handleInputChange('rate', parseFloat(e.target.value) || 0)} className="w-full pl-8 text-base font-medium text-slate-900 border border-slate-200 rounded p-2 focus:border-slate-400 outline-none transition-all" /></div>
            </div>
            <div><label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">In Stock</label><input type="number" value={formData.in_stock || 0} onChange={(e) => handleInputChange('in_stock', parseFloat(e.target.value) || 0)} className="w-full text-base font-medium text-slate-900 border border-slate-200 rounded p-2 focus:border-slate-400 outline-none transition-all" /></div>
            <div><label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">HSN / SAC Code</label><input type="text" value={formData.hsn || ''} onChange={(e) => handleInputChange('hsn', e.target.value)} className="w-full text-base font-medium text-slate-900 border border-slate-200 rounded p-2 focus:border-slate-400 outline-none transition-all" /></div>
        </div>
    </div>
  );
};

export default StockForm;
