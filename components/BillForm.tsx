
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
        round_off: Number(initialData.round_off || 0),
        grand_total: Number(initialData.grand_total || 0),
        status: initialData.status || 'Pending'
      });
    } else {
      setFormData(getInitialState());
    }
  }, [initialData, cid]);

  const updateTotals = (items: any[]) => {
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
    const rawTotal = subtotal + totalTax;
    const grandTotalInt = Math.round(rawTotal);
    const ro = parseFloat((grandTotalInt - rawTotal).toFixed(2));
    setFormData(prev => ({ ...prev, items: updated, total_without_gst: subtotal, total_gst: totalTax, round_off: ro, grand_total: grandTotalInt }));
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
    
    let submissionDate = formData.date;
    if (!submissionDate) {
        const parsed = parseDateFromInput(formData.displayDate);
        if (parsed) submissionDate = parsed;
    }

    if (!submissionDate || !formData.bill_number || !formData.vendor_name) {
      alert("Mandatory: Please provide Date, Bill Number, and Vendor Name.");
      return;
    }
    
    const validItems = formData.items.filter((it: any) => it.itemName && it.itemName.trim() !== '');
    if (validItems.length === 0) {
      alert("Voucher rejected: At least one item is required.");
      return;
    }

    if (!cid) {
      alert("Error: Workspace context lost. Please select a company again.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired. Please log in again.");

      // 1. Auto-create Vendor check
      const vendorExists = vendors.some(v => v.name.toLowerCase() === formData.vendor_name.toLowerCase());
      if (!vendorExists) {
        const { error: vErr } = await supabase.from('vendors').insert([{
          company_id: cid,
          user_id: user.id,
          name: formData.vendor_name,
          gstin: formData.gstin || '',
          address: formData.address || '',
          balance: 0,
          is_deleted: false
        }]);
        if (vErr) console.warn("Vendor auto-creation warning:", vErr);
      }

      // 2. Auto-create Items check with "Actual Bill Data" (Rate, Unit, HSN)
      for (const item of validItems) {
        const itemExists = stockItems.some(si => si.name.toLowerCase() === item.itemName.toLowerCase());
        if (!itemExists) {
          const { error: sErr } = await supabase.from('stock_items').insert([{
            company_id: cid,
            user_id: user.id,
            name: item.itemName,
            sku: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
            unit: item.unit || 'PCS',
            rate: Number(item.rate) || 0,
            hsn: item.hsnCode || '',
            in_stock: 0, // Opening stock is zero, purchases will increase it later if logic added
            is_deleted: false
          }]);
          if (sErr) console.warn("Stock auto-creation warning:", sErr);
        }
      }

      // 3. Prepare Clean Payload - STRICTLY OMITTING COLUMNS NOT IN SCHEMA
      // The error PGRST204 confirmed 'description' column does not exist on 'bills' table.
      const payload: any = {
        company_id: cid,
        user_id: user.id,
        vendor_name: formData.vendor_name,
        bill_number: formData.bill_number,
        date: submissionDate,
        items: validItems.map((it: any) => ({
          ...it,
          description: formData.description // Storing the narration inside the items JSON
        })),
        total_without_gst: Number(formData.total_without_gst) || 0,
        total_gst: Number(formData.total_gst) || 0,
        grand_total: Number(formData.grand_total) || 0,
        status: formData.status,
        is_deleted: false
      };

      let opResult;
      if (initialData?.id) {
        // Explicitly check ID to fix "cannot edit"
        opResult = await supabase.from('bills').update(payload).eq('id', initialData.id);
      } else {
        opResult = await supabase.from('bills').insert([payload]);
      }

      if (opResult.error) {
        console.error("Supabase Operation Failed:", opResult.error);
        throw opResult.error;
      }
      
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) {
      // Improved error parsing to avoid [object Object]
      const errMsg = err.message || err.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert("Database Submission Error:\n\n" + errMsg);
      console.error("Full Submission Error Object:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</label>
          <input 
            required 
            value={formData.displayDate || ''} 
            onChange={(e) => setFormData({...formData, displayDate: e.target.value})} 
            onBlur={handleDateBlur} 
            placeholder={getDatePlaceholder()} 
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white" 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bill No</label>
          <input 
            required 
            value={formData.bill_number || ''} 
            onChange={(e) => setFormData({...formData, bill_number: e.target.value})} 
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-400 bg-white" 
            placeholder="Inv-001" 
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor</label>
          <input 
            required 
            value={formData.vendor_name || ''} 
            onChange={(e) => setFormData({...formData, vendor_name: e.target.value})} 
            list="vl" 
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white" 
            placeholder="Type name..." 
          />
          <datalist id="vl">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">GSTIN (Saved to Vendor)</label>
          <input value={formData.gstin || ''} onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-400 bg-white" placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Address (Saved to Vendor)</label>
          <input value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white" placeholder="City, State" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
          <select value={formData.status || 'Pending'} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white outline-none focus:border-slate-400">
            <option value="Pending">Unpaid (Pending)</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Line Items (New Stock Items Auto-Created)</label>
           {formData.items.filter((it: any) => it.itemName).length === 0 && (
              <span className="text-[9px] font-bold text-red-500 flex items-center animate-pulse"><AlertCircle className="w-3 h-3 mr-1" /> At least one item required</span>
           )}
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="p-3 border-r border-slate-200 text-left">Item Name</th>
                <th className="p-3 border-r border-slate-200 w-16 text-center">Qty</th>
                <th className="p-3 border-r border-slate-200 w-24 text-right">Rate</th>
                <th className="p-3 border-r border-slate-200 w-24 text-center">GST %</th>
                <th className="p-3 text-right w-32">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {(formData.items || []).map((it: any, idx: number) => (
                <tr key={it.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-0 border-r border-slate-200">
                    <input 
                      value={it.itemName || ''} 
                      onChange={(e) => handleFieldChange(idx, 'itemName', e.target.value)} 
                      list="sil" 
                      className="w-full p-3 outline-none border-none bg-transparent" 
                      placeholder="Search/Add item..." 
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
                    <button type="button" onClick={() => { const i = [...(formData.items || [])]; i.splice(idx, 1); updateTotals(i); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFormData({...formData, items: [...(formData.items || []), { id: Date.now().toString(), itemName: '', qty: 1, rate: 0, igstRate: 0, cgstRate: 0, sgstRate: 0, amount: 0 }]})} className="w-full py-3 bg-slate-50 text-[10px] font-bold text-slate-500 hover:bg-slate-100 uppercase tracking-widest border-t border-slate-200 transition-colors">+ Add New Row</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-6">
        <div className="w-full md:flex-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Narrations / Notes (Stored in Bill Data)</label>
          <textarea 
            value={formData.description || ''} 
            onChange={(e) => setFormData({...formData, description: e.target.value})} 
            rows={4} 
            className="w-full border border-slate-200 rounded-lg p-4 text-sm outline-none focus:border-slate-400 resize-none bg-white shadow-inner" 
            placeholder="Enter transaction remarks..." 
          />
        </div>
        <div className="w-full md:w-96 bg-slate-50 p-6 border border-slate-200 rounded-lg space-y-4 shadow-sm">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Taxable Amount</span>
                <span className="text-slate-800 font-mono text-sm">{formatCurrency(formData.total_without_gst)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>GST Aggregate</span>
                <span className="text-slate-800 font-mono text-sm">{formatCurrency(formData.total_gst)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase italic">
                <span>Adjustment (Round Off)</span>
                <span className="text-slate-500 font-mono text-sm">{formData.round_off >= 0 ? '+' : ''}{(formData.round_off || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-300">
                <span className="text-sm font-bold text-slate-900 uppercase tracking-widest">Net Payable</span>
                <span className="text-3xl font-semibold text-slate-900">{formatCurrency(formData.grand_total)}</span>
            </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-8 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-8 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-700 transition-colors">Discard</button>
        <button type="submit" disabled={loading} className="px-12 py-3 bg-primary text-slate-900 font-bold uppercase text-[10px] tracking-widest rounded-lg border border-slate-200 hover:bg-primary-dark transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
          {initialData?.id ? 'Update Voucher' : 'Create Voucher'}
        </button>
      </div>
      <datalist id="sil">{stockItems.map(si => <option key={si.id} value={si.name} />)}</datalist>
    </form>
  );
};

export default BillForm;
