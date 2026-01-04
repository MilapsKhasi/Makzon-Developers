
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Trash2, Loader2, UserPlus, UserRoundPen, ChevronDown, AlertCircle } from 'lucide-react';
import { getActiveCompanyId, formatDate, parseDateFromInput, safeSupabaseSave, syncTransactionToCashbook, ensureStockItems, normalizeBill } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import CustomerForm from './CustomerForm';

interface SalesInvoiceFormProps {
  initialData?: any;
  onSubmit: (invoice: any) => void;
  onCancel: () => void;
}

const TAX_RATES = [0, 5, 12, 18, 28];

const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const cid = getActiveCompanyId();
  const today = new Date().toISOString().split('T')[0];
  
  const getInitialState = () => ({
    customer_name: '', 
    gstin: '', 
    invoice_number: '', 
    date: today, 
    displayDate: formatDate(today), 
    gst_type: 'Intra-State',
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, rate: 0, tax_rate: 0, taxableAmount: 0, amount: 0 }],
    total_without_gst: 0, 
    total_gst: 0, 
    grand_total: 0, 
    status: 'Pending',
    type: 'Sale'
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [allBills, setAllBills] = useState<any[]>([]); 
  const [customerModal, setCustomerModal] = useState({ isOpen: false, initialData: null, prefilledName: '' });

  const loadData = async () => {
    if (!cid) return;
    const { data: v } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
    const { data: s } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
    const { data: b } = await supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false);
    setCustomers((v || []).filter(p => p.is_customer));
    setStockItems(s || []);
    setAllBills((b || []).map(normalizeBill));
  };

  useEffect(() => {
    loadData();
    if (initialData) {
      const normalized = normalizeBill(initialData);
      setFormData({
        ...normalized,
        customer_name: normalized.vendor_name || '',
        invoice_number: normalized.bill_number || '',
        displayDate: formatDate(normalized.date),
      });
    }
  }, [initialData, cid]);

  const getAvailableStock = (itemName: string) => {
    const item = stockItems.find(s => s.name.toLowerCase() === itemName.toLowerCase());
    if (!item) return 0;

    let purchased = 0;
    let sold = 0;

    allBills.forEach(bill => {
      if (initialData?.id && bill.id === initialData.id) return;
      bill.items?.forEach((it: any) => {
        if (it.itemName?.trim().toLowerCase() === itemName.toLowerCase()) {
          if (bill.type === 'Sale') sold += Number(it.qty || 0);
          else purchased += Number(it.qty || 0);
        }
      });
    });

    return (Number(item.in_stock) || 0) + purchased - sold;
  };

  const recalculate = (state: any) => {
    let taxableTotal = 0;
    let gstTotal = 0;
    const items = (state.items || []).map((item: any) => {
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      const t = parseFloat(item.tax_rate) || 0;
      const taxable = q * r;
      const gst = taxable * (t / 100);
      taxableTotal += taxable;
      gstTotal += gst;
      return { ...item, taxableAmount: taxable, amount: taxable + gst };
    });

    const total = Math.round(taxableTotal + gstTotal);
    return { ...state, items, total_without_gst: taxableTotal, total_gst: gstTotal, grand_total: total };
  };

  const updateItemField = (idx: number, field: string, val: any) => {
    const items = [...formData.items];
    items[idx] = { ...items[idx], [field]: val };

    // Auto-fill logic when Item name matches master record
    if (field === 'itemName') {
        const selected = stockItems.find(s => s.name.toLowerCase() === val.toLowerCase());
        if (selected) {
            items[idx] = { 
                ...items[idx], 
                hsnCode: selected.hsn || '',
                rate: selected.rate || 0, 
                tax_rate: selected.tax_rate || 0 
            };
        }
    }

    setFormData(recalculate({ ...formData, items }));
  };

  const handleCustomerChange = (name: string) => {
    const selected = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    setFormData(recalculate({ ...formData, customer_name: name, gstin: selected?.gstin || '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.invoice_number) return alert("Required: Customer and Invoice Number");

    // Stock availability validation
    for (const item of formData.items) {
      if (!item.itemName) continue;
      const available = getAvailableStock(item.itemName);
      if (available < Number(item.qty)) {
        alert(`Insufficient stock for ${item.itemName}. Available in inventory: ${available}`);
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // PACK METADATA into items JSONB to avoid warnings and schema sync issues
      const payload: any = {
        company_id: cid,
        user_id: user.id,
        vendor_name: formData.customer_name,
        bill_number: formData.invoice_number,
        date: formData.date,
        total_without_gst: formData.total_without_gst,
        total_gst: formData.total_gst,
        grand_total: formData.grand_total,
        status: formData.status,
        is_deleted: false,
        items: {
            line_items: formData.items,
            type: 'Sale',
            gst_type: formData.gst_type,
            round_off: Number(formData.round_off) || 0
        },
        // Mirror as columns for standard support if they exist
        type: 'Sale',
        gst_type: formData.gst_type,
        round_off: Number(formData.round_off) || 0
      };

      const savedRes = await safeSupabaseSave('bills', payload, initialData?.id);
      
      // AUTO-UPDATE STOCK MASTER info (HSN, etc)
      await ensureStockItems(formData.items, cid, user.id);
      
      // SYNC TO CASHBOOK: Only for Paid transactions
      if (payload.status === 'Paid' && savedRes.data) {
        await syncTransactionToCashbook(savedRes.data[0]);
      }

      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) { alert("Error: " + (err.message || err)); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white">
      <Modal isOpen={customerModal.isOpen} onClose={() => setCustomerModal({ ...customerModal, isOpen: false })} title="Customer Profile">
        <CustomerForm 
            initialData={customerModal.initialData} 
            prefilledName={customerModal.prefilledName} 
            onSubmit={(saved) => { setCustomerModal({ ...customerModal, isOpen: false }); loadData().then(() => handleCustomerChange(saved.name)); }}
            onCancel={() => setCustomerModal({ ...customerModal, isOpen: false })}
        />
      </Modal>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="border border-slate-200 rounded-md p-8 bg-slate-50/50 space-y-6">
            <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Invoice Date</label>
                    <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-4 py-2.5 border border-slate-200 rounded outline-none text-sm font-medium bg-white" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Invoice No</label>
                    <input required value={formData.invoice_number} onChange={e => setFormData({...formData, invoice_number: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded outline-none text-sm font-mono font-bold bg-white" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                    <div className="relative">
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded outline-none text-sm bg-white appearance-none">
                            <option value="Pending">Unpaid (Credit)</option>
                            <option value="Paid">Received (Paid)</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Customer Name</label>
                <div className="flex gap-3">
                    <input required list="custlist" value={formData.customer_name} onChange={e => handleCustomerChange(e.target.value)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded outline-none text-sm font-bold uppercase bg-white" placeholder="Search Customer..." />
                    <button type="button" onClick={() => setCustomerModal({ isOpen: true, initialData: null, prefilledName: formData.customer_name })} className="p-2.5 bg-link/10 text-link border border-link/20 rounded hover:bg-link/20"><UserPlus className="w-5 h-5" /></button>
                </div>
                <datalist id="custlist">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                        <tr>
                            <th className="p-3 text-left border-r border-slate-200">Particulars (Item)</th>
                            <th className="p-3 text-left w-24 border-r border-slate-200">HSN</th>
                            <th className="p-3 text-center w-24 border-r border-slate-200">Qty</th>
                            <th className="p-3 text-right w-32 border-r border-slate-200">Rate</th>
                            <th className="p-3 text-center w-24 border-r border-slate-200">GST %</th>
                            <th className="p-3 text-right w-40">Total</th>
                            <th className="w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {formData.items.map((it: any, idx: number) => (
                            <tr key={it.id}>
                                <td className="p-0 border-r border-slate-100"><input list="itemslist" value={it.itemName} onChange={e => updateItemField(idx, 'itemName', e.target.value)} className="w-full p-3 outline-none font-medium bg-transparent" placeholder="Start typing..." /></td>
                                <td className="p-0 border-r border-slate-100"><input value={it.hsnCode} onChange={e => updateItemField(idx, 'hsnCode', e.target.value)} className="w-full p-3 outline-none bg-transparent font-mono" /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" value={it.qty} onChange={e => updateItemField(idx, 'qty', e.target.value)} className="w-full p-3 text-center outline-none bg-transparent font-bold" /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" value={it.rate} onChange={e => updateItemField(idx, 'rate', e.target.value)} className="w-full p-3 text-right outline-none bg-transparent font-mono" /></td>
                                <td className="p-0 border-r border-slate-100"><select value={it.tax_rate} onChange={e => updateItemField(idx, 'tax_rate', e.target.value)} className="w-full p-3 outline-none appearance-none text-center bg-transparent">{TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}</select></td>
                                <td className="p-3 text-right font-bold text-slate-900 font-mono bg-slate-50/50">{(it.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 text-center"><button type="button" onClick={() => setFormData(recalculate({...formData, items: formData.items.filter((_: any, i: number) => i !== idx)}))} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <datalist id="itemslist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
                <button type="button" onClick={() => setFormData(recalculate({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, rate: 0, tax_rate: 0, taxableAmount: 0, amount: 0 }]}))} className="w-full py-3 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase hover:bg-slate-100 transition-colors border-t border-slate-200">+ Add Row</button>
            </div>
        </div>

        <div className="flex flex-col items-end space-y-3 pt-6 border-t border-slate-100">
            <div className="flex justify-between w-80 text-sm font-semibold text-slate-500 uppercase">
                <span>Total Taxable</span>
                <span className="font-mono text-slate-900">₹ {formData.total_without_gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-80 text-sm font-semibold text-slate-500 uppercase">
                <span>GST Aggregate</span>
                <span className="font-mono text-slate-900">₹ {formData.total_gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between w-80 pt-4 border-t border-slate-200">
                <span className="text-lg font-bold text-slate-900 uppercase tracking-tighter">Grand Total</span>
                <span className="text-2xl font-bold text-link font-mono">₹ {formData.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
        </div>

        <div className="flex justify-end gap-6 items-center">
            <button type="button" onClick={onCancel} className="text-slate-400 font-bold uppercase text-[12px] hover:text-slate-600">Discard</button>
            <button 
                type="submit" 
                disabled={loading} 
                className="bg-link text-white px-10 py-3 rounded font-bold text-sm hover:bg-link/90 transition-all flex items-center shadow-lg shadow-link/20"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {initialData ? 'Update Invoice' : 'Generate Invoice'}
            </button>
        </div>
      </form>
    </div>
  );
};

export default SalesInvoiceForm;
