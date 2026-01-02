
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Loader2, Check, UserPlus, UserRoundPen } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, parseDateFromInput, formatDate, safeSupabaseSave, getSelectedLedgerIds } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import VendorForm from './VendorForm';

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
    bill_number: '', 
    date: today, 
    displayDate: formatDate(today), 
    gst_type: 'Intra-State',
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0, taxableAmount: 0 }],
    total_without_gst: 0, 
    total_cgst: 0,
    total_sgst: 0,
    total_igst: 0,
    total_gst: 0, 
    duties_and_taxes: [], 
    round_off: 0, 
    grand_total: 0, 
    status: 'Pending',
    type: 'Purchase'
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorModal, setVendorModal] = useState<{ isOpen: boolean, initialData: any | null, prefilledName: string }>({
    isOpen: false,
    initialData: null,
    prefilledName: ''
  });

  const loadDependencies = async () => {
    if (!cid) return;
    
    // Fetch Vendors
    const { data: vendorData } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
    setVendors(vendorData || []);

    // Fetch Master Duties
    const { data: allDuties } = await supabase
      .from('duties_taxes')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false);

    const selectedIds = getSelectedLedgerIds();
    
    // Filter by ticked ledgers (Database flag OR Local Storage ID)
    const activeDuties = (allDuties || []).filter(d => d.is_default || selectedIds.includes(d.id));

    if (!initialData) {
      setFormData(prev => recalculate({ 
        ...prev, 
        duties_and_taxes: activeDuties.map(d => ({ 
          ...d, 
          // Default initial bill values from master
          bill_rate: d.rate, 
          bill_fixed_amount: d.fixed_amount,
          amount: 0 
        }))
      }));
    } else {
        // For existing bills, we prioritize the saved duties_and_taxes structure
        setFormData(prev => recalculate({
            ...getInitialState(),
            ...initialData,
            displayDate: formatDate(initialData.date),
            type: 'Purchase'
        }));
    }
  };

  const recalculate = (state: any) => {
    let taxable = 0;
    let gst = 0;
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

    const cgst = state.gst_type === 'Intra-State' ? gst / 2 : 0;
    const sgst = state.gst_type === 'Intra-State' ? gst / 2 : 0;
    const igst = state.gst_type === 'Inter-State' ? gst : 0;

    // Process Dynamic Duties
    let runningTotal = taxable + gst;
    const updatedDuties = (state.duties_and_taxes || []).map((d: any) => {
      let calcAmt = 0;
      // We apply logic based on the master's "apply_on" setting if it exists, otherwise on subtotal
      const base = d.apply_on === 'Net Total' ? runningTotal : taxable;
      const rate = parseFloat(d.bill_rate !== undefined ? d.bill_rate : d.rate) || 0;
      const fixed = parseFloat(d.bill_fixed_amount !== undefined ? d.bill_fixed_amount : d.fixed_amount) || 0;

      if (d.calc_method === 'Percentage') {
        calcAmt = base * (rate / 100);
      } else {
        calcAmt = fixed;
      }

      // Important: Additive for Charges, Subtractive for Deductions
      const finalAmt = d.type === 'Deduction' ? -Math.abs(calcAmt) : Math.abs(calcAmt);
      runningTotal += finalAmt;
      
      return { ...d, amount: finalAmt, bill_rate: rate, bill_fixed_amount: fixed };
    });

    const rounded = Math.round(runningTotal);
    const ro = parseFloat((rounded - runningTotal).toFixed(2));

    return {
      ...state,
      items: updatedItems,
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

  useEffect(() => {
    loadDependencies();
  }, [initialData, cid]);

  const updateField = (idx: number, field: string, val: any) => {
    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setFormData(recalculate({ ...formData, items: newItems }));
  };

  const handleDutyValueChange = (id: string, field: string, val: string) => {
    const updatedDuties = formData.duties_and_taxes.map((d: any) => {
      if (d.id === id) return { ...d, [field]: val };
      return d;
    });
    setFormData(recalculate({ ...formData, duties_and_taxes: updatedDuties }));
  };

  const handleVendorChange = (name: string) => {
    const selected = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    setFormData(recalculate({
        ...formData,
        vendor_name: name,
        gstin: selected?.gstin || formData.gstin
    }));
  };

  const matchedVendor = useMemo(() => vendors.find(v => v.name.toLowerCase() === formData.vendor_name.toLowerCase()), [formData.vendor_name, vendors]);

  const onVendorSaved = (saved: any) => {
    setVendorModal({ isOpen: false, initialData: null, prefilledName: '' });
    loadDependencies().then(() => handleVendorChange(saved.name));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name || !formData.bill_number) return alert("Vendor and Bill No are required.");
    if (!cid) return alert("No active workspace selected.");

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...formData, company_id: cid, user_id: user?.id, is_deleted: false, type: 'Purchase' };
      
      delete payload.displayDate;
      
      await safeSupabaseSave('bills', payload, initialData?.id);
      
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) {
      alert("Submission Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
      <Modal isOpen={vendorModal.isOpen} onClose={() => setVendorModal({ ...vendorModal, isOpen: false })} title={vendorModal.initialData ? "Edit Vendor Profile" : "Register New Vendor"}>
        <VendorForm initialData={vendorModal.initialData} prefilledName={vendorModal.prefilledName} onSubmit={onVendorSaved} onCancel={() => setVendorModal({ ...vendorModal, isOpen: false })} />
      </Modal>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Date</label>
            <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none shadow-sm focus:border-slate-400" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Bill No</label>
            <input required value={formData.bill_number} onChange={e => setFormData({...formData, bill_number: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none font-mono shadow-sm focus:border-slate-400" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Vendor Name</label>
            <div className="flex items-center gap-2">
                <input required list="vlist_bill" value={formData.vendor_name} onChange={e => handleVendorChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none uppercase font-bold shadow-sm focus:border-slate-400" />
                <button type="button" onClick={() => setVendorModal({ isOpen: true, initialData: matchedVendor || null, prefilledName: matchedVendor ? '' : formData.vendor_name })} className="h-9 w-9 flex items-center justify-center rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors shadow-sm">
                    {matchedVendor ? <UserRoundPen className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </button>
            </div>
            <datalist id="vlist_bill">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
          </div>
        </div>

        <div className="border border-slate-200 rounded-md overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="p-3 text-left">ITEM</th>
                <th className="p-3 text-center w-20">QTY</th>
                <th className="p-3 text-right w-24">RATE</th>
                <th className="p-3 text-center w-20">TAX %</th>
                <th className="p-3 text-right w-28">TOTAL</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formData.items.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="p-1"><input value={it.itemName} onChange={e => updateField(idx, 'itemName', e.target.value)} className="w-full p-2 outline-none" /></td>
                  <td className="p-1 text-center"><input type="number" value={it.qty} onChange={e => updateField(idx, 'qty', e.target.value)} className="w-full p-2 text-center outline-none" /></td>
                  <td className="p-1 text-right"><input type="number" value={it.rate} onChange={e => updateField(idx, 'rate', e.target.value)} className="w-full p-2 text-right outline-none" /></td>
                  <td className="p-1 text-center">
                    <select value={it.tax_rate} onChange={e => updateField(idx, 'tax_rate', e.target.value)} className="w-full p-2 outline-none bg-white">
                      {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-right font-medium">{(Number(it.taxableAmount) || 0).toFixed(2)}</td>
                  <td className="text-center"><button type="button" onClick={() => setFormData(recalculate({...formData, items: formData.items.filter((_: any, i: number) => i !== idx)}))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFormData(recalculate({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0, taxableAmount: 0 }]}))} className="w-full py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 border-t border-slate-200">
            + Add Line Item
          </button>
        </div>

        {/* Active Master Duties Section */}
        {formData.duties_and_taxes.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4 bg-slate-50/50 p-4 rounded-lg">
                <div className="col-span-full mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Additional Ledger Entries</p>
                </div>
                {formData.duties_and_taxes.map((d: any) => (
                    <div key={d.id} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tight flex items-center">
                            {d.name} {d.calc_method === 'Percentage' ? '(%)' : '(₹)'}
                        </label>
                        <input 
                            type="number" 
                            step="0.01" 
                            value={d.calc_method === 'Percentage' ? d.bill_rate : d.bill_fixed_amount} 
                            onChange={e => handleDutyValueChange(d.id, d.calc_method === 'Percentage' ? 'bill_rate' : 'bill_fixed_amount', e.target.value)} 
                            className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 font-mono shadow-sm bg-white" 
                        />
                    </div>
                ))}
            </div>
        )}

        <div className="bg-slate-50 p-6 rounded-md space-y-3 border border-slate-200 shadow-inner">
          <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
            <span>Taxable Amount</span>
            <span className="font-mono">{(Number(formData.total_without_gst) || 0).toFixed(2)}</span>
          </div>
          {formData.gst_type === 'Intra-State' ? (
            <>
              <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
                <span>CGST</span>
                <span className="font-mono">{(Number(formData.total_cgst) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
                <span>SGST</span>
                <span className="font-mono">{(Number(formData.total_sgst) || 0).toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
              <span>IGST</span>
              <span className="font-mono">{(Number(formData.total_igst) || 0).toFixed(2)}</span>
            </div>
          )}

          {/* Dynamic Extra Charges in Final Summary */}
          {formData.duties_and_taxes.map((d: any) => (
              <div key={d.id} className={`flex justify-between text-[11px] font-bold uppercase ${d.type === 'Deduction' ? 'text-red-600' : 'text-slate-700'}`}>
                <span className="flex items-center">
                    {d.name}
                    <span className="text-[9px] ml-2 opacity-60 font-normal">({d.calc_method === 'Percentage' ? `${d.bill_rate}%` : 'Fixed'})</span>
                </span>
                <span className="font-mono">{(Number(d.amount) || 0).toFixed(2)}</span>
              </div>
          ))}

          <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase italic border-t border-slate-100 pt-2">
            <span>Rounding Correction</span>
            <span className="font-mono">{(Number(formData.round_off) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-300">
            <span className="text-[14px] font-black text-slate-900 uppercase">NET PAYABLE VALUE</span>
            <span className="text-[24px] font-black text-slate-900 font-mono tracking-tighter">{(Number(formData.grand_total) || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={loading} className="bg-primary text-slate-900 px-10 py-3 rounded-md font-bold text-sm hover:bg-primary-dark transition-none flex items-center shadow-lg border border-slate-900">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            FINALIZE PURCHASE BILL
          </button>
        </div>
      </form>
    </div>
  );
};

export default BillForm;
