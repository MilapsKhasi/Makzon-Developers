
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Loader2, ChevronDown, UserPlus, UserRoundPen } from 'lucide-react';
import { getActiveCompanyId, formatDate, parseDateFromInput, safeSupabaseSave, getSelectedLedgerIds, syncTransactionToCashbook, ensureStockItems, ensureParty, normalizeBill, getAppSettings, formatCurrency } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import VendorForm from './VendorForm';

interface BillFormProps {
  initialData?: any;
  onSubmit: (bill: any) => void;
  onCancel: () => void;
}

const BillForm: React.FC<BillFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const cid = getActiveCompanyId();
  const appSettings = getAppSettings();
  const today = new Date().toISOString().split('T')[0];
  const manualOverrides = useRef<Set<string>>(new Set());

  const getInitialState = () => ({
    vendor_name: '', 
    bill_number: '', 
    date: today, 
    displayDate: formatDate(today), 
    gst_type: appSettings.gstType || 'CGST - SGST',
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: '', rate: '', tax_rate: 0, taxableAmount: 0 }],
    total_without_gst: 0, 
    total_gst: 0, 
    duties_and_taxes: [], 
    round_off: 0, 
    grand_total: 0, 
    status: 'Pending',
    description: ''
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [vendors, setVendors] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [vendorModal, setVendorModal] = useState({ isOpen: false, initialData: null, prefilledName: '' });

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
    let taxable = state.total_without_gst;
    let gst = state.total_gst;
    let autoGstSum = 0;

    if (sourceDutyId) manualOverrides.current.add(sourceDutyId);

    if (sourceField === 'total_without_gst') {
      taxable = parseNumber(sourceVal);
    } else if (sourceField === 'total_gst') {
      gst = parseNumber(sourceVal);
    } else if (!sourceDutyId) {
      taxable = 0;
      gst = 0;
      const updatedItems = (state.items || []).map((item: any) => {
        const q = parseNumber(item.qty.toString());
        const r = parseNumber(item.rate.toString());
        const t = parseFloat(item.tax_rate) || 0;
        const tamt = q * r;
        const gamt = tamt * (t / 100);
        taxable += tamt;
        autoGstSum += gamt;
        gst += gamt;
        return { ...item, taxableAmount: tamt };
      });
      state.items = updatedItems;
    }

    let runningTotal = taxable + gst;
    const updatedDuties = (state.duties_and_taxes || []).map((d: any) => {
      let calcAmt = d.amount || 0;
      if (sourceDutyId === d.id) {
        calcAmt = parseNumber(sourceVal);
      } else if (appSettings.gstEnabled && (d.name === 'CGST' || d.name === 'SGST' || d.name === 'IGST')) {
          if (appSettings.gstType === 'CGST - SGST') {
              if (d.name === 'CGST' || d.name === 'SGST') calcAmt = autoGstSum / 2;
          } else if (appSettings.gstType === 'IGST') {
              if (d.name === 'IGST') calcAmt = autoGstSum;
          }
      } else if (!manualOverrides.current.has(d.id)) {
        const base = d.apply_on === 'Net Total' ? (taxable + gst) : taxable;
        const rate = parseFloat(d.bill_rate !== undefined ? d.bill_rate : d.rate) || 0;
        const fixed = parseFloat(d.bill_fixed_amount !== undefined ? d.bill_fixed_amount : d.fixed_amount) || 0;
        calcAmt = d.calc_method === 'Percentage' ? base * (rate / 100) : fixed;
      }
      runningTotal += calcAmt;
      return { ...d, amount: calcAmt };
    });

    const rounded = Math.round(runningTotal);
    const ro = parseFloat((rounded - runningTotal).toFixed(2));

    return { ...state, total_without_gst: taxable, total_gst: gst, duties_and_taxes: updatedDuties, round_off: ro, grand_total: rounded };
  };

  const loadDependencies = async () => {
    if (!cid) return;
    const { data: vendorData } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('party_type', 'vendor').eq('is_deleted', false);
    const { data: stockData } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
    setVendors(vendorData || []);
    setStockItems(stockData || []);
    
    const { data: allDuties } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false);
    const selectedIds = getSelectedLedgerIds();
    const activeDuties = (allDuties || []).filter(d => d.is_default || selectedIds.includes(d.id));

    if (!initialData) {
      setFormData(prev => {
        if (prev.duties_and_taxes.length > 0) return prev;
        return recalculate({ ...prev, duties_and_taxes: activeDuties.map(d => ({ ...d, amount: 0 }))});
      });
    } else {
        const normalized = normalizeBill(initialData);
        normalized.items_raw?.duties_and_taxes?.forEach((d:any) => { if(d.amount !== 0) manualOverrides.current.add(d.id); });
        setFormData(recalculate({ ...getInitialState(), ...normalized, description: normalized.description || '', displayDate: formatDate(normalized.date), duties_and_taxes: (normalized.items_raw?.duties_and_taxes || []) }));
    }
  };

  useEffect(() => { loadDependencies(); }, [initialData, cid]);

  const updateItemRow = (idx: number, field: string, val: any) => {
    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    if (field === 'itemName') {
        const selected = stockItems.find(s => s.name.toLowerCase().trim() === val.toLowerCase().trim());
        if (selected) {
            newItems[idx] = { ...newItems[idx], hsnCode: selected.hsn || '', rate: selected.rate?.toString() || '', tax_rate: selected.tax_rate || 0 };
        }
    }
    setFormData(recalculate({ ...formData, items: newItems }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name || !formData.bill_number) return alert("Required: Vendor and Bill No");
    setLoading(true);
    try {
      const payload: any = {
          vendor_name: formData.vendor_name,
          bill_number: formData.bill_number,
          date: formData.date,
          total_without_gst: formData.total_without_gst,
          total_gst: formData.total_gst,
          grand_total: formData.grand_total,
          status: formData.status,
          is_deleted: false,
          description: formData.description,
          round_off: formData.round_off,
          items: {
              line_items: formData.items,
              duties_and_taxes: formData.duties_and_taxes,
              gst_type: formData.gst_type
          }
      };
      
      const savedRes = await safeSupabaseSave('bills', payload, initialData?.id);
      await ensureStockItems(formData.items, cid);
      await ensureParty(formData.vendor_name, 'vendor', cid);
      if (payload.status === 'Paid' && savedRes.data) await syncTransactionToCashbook(savedRes.data[0]);
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) { alert("Error: " + err.message); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 w-full flex flex-col">
      <Modal isOpen={vendorModal.isOpen} onClose={() => setVendorModal({ ...vendorModal, isOpen: false })} title="Vendor Master" maxWidth="max-w-4xl">
        <VendorForm initialData={vendorModal.initialData} prefilledName={vendorModal.prefilledName} onSubmit={(v) => { setVendorModal({ ...vendorModal, isOpen: false }); loadDependencies(); }} onCancel={() => setVendorModal({ ...vendorModal, isOpen: false })} />
      </Modal>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="border border-slate-200 dark:border-slate-800 rounded-md p-8 bg-white dark:bg-slate-900 space-y-6 shadow-sm">
            <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1.5"><label className="text-[14px] font-medium dark:text-slate-300 capitalize">Date</label><input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded outline-none text-[14px]" /></div>
                <div className="space-y-1.5"><label className="text-[14px] font-medium dark:text-slate-300 capitalize">Bill No</label><input required value={formData.bill_number} onChange={e => setFormData({...formData, bill_number: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded outline-none text-[14px] font-mono uppercase" /></div>
                <div className="space-y-1.5"><label className="text-[14px] font-medium dark:text-slate-300 capitalize">Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded outline-none text-[14px] appearance-none cursor-pointer"><option value="Pending">Pending</option><option value="Paid">Paid</option></select></div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] font-medium dark:text-slate-300 capitalize">Vendor Name</label>
                <div className="flex gap-3">
                  <input required list="vlist" value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded outline-none text-[14px] uppercase font-bold" />
                  <button type="button" onClick={() => setVendorModal({ isOpen: true, initialData: vendors.find(v=>v.name===formData.vendor_name), prefilledName: formData.vendor_name })} className="h-10 w-10 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"><UserRoundPen className="w-4 h-4 text-slate-400" /></button>
                </div>
                <datalist id="vlist">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto mt-6 bg-white dark:bg-slate-900">
                <table className="w-full text-[14px] border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                        <tr>
                            <th className="p-3 text-left border-r border-slate-200 dark:border-slate-700 min-w-[200px] capitalize">Particulars</th>
                            {appSettings.gstEnabled && <th className="p-3 text-center w-24 border-r border-slate-200 dark:border-slate-700 capitalize">GST %</th>}
                            <th className="p-3 text-center w-28 border-r border-slate-200 dark:border-slate-700 capitalize">QTY</th>
                            <th className="p-3 text-right w-36 border-r border-slate-200 dark:border-slate-700 capitalize">Rate</th>
                            <th className="p-3 text-right w-32 capitalize">Amount</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {formData.items.map((it: any, idx: number) => (
                            <tr key={it.id}>
                                <td className="p-0 border-r border-slate-100 dark:border-slate-800"><input list="itemslist" value={it.itemName} onChange={e => updateItemRow(idx, 'itemName', e.target.value)} className="w-full h-10 px-3 outline-none bg-transparent dark:text-white" /></td>
                                {appSettings.gstEnabled && (
                                    <td className="p-0 border-r border-slate-100 dark:border-slate-800 text-center">
                                        <select value={it.tax_rate} onChange={e => updateItemRow(idx, 'tax_rate', e.target.value)} className="w-full h-10 px-2 outline-none bg-transparent dark:text-white appearance-none text-center cursor-pointer">
                                            <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                                        </select>
                                    </td>
                                )}
                                <td className="p-0 border-r border-slate-100 dark:border-slate-800"><input value={it.qty} onChange={e => updateItemRow(idx, 'qty', e.target.value)} placeholder="10,000" className="w-full h-10 px-2 text-center outline-none font-mono font-bold dark:text-white bg-transparent" /></td>
                                <td className="p-0 border-r border-slate-100 dark:border-slate-800"><input value={it.rate} onChange={e => updateItemRow(idx, 'rate', e.target.value)} className="w-full h-10 px-2 text-right outline-none font-mono font-bold dark:text-white bg-transparent" /></td>
                                <td className="p-3 text-right font-bold font-mono dark:text-slate-200">{formatCurrency(it.taxableAmount, false)}</td>
                                <td className="text-center p-2"><button type="button" onClick={() => setFormData(recalculate({...formData, items: formData.items.filter((_: any, i: number) => i !== idx)}))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <datalist id="itemslist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
                <button type="button" onClick={() => setFormData(recalculate({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', qty: '', rate: '', tax_rate: 0, taxableAmount: 0 }]}))} className="w-full py-3 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-200 dark:border-slate-700">+ Add New Row</button>
            </div>

            <div className="flex justify-between items-start pt-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="w-1/2 pr-12"><label className="text-[14px] font-medium dark:text-slate-300 mb-2 block capitalize">Remark</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded outline-none text-[14px] resize-none h-36 bg-slate-50/30 focus:bg-white transition-all shadow-inner" placeholder="Public or private notes..." /></div>
                <div className="flex flex-col items-end space-y-4 w-1/2">
                    <div className="flex items-center justify-between w-full max-w-sm text-[14px]">
                        <span className="text-slate-500 font-bold uppercase tracking-tight pr-4">Taxable Value</span>
                        <input type="text" value={formatWhileTyping(formData.total_without_gst.toString())} onFocus={(e) => { e.target.value = formData.total_without_gst.toString(); e.target.select(); }} onBlur={(e) => { e.target.value = formatWhileTyping(formData.total_without_gst.toString()) }} onChange={e => setFormData(recalculate({...formData}, 'total_without_gst', undefined, e.target.value))} className="px-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded outline-none text-[14px] font-mono font-bold text-right w-48" />
                    </div>
                    {formData.duties_and_taxes.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between w-full max-w-sm text-[14px]">
                            <span className="text-slate-500 font-bold uppercase tracking-tight pr-4">{d.name}</span>
                            <input 
                              type="text" 
                              value={formatWhileTyping(d.amount.toString())} 
                              onFocus={(e) => { e.target.value = d.amount.toString(); e.target.select(); }} 
                              onBlur={(e) => { e.target.value = formatWhileTyping(d.amount.toString()) }} 
                              onChange={e => setFormData(recalculate({...formData}, undefined, d.id, e.target.value))} 
                              className={`px-4 py-2 border border-slate-200 dark:border-slate-700 rounded outline-none text-[14px] font-mono font-bold text-right w-48 ${appSettings.gstEnabled && (d.name === 'CGST' || d.name === 'SGST' || d.name === 'IGST') ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`}
                              readOnly={appSettings.gstEnabled && (d.name === 'CGST' || d.name === 'SGST' || d.name === 'IGST')}
                            />
                        </div>
                    ))}
                    <div className="flex items-center justify-between w-full max-w-sm text-[14px] border-t border-slate-100 dark:border-slate-800 pt-5">
                        <span className="text-slate-900 dark:text-slate-100 font-bold uppercase text-right pr-4 tracking-tighter">Net Total Bill</span>
                        <span className="font-mono font-bold text-[24px] text-link">{formatCurrency(formData.grand_total)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-end space-x-6">
            <button type="button" onClick={onCancel} className="text-[14px] text-slate-400 hover:text-slate-800 font-medium capitalize">Discard</button>
            <button type="submit" disabled={loading} className="bg-primary text-slate-900 px-10 py-3 rounded font-bold text-[14px] hover:bg-primary-dark shadow-lg active:scale-95 flex items-center capitalize">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{initialData ? 'Update Bill' : 'Save Statement'}
            </button>
        </div>
      </form>
    </div>
  );
};

export default BillForm;
