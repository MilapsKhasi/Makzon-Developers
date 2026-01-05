
import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Loader2, ChevronDown, UserPlus, UserRoundPen } from 'lucide-react';
import { getActiveCompanyId, formatDate, parseDateFromInput, safeSupabaseSave, getSelectedLedgerIds, syncTransactionToCashbook, ensureStockItems, ensureParty, normalizeBill } from '../utils/helpers';
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
  const today = new Date().toISOString().split('T')[0];
  
  const getInitialState = () => ({
    vendor_name: '', 
    gstin: '', 
    bill_number: '', 
    date: today, 
    displayDate: formatDate(today), 
    gst_type: 'Intra-State',
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: '', kgPerBag: '', unit: 'PCS', rate: '', tax_rate: 0, amount: 0, taxableAmount: 0 }],
    total_without_gst: 0, 
    total_cgst: 0,
    total_sgst: 0,
    total_igst: 0,
    total_gst: 0, 
    duties_and_taxes: [], 
    round_off: 0, 
    grand_total: 0, 
    status: 'Pending',
    type: 'Purchase',
    transaction_type: 'purchase'
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [vendors, setVendors] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [vendorModal, setVendorModal] = useState<{ isOpen: boolean; initialData: any | null; prefilledName: string }>({
    isOpen: false,
    initialData: null,
    prefilledName: ''
  });

  const matchedVendor = useMemo(() => 
    vendors.find(v => v.name.toLowerCase() === formData.vendor_name.toLowerCase()), 
    [formData.vendor_name, vendors]
  );

  const recalculate = (state: any, sourceField?: string, sourceDutyId?: string, sourceVal?: any) => {
    let taxable = parseFloat(state.total_without_gst) || 0;
    let gst = parseFloat(state.total_gst) || 0;

    // Line item summation
    if (sourceField !== 'total_without_gst' && sourceField !== 'total_gst' && !sourceDutyId) {
      taxable = 0;
      gst = 0;
      const updatedItems = (state.items || []).map((item: any) => {
        const q = parseFloat(item.qty) || 0;
        const r = parseFloat(item.rate) || 0;
        const t = parseFloat(item.tax_rate) || 0;
        const tamt = q * r;
        const gamt = tamt * (t / 100);
        taxable += tamt;
        gst += gamt;
        return { ...item, taxableAmount: tamt, amount: tamt + gamt };
      });
      state.items = updatedItems;
    } else if (sourceField === 'total_without_gst') {
      taxable = parseFloat(sourceVal) || 0;
    } else if (sourceField === 'total_gst') {
      gst = parseFloat(sourceVal) || 0;
    }

    const cgst = state.gst_type === 'Intra-State' ? gst / 2 : 0;
    const sgst = state.gst_type === 'Intra-State' ? gst / 2 : 0;
    const igst = state.gst_type === 'Inter-State' ? gst : 0;

    let runningTotal = taxable + gst;
    const updatedDuties = (state.duties_and_taxes || []).map((d: any) => {
      let calcAmt = 0;
      if (sourceDutyId === d.id) {
        calcAmt = Math.abs(parseFloat(sourceVal) || 0);
      } else {
        const base = d.apply_on === 'Net Total' ? (taxable + gst) : taxable;
        const rate = parseFloat(d.bill_rate !== undefined ? d.bill_rate : d.rate) || 0;
        const fixed = parseFloat(d.bill_fixed_amount !== undefined ? d.bill_fixed_amount : d.fixed_amount) || 0;
        if (d.calc_method === 'Percentage') calcAmt = base * (rate / 100);
        else calcAmt = fixed;
      }
      const finalAmt = d.type === 'Deduction' ? -Math.abs(calcAmt) : Math.abs(calcAmt);
      runningTotal += finalAmt;
      return { ...d, amount: finalAmt };
    });

    const rounded = Math.round(runningTotal);
    const ro = parseFloat((rounded - runningTotal).toFixed(2));

    return {
      ...state,
      total_without_gst: taxable,
      total_cgst: cgst,
      total_sgst: sgst,
      total_igst: igst,
      total_gst: gst,
      duties_and_taxes: updatedDuties,
      round_off: ro,
      grand_total: rounded
    };
  };

  const loadDependencies = async () => {
    if (!cid) return;
    const { data: vendorData } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
    const { data: stockData } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
    setVendors((vendorData || []).filter(v => v.party_type === 'vendor' || !v.is_customer));
    setStockItems(stockData || []);
    
    const { data: allDuties } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false);
    const selectedIds = getSelectedLedgerIds();
    const activeDuties = (allDuties || []).filter(d => d.is_default || selectedIds.includes(d.id));

    if (!initialData) {
      setFormData(prev => {
        if (prev.duties_and_taxes.length > 0) return prev;
        return recalculate({ ...prev, duties_and_taxes: activeDuties.map(d => ({ ...d, bill_rate: d.rate, bill_fixed_amount: d.fixed_amount, amount: 0 }))});
      });
    } else {
        const normalized = normalizeBill(initialData);
        setFormData(recalculate({ ...getInitialState(), ...normalized, displayDate: formatDate(normalized.date) }));
    }
  };

  useEffect(() => { loadDependencies(); }, [initialData, cid]);

  const updateItemRow = (idx: number, field: string, val: any) => {
    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    
    if (field === 'itemName') {
        const selected = stockItems.find(s => s.name.toLowerCase().trim() === val.toLowerCase().trim());
        if (selected) {
            newItems[idx] = { 
                ...newItems[idx], 
                hsnCode: selected.hsn || '', 
                rate: selected.rate || '',
                tax_rate: selected.tax_rate || 0,
                unit: selected.unit || 'PCS'
            };
        }
    }

    setFormData(recalculate({ ...formData, items: newItems }));
  };

  const handleVendorChange = (name: string) => {
    const selected = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    setFormData(recalculate({ ...formData, vendor_name: name, gstin: selected?.gstin || formData.gstin }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name || !formData.bill_number) return alert("Required: Vendor and Bill No");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session not found.");

      const payload: any = {
          company_id: cid,
          user_id: user.id,
          vendor_name: formData.vendor_name,
          bill_number: formData.bill_number,
          date: formData.date,
          total_without_gst: formData.total_without_gst,
          total_gst: formData.total_gst,
          grand_total: formData.grand_total,
          status: formData.status,
          is_deleted: false,
          items: {
              line_items: formData.items,
              type: 'Purchase',
              transaction_type: 'purchase',
              gst_type: formData.gst_type,
              round_off: formData.round_off,
              duties_and_taxes: formData.duties_and_taxes,
              total_cgst: formData.total_cgst,
              total_sgst: formData.total_sgst,
              total_igst: formData.total_igst
          },
          type: 'Purchase',
          transaction_type: 'purchase',
          gst_type: formData.gst_type,
          round_off: formData.round_off,
          total_cgst: Number(formData.total_cgst) || 0,
          total_sgst: Number(formData.total_sgst) || 0,
          total_igst: Number(formData.total_igst) || 0
      };
      
      const savedRes = await safeSupabaseSave('bills', payload, initialData?.id);
      await ensureStockItems(formData.items, cid, user.id);
      await ensureParty(formData.vendor_name, 'vendor', cid, user.id);

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
        isOpen={vendorModal.isOpen} 
        onClose={() => setVendorModal({ ...vendorModal, isOpen: false })} 
        title={vendorModal.initialData ? "Edit Vendor Profile" : "Register New Vendor"}
        maxWidth="max-w-4xl"
      >
        <VendorForm 
          initialData={vendorModal.initialData} 
          prefilledName={vendorModal.prefilledName} 
          onSubmit={(v) => { setVendorModal({ ...vendorModal, isOpen: false }); loadDependencies().then(() => handleVendorChange(v.name)); }} 
          onCancel={() => setVendorModal({ ...vendorModal, isOpen: false })} 
        />
      </Modal>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="border border-slate-200 rounded-md p-8 space-y-6 bg-white">
            <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Date</label>
                    <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px]" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Bill No</label>
                    <input required value={formData.bill_number} onChange={e => setFormData({...formData, bill_number: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] font-mono" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[14px] font-normal text-slate-900">Payment Status</label>
                    <div className="relative">
                        <select 
                            value={formData.status} 
                            onChange={e => setFormData({...formData, status: e.target.value})}
                            className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] appearance-none bg-white"
                        >
                            <option value="Pending">Pending</option>
                            <option value="Paid">Paid</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] font-normal text-slate-900">Vendor Name</label>
                <div className="flex items-center gap-3">
                  <input required list="vlist" value={formData.vendor_name} onChange={e => handleVendorChange(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] uppercase shadow-inner bg-white" placeholder="Search Vendor..." />
                  <button type="button" onClick={() => setVendorModal({ isOpen: true, initialData: matchedVendor || null, prefilledName: matchedVendor ? '' : formData.vendor_name })} className={`h-10 w-10 flex items-center justify-center rounded border transition-all shrink-0 ${matchedVendor ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-primary/20 text-slate-700 border-slate-200'}`}>
                    {matchedVendor ? <UserRoundPen className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  </button>
                </div>
                <datalist id="vlist">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
            </div>

            <div className="border border-slate-200 rounded-md overflow-x-auto mt-6">
                <table className="w-full text-[13px] border-collapse min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                            <th className="p-3 text-left font-normal border-r border-slate-200 min-w-[200px]">Item Description</th>
                            <th className="p-3 text-left font-normal w-24 border-r border-slate-200">HSN</th>
                            <th className="p-3 text-center font-normal w-24 border-r border-slate-200">QTY (KG)</th>
                            <th className="p-3 text-center font-normal w-24 border-r border-slate-200">KG PER BAG</th>
                            <th className="p-3 text-right font-normal w-32 border-r border-slate-200">Rate per KG</th>
                            <th className="p-3 text-right font-normal w-32">Amount</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {formData.items.map((it: any, idx: number) => (
                            <tr key={it.id}>
                                <td className="p-0 border-r border-slate-100">
                                    <input list="itemslist" value={it.itemName} onChange={e => updateItemRow(idx, 'itemName', e.target.value)} className="w-full h-9 px-3 outline-none bg-transparent" placeholder="Start typing item..." />
                                </td>
                                <td className="p-0 border-r border-slate-100"><input value={it.hsnCode} onChange={e => updateItemRow(idx, 'hsnCode', e.target.value)} className="w-full h-9 px-3 outline-none bg-transparent font-mono" /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" step="any" value={it.qty} onChange={e => updateItemRow(idx, 'qty', e.target.value)} className="w-full h-9 px-2 text-center outline-none bg-transparent" placeholder="QTY" /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" step="any" value={it.kgPerBag} onChange={e => updateItemRow(idx, 'kgPerBag', e.target.value)} className="w-full h-9 px-2 text-center outline-none bg-transparent" placeholder="Adapts..." /></td>
                                <td className="p-0 border-r border-slate-100"><input type="number" step="any" value={it.rate} onChange={e => updateItemRow(idx, 'rate', e.target.value)} className="w-full h-9 px-2 text-right outline-none bg-transparent" placeholder="Rate / KG" /></td>
                                <td className="p-3 text-right font-medium text-slate-900">{(Number(it.taxableAmount) || 0).toFixed(2)}</td>
                                <td className="text-center p-2"><button type="button" onClick={() => setFormData(recalculate({...formData, items: formData.items.filter((_: any, i: number) => i !== idx)}))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <datalist id="itemslist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
                <button type="button" onClick={() => setFormData(recalculate({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: '', kgPerBag: '', unit: 'PCS', rate: '', tax_rate: 0, amount: 0, taxableAmount: 0 }]}))} className="w-full py-2 bg-slate-50 text-[11px] font-normal text-slate-400 uppercase tracking-widest hover:bg-slate-100 border-t border-slate-200">
                    + Add New Particular
                </button>
            </div>

            <div className="flex flex-col items-center justify-center space-y-3 py-6 border-t border-slate-100">
                <div className="flex items-center justify-between w-72 text-[14px]">
                    <span className="text-slate-500">Taxable Amount</span>
                    <input 
                      type="number" 
                      step="any"
                      value={formData.total_without_gst} 
                      onChange={e => setFormData(recalculate({...formData}, 'total_without_gst', undefined, e.target.value))}
                      className="font-bold text-slate-900 text-right w-32 border-b border-dashed border-slate-200 outline-none focus:border-link" 
                    />
                </div>
                {formData.duties_and_taxes.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between w-72 text-[14px]">
                        <span className="text-slate-500">{d.name}</span>
                        <input 
                            type="number" 
                            step="any"
                            value={Math.abs(d.amount)} 
                            onChange={e => setFormData(recalculate({...formData}, undefined, d.id, e.target.value))}
                            className="font-bold text-slate-900 text-right w-32 border-b border-dashed border-slate-200 outline-none focus:border-link bg-transparent" 
                        />
                    </div>
                ))}
                <div className="flex items-center justify-between w-72 text-[14px] border-t border-slate-100 pt-3">
                    <span className="text-slate-900 font-normal">Grand Total</span>
                    <span className="font-bold text-link">₹{formData.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-end space-x-6">
            <button type="button" onClick={onCancel} className="text-[13px] text-slate-500 hover:text-slate-800 transition-none font-normal">Discard</button>
            <button type="submit" disabled={loading} className="bg-primary text-slate-900 px-8 py-2.5 rounded font-normal text-[14px] hover:bg-primary-dark transition-none flex items-center">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {initialData ? 'Update Bill' : 'Create Bill'}
            </button>
        </div>
      </form>
    </div>
  );
};

export default BillForm;
