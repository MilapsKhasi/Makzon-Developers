
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
    commission_charges: 0,
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
        total_without_gst: Number(initialData.total_without_gst || 0),
        total_gst: Number(initialData.total_gst || 0),
        commission_charges: Number(initialData.commission_charges || 0),
        labor_charges: Number(initialData.labor_charges || 0),
        round_off: Number(initialData.round_off || 0),
        grand_total: Number(initialData.grand_total || 0),
        status: initialData.status || 'Pending'
      });
    } else {
      setFormData(getInitialState());
    }
  }, [initialData, cid]);

  const updateTotals = (items: any[], commission = formData.commission_charges, labor = formData.labor_charges) => {
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

    const commNum = Number(commission) || 0;
    const labNum = Number(labor) || 0;
    const rawTotal = subtotal + totalTax + commNum + labNum;
    const grandTotalInt = Math.round(rawTotal);
    const ro = parseFloat((grandTotalInt - rawTotal).toFixed(2));
    
    setFormData(prev => ({ 
      ...prev, 
      items: updated, 
      total_without_gst: subtotal, 
      total_gst: totalTax, 
      commission_charges: commNum,
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
      alert("Please fill in Date, Bill Number, and Vendor Name.");
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication session expired.");

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
        commission_charges: Number(formData.commission_charges) || 0,
        labor_charges: Number(formData.labor_charges) || 0,
        grand_total: Number(formData.grand_total) || 0,
        status: formData.status,
        is_deleted: false
      };

      // Define columns that might be missing in older schemas
      const legacyPayload = { ...fullPayload };
      delete legacyPayload.commission_charges;
      delete legacyPayload.labor_charges;

      let result;
      if (initialData?.id) {
        result = await supabase.from('bills').update(fullPayload).eq('id', initialData.id);
        if (result.error && (result.error.code === 'PGRST204' || result.error.message?.includes('column'))) {
          console.warn("Retrying update without new charge columns...");
          result = await supabase.from('bills').update(legacyPayload).eq('id', initialData.id);
          if (!result.error) alert("Voucher updated. Note: Commission/Labor charges were skipped because your database schema needs an update.");
        }
      } else {
        result = await supabase.from('bills').insert([fullPayload]);
        if (result.error && (result.error.code === 'PGRST204' || result.error.message?.includes('column'))) {
          console.warn("Retrying insert without new charge columns...");
          result = await supabase.from('bills').insert([legacyPayload]);
          if (!result.error) alert("Voucher created. Note: Commission/Labor charges were skipped because your database schema needs an update.");
        }
      }

      if (result.error) throw result.error;
      
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(fullPayload);
    } catch (err: any) {
      console.error("Submission Failure:", err);
      const msg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert(`Submission Process Failure: ${msg}`);
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
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor Name</label>
          <input required value={formData.vendor_name || ''} onChange={(e) => setFormData({...formData, vendor_name: e.target.value})} list="vl" className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white shadow-sm font-medium" placeholder="Select or type vendor..." />
          <datalist id="vl">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor GSTIN (Notes Only)</label>
          <input value={formData.gstin || ''} onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-400 bg-white shadow-sm" placeholder="Enter GSTIN for this bill" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor Address (Notes Only)</label>
          <input value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white shadow-sm" placeholder="City, State" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Line Items</label>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3 border-r border-slate-200 text-left">Item Name</th>
                <th className="p-3 border-r border-slate-200 w-16 text-center">Qty</th>
                <th className="p-3 border-r border-slate-200 w-24 text-right">Rate</th>
                <th className="p-3 border-r border-slate-200 w-24 text-center">GST %</th>
                <th className="p-3 text-right w-32">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {formData.items.map((it: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-0 border-r border-slate-200">
                    <input 
                      value={it.itemName || ''} 
                      onChange={(e) => handleFieldChange(idx, 'itemName', e.target.value)} 
                      list="sil" 
                      className="w-full p-3 outline-none border-none bg-transparent" 
                      placeholder="Enter item name..." 
                    />
                  </td>
                  <td className="p-0 border-r border-slate-200">
                    <input type="number" value={it.qty || 0} onChange={(e) => handleFieldChange(idx, 'qty', e.target.value)} className="w-full p-3 text-center outline-none border-none bg-transparent" />
                  </td>
                  <td className="p-0 border-r border-slate-200">
                    <input type="number" value={it.rate || 0} onChange={(e) => handleFieldChange(idx, 'rate', e.target.value)} className="w-full p-3 text-right outline-none border-none bg-transparent font-medium" />
                  </td>
                  <td className="p-0 border-r border-slate-200">
                    <select value={it.igstRate || it.cgstRate || 0} onChange={(e) => handleFieldChange(idx, 'igstRate', e.target.value)} className="w-full p-3 outline-none border-none bg-transparent cursor-pointer text-center">
                      {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(it.amount)}</td>
                  <td className="text-center">
                    <button type="button" onClick={() => { const i = [...formData.items]; i.splice(idx, 1); updateTotals(i); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFormData({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', qty: 1, rate: 0, amount: 0 }]})} className="w-full py-3 bg-slate-50 text-[10px] font-bold text-slate-500 hover:bg-slate-100 uppercase tracking-widest border-t border-slate-200 transition-colors">
            + Add New Line
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-6">
        <div className="w-full md:flex-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Remarks / Narration</label>
          <textarea value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} className="w-full border border-slate-200 rounded-lg p-4 text-sm outline-none focus:border-slate-400 resize-none bg-white shadow-inner" placeholder="Enter notes..." />
        </div>
        <div className="w-full md:w-80 bg-slate-50 p-6 border border-slate-200 rounded-lg space-y-4 shadow-sm">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Taxable Amount</span>
                <span className="text-slate-800 font-mono text-sm">{formatCurrency(formData.total_without_gst)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>GST Total</span>
                <span className="text-slate-800 font-mono text-sm">{formatCurrency(formData.total_gst)}</span>
            </div>
            
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Commission</span>
                <input 
                  type="number" 
                  value={formData.commission_charges} 
                  onChange={(e) => updateTotals(formData.items, parseFloat(e.target.value) || 0, formData.labor_charges)} 
                  className="text-right bg-transparent border-none hover:ring-1 hover:ring-slate-300 focus:ring-1 focus:ring-slate-400 outline-none rounded p-0.5 font-mono text-sm w-24 text-slate-800 transition-all"
                  placeholder="0.00"
                />
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Labor Charges</span>
                <input 
                  type="number" 
                  value={formData.labor_charges} 
                  onChange={(e) => updateTotals(formData.items, formData.commission_charges, parseFloat(e.target.value) || 0)} 
                  className="text-right bg-transparent border-none hover:ring-1 hover:ring-slate-300 focus:ring-1 focus:ring-slate-400 outline-none rounded p-0.5 font-mono text-sm w-24 text-slate-800 transition-all"
                  placeholder="0.00"
                />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-300">
                <span className="text-sm font-bold text-slate-900 uppercase tracking-widest">Net Total</span>
                <span className="text-2xl font-semibold text-slate-900">{formatCurrency(formData.grand_total)}</span>
            </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-8 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-700 transition-colors">Discard</button>
        <button type="submit" disabled={loading} className="px-12 py-3 bg-primary text-slate-900 font-bold uppercase text-[10px] tracking-widest rounded-lg border border-slate-200 hover:bg-primary-dark transition-all shadow-md active:scale-95 flex items-center disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
          {initialData?.id ? 'Update Bill' : 'Create Bill'}
        </button>
      </div>
      <datalist id="sil">{stockItems.map(si => <option key={si.id} value={si.name} />)}</datalist>
    </form>
  );
};

export default BillForm;
