
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Loader2, Calculator, Percent, Banknote, ShieldCheck, UserPlus, UserRoundPen, Check, Info } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, getDatePlaceholder, parseDateFromInput, formatDate } from '../utils/helpers';
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
    address: '',
    invoice_number: '', 
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
    status: 'Pending',
    type: 'Sale' // Discriminator for the 'bills' table
  });

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>(getInitialState());
  const [customers, setCustomers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  
  const [customerModal, setCustomerModal] = useState<{ isOpen: boolean, initialData: any | null, prefilledName: string }>({
    isOpen: false,
    initialData: null,
    prefilledName: ''
  });

  const recalculateManual = (state: any) => {
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

    const baseRunningTotal = calculatedTaxable + cgst + sgst + igst;
    let runningTotal = baseRunningTotal;

    const processedDuties = (state.duties_and_taxes || []).map((d: any) => {
      let calcAmt = 0;
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
      // Use 'vendors' table as the unified 'Parties' storage
      const { data: v } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: s } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: t } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false);
      
      const allMasters = (t || []).map(tm => ({ ...tm, amount: 0 }));
      setCustomers(v || []);
      setStockItems(s || []);
      
      if (!initialData) {
        setFormData(prev => recalculateManual({ ...prev, duties_and_taxes: allMasters }));
      }
    } catch (e) {
      console.error("Dependency load failed", e);
    }
  };

  useEffect(() => {
    loadDependencies();
    if (initialData) {
      setFormData(prev => recalculateManual({ 
        ...prev,
        ...initialData,
        // Map backend names if necessary
        customer_name: initialData.customer_name || initialData.vendor_name || '',
        invoice_number: initialData.invoice_number || initialData.bill_number || '',
        displayDate: formatDate(initialData.date || today),
        items: Array.isArray(initialData.items) ? initialData.items : getInitialState().items,
        resetTaxes: false 
      }));
    }
  }, [initialData, cid]);

  const handleManualTaxChange = (field: string, value: any) => {
    const numVal = parseFloat(value);
    setFormData(prev => recalculateManual({ ...prev, [field]: isNaN(numVal) ? 0 : numVal, resetTaxes: false }));
  };

  const handleCustomerChange = (name: string) => {
    const selected = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    setFormData(prev => recalculateManual({
        ...prev,
        customer_name: name,
        gstin: selected?.gstin || prev.gstin,
        address: selected?.address || prev.address
    }));
  };

  const matchedCustomer = useMemo(() => customers.find(c => c.name.toLowerCase() === formData.customer_name.toLowerCase()), [formData.customer_name, customers]);
  const onCustomerSaved = (saved: any) => {
    setCustomerModal({ isOpen: false, initialData: null, prefilledName: '' });
    loadDependencies().then(() => handleCustomerChange(saved.name));
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

  const saveToSupabase = async (payload: any): Promise<any> => {
    // Map UI terminology to 'bills' table columns
    const dbPayload = {
        ...payload,
        vendor_name: payload.customer_name,
        bill_number: payload.invoice_number,
        type: 'Sale'
    };
    // Remove the UI-only aliases
    delete dbPayload.customer_name;
    delete dbPayload.invoice_number;

    const operation = initialData?.id 
      ? supabase.from('bills').update(dbPayload).eq('id', initialData.id).select()
      : supabase.from('bills').insert([dbPayload]).select();
    
    const res = await operation;

    if (res.error) {
      const msg = res.error.message;
      const missingColumnMatch = msg.match(/column '(.+?)' of/i) || 
                                 msg.match(/'(.+?)' column/i) || 
                                 msg.match(/find the '(.+?)' column/i);
      
      if (missingColumnMatch) {
        const offendingColumn = missingColumnMatch[1];
        if (offendingColumn && dbPayload.hasOwnProperty(offendingColumn)) {
          const nextPayload = { ...dbPayload }; 
          delete nextPayload[offendingColumn]; 
          // We can't use payload because recursive calls should use the stripped dbPayload
          // But we must map back to 'vendor_name' etc to continue the stripping logic if it fails again
          return saveToSupabaseRecursive(nextPayload);
        }
      }
      throw res.error;
    }
    return res;
  };

  const saveToSupabaseRecursive = async (dbPayload: any): Promise<any> => {
    const operation = initialData?.id 
      ? supabase.from('bills').update(dbPayload).eq('id', initialData.id).select()
      : supabase.from('bills').insert([dbPayload]).select();
    
    const res = await operation;
    if (res.error) {
      const msg = res.error.message;
      const missingColumnMatch = msg.match(/column '(.+?)' of/i) || msg.match(/'(.+?)' column/i) || msg.match(/find the '(.+?)' column/i);
      if (missingColumnMatch) {
        const offendingColumn = missingColumnMatch[1];
        if (offendingColumn && dbPayload.hasOwnProperty(offendingColumn)) {
          const nextPayload = { ...dbPayload }; 
          delete nextPayload[offendingColumn]; 
          return saveToSupabaseRecursive(nextPayload);
        }
      }
      throw res.error;
    }
    return res;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.invoice_number) return alert("Required: Customer and Invoice Number");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...formData, company_id: cid, user_id: user?.id, is_deleted: false };
      const internalFields = ['displayDate', 'resetTaxes'];
      internalFields.forEach(field => delete payload[field]);
      
      await saveToSupabase(payload);
      
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) { 
      alert("Submission Error: " + err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="space-y-10">
      <Modal isOpen={customerModal.isOpen} onClose={() => setCustomerModal({ ...customerModal, isOpen: false })} title={customerModal.initialData ? "Edit Customer Profile" : "Register New Customer"}>
        <CustomerForm initialData={customerModal.initialData} prefilledName={customerModal.prefilledName} onSubmit={onCustomerSaved} onCancel={() => setCustomerModal({ ...customerModal, isOpen: false })} />
      </Modal>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="bg-[#f9f9f9] p-8 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Transaction Type</label>
            <div className="flex p-1.5 bg-slate-200 rounded-lg">
               {['Intra-State', 'Inter-State'].map(mode => (
                 <button key={mode} type="button" onClick={() => setFormData(prev => recalculateManual({...prev, gst_type: mode, resetTaxes: true}))} className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all ${formData.gst_type === mode ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                   {mode}
                 </button>
               ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Invoice Date</label>
            <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base focus:border-slate-400 outline-none shadow-sm transition-all bg-white font-medium" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Invoice No</label>
            <input required value={formData.invoice_number} onChange={e => setFormData({...formData, invoice_number: e.target.value})} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base font-mono font-bold focus:border-slate-400 outline-none shadow-sm bg-white" />
          </div>
          <div className="space-y-2 relative">
            <label className="text-sm font-bold text-slate-500 capitalize">Customer</label>
            <div className="flex items-center gap-3">
                <input required list="clist" value={formData.customer_name} onChange={e => handleCustomerChange(e.target.value)} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base font-bold focus:border-slate-400 outline-none shadow-inner bg-white" />
                <button type="button" onClick={() => setCustomerModal({ isOpen: true, initialData: matchedCustomer || null, prefilledName: matchedCustomer ? '' : formData.customer_name })} className={`h-12 w-12 flex items-center justify-center rounded-lg border border-slate-200 transition-all ${matchedCustomer ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-[#ffea79]/20 text-slate-700'}`}>
                    {matchedCustomer ? <UserRoundPen className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </button>
            </div>
            <datalist id="clist">{customers.map(c => <option key={c.id} value={c.name}>{c.gstin}</option>)}</datalist>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-bold capitalize border-b border-slate-200">
              <tr>
                <th className="p-6 border-r border-slate-200">Particulars</th>
                <th className="p-6 border-r border-slate-200 w-32 text-center">HSN</th>
                <th className="p-6 border-r border-slate-200 w-28 text-center">Qty</th>
                <th className="p-6 border-r border-slate-200 w-32 text-right">Rate</th>
                <th className="p-6 border-r border-slate-200 w-32 text-center">GST %</th>
                <th className="p-6 text-right w-44">Taxable</th>
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
            + Add New Particular
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6 space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-8 rounded-xl flex items-start gap-4 shadow-sm">
                  <Info className="w-6 h-6 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-700 font-medium leading-relaxed">
                      Sales summary follows standard accounting rules. Manual adjustments to charges or discounts will update the Net Payable value.
                  </p>
              </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 p-10 rounded-xl space-y-6">
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-4">
                  <span>Taxable Total</span>
                  <span className="font-mono text-slate-900 text-base">{formatCurrency(formData.total_without_gst)}</span>
              </div>

              <div className="space-y-4">
                  {formData.gst_type === 'Intra-State' ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            <label>CGST</label>
                            <label>SGST</label>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <input type="number" step="0.01" value={formData.total_cgst} onChange={(e) => handleManualTaxChange('total_cgst', e.target.value)} className="w-full h-11 px-4 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 bg-[#f9f9f9] text-base" />
                            <input type="number" step="0.01" value={formData.total_sgst} onChange={(e) => handleManualTaxChange('total_sgst', e.target.value)} className="w-full h-11 px-4 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 bg-[#f9f9f9] text-base" />
                        </div>
                      </div>
                  ) : (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">IGST</label>
                        <input type="number" step="0.01" value={formData.total_igst} onChange={(e) => handleManualTaxChange('total_igst', e.target.value)} className="w-full h-11 px-4 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 bg-[#f9f9f9] text-base" />
                    </div>
                  )}
              </div>

              {formData.duties_and_taxes && formData.duties_and_taxes.length > 0 && (
                <div className="space-y-5 pt-2">
                    {formData.duties_and_taxes.map((d: any, idx: number) => (
                        <div key={d.id || idx} className="space-y-1.5">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.name}</label>
                                <button type="button" onClick={() => setFormData(prev => recalculateManual({...prev, duties_and_taxes: prev.duties_and_taxes.filter((_: any, i: number) => i !== idx)}))} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">₹</span>
                                <input type="number" step="0.01" value={d.fixed_amount || 0} onChange={(e) => handleDutyFieldChange(d.id, 'fixed_amount', e.target.value)} className="w-full h-11 pl-8 pr-4 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 bg-white" />
                            </div>
                        </div>
                    ))}
                </div>
              )}

              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase border-t border-slate-100 pt-4">
                  <span>Round Off</span>
                  <span className="font-mono text-slate-900">{formData.round_off >= 0 ? '+' : ''}{(formData.round_off || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                  <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Receivable</p>
                      <h2 className="text-2xl font-bold font-mono tracking-tighter text-slate-900 leading-none">{formatCurrency(formData.grand_total)}</h2>
                  </div>
                  <button type="submit" disabled={loading} className="bg-primary text-slate-900 h-14 w-14 rounded-none font-bold hover:bg-primary-dark transition-all flex items-center justify-center disabled:opacity-50 border border-primary">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  </button>
              </div>
          </div>
        </div>
        <datalist id="slist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
      </form>
    </div>
  );
};

export default SalesInvoiceForm;
