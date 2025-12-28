
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Loader2, Calculator, Percent, Banknote, ShieldCheck, UserPlus, UserRoundPen, Check, Info } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, getDatePlaceholder, parseDateFromInput, formatDate } from '../utils/helpers';
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
    address: '',
    vendor_state: '',
    company_state: '',
    bill_number: '', 
    date: today, 
    displayDate: formatDate(today), 
    gst_type: 'Intra-State',
    items: [{ id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0 }],
    total_without_gst: 0, 
    total_cgst: 0,
    total_sgst: 0,
    total_igst: 0,
    total_gst: 0, 
    duties_and_taxes: [], 
    round_off: 0, 
    grand_total: 0, 
    status: 'Pending'
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [vendors, setVendors] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  
  const [vendorModal, setVendorModal] = useState<{ isOpen: boolean, initialData: any | null, prefilledName: string }>({
    isOpen: false,
    initialData: null,
    prefilledName: ''
  });

  const recalculateManual = (state: any) => {
    // 1. Recalculate basic line items
    let calculatedTaxable = 0;
    let autoGstTotal = 0;
    
    const updatedItems = (state.items || []).map((item: any) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const taxRate = parseFloat(item.tax_rate) || 0;
      const taxable = qty * rate;
      const taxAmount = taxable * (taxRate / 100);
      calculatedTaxable += taxable;
      autoGstTotal += taxAmount;
      return { ...item, taxableAmount: taxable, amount: taxable + taxAmount };
    });

    // 2. Handle GST (Only overwrite if resetTaxes is true)
    let cgst = parseFloat(state.total_cgst);
    let sgst = parseFloat(state.total_sgst);
    let igst = parseFloat(state.total_igst);

    if (isNaN(cgst)) cgst = 0;
    if (isNaN(sgst)) sgst = 0;
    if (isNaN(igst)) igst = 0;

    if (state.resetTaxes) {
      if (state.gst_type === 'Intra-State') {
        cgst = autoGstTotal / 2;
        sgst = autoGstTotal / 2;
        igst = 0;
      } else {
        igst = autoGstTotal;
        cgst = 0;
        sgst = 0;
      }
    }

    // 3. Start running total for Duties & Taxes
    let runningTotal = calculatedTaxable + cgst + sgst + igst;

    // 4. Calculate Ledger Charges (Duties & Taxes)
    const processedDuties = (state.duties_and_taxes || []).map((d: any) => {
      let calcAmt = 0;
      // If the field was manually edited, we might want to respect it, 
      // but standard behavior is to recalculate based on master rate unless rate is zero.
      const base = d.apply_on === 'Subtotal' ? calculatedTaxable : runningTotal;
      const rate = parseFloat(d.rate) || 0;
      const fixed = parseFloat(d.fixed_amount) || 0;

      if (d.calc_method === 'Percentage') calcAmt = base * (rate / 100);
      else if (d.calc_method === 'Fixed') calcAmt = fixed;
      else calcAmt = (base * (rate / 100)) + fixed;

      const finalAmt = d.type === 'Deduction' ? -Math.abs(calcAmt) : Math.abs(calcAmt);
      runningTotal += finalAmt;
      return { ...d, amount: finalAmt };
    });

    // 5. Finalize Round Off and Grand Total
    const roundedTotal = Math.round(runningTotal);
    const ro = parseFloat((roundedTotal - runningTotal).toFixed(2));

    return {
      ...state,
      items: updatedItems,
      total_without_gst: calculatedTaxable,
      total_cgst: cgst,
      total_sgst: sgst,
      total_igst: igst,
      total_gst: cgst + sgst + igst,
      duties_and_taxes: processedDuties,
      round_off: ro,
      grand_total: roundedTotal,
      resetTaxes: false
    };
  };

  const loadDependencies = async () => {
    if (!cid) return;
    try {
      const { data: v } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: s } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: t } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: c } = await supabase.from('companies').select('state').eq('id', cid).single();
      
      const allMasters = (t || []).map(tm => ({ ...tm, amount: 0 }));
      setVendors(v || []);
      setStockItems(s || []);
      
      if (!initialData) {
        setFormData(prev => {
          const newState = { ...prev, company_state: c?.state || '', duties_and_taxes: allMasters };
          return recalculateManual(newState);
        });
      } else {
         setFormData(prev => ({ ...prev, company_state: c?.state || '' }));
      }
    } catch (e) {
      console.error("Dependency load failed", e);
    }
  };

  useEffect(() => {
    loadDependencies();
    if (initialData) {
      // On load, we want to maintain the specific values saved in the DB
      setFormData(prev => recalculateManual({ 
        ...prev,
        ...initialData,
        displayDate: formatDate(initialData.date || today),
        items: Array.isArray(initialData.items) ? initialData.items : getInitialState().items,
        resetTaxes: false // Don't auto-reset stored taxes
      }));
    }
  }, [initialData, cid]);

  const handleManualTaxChange = (field: string, value: any) => {
    const numVal = parseFloat(value);
    setFormData(prev => recalculateManual({ ...prev, [field]: isNaN(numVal) ? 0 : numVal, resetTaxes: false }));
  };

  const handleVendorChange = (name: string) => {
    const selectedVendor = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    setFormData(prev => {
        const next = {
            ...prev,
            vendor_name: name,
            gstin: selectedVendor?.gstin || prev.gstin,
            address: selectedVendor?.address || prev.address
        };
        return recalculateManual(next);
    });
  };

  const matchedVendor = useMemo(() => vendors.find(v => v.name.toLowerCase() === formData.vendor_name.toLowerCase()), [formData.vendor_name, vendors]);
  const onVendorSaved = (savedVendor: any) => {
    setVendorModal({ isOpen: false, initialData: null, prefilledName: '' });
    loadDependencies().then(() => handleVendorChange(savedVendor.name));
  };

  const handleItemSelect = (index: number, name: string) => {
    const stockItem = stockItems.find(s => s.name === name);
    const newItems = [...formData.items];
    if (stockItem) {
      newItems[index] = { 
        ...newItems[index], 
        itemName: name, 
        hsnCode: stockItem.hsn || '', 
        rate: stockItem.rate || 0,
        tax_rate: stockItem.tax_rate || 0,
        unit: stockItem.unit || 'PCS'
      };
    } else {
      newItems[index] = { ...newItems[index], itemName: name };
    }
    setFormData(prev => recalculateManual({ ...prev, items: newItems, resetTaxes: true }));
  };

  const updateItemField = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData(prev => recalculateManual({ ...prev, items: newItems, resetTaxes: true }));
  };

  const handleDutyFieldChange = (id: string, field: string, value: any) => {
    const numVal = parseFloat(value);
    const newDuties = (formData.duties_and_taxes || []).map((d: any) => {
      if (d.id === id) return { ...d, [field]: isNaN(numVal) ? 0 : numVal };
      return d;
    });
    setFormData(prev => recalculateManual({ ...prev, duties_and_taxes: newDuties, resetTaxes: false }));
  };

  const removeRow = (idx: number) => {
    const newItems = formData.items.filter((_: any, i: number) => i !== idx);
    const data = newItems.length ? newItems : getInitialState().items;
    setFormData(prev => recalculateManual({ ...prev, items: data, resetTaxes: true }));
  };

  const saveBillToSupabase = async (payload: any): Promise<any> => {
    const operation = initialData?.id 
      ? supabase.from('bills').update(payload).eq('id', initialData.id).select()
      : supabase.from('bills').insert([payload]).select();
    
    const res = await operation;

    if (res.error) {
      const msg = res.error.message;
      const missingColumnMatch = msg.match(/column '(.+?)' of/i) || 
                                 msg.match(/'(.+?)' column/i) || 
                                 msg.match(/find the '(.+?)' column/i);
      
      if (missingColumnMatch) {
        const offendingColumn = missingColumnMatch[1];
        if (offendingColumn && payload.hasOwnProperty(offendingColumn)) {
          const nextPayload = { ...payload }; 
          delete nextPayload[offendingColumn]; 
          return saveBillToSupabase(nextPayload);
        }
      }
      throw res.error;
    }
    return res;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name || !formData.bill_number) return alert("Required: Vendor and Bill Number");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...formData, company_id: cid, user_id: user?.id, is_deleted: false };
      const internalFields = ['displayDate', 'company_state', 'vendor_state', 'resetTaxes'];
      internalFields.forEach(field => delete payload[field]);
      await saveBillToSupabase(payload);
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) { 
      console.error("Save Error:", err);
      alert("Submission Error: " + err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="space-y-10">
      <Modal isOpen={vendorModal.isOpen} onClose={() => setVendorModal({ ...vendorModal, isOpen: false })} title={vendorModal.initialData ? "Edit Vendor Profile" : "Register New Vendor"}>
        <VendorForm initialData={vendorModal.initialData} prefilledName={vendorModal.prefilledName} onSubmit={onVendorSaved} onCancel={() => setVendorModal({ ...vendorModal, isOpen: false })} />
      </Modal>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="bg-[#f9f9f9] p-8 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Category</label>
            <div className="flex p-1.5 bg-slate-200 rounded-lg">
               {['Intra-State', 'Inter-State'].map(mode => (
                 <button key={mode} type="button" onClick={() => setFormData(prev => recalculateManual({...prev, gst_type: mode, resetTaxes: true}))} className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all ${formData.gst_type === mode ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                   {mode}
                 </button>
               ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Voucher Date</label>
            <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base focus:border-slate-400 outline-none shadow-sm transition-all bg-white font-medium" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Invoice No</label>
            <input required value={formData.bill_number} onChange={e => setFormData({...formData, bill_number: e.target.value})} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base font-mono font-bold focus:border-slate-400 outline-none shadow-sm bg-white" />
          </div>
          <div className="space-y-2 relative">
            <label className="text-sm font-bold text-slate-500 capitalize">Vendor</label>
            <div className="flex items-center gap-3">
                <input required list="vlist" value={formData.vendor_name} onChange={e => handleVendorChange(e.target.value)} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base font-bold focus:border-slate-400 outline-none shadow-inner bg-white" />
                <button type="button" onClick={() => setVendorModal({ isOpen: true, initialData: matchedVendor || null, prefilledName: matchedVendor ? '' : formData.vendor_name })} className={`h-12 w-12 flex items-center justify-center rounded-lg border border-slate-200 transition-all ${matchedVendor ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-[#ffea79]/20 text-slate-700'}`}>
                    {matchedVendor ? <UserRoundPen className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </button>
            </div>
            <datalist id="vlist">{vendors.map(v => <option key={v.id} value={v.name}>{v.gstin}</option>)}</datalist>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-bold capitalize border-b border-slate-200">
              <tr>
                <th className="p-6 border-r border-slate-200">Item Description</th>
                <th className="p-6 border-r border-slate-200 w-32 text-center">HSN</th>
                <th className="p-6 border-r border-slate-200 w-28 text-center">Qty</th>
                <th className="p-6 border-r border-slate-200 w-32 text-right">Rate</th>
                <th className="p-6 border-r border-slate-200 w-32 text-center">Tax %</th>
                <th className="p-6 text-right w-44">Taxable Amt</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {formData.items.map((it: any, idx: number) => (
                <tr key={it.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-0 border-r border-slate-100"><input list="slist" value={it.itemName} onChange={e => handleItemSelect(idx, e.target.value)} className="w-full p-6 border-none outline-none font-semibold bg-transparent text-slate-900" /></td>
                  <td className="p-0 border-r border-slate-100"><input value={it.hsnCode} onChange={e => updateItemField(idx, 'hsnCode', e.target.value)} className="w-full p-6 border-none outline-none text-center text-slate-400 font-mono" /></td>
                  <td className="p-0 border-r border-slate-100"><input type="number" value={it.qty} onChange={e => updateItemField(idx, 'qty', e.target.value)} className="w-full p-6 border-none outline-none text-center font-bold text-slate-800" /></td>
                  <td className="p-0 border-r border-slate-100"><input type="number" value={it.rate} onChange={e => updateItemField(idx, 'rate', e.target.value)} className="w-full p-6 border-none outline-none text-right font-mono font-bold" /></td>
                  <td className="p-0 border-r border-slate-100"><select value={it.tax_rate} onChange={e => updateItemField(idx, 'tax_rate', Number(e.target.value))} className="w-full h-full p-6 border-none outline-none text-center bg-transparent font-bold text-slate-900">{TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}</select></td>
                  <td className="p-6 text-right font-bold text-slate-900 font-mono bg-slate-50/30">{formatCurrency(it.taxableAmount)}</td>
                  <td className="text-center"><button type="button" onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFormData(prev => recalculateManual({ ...prev, items: [...prev.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0 }], resetTaxes: true }))} className="w-full py-5 bg-slate-50 text-sm font-bold text-slate-400 capitalize border-t border-slate-200 hover:bg-slate-100 transition-all">
            + Add New Line Item
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6 space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-8 rounded-xl flex items-start gap-4 shadow-sm">
                  <Info className="w-6 h-6 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-700 font-medium leading-relaxed">
                      All calculations are automated based on line items. You can manually adjust taxes and ledger charges here if required for specific vouchers.
                  </p>
              </div>
          </div>

          <div className="lg:col-span-6 bg-[#f9f9f9] border border-slate-200 p-10 rounded-xl space-y-6 shadow-md">
              <div className="flex justify-between items-center text-sm font-bold text-slate-600 border-b border-slate-200 pb-4 mb-2">
                  <span>Basic Taxable Value</span>
                  <span className="font-mono text-slate-900">{formatCurrency(formData.total_without_gst)}</span>
              </div>

              <div className="space-y-4">
                  {formData.gst_type === 'Intra-State' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CGST Amount</label>
                            <input type="number" step="0.01" value={formData.total_cgst} onChange={(e) => handleManualTaxChange('total_cgst', e.target.value)} className="w-full h-11 px-4 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:border-slate-400 outline-none bg-white shadow-inner" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SGST Amount</label>
                            <input type="number" step="0.01" value={formData.total_sgst} onChange={(e) => handleManualTaxChange('total_sgst', e.target.value)} className="w-full h-11 px-4 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:border-slate-400 outline-none bg-white shadow-inner" />
                        </div>
                      </div>
                  ) : (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IGST Amount</label>
                        <input type="number" step="0.01" value={formData.total_igst} onChange={(e) => handleManualTaxChange('total_igst', e.target.value)} className="w-full h-11 px-4 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:border-slate-400 outline-none bg-white shadow-inner" />
                    </div>
                  )}
              </div>

              {formData.duties_and_taxes && formData.duties_and_taxes.length > 0 && (
                <div className="space-y-4 border-t border-slate-200 pt-4">
                    {formData.duties_and_taxes.map((d: any, idx: number) => {
                         const isRate = d.calc_method === 'Percentage' || d.calc_method === 'Both';
                         const isFixed = d.calc_method === 'Fixed' || d.calc_method === 'Both';
                         return (
                            <div key={d.id || idx} className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate block mb-1">{d.name}</label>
                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg h-11 px-3 shadow-inner">
                                        {isRate ? (
                                            <>
                                                <Percent className="w-3 h-3 text-slate-300 mr-2" />
                                                <input type="number" step="0.01" value={d.rate} onChange={(e) => handleDutyFieldChange(d.id, 'rate', e.target.value)} className="w-full bg-transparent border-none text-xs font-mono font-bold outline-none" />
                                            </>
                                        ) : isFixed ? (
                                            <>
                                                <Banknote className="w-3 h-3 text-slate-300 mr-2" />
                                                <input type="number" step="0.01" value={d.fixed_amount} onChange={(e) => handleDutyFieldChange(d.id, 'fixed_amount', e.target.value)} className="w-full bg-transparent border-none text-xs font-mono font-bold outline-none" />
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="col-span-5 text-right flex flex-col items-end">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Charge</span>
                                    <span className={`text-sm font-bold font-mono h-11 flex items-center ${d.type === 'Deduction' ? 'text-rose-500' : 'text-slate-900'}`}>{d.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(d.amount))}</span>
                                </div>
                                <div className="col-span-2 text-right">
                                    <button type="button" onClick={() => setFormData(prev => recalculateManual({...prev, duties_and_taxes: prev.duties_and_taxes.filter((_: any, i: number) => i !== idx)}))} className="h-11 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                         );
                    })}
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold text-slate-400 border-t border-slate-200 pt-6 capitalize italic">
                  <span>Round Off Adjustment</span>
                  <span className="font-mono">{formData.round_off >= 0 ? '+' : ''}{(formData.round_off || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-end pt-4 border-t border-slate-200">
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Payable Net Total</p>
                      <h2 className="text-4xl font-bold font-mono tracking-tighter text-slate-900 leading-none">{formatCurrency(formData.grand_total)}</h2>
                  </div>
                  <button type="submit" disabled={loading} className="bg-[#ffea79] text-slate-900 px-10 py-5 rounded-lg font-bold capitalize text-base hover:bg-[#f0db69] border border-[#ffea79] transition-all shadow-md active:scale-95 disabled:opacity-50">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Commit Bill'}
                  </button>
              </div>
          </div>
        </div>
        <datalist id="slist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
      </form>
    </div>
  );
};

export default BillForm;
