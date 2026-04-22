
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, Trash2, Loader2, UserPlus, UserRoundPen, ChevronDown, Undo2, Redo2, ToggleLeft, ToggleRight } from 'lucide-react';
import { getActiveCompanyId, formatDate, parseDateFromInput, safeSupabaseSave, syncTransactionToCashbook, ensureStockItems, ensureParty, normalizeBill, getSelectedLedgerIds, getAppSettings, formatCurrency, toDisplayValue } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import CustomerForm from './CustomerForm';
import PaymentModal from './PaymentModal';
import { recordActivity } from '../utils/activityTracker';

interface SalesInvoiceFormProps {
  initialData?: any;
  onSubmit: (invoice: any) => void;
  onCancel: () => void;
}

const SalesInvoiceForm: React.FC<SalesInvoiceFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const cid = getActiveCompanyId();
  const appSettings = getAppSettings();
  const today = new Date().toISOString().split('T')[0];
  const firstInputRef = useRef<HTMLInputElement>(null);
  const manualOverrides = useRef<Set<string>>(new Set());
  
  const getInitialState = () => ({
    customer_name: '', 
    invoice_number: '', 
    date: today, 
    displayDate: formatDate(today), 
    gst_type: appSettings.gstType || 'CGST - SGST',
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: '', rate: '', discount: 0, discount_type: 'Percentage', tax_rate: 0, taxableAmount: 0, itemTotal: 0 }],
    total_without_gst: 0, 
    total_gst: 0, 
    duties_and_taxes: [],
    grand_total: 0, 
    status: 'Pending',
    round_off: 0,
    description: '',
    payment_details: null
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [history, setHistory] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [isGstEnabled, setIsGstEnabled] = useState(true);

  const updateFormData = useCallback((next: any, skipHistory = false) => {
    if (!skipHistory) {
      setHistory(prev => [...prev, formData].slice(-50)); // Keep last 50 changes
      setFuture([]);
    }
    setFormData(next);
  }, [formData]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [formData, ...f]);
    setHistory(h => h.slice(0, -1));
    setFormData(prev);
  }, [history, formData]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(h => [...h, formData]);
    setFuture(f => f.slice(1));
    setFormData(next);
  }, [future, formData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [customerModal, setCustomerModal] = useState({ isOpen: false, initialData: null, prefilledName: '' });
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const parseNumber = (val: string) => {
    if (!val) return 0;
    const clean = val.toString().replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const formatWhileTyping = (val: string) => {
    if (val === '') return '';
    const clean = val.replace(/[^0-9.]/g, '');
    if (clean === '') return '';
    const parts = clean.split('.');
    let formatted = new Intl.NumberFormat('en-IN').format(parseFloat(parts[0]));
    if (parts.length > 1) formatted += `.${parts[1].slice(0, 2)}`;
    return val.startsWith('-') ? `-${formatted}` : formatted;
  };

  const recalculate = (state: any, sourceField?: string, sourceDutyId?: string, sourceVal?: any) => {
    let taxableTotal = state.total_without_gst;
    let gstTotal = state.total_gst;
    let autoGstSum = gstTotal;

    if (sourceDutyId) manualOverrides.current.add(sourceDutyId);

    if (sourceField === 'total_without_gst') {
      taxableTotal = parseNumber(sourceVal);
    } else if (sourceField === 'total_gst') {
      gstTotal = parseNumber(sourceVal);
      autoGstSum = gstTotal;
    } else if (!sourceDutyId) {
      taxableTotal = 0;
      gstTotal = 0;
      autoGstSum = 0;
      const items = (state.items || []).map((item: any) => {
        const q = parseNumber(item.qty.toString());
        const r = parseNumber(item.rate.toString());
        const d = parseFloat(item.discount) || 0;
        const dt = item.discount_type || 'Percentage';
        const t = parseFloat(item.tax_rate) || 0;
        
        const baseAmount = q * r;
        let discountAmount = 0;
        if (dt === 'Percentage') {
          discountAmount = baseAmount * (d / 100);
        } else {
          discountAmount = d;
        }
        
        // Ensure discount does not exceed baseAmount
        discountAmount = Math.min(discountAmount, baseAmount);
        
        const taxable = baseAmount - discountAmount;
        const gst = isGstEnabled ? taxable * (t / 100) : 0;
        const itemSubtotal = taxable + gst; 
        
        taxableTotal += taxable;
        autoGstSum += gst;
        gstTotal += gst;
        return { ...item, taxableAmount: taxable, itemTotal: itemSubtotal };
      });
      state.items = items;
    }

    let runningTotal = taxableTotal;
    const updatedDuties = (state.duties_and_taxes || []).map((d: any) => {
      let calcAmt = d.amount || 0;
      if (sourceDutyId === d.id) {
        calcAmt = parseNumber(sourceVal);
      } else if (isGstEnabled && appSettings.gstEnabled && (d.name === 'CGST' || d.name === 'SGST' || d.name === 'IGST')) {
          if (appSettings.gstType === 'CGST - SGST') {
              if (d.name === 'CGST' || d.name === 'SGST') calcAmt = autoGstSum / 2;
          } else if (appSettings.gstType === 'IGST') {
              if (d.name === 'IGST') calcAmt = autoGstSum;
          }
      } else {
        const base = d.apply_on === 'Net Total' ? (taxableTotal + gstTotal) : taxableTotal;
        const rate = parseFloat(d.bill_rate !== undefined ? d.bill_rate : d.rate) || 0;
        const fixed = parseFloat(d.bill_fixed_amount !== undefined ? d.bill_fixed_amount : d.fixed_amount) || 0;
        calcAmt = d.calc_method === 'Percentage' ? base * (rate / 100) : fixed;
      }
      runningTotal += calcAmt;
      return { ...d, amount: calcAmt };
    });

    const total = parseFloat(runningTotal.toFixed(2));
    const ro = 0; // Removing automatic rounding as per "exact logic" request

    return { ...state, total_without_gst: parseFloat(taxableTotal.toFixed(2)), total_gst: parseFloat(gstTotal.toFixed(2)), duties_and_taxes: updatedDuties, round_off: ro, grand_total: total };
  };

  const loadData = async () => {
    if (!cid) return;
    const { data: v } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
    const { data: s } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
    setCustomers((v || []).filter(p => p.party_type === 'customer' || p.is_customer === true));
    setStockItems(s || []);
    
    const { data: allDuties } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false);
    const selectedIds = getSelectedLedgerIds();
    const activeDuties = (allDuties || []).filter(d => d.is_default || selectedIds.includes(d.id));

    if (!initialData) {
      setFormData((prev: any) => {
        if (prev.duties_and_taxes.length > 0) return prev;
        return recalculate({ ...prev, duties_and_taxes: activeDuties.map(d => ({ ...d, bill_rate: d.rate, bill_fixed_amount: d.fixed_amount, amount: 0 }))});
      });
    } else {
      const normalized = normalizeBill(initialData);
      setFormData(recalculate({
        ...getInitialState(),
        ...normalized,
        description: normalized.description || '',
        customer_name: normalized.customer_name || '',
        invoice_number: normalized.invoice_number || '',
        displayDate: formatDate(normalized.date),
        duties_and_taxes: (normalized.items_raw?.duties_and_taxes) || activeDuties.map(d => ({ ...d, bill_rate: d.rate, bill_fixed_amount: d.fixed_amount, amount: 0 })),
        payment_details: normalized.items_raw?.payment_details || null
      }));
    }
  };

  useEffect(() => {
    loadData();
    setTimeout(() => { firstInputRef.current?.focus(); }, 100);
  }, [initialData, cid]);

  const updateItemRow = (idx: number, field: string, val: any) => {
    const items = [...formData.items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === 'itemName') {
        const selected = stockItems.find(s => s.name.toLowerCase().trim() === val.toLowerCase().trim());
        if (selected) {
            items[idx] = { 
              ...items[idx], 
              hsnCode: selected.hsn || '', 
              rate: (selected.selling_price || selected.rate || 0).toString(), 
              tax_rate: selected.tax_rate || 0 
            };
        }
    }
    updateFormData(recalculate({ ...formData, items }));
  };

  const handleCustomerChange = (name: string) => {
    const selected = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    updateFormData(recalculate({ ...formData, customer_name: name }));
  };

  const matchedCustomer = useMemo(() => customers.find(c => c.name.toLowerCase() === formData.customer_name.toLowerCase()), [formData.customer_name, customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.invoice_number) return alert("Required: Customer and Invoice Number");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) recordActivity(user.id, user.email || '');

      const payload: any = {
        customer_name: formData.customer_name,
        invoice_number: formData.invoice_number,
        date: formData.date,
        total_without_gst: formData.total_without_gst,
        total_gst: formData.total_gst,
        grand_total: formData.grand_total,
        status: formData.status,
        is_deleted: false,
        description: formData.description,
        round_off: Number(formData.round_off) || 0,
        items: {
            line_items: formData.items,
            duties_and_taxes: formData.duties_and_taxes,
            gst_type: formData.gst_type,
            payment_details: formData.payment_details
        }
      };

      const savedRes = await safeSupabaseSave('sales_invoices', payload, initialData?.id);
      await ensureStockItems(formData.items, cid);
      await ensureParty(formData.customer_name, 'customer', cid);

      if (payload.status === 'Paid' && savedRes.data) {
        await syncTransactionToCashbook(savedRes.data[0]);
      }

      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) { alert("Error: " + (err.message || err)); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 w-full flex flex-col">
      <Modal isOpen={customerModal.isOpen} onClose={() => setCustomerModal({ ...customerModal, isOpen: false })} title={customerModal.initialData ? "Edit Customer" : "New Customer"} maxWidth="max-w-4xl">
        <CustomerForm initialData={customerModal.initialData || matchedCustomer} prefilledName={customerModal.prefilledName} onSubmit={(saved) => { setCustomerModal({ ...customerModal, isOpen: false }); loadData().then(() => handleCustomerChange(saved.name)); }} onCancel={() => setCustomerModal({ ...customerModal, isOpen: false })} />
      </Modal>

      <PaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => {
          setShowPaymentModal(false);
          if (!formData.payment_details || formData.payment_details.length === 0) setFormData({ ...formData, status: 'Pending' });
        }} 
        onSubmit={(payments) => {
          setFormData({ ...formData, payment_details: payments, status: 'Paid' });
          setShowPaymentModal(false);
        }}
        billNumber={formData.invoice_number || 'New'}
        totalAmount={formData.grand_total}
        initialPayments={Array.isArray(formData.payment_details) ? formData.payment_details : (formData.payment_details ? [formData.payment_details] : [])}
      />

      <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-6 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-4">
            <button type="button" onClick={() => setIsGstEnabled(!isGstEnabled)} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              {isGstEnabled ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
              <span>Enable GST</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-200 dark:border-slate-700" />
            <button type="button" onClick={undo} disabled={history.length === 0} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={redo} disabled={future.length === 0} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors" title="Redo (Ctrl+Y)">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="border border-slate-200 dark:border-slate-800 rounded-md p-4 sm:p-8 bg-white dark:bg-slate-900 space-y-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-1.5"><label className="text-[14px] font-medium dark:text-slate-300 capitalize">Date</label><input ref={firstInputRef} required value={toDisplayValue(formData.displayDate)} onChange={e => updateFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) updateFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] font-medium dark:bg-slate-800 dark:text-white" /></div>
                <div className="space-y-1.5"><label className="text-[14px] font-medium dark:text-slate-300 capitalize">Invoice No</label><input required value={toDisplayValue(formData.invoice_number)} onChange={e => updateFormData({...formData, invoice_number: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] font-mono dark:bg-slate-800 dark:text-white font-bold uppercase" /></div>
                <div className="space-y-1.5">
                    <label className="text-[14px] font-medium dark:text-slate-300 capitalize">Status</label>
                    <div className="relative">
                        <select 
                          value={formData.status} 
                          onChange={e => {
                            const newStatus = e.target.value;
                            updateFormData({...formData, status: newStatus});
                            if (newStatus === 'Paid' && (!formData.payment_details || (Array.isArray(formData.payment_details) && formData.payment_details.length === 0))) {
                              setShowPaymentModal(true);
                            }
                          }} 
                          className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] dark:bg-slate-800 dark:text-white appearance-none cursor-pointer"
                        >
                            <option value="Pending">Unpaid</option>
                            <option value="Paid">Received</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-[14px] font-medium dark:text-slate-300 capitalize">Customer Name</label>
                <div className="flex gap-3">
                    <input required list="custlist" value={toDisplayValue(formData.customer_name)} onChange={e => handleCustomerChange(e.target.value)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] uppercase dark:bg-slate-800 dark:text-white font-bold" />
                    <button type="button" onClick={() => setCustomerModal({ isOpen: true, initialData: matchedCustomer || null, prefilledName: matchedCustomer ? '' : formData.customer_name })} className={`h-10 w-10 flex items-center justify-center rounded border transition-all shrink-0 ${matchedCustomer ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800' : 'bg-primary/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                      {matchedCustomer ? <UserRoundPen className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    </button>
                </div>
                <datalist id="custlist">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto bg-white dark:bg-slate-900">
                <table className="w-full text-[14px] border-collapse min-w-[800px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                            <th className="p-3 text-left border-r border-slate-200 dark:border-slate-700 min-w-[200px] capitalize">Particulars</th>
                            <th className="p-3 text-left w-24 border-r border-slate-200 dark:border-slate-700 capitalize">HSN</th>
                            <th className="p-3 text-right w-32 border-r border-slate-200 dark:border-slate-700 capitalize">Rate</th>
                            <th className="p-3 text-center w-24 border-r border-slate-200 dark:border-slate-700 capitalize">QTY</th>
                            <th className="p-3 text-center w-40 border-r border-slate-200 dark:border-slate-700 capitalize">Discount</th>
                            {isGstEnabled && appSettings.gstEnabled && <th className="p-3 text-center w-24 border-r border-slate-200 dark:border-slate-700 capitalize">GST %</th>}
                            <th className="p-3 text-right w-32 capitalize">Subtotal</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {formData.items.map((it: any, idx: number) => {
                            const base = parseNumber(it.qty) * parseNumber(it.rate);
                            const discVal = parseFloat(it.discount) || 0;
                            const isPerc = it.discount_type === 'Percentage';
                            const equiv = isPerc ? (base * (discVal / 100)) : (base > 0 ? (discVal / base) * 100 : 0);

                            return (
                                <tr key={it.id}>
                                    <td className="p-0 border-r border-slate-100 dark:border-slate-800"><input list="itemslist" value={toDisplayValue(it.itemName)} onChange={e => updateItemRow(idx, 'itemName', e.target.value)} className="w-full h-10 px-3 outline-none font-medium bg-transparent dark:text-white" /></td>
                                    <td className="p-0 border-r border-slate-100 dark:border-slate-800"><input value={toDisplayValue(it.hsnCode)} onChange={e => updateItemRow(idx, 'hsnCode', e.target.value)} className="w-full h-10 px-3 outline-none bg-transparent font-mono text-slate-400 dark:text-slate-500" /></td>
                                    <td className="p-0 border-r border-slate-100 dark:border-slate-800"><input type="text" value={toDisplayValue(it.rate)} onChange={e => updateItemRow(idx, 'rate', e.target.value)} className="w-full h-10 px-2 text-right outline-none bg-transparent font-mono font-bold dark:text-white" /></td>
                                    <td className="p-0 border-r border-slate-100 dark:border-slate-800"><input type="text" value={toDisplayValue(it.qty)} onChange={e => updateItemRow(idx, 'qty', e.target.value)} className="w-full h-10 px-2 text-center outline-none bg-transparent font-mono font-bold dark:text-white" /></td>
                                    <td className="p-0 border-r border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center h-10">
                                            <input type="text" value={toDisplayValue(it.discount)} onChange={e => updateItemRow(idx, 'discount', e.target.value)} className="w-1/2 h-full px-2 text-right outline-none bg-transparent dark:text-white border-r border-slate-100 dark:border-slate-800" />
                                            <select value={it.discount_type} onChange={e => updateItemRow(idx, 'discount_type', e.target.value)} className="w-1/2 h-full px-1 outline-none bg-transparent dark:text-white text-[10px] font-bold">
                                                <option value="Percentage">%</option>
                                                <option value="Amount">₹</option>
                                            </select>
                                        </div>
                                        {discVal > 0 && (
                                            <div className="px-2 pb-1 text-[9px] text-slate-400 text-right">
                                                {isPerc ? `₹${equiv.toFixed(2)}` : `${equiv.toFixed(2)}%`}
                                            </div>
                                        )}
                                    </td>
                                    {isGstEnabled && appSettings.gstEnabled && (
                                        <td className="p-0 border-r border-slate-100 dark:border-slate-800 text-center">
                                            <select value={it.tax_rate} onChange={e => updateItemRow(idx, 'tax_rate', e.target.value)} className="w-full h-10 px-2 outline-none bg-transparent dark:text-white appearance-none text-center cursor-pointer">
                                                <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                                            </select>
                                        </td>
                                    )}
                                    <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">{formatCurrency(it.itemTotal, false)}</td>
                                    <td className="p-2 text-center"><button type="button" onClick={() => updateFormData(recalculate({...formData, items: formData.items.filter((_: any, i: number) => i !== idx)}))} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <datalist id="itemslist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
                <button type="button" onClick={() => updateFormData(recalculate({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: '', unit: 'PCS', rate: '', discount: 0, discount_type: 'Percentage', tax_rate: 0, taxableAmount: 0, itemTotal: 0 }]}))} className="w-full py-3 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-t border-slate-200 dark:border-slate-700">+ Add New Row</button>
            </div>
            <div className="flex flex-col lg:flex-row justify-between items-start pt-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 gap-8">
                <div className="w-full lg:w-1/2 lg:pr-12"><label className="text-[14px] font-medium dark:text-slate-100 mb-2 block capitalize">Remark</label><textarea value={toDisplayValue(formData.description)} onChange={e => updateFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] resize-none h-36 bg-slate-50/30 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-inner" /></div>
                <div className="flex flex-col items-end space-y-4 w-full lg:w-1/2">
                    <div className="flex items-center justify-between w-full max-sm text-[14px]"><span className="text-slate-500 font-bold uppercase tracking-tight text-right pr-4">Taxable (Without GST)</span><input type="text" value={formatWhileTyping(formData.total_without_gst.toString())} onFocus={(e) => { e.target.value = formData.total_without_gst.toString(); e.target.select(); }} onBlur={(e) => { e.target.value = formatWhileTyping(formData.total_without_gst.toString()) }} onChange={e => updateFormData(recalculate({...formData}, 'total_without_gst', undefined, e.target.value))} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] font-mono font-bold text-slate-900 dark:text-100 text-right w-40 sm:w-48 bg-white dark:bg-slate-800" /></div>
                    <div className="flex items-center justify-between w-full max-sm text-[14px]"><span className="text-slate-500 font-bold uppercase tracking-tight text-right pr-4">GST Amount</span><input type="text" value={formatWhileTyping(formData.total_gst.toString())} onFocus={(e) => { e.target.value = formData.total_gst.toString(); e.target.select(); }} onBlur={(e) => { e.target.value = formatWhileTyping(formData.total_gst.toString()) }} onChange={e => updateFormData(recalculate({...formData}, 'total_gst', undefined, e.target.value))} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] font-mono font-bold text-slate-900 dark:text-100 text-right w-40 sm:w-48 bg-white dark:bg-slate-800" /></div>
                    {formData.duties_and_taxes.filter((d: any) => !['CGST', 'SGST', 'IGST'].includes(d.name)).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between w-full max-sm text-[14px]">
                            <span className="text-slate-500 font-bold uppercase tracking-tight text-right pr-4">{d.name}</span>
                            <input 
                              type="text" 
                              value={formatWhileTyping(d.amount.toString())} 
                              onFocus={(e) => { e.target.value = d.amount.toString(); e.target.select(); }} 
                              onBlur={(e) => { e.target.value = formatWhileTyping(d.amount.toString()) }} 
                              onChange={e => updateFormData(recalculate({...formData}, undefined, d.id, e.target.value))} 
                              className={`px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] font-mono font-bold text-right w-40 sm:w-48 ${appSettings.gstEnabled && (d.name === 'CGST' || d.name === 'SGST' || d.name === 'IGST') ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`}
                              readOnly={appSettings.gstEnabled && (d.name === 'CGST' || d.name === 'SGST' || d.name === 'IGST')}
                            />
                        </div>
                    ))}
                    <div className="flex items-center justify-between w-full max-sm pt-5 border-t border-slate-100 dark:border-slate-800"><span className="text-slate-900 dark:text-white font-bold uppercase tracking-tight text-right pr-4">Net Amount</span><span className={`font-mono font-bold text-[20px] sm:text-[24px] tracking-tight ${formData.grand_total < 0 ? 'text-red-500' : 'text-link'}`}>{formatCurrency(formData.grand_total)}</span></div>
                </div>
            </div>
        </div>
        <div className="flex justify-end gap-6 items-center"><button type="button" onClick={onCancel} className="text-[14px] text-slate-500 hover:text-slate-800 transition-none font-medium capitalize">Discard</button><button type="submit" disabled={loading} className="bg-link text-white px-10 py-3 rounded font-bold text-[14px] hover:bg-link/90 transition-none flex items-center shadow-lg capitalize">{loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}{initialData ? 'Update Invoice' : 'Generate Invoice'}</button></div>
      </form>
    </div>
  );
};

export default SalesInvoiceForm;
