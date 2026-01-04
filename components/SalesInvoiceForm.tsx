
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Trash2, Loader2, UserPlus, UserRoundPen, ChevronDown } from 'lucide-react';
import { getActiveCompanyId, formatDate, parseDateFromInput, safeSupabaseSave, syncTransactionToCashbook, ensureStockItems, ensureParty, normalizeBill } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import CustomerForm from './CustomerForm';

interface SalesInvoiceFormProps {
  initialData?: any;
  onSubmit: (invoice: any) => void;
  onCancel: () => void;
}

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
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: '', kgPerBag: '', unit: 'PCS', rate: '', tax_rate: 0, taxableAmount: 0, amount: 0 }],
    total_without_gst: 0, 
    total_gst: 0, 
    grand_total: 0, 
    status: 'Pending',
    type: 'Sale',
    transaction_type: 'sale'
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [customerModal, setCustomerModal] = useState({ isOpen: false, initialData: null, prefilledName: '' });

  const loadData = async () => {
    if (!cid) return;
    const { data: v } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
    const { data: s } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
    setCustomers((v || []).filter(p => p.party_type === 'customer' || p.is_customer === true));
    setStockItems(s || []);
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

  const recalculate = (state: any, sourceField?: string) => {
    let taxableTotal = parseFloat(state.total_without_gst) || 0;
    let gstTotal = parseFloat(state.total_gst) || 0;

    // Only recalculate from items if not a manual override of totals
    if (sourceField !== 'total_without_gst' && sourceField !== 'total_gst') {
      taxableTotal = 0;
      gstTotal = 0;
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
      state.items = items;
    }

    const total = Math.round(taxableTotal + gstTotal);
    return { ...state, total_without_gst: taxableTotal, total_gst: gstTotal, grand_total: total };
  };

  const updateItemRow = (idx: number, field: string, val: any) => {
    const items = [...formData.items];
    items[idx] = { ...items[idx], [field]: val };

    if (field === 'itemName') {
        const selected = stockItems.find(s => s.name.toLowerCase().trim() === val.toLowerCase().trim());
        if (selected) {
            items[idx] = { 
                ...items[idx], 
                hsnCode: selected.hsn || '',
                rate: selected.rate || '',
                tax_rate: selected.tax_rate || 0,
                unit: selected.unit || 'PCS'
            };
        }
    }

    setFormData(recalculate({ ...formData, items }));
  };

  const handleCustomerChange = (name: string) => {
    const selected = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    setFormData(recalculate({ ...formData, customer_name: name, gstin: selected?.gstin || '' }));
  };

  const matchedCustomer = useMemo(() => 
    customers.find(c => c.name.toLowerCase() === formData.customer_name.toLowerCase()), 
    [formData.customer_name, customers]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.invoice_number) return alert("Required: Customer and Invoice Number");

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
            transaction_type: 'sale',
            gst_type: formData.gst_type,
            round_off: Number(formData.round_off) || 0
        },
        type: 'Sale',
        transaction_type: 'sale',
        gst_type: formData.gst_type,
        round_off: Number(formData.round_off) || 0
      };

      const savedRes = await safeSupabaseSave('bills', payload, initialData?.id);
      
      // Auto-update master items
      await ensureStockItems(formData.items, cid, user.id);
      // Auto-update master customer
      await ensureParty(formData.customer_name, 'customer', cid, user.id);

      if (payload.status === 'Paid' && savedRes.data) {
        await syncTransactionToCashbook(savedRes.data[0]);
      }

      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) { alert("Error: " + (err.message || err)); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white w-full flex flex-col">
      <Modal 
        isOpen={customerModal.isOpen} 
        onClose={() => setCustomerModal({ ...customerModal, isOpen: false })} 
        title={customerModal.initialData ? "Edit Customer Ledger" : "Register New Customer"}
        maxWidth="max-w-4xl"
      >
        <CustomerForm 
            initialData={customerModal.initialData || matchedCustomer} 
            prefilledName={customerModal.prefilledName} 
            onSubmit={(saved) => { setCustomerModal({ ...customerModal, isOpen: false }); loadData().then(() => handleCustomerChange(saved.name)); }}
            onCancel={() => setCustomerModal({ ...customerModal, isOpen: false })}
        />
      </Modal>

      <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
        <div className="border border-slate-200 rounded-md p-8 bg-white space-y-6">
            <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Invoice Date</label>
                    <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] font-medium bg-white" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Invoice No</label>
                    <input required value={formData.invoice_number} onChange={e => setFormData({...formData, invoice_number: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] font-mono font-bold bg-white" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Status</label>
                    <div className="relative">
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] bg-white appearance-none">
                            <option value="Pending">Unpaid (Credit)</option>
                            <option value="Paid">Received (Paid)</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] font-normal text-slate-900">Customer Name</label>
                <div className="flex gap-3">
                    <input required list="custlist" value={formData.customer_name} onChange={e => handleCustomerChange(e.target.value)} className="flex-1 px-4 py-2 border border-slate-200 rounded outline-none text-[14px] font-bold uppercase bg-white" placeholder="Search Customer..." />
                    <button type="button" onClick={() => setCustomerModal({ isOpen: true, initialData: matchedCustomer || null, prefilledName: matchedCustomer ? '' : formData.customer_name })} className={`h-10 w-10 flex items-center justify-center rounded border transition-all shrink-0 ${matchedCustomer ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-primary/20 text-slate-700 border-slate-200'}`}>
                      {matchedCustomer ? <UserRoundPen className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    </button>
                </div>
                <datalist id="custlist">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>

            <div className="border border-slate-200 rounded-md overflow-x-auto bg-white">
                <table className="w-full text-[13px] border-collapse min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                        <tr>
                            <th className="p-3 text-left border-r border-slate-200 min-w-[200px]">Particulars (Item)</th>
                            <th className="p-3 text-left w-24 border-r border-slate-200">HSN</th>
                            <th className="p-3 text-center w-24 border-r border-slate-200">QTY</th>
                            <th className="p-3 text-center w-24 border-r border-slate-200">KG PER BAG</th>
                            <th className="p-3 text-right w-32 border-r border-slate-200">Rate per KG</th>
                            <th className="p-3 text-right w-32">Amount</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {formData.items.map((it: any, idx: number) => (
                            <tr key={it.id}>
                                <td className="p-0 border-r border-slate-100">
                                    <input list="itemslist" value={it.itemName} onChange={e => updateItemRow(idx, 'itemName', e.target.value)} className="w-full h-9 px-3 outline-none font-medium bg-transparent" placeholder="Start typing item..." />
                                </td>
                                <td className="p-0 border-r border-slate-100"><input value={it.hsnCode} onChange={e => updateItemRow(idx, 'hsnCode', e.target.value)} className="w-full h-9 px-3 outline-none bg-transparent font-mono" /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" step="any" value={it.qty} onChange={e => updateItemRow(idx, 'qty', e.target.value)} className="w-full h-9 px-2 text-center outline-none bg-transparent font-bold" placeholder="QTY" /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" step="any" value={it.kgPerBag} onChange={e => updateItemRow(idx, 'kgPerBag', e.target.value)} className="w-full h-9 px-2 text-center outline-none bg-transparent" placeholder="Adapts..." /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" step="any" value={it.rate} onChange={e => updateItemRow(idx, 'rate', e.target.value)} className="w-full h-9 px-2 text-right outline-none bg-transparent font-mono" placeholder="Rate / KG" /></td>
                                <td className="p-3 text-right font-bold text-slate-900 font-mono">{(it.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2 text-center"><button type="button" onClick={() => setFormData(recalculate({...formData, items: formData.items.filter((_: any, i: number) => i !== idx)}))} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <datalist id="itemslist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
                <button type="button" onClick={() => setFormData(recalculate({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: '', kgPerBag: '', unit: 'PCS', rate: '', tax_rate: 0, taxableAmount: 0, amount: 0 }]}))} className="w-full py-3 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase hover:bg-slate-100 transition-colors border-t border-slate-200">+ Add New Line</button>
            </div>

            <div className="flex flex-col items-center justify-center space-y-3 py-6 border-t border-slate-100">
                <div className="flex items-center justify-between w-72 text-[14px]">
                    <span className="text-slate-500 font-normal">Total Taxable</span>
                    <input 
                      type="number" 
                      step="any"
                      value={formData.total_without_gst} 
                      onChange={e => setFormData(recalculate({...formData, total_without_gst: e.target.value}, 'total_without_gst'))}
                      className="font-bold text-slate-900 text-right w-32 border-b border-dashed border-slate-200 outline-none focus:border-link" 
                    />
                </div>
                <div className="flex items-center justify-between w-72 text-[14px]">
                    <span className="text-slate-500 font-normal">GST Total</span>
                    <input 
                      type="number" 
                      step="any"
                      value={formData.total_gst} 
                      onChange={e => setFormData(recalculate({...formData, total_gst: e.target.value}, 'total_gst'))}
                      className="font-bold text-slate-900 text-right w-32 border-b border-dashed border-slate-200 outline-none focus:border-link" 
                    />
                </div>
                <div className="flex items-center justify-between w-72 pt-3 border-t border-slate-100">
                    <span className="text-slate-900 font-normal">Grand Total</span>
                    <span className="text-[18px] font-bold text-link">₹{formData.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-6 items-center">
            <button type="button" onClick={onCancel} className="text-[13px] text-slate-500 hover:text-slate-800 transition-none font-normal">Discard</button>
            <button 
                type="submit" 
                disabled={loading} 
                className="bg-link text-white px-10 py-2.5 rounded font-normal text-[14px] hover:bg-link/90 transition-none flex items-center shadow-lg shadow-link/10"
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
