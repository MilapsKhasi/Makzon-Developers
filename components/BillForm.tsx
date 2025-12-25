
import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, getDatePlaceholder, parseDateFromInput, formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';

interface BillFormProps {
  initialData?: any;
  onSubmit: (bill: any) => void;
  onCancel: () => void;
}

const TAX_RATES = [0, 5, 12, 18, 28];

const BillForm: React.FC<BillFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const cid = getActiveCompanyId();
  const today = new Date().toISOString().split('T')[0];
  
  const getInitialState = () => ({
    vendor_name: '', 
    gstin: '', 
    address: '',
    bill_number: '', 
    date: today, 
    displayDate: formatDate(today), 
    description: '',
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, igstRate: 0, cgstRate: 0, sgstRate: 0, igstAmount: 0, cgstAmount: 0, sgstAmount: 0, taxableAmount: 0, amount: 0 }],
    total_without_gst: 0, 
    total_gst: 0, 
    commission_percent: 0, // Store percentage in UI state
    commission_charges: 0, // Store absolute amount for DB
    labor_charges: 0,
    round_off: 0, 
    grand_total: 0, 
    status: 'Pending'
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [vendors, setVendors] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);

  const loadDependencies = async () => {
    if (!cid) return;
    try {
      const { data: v } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: s } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
      setVendors(v || []);
      setStockItems(s || []);
    } catch (e) {
      console.error("Dependency load failed", e);
    }
  };

  useEffect(() => {
    loadDependencies();
    if (initialData) {
      const subtotal = Number(initialData.total_without_gst || 0);
      const absCommission = Number(initialData.commission_charges || 0);
      // Reverse calculate percentage if absolute exists
      const percent = subtotal > 0 ? (absCommission / subtotal) * 100 : 0;

      setFormData({ 
        ...initialData,
        vendor_name: initialData.vendor_name || '',
        gstin: initialData.gstin || '',
        address: initialData.address || '',
        bill_number: initialData.bill_number || '',
        date: initialData.date || today,
        displayDate: formatDate(initialData.date || today),
        description: initialData.description || '',
        items: Array.isArray(initialData.items) && initialData.items.length > 0 ? initialData.items : getInitialState().items,
        total_without_gst: subtotal,
        total_gst: Number(initialData.total_gst || 0),
        commission_percent: parseFloat(percent.toFixed(2)),
        commission_charges: absCommission,
        labor_charges: Number(initialData.labor_charges || 0),
        round_off: Number(initialData.round_off || 0),
        grand_total: Number(initialData.grand_total || 0),
        status: initialData.status || 'Pending'
      });
    } else {
      setFormData(getInitialState());
    }
  }, [initialData, cid]);

  const handleVendorSelect = (name: string) => {
    const selected = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (selected) {
      setFormData(prev => ({
        ...prev,
        vendor_name: name,
        gstin: selected.gstin || '',
        address: selected.address || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, vendor_name: name }));
    }
  };

  const updateTotals = (items: any[], commissionPercent = formData.commission_percent, labor = formData.labor_charges) => {
    let subtotal = 0, totalTax = 0;
    const updated = items.map(item => {
      const taxable = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      const igst = taxable * ((Number(item.igstRate) || 0) / 100);
      const cgst = taxable * ((Number(item.cgstRate) || 0) / 100);
      const sgst = taxable * ((Number(item.sgstRate) || 0) / 100);
      const rowTax = igst + cgst + sgst;
      subtotal += taxable; totalTax += rowTax;
      return { ...item, taxableAmount: taxable, igstAmount: igst, cgstAmount: cgst, sgstAmount: sgst, amount: taxable + rowTax };
    });

    const commRate = Number(commissionPercent) || 0;
    const labNum = Number(labor) || 0;
    
    // Calculate absolute commission from percentage of subtotal
    const commAbs = subtotal * (commRate / 100);
    
    const rawTotal = subtotal + totalTax + commAbs + labNum;
    const grandTotalInt = Math.round(rawTotal);
    const ro = parseFloat((grandTotalInt - rawTotal).toFixed(2));
    
    setFormData(prev => ({ 
      ...prev, 
      items: updated, 
      total_without_gst: subtotal, 
      total_gst: totalTax, 
      commission_percent: commRate,
      commission_charges: commAbs,
      labor_charges: labNum,
      round_off: ro, 
      grand_total: grandTotalInt 
    }));
  };

  const handleFieldChange = (index: number, field: string, value: any) => {
    const newItems = [...(formData.items || [])];
    if (!newItems[index]) return;
    const item = { ...newItems[index] };
    item[field] = (['itemName', 'hsnCode', 'unit'].includes(field)) ? value : Number(value);
    
    const tx = ['igstRate', 'cgstRate', 'sgstRate'];
    if (tx.includes(field)) {
      const active = tx.filter(f => Number(item[f]) > 0);
      if (active.length > 2) {
        const reset = active.find(f => f !== field);
        if (reset) item[reset] = 0;
      }
    }
    newItems[index] = item;
    updateTotals(newItems);
  };

  const handleDateBlur = () => {
    const iso = parseDateFromInput(formData.displayDate);
    if (iso) setFormData({ ...formData, date: iso, displayDate: formatDate(iso) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.bill_number || !formData.vendor_name) {
      alert("Missing mandatory fields.");
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Auth session expired.");

      const fullPayload: any = {
        company_id: cid,
        user_id: user.id,
        vendor_name: formData.vendor_name.trim(),
        bill_number: formData.bill_number.trim(),
        date: formData.date,
        gstin: formData.gstin || '',
        address: formData.address || '',
        items: formData.items,
        total_without_gst: Number(formData.total_without_gst) || 0,
        total_gst: Number(formData.total_gst) || 0,
        commission_charges: Number(formData.commission_charges) || 0, // Absolute value for DB
        labor_charges: Number(formData.labor_charges) || 0,
        grand_total: Number(formData.grand_total) || 0,
        status: formData.status,
        is_deleted: false
      };

      const fallbackPayload = { ...fullPayload };
      delete fallbackPayload.commission_charges;
      delete fallbackPayload.labor_charges;

      let res;
      if (initialData?.id) {
        res = await supabase.from('bills').update(fullPayload).eq('id', initialData.id);
        if (res.error?.code === 'PGRST204') {
          res = await supabase.from('bills').update(fallbackPayload).eq('id', initialData.id);
          if (!res.error) alert("Voucher updated. Note: Database schema update needed for charges columns.");
        }
      } else {
        res = await supabase.from('bills').insert([fullPayload]);
        if (res.error?.code === 'PGRST204') {
          res = await supabase.from('bills').insert([fallbackPayload]);
          if (!res.error) alert("Voucher created. Note: Database schema update needed for charges columns.");
        }
      }

      if (res.error) throw res.error;
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(fullPayload);
    } catch (err: any) {
      console.error("Submission Error:", err);
      const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert(`Submission Failure: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</label>
          <input required value={formData.displayDate || ''} onChange={(e) => setFormData({...formData, displayDate: e.target.value})} onBlur={handleDateBlur} placeholder={getDatePlaceholder()} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white shadow-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bill No</label>
          <input required value={formData.bill_number || ''} onChange={(e) => setFormData({...formData, bill_number: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-400 bg-white shadow-sm" placeholder="INV-001" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor</label>
          <input 
            required 
            value={formData.vendor_name || ''} 
            onChange={(e) => handleVendorSelect(e.target.value)} 
            list="vl" 
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white font-medium shadow-sm" 
            placeholder="Search vendor..." 
          />
          <datalist id="vl">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor GSTIN</label>
          <input 
            value={formData.gstin || ''} 
            onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})} 
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-400 bg-white shadow-sm" 
            placeholder="Auto-populated" 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Billing Address</label>
          <input 
            value={formData.address || ''} 
            onChange={(e) => setFormData({...formData, address: e.target.value})} 
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white shadow-sm" 
            placeholder="Auto-populated" 
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Items</label>
        <div className="overflow-x-auto border border-slate-200 rounded shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-bold text-slate-500 uppercase">
                <th className="p-2 border-r text-left">Item Name</th>
                <th className="p-2 border-r w-16 text-center">Qty</th>
                <th className="p-2 border-r w-24 text-right">Rate</th>
                <th className="p-2 border-r w-20 text-center">GST %</th>
                <th className="p-2 text-right w-32">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {formData.items.map((it: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="p-0 border-r"><input value={it.itemName || ''} onChange={(e) => handleFieldChange(idx, 'itemName', e.target.value)} list="sil" className="w-full p-2 outline-none border-none bg-transparent" placeholder="Select item..." /></td>
                  <td className="p-0 border-r"><input type="number" value={it.qty || 0} onChange={(e) => handleFieldChange(idx, 'qty', e.target.value)} className="w-full p-2 text-center outline-none border-none bg-transparent" /></td>
                  <td className="p-0 border-r"><input type="number" value={it.rate || 0} onChange={(e) => handleFieldChange(idx, 'rate', e.target.value)} className="w-full p-2 text-right outline-none border-none bg-transparent" /></td>
                  <td className="p-0 border-r">
                    <select value={it.igstRate || it.cgstRate || 0} onChange={(e) => handleFieldChange(idx, 'igstRate', e.target.value)} className="w-full p-2 outline-none border-none bg-transparent text-center">
                      {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-right font-bold text-slate-900">{formatCurrency(it.amount)}</td>
                  <td className="text-center"><button type="button" onClick={() => { const i = [...formData.items]; i.splice(idx, 1); updateTotals(i); }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFormData({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', qty: 1, rate: 0, amount: 0 }]})} className="w-full py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase hover:bg-slate-100 transition-colors border-t border-slate-200">+ Add Line Item</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-6">
        <div className="w-full md:flex-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Remarks</label>
          <textarea value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} className="w-full border border-slate-200 rounded p-4 text-sm outline-none focus:border-slate-400 resize-none bg-white shadow-inner" placeholder="Enter notes..." />
        </div>
        <div className="w-full md:w-80 bg-slate-50 p-6 border border-slate-200 rounded space-y-4 shadow-sm">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                <span>Taxable Amount</span>
                <span className="text-slate-800 font-mono text-sm">{formatCurrency(formData.total_without_gst)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                <span>GST Total</span>
                <span className="text-slate-800 font-mono text-sm">{formatCurrency(formData.total_gst)}</span>
            </div>
            
            <div className="flex justify-between items-start text-[10px] font-bold text-slate-400 uppercase">
                <span className="mt-1">Commission</span>
                <div className="flex flex-col items-end">
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1"
                      value={formData.commission_percent} 
                      onChange={(e) => updateTotals(formData.items, parseFloat(e.target.value) || 0, formData.labor_charges)} 
                      className="text-right bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-400 outline-none rounded px-2 py-1 font-mono text-sm w-20 text-slate-800 transition-all pr-6"
                      placeholder="0.0"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium mt-1">Amt: {formatCurrency(formData.commission_charges)}</span>
                </div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                <span>Labor Charges</span>
                <input 
                  type="number" 
                  value={formData.labor_charges} 
                  onChange={(e) => updateTotals(formData.items, formData.commission_percent, parseFloat(e.target.value) || 0)} 
                  className="text-right bg-transparent border-none hover:ring-1 hover:ring-slate-300 focus:ring-1 focus:ring-slate-400 outline-none rounded p-0.5 font-mono text-sm w-24 text-slate-800 transition-all"
                  placeholder="0.00"
                />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-300">
                <span className="text-sm font-bold text-slate-900 uppercase">Net Payable</span>
                <span className="text-2xl font-semibold text-slate-900">{formatCurrency(formData.grand_total)}</span>
            </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-700">Discard</button>
        <button type="submit" disabled={loading} className="px-10 py-2.5 bg-primary text-slate-800 font-bold uppercase text-[10px] tracking-widest rounded border border-slate-200 hover:bg-primary-dark transition-all shadow-md active:scale-95 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
          {initialData?.id ? 'Update Bill' : 'Create Bill'}
        </button>
      </div>
      <datalist id="sil">{stockItems.map(si => <option key={si.id} value={si.name} />)}</datalist>
    </form>
  );
};

export default BillForm;
