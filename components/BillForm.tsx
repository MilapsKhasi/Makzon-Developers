
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Loader2, Check, UserPlus, UserRoundPen } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, parseDateFromInput, formatDate } from '../utils/helpers';
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
    commission_rate: 0,
    commission_amount: 0,
    labor_charges: 0,
    market_fee: 0,
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
    const { data } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
    setVendors(data || []);
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

    const commRate = parseFloat(state.commission_rate) || 0;
    const commAmt = taxable * (commRate / 100);
    const labor = parseFloat(state.labor_charges) || 0;
    const fee = parseFloat(state.market_fee) || 0;

    const total = taxable + gst + commAmt + labor + fee;
    const rounded = Math.round(total);
    const ro = parseFloat((rounded - total).toFixed(2));

    return {
      ...state,
      items: updatedItems,
      total_without_gst: taxable,
      total_cgst: cgst,
      total_sgst: sgst,
      total_igst: igst,
      total_gst: gst,
      commission_amount: commAmt,
      round_off: ro,
      grand_total: rounded
    };
  };

  useEffect(() => {
    loadDependencies();
    if (initialData) {
      setFormData({ 
        ...initialData,
        displayDate: formatDate(initialData.date),
        type: 'Purchase'
      });
    }
  }, [initialData, cid]);

  const updateField = (idx: number, field: string, val: any) => {
    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setFormData(recalculate({ ...formData, items: newItems }));
  };

  const handleExtraChargeChange = (field: string, val: string) => {
    setFormData(recalculate({ ...formData, [field]: val }));
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
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...formData, company_id: cid, user_id: user?.id, is_deleted: false };
      delete payload.displayDate;
      
      if (initialData?.id) {
        await supabase.from('bills').update(payload).eq('id', initialData.id);
      } else {
        await supabase.from('bills').insert([payload]);
      }
      
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) {
      alert("Error: " + err.message);
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
            <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Bill No</label>
            <input required value={formData.bill_number} onChange={e => setFormData({...formData, bill_number: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none font-mono" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Vendor Name</label>
            <div className="flex items-center gap-2">
                <input required list="vlist_bill" value={formData.vendor_name} onChange={e => handleVendorChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none uppercase font-bold" />
                <button type="button" onClick={() => setVendorModal({ isOpen: true, initialData: matchedVendor || null, prefilledName: matchedVendor ? '' : formData.vendor_name })} className="h-9 w-9 flex items-center justify-center rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">
                    {matchedVendor ? <UserRoundPen className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </button>
            </div>
            <datalist id="vlist_bill">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
          </div>
        </div>

        <div className="border border-slate-200 rounded-md overflow-hidden">
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
                  <td className="p-3 text-right font-medium">{it.taxableAmount.toFixed(2)}</td>
                  <td className="text-center"><button type="button" onClick={() => setFormData(recalculate({...formData, items: formData.items.filter((_: any, i: number) => i !== idx)}))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFormData(recalculate({...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0, taxableAmount: 0 }]}))} className="w-full py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100">
            + Add Line
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Commission (%)</label>
                <input type="number" step="0.01" value={formData.commission_rate} onChange={e => handleExtraChargeChange('commission_rate', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Labor Charges</label>
                <input type="number" step="0.01" value={formData.labor_charges} onChange={e => handleExtraChargeChange('labor_charges', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Market Fee</label>
                <input type="number" step="0.01" value={formData.market_fee} onChange={e => handleExtraChargeChange('market_fee', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none" />
            </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-md space-y-2">
          <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
            <span>Taxable</span>
            <span>{formData.total_without_gst.toFixed(2)}</span>
          </div>
          {formData.gst_type === 'Intra-State' ? (
            <>
              <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
                <span>CGST</span>
                <span>{formData.total_cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
                <span>SGST</span>
                <span>{formData.total_sgst.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
              <span>IGST</span>
              <span>{formData.total_igst.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
            <span>Commission</span>
            <span>{formData.commission_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
            <span>Labor Charges</span>
            <span>{(parseFloat(formData.labor_charges) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
            <span>Market Fee</span>
            <span>{(parseFloat(formData.market_fee) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="text-[14px] font-semibold text-slate-900 uppercase">NET PAYABLE</span>
            <span className="text-[20px] font-semibold text-slate-900">{formData.grand_total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={loading} className="bg-primary text-slate-900 px-10 py-3 rounded-md font-normal text-sm hover:bg-primary-dark transition-none flex items-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            SAVE BILL
          </button>
        </div>
      </form>
    </div>
  );
};

export default BillForm;
