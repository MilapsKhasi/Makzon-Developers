
import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Loader2, Calculator, Percent, Banknote, ShieldCheck, UserPlus, UserRoundPen, Check } from 'lucide-react';
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
  const [taxMasters, setTaxMasters] = useState<any[]>([]);
  
  const [vendorModal, setVendorModal] = useState<{ isOpen: boolean, initialData: any | null, prefilledName: string }>({
    isOpen: false,
    initialData: null,
    prefilledName: ''
  });

  const loadDependencies = async () => {
    if (!cid) return;
    try {
      const { data: v } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: s } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: t } = await supabase.from('duties_taxes').select('*').eq('company_id', cid).eq('is_deleted', false);
      const { data: c } = await supabase.from('companies').select('state').eq('id', cid).single();
      
      setVendors(v || []);
      setStockItems(s || []);
      setTaxMasters(t || []);
      setFormData(prev => ({ ...prev, company_state: c?.state || '' }));
    } catch (e) {
      console.error("Dependency load failed", e);
    }
  };

  useEffect(() => {
    loadDependencies();
    if (initialData) {
      setFormData(prev => ({ 
        ...prev,
        ...initialData,
        displayDate: formatDate(initialData.date || today),
        items: Array.isArray(initialData.items) ? initialData.items : getInitialState().items
      }));
    }
  }, [initialData, cid]);

  const uniqueTaxMasters = useMemo(() => {
    const seenNames = new Set();
    return taxMasters.filter(t => {
      const lowerName = t.name.trim().toLowerCase();
      if (seenNames.has(lowerName)) return false;
      seenNames.add(lowerName);
      return true;
    });
  }, [taxMasters]);

  const getStickyChargesKey = (vendorId: string) => `sticky_charges_${cid}_${vendorId}`;
  const saveStickyCharges = (vendorId: string, duties: any[]) => {
    localStorage.setItem(getStickyChargesKey(vendorId), JSON.stringify(duties));
  };
  const getStickyCharges = (vendorId: string) => {
    const saved = localStorage.getItem(getStickyChargesKey(vendorId));
    return saved ? JSON.parse(saved) : null;
  };

  const recalculate = (items: any[], gstType = formData.gst_type, duties = formData.duties_and_taxes) => {
    let totalTaxable = 0;
    let totalTax = 0;
    
    const updatedItems = items.map(item => {
      const taxable = (Number(item.qty) || 0) * (Number(item.rate) || 0);
      const taxRate = Number(item.tax_rate) || 0;
      const taxAmount = taxable * (taxRate / 100);
      totalTaxable += taxable;
      totalTax += taxAmount;
      return { ...item, taxableAmount: taxable, amount: taxable + taxAmount };
    });

    let cgst = 0, sgst = 0, igst = 0;
    if (gstType === 'Intra-State') {
      cgst = totalTax / 2;
      sgst = totalTax / 2;
    } else {
      igst = totalTax;
    }

    let runningTotal = totalTaxable + cgst + sgst + igst;
    const processedDuties = duties.map((d: any) => {
      let calcAmt = 0;
      const base = d.apply_on === 'Subtotal' ? totalTaxable : runningTotal;
      const rate = Number(d.rate) || 0;
      const fixed = Number(d.fixed_amount) || 0;

      if (d.calc_method === 'Percentage') calcAmt = base * (rate / 100);
      else if (d.calc_method === 'Fixed') calcAmt = fixed;
      else calcAmt = (base * (rate / 100)) + fixed;

      const finalAmt = d.type === 'Deduction' ? -Math.abs(calcAmt) : Math.abs(calcAmt);
      runningTotal += finalAmt;
      return { ...d, amount: finalAmt };
    });

    const roundedTotal = Math.round(runningTotal);
    const ro = parseFloat((roundedTotal - runningTotal).toFixed(2));

    setFormData(prev => ({
      ...prev,
      items: updatedItems,
      gst_type: gstType,
      total_without_gst: totalTaxable,
      total_cgst: cgst,
      total_sgst: sgst,
      total_igst: igst,
      total_gst: totalTax,
      duties_and_taxes: processedDuties,
      round_off: ro,
      grand_total: roundedTotal
    }));
  };

  const handleVendorChange = (name: string) => {
    const selectedVendor = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    let appliedDuties = [];
    if (selectedVendor) {
        const localSticky = getStickyCharges(selectedVendor.id);
        appliedDuties = localSticky || uniqueTaxMasters.map(m => ({ ...m, amount: 0 }));
    } else {
        appliedDuties = uniqueTaxMasters.map(m => ({ ...m, amount: 0 }));
    }
    setFormData(prev => ({
      ...prev,
      vendor_name: name,
      gstin: selectedVendor?.gstin || prev.gstin,
      address: selectedVendor?.address || prev.address,
      duties_and_taxes: appliedDuties
    }));
    recalculate(formData.items, formData.gst_type, appliedDuties);
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
    recalculate(newItems);
  };

  const updateItemField = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    recalculate(newItems);
  };

  const handleDutyFieldChange = (id: string, field: string, value: any) => {
    const newDuties = formData.duties_and_taxes.map((d: any) => {
      if (d.id === id) return { ...d, [field]: Number(value) };
      return d;
    });
    recalculate(formData.items, formData.gst_type, newDuties);
  };

  const addDuty = (tax: any) => {
    if (formData.duties_and_taxes.find((d: any) => d.name === tax.name)) return;
    recalculate(formData.items, formData.gst_type, [...formData.duties_and_taxes, tax]);
  };

  const removeRow = (idx: number) => {
    const newItems = formData.items.filter((_: any, i: number) => i !== idx);
    recalculate(newItems.length ? newItems : getInitialState().items);
  };

  const gstAnalysis = useMemo(() => {
    const groups: Record<number, any> = {};
    formData.items.forEach((item: any) => {
      const rate = Number(item.tax_rate) || 0;
      if (!groups[rate]) groups[rate] = { rate, taxable: 0, tax: 0 };
      groups[rate].taxable += item.taxableAmount || 0;
      groups[rate].tax += (item.taxableAmount || 0) * (rate / 100);
    });
    return Object.values(groups).filter(g => g.taxable > 0).sort((a, b) => a.rate - b.rate);
  }, [formData.items]);

  const saveBillToSupabase = async (payload: any): Promise<any> => {
    const operation = initialData?.id 
        ? supabase.from('bills').update(payload).eq('id', initialData.id)
        : supabase.from('bills').insert([payload]);

    const res = await operation;

    if (res.error) {
      const msg = res.error.message;
      const missingColumnMatch = msg.match(/'(.+?)' column/) || msg.match(/column '(.+?)' of/);
      if (missingColumnMatch) {
        const offendingColumn = missingColumnMatch[1];
        if (offendingColumn && payload.hasOwnProperty(offendingColumn)) {
          const nextPayload = { ...payload };
          delete nextPayload[offendingColumn];
          return saveBillToSupabase(nextPayload);
        }
      }
      const commonMismatches = ['round_off', 'gst_type', 'is_starred', 'is_favorite', 'duties_and_taxes', 'items'];
      for (const col of commonMismatches) {
        if (msg.includes(`'${col}'`) && payload.hasOwnProperty(col)) {
           const nextPayload = { ...payload }; delete nextPayload[col]; return saveBillToSupabase(nextPayload);
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
      delete payload.displayDate; delete payload.company_state; delete payload.vendor_state;
      await saveBillToSupabase(payload);
      if (matchedVendor) {
        saveStickyCharges(matchedVendor.id, formData.duties_and_taxes);
        try { await supabase.from('vendors').update({ default_duties: formData.duties_and_taxes }).eq('id', matchedVendor.id); } catch {}
      }
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) { alert("Submission Error: " + err.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-10">
      <Modal isOpen={vendorModal.isOpen} onClose={() => setVendorModal({ ...vendorModal, isOpen: false })} title={vendorModal.initialData ? "Edit Vendor Profile" : "Register New Vendor"}>
        <VendorForm initialData={vendorModal.initialData} prefilledName={vendorModal.prefilledName} onSubmit={onVendorSaved} onCancel={() => setVendorModal({ ...vendorModal, isOpen: false })} />
      </Modal>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="bg-slate-50 p-8 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Transaction Category</label>
            <div className="flex p-1.5 bg-slate-200 rounded-lg">
               {['Intra-State', 'Inter-State'].map(mode => (
                 <button key={mode} type="button" onClick={() => recalculate(formData.items, mode)} className={`flex-1 py-2.5 text-sm font-bold rounded-md transition-all ${formData.gst_type === mode ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                   {mode}
                 </button>
               ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Voucher Date</label>
            <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base focus:border-slate-400 outline-none shadow-sm transition-all" placeholder={getDatePlaceholder()} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Invoice Reference No</label>
            <input required value={formData.bill_number} onChange={e => setFormData({...formData, bill_number: e.target.value})} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base font-mono font-bold focus:border-slate-400 outline-none shadow-sm" placeholder="INV-100" />
          </div>
          <div className="space-y-2 relative">
            <label className="text-sm font-bold text-slate-500 capitalize">Vendor Business Name</label>
            <div className="flex items-center gap-3">
                <input required list="vlist" value={formData.vendor_name} onChange={e => handleVendorChange(e.target.value)} className="w-full h-12 px-5 border border-slate-200 rounded-lg text-base font-bold focus:border-slate-400 outline-none shadow-inner bg-white" placeholder="Search registered parties..." />
                <button type="button" onClick={() => setVendorModal({ isOpen: true, initialData: matchedVendor || null, prefilledName: matchedVendor ? '' : formData.vendor_name })} className={`h-12 w-12 flex items-center justify-center rounded-lg border border-slate-200 transition-all ${matchedVendor ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' : 'bg-primary/20 text-slate-700 hover:bg-primary border-primary/30'}`}>
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
                <th className="p-6 border-r border-slate-200 w-32 text-center">HSN Code</th>
                <th className="p-6 border-r border-slate-200 w-28 text-center">Quantity</th>
                <th className="p-6 border-r border-slate-200 w-32 text-right">Unit Rate</th>
                <th className="p-6 border-r border-slate-200 w-32 text-center">GST Rate</th>
                <th className="p-6 text-right w-44">Taxable Amount</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {formData.items.map((it: any, idx: number) => (
                <tr key={it.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-0 border-r border-slate-100"><input list="slist" value={it.itemName} onChange={e => handleItemSelect(idx, e.target.value)} className="w-full p-6 border-none outline-none font-semibold bg-transparent text-slate-900" placeholder="Select item from stock..." /></td>
                  <td className="p-0 border-r border-slate-100"><input value={it.hsnCode} onChange={e => updateItemField(idx, 'hsnCode', e.target.value)} className="w-full p-6 border-none outline-none text-center text-slate-400 font-mono" /></td>
                  <td className="p-0 border-r border-slate-100"><input type="number" value={it.qty} onChange={e => updateItemField(idx, 'qty', Number(e.target.value))} className="w-full p-6 border-none outline-none text-center font-bold text-slate-800" /></td>
                  <td className="p-0 border-r border-slate-100"><input type="number" value={it.rate} onChange={e => updateItemField(idx, 'rate', Number(e.target.value))} className="w-full p-6 border-none outline-none text-right font-mono font-bold" /></td>
                  <td className="p-0 border-r border-slate-100"><select value={it.tax_rate} onChange={e => updateItemField(idx, 'tax_rate', Number(e.target.value))} className="w-full h-full p-6 border-none outline-none text-center bg-transparent font-bold text-slate-900">{TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}</select></td>
                  <td className="p-6 text-right font-bold text-slate-900 font-mono bg-slate-50/30">{formatCurrency(it.taxableAmount)}</td>
                  <td className="text-center"><button type="button" onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFormData({ ...formData, items: [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0 }] })} className="w-full py-5 bg-slate-50 text-sm font-bold text-slate-400 capitalize border-t border-slate-200 hover:bg-slate-100 transition-all">
            + Add New Line Particular
          </button>
        </div>

        <div className="bg-slate-50 p-10 border border-slate-200 rounded-xl space-y-8">
            <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-600 capitalize flex items-center">
                  <Calculator className="w-5 h-5 mr-3 text-slate-400" /> Additional Ledgers & Surcharges
                </h4>
                <div className="flex flex-wrap gap-3">
                   {uniqueTaxMasters.map(tax => (
                     <button key={tax.id} type="button" onClick={() => addDuty(tax)} className="px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold capitalize hover:bg-slate-100 transition-all flex items-center shadow-sm">
                       <Plus className="w-4 h-4 mr-2 text-slate-400" /> {tax.name}
                     </button>
                   ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {formData.duties_and_taxes.map((d: any, idx: number) => (
                 <div key={d.id || idx} className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between group shadow-sm">
                    <div className="w-1/3">
                      <p className="text-sm font-bold text-slate-900">{d.name}</p>
                      <p className="text-xs text-slate-400 font-semibold capitalize">{d.type} - {d.calc_method}</p>
                    </div>
                    <div className="flex items-center space-x-8 w-2/3 justify-end">
                      {(d.calc_method === 'Percentage' || d.calc_method === 'Both') && (
                        <div className="flex items-center bg-slate-50 rounded-lg px-4 border border-slate-100 h-12">
                          <Percent className="w-4 h-4 text-slate-300 mr-3" /><input type="number" step="0.01" value={d.rate} onChange={(e) => handleDutyFieldChange(d.id, 'rate', e.target.value)} className="w-24 bg-transparent border-none text-sm font-mono py-3 outline-none font-bold" />
                        </div>
                      )}
                      {(d.calc_method === 'Fixed' || d.calc_method === 'Both') && (
                        <div className="flex items-center bg-slate-50 rounded-lg px-4 border border-slate-100 h-12">
                          <Banknote className="w-4 h-4 text-slate-300 mr-3" /><input type="number" step="0.01" value={d.fixed_amount} onChange={(e) => handleDutyFieldChange(d.id, 'fixed_amount', e.target.value)} className="w-28 bg-transparent border-none text-sm font-mono py-3 outline-none font-bold" />
                        </div>
                      )}
                      <div className="w-48 text-right"><span className={`text-xl font-bold font-mono ${d.type === 'Deduction' ? 'text-red-500' : 'text-slate-900'}`}>{d.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(d.amount))}</span></div>
                      <button type="button" onClick={() => { const next = formData.duties_and_taxes.filter((_, i) => i !== idx); recalculate(formData.items, formData.gst_type, next); }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                    </div>
                 </div>
              ))}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-8">
              <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-500 capitalize mb-8 flex items-center">
                      <ShieldCheck className="w-5 h-5 mr-3 text-slate-400" /> Summary Of Tax Distributions
                  </h4>
                  <table className="w-full text-sm font-medium border-collapse">
                      <thead className="text-slate-400 border-b border-slate-100">
                          <tr>
                              <th className="py-4 text-left font-bold uppercase text-[10px] tracking-widest">Rate</th>
                              <th className="py-4 text-right font-bold uppercase text-[10px] tracking-widest">Taxable Val</th>
                              {formData.gst_type === 'Intra-State' ? (<><th className="py-4 text-right font-bold uppercase text-[10px] tracking-widest">CGST</th><th className="py-4 text-right font-bold uppercase text-[10px] tracking-widest">SGST</th></>) : (<th className="py-4 text-right font-bold uppercase text-[10px] tracking-widest">IGST</th>)}
                              <th className="py-4 text-right font-bold uppercase text-[10px] tracking-widest">Line Total</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {gstAnalysis.map(g => (
                              <tr key={g.rate} className="text-slate-700">
                                  <td className="py-4 font-bold">{g.rate}%</td>
                                  <td className="py-4 text-right">{formatCurrency(g.taxable)}</td>
                                  {formData.gst_type === 'Intra-State' ? (<><td className="py-4 text-right">{formatCurrency(g.tax / 2)}</td><td className="py-4 text-right">{formatCurrency(g.tax / 2)}</td></>) : (<td className="py-4 text-right">{formatCurrency(g.tax)}</td>)}
                                  <td className="py-4 text-right font-bold">{formatCurrency(g.tax)}</td>
                              </tr>
                          ))}
                          <tr className="border-t-2 border-slate-100 bg-slate-50 font-bold text-slate-900">
                              <td className="py-4">Grand Totals</td>
                              <td className="py-4 text-right">{formatCurrency(formData.total_without_gst)}</td>
                              {formData.gst_type === 'Intra-State' ? (<><td className="py-4 text-right">{formatCurrency(formData.total_cgst)}</td><td className="py-4 text-right">{formatCurrency(formData.total_sgst)}</td></>) : (<td className="py-4 text-right">{formatCurrency(formData.total_igst)}</td>)}
                              <td className="py-4 text-right">{formatCurrency(formData.total_gst)}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 text-slate-900 p-10 rounded-xl space-y-6 border border-slate-200 shadow-md">
              <div className="flex justify-between items-center text-sm font-bold text-slate-500 border-b border-slate-200 pb-6 mb-6 capitalize">
                  <span>Gross Taxable Amount</span>
                  <span className="text-lg font-mono font-bold text-slate-900">{formatCurrency(formData.total_without_gst)}</span>
              </div>
              
              <div className="space-y-4 pb-6 border-b border-slate-200 font-semibold">
                  {formData.gst_type === 'Intra-State' ? (
                      <>
                          <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500 capitalize">Central Goods Tax (CGST)</span>
                              <span className="text-lg font-mono font-bold">{formatCurrency(formData.total_cgst)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500 capitalize">State Goods Tax (SGST)</span>
                              <span className="text-lg font-mono font-bold">{formatCurrency(formData.total_sgst)}</span>
                          </div>
                      </>
                  ) : (
                      <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500 capitalize">Integrated Goods Tax (IGST)</span>
                          <span className="text-lg font-mono font-bold">{formatCurrency(formData.total_igst)}</span>
                      </div>
                  )}
              </div>

              {formData.duties_and_taxes.length > 0 && (
                  <div className="space-y-4 pb-6 border-b border-slate-200 font-semibold">
                      {formData.duties_and_taxes.map((d: any, idx: number) => (
                          <div key={d.id || idx} className={`flex justify-between items-center text-sm ${d.type === 'Deduction' ? 'text-red-500' : 'text-slate-500'}`}>
                              <span className="capitalize">{d.name}</span>
                              <span className="text-lg font-mono font-bold">{d.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(d.amount))}</span>
                          </div>
                      ))}
                  </div>
              )}

              <div className="flex justify-between items-center text-sm font-bold text-slate-400 italic">
                  <span>Currency Rounding Difference</span>
                  <span className="font-mono">{formData.round_off >= 0 ? '+' : ''}{formData.round_off.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-end pt-10">
                  <div>
                      <p className="text-xs font-bold text-slate-400 capitalize mb-2">Final Payable Net Total</p>
                      <h2 className="text-4xl font-bold font-mono tracking-tighter text-slate-900 leading-none">{formatCurrency(formData.grand_total)}</h2>
                  </div>
                  <button type="submit" disabled={loading} className="bg-primary text-slate-900 px-12 py-5 rounded-lg font-bold capitalize text-base hover:bg-white border-2 border-primary transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirm Bill Voucher'}
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
