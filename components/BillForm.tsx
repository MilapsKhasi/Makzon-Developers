
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Save, Plus, Trash2, Loader2, Calculator, Percent, Banknote, ShieldCheck, Info, MapPin, Hash } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, getDatePlaceholder, parseDateFromInput, formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';

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
    gst_type: 'Intra-State', // Default to Local
    description: '',
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

  // Unique Tax Masters Filter (Ensures duplicate master entries don't appear twice in the bill)
  const uniqueTaxMasters = useMemo(() => {
    const seenNames = new Set();
    return taxMasters.filter(t => {
      const lowerName = t.name.trim().toLowerCase();
      if (seenNames.has(lowerName)) return false;
      seenNames.add(lowerName);
      return true;
    });
  }, [taxMasters]);

  // CORE GST ENGINE
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
      igst = 0;
    } else {
      cgst = 0;
      sgst = 0;
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
      else calcAmt = (base * (rate / 100)) + fixed; // Handle "Both" percentage and fixed

      const finalAmt = d.type === 'Deduction' ? -Math.abs(calcAmt) : Math.abs(calcAmt);
      runningTotal += finalAmt;
      return { ...d, amount: finalAmt };
    });

    const rawGrandTotal = runningTotal;
    const roundedTotal = Math.round(rawGrandTotal);
    const ro = parseFloat((roundedTotal - rawGrandTotal).toFixed(2));

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
    setFormData(prev => ({
      ...prev,
      vendor_name: name,
      gstin: selectedVendor?.gstin || prev.gstin,
      address: selectedVendor?.address || prev.address
    }));
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
    // Only add if not already applied by name to prevent visual clutter
    if (formData.duties_and_taxes.find((d: any) => d.name === tax.name)) return;
    recalculate(formData.items, formData.gst_type, [...formData.duties_and_taxes, tax]);
  };

  const removeDuty = (idx: number) => {
    const newDuties = formData.duties_and_taxes.filter((_: any, i: number) => i !== idx);
    recalculate(formData.items, formData.gst_type, newDuties);
  };

  const addRow = () => {
    const newItems = [...formData.items, { id: Date.now().toString(), itemName: '', hsnCode: '', qty: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0 }];
    setFormData({ ...formData, items: newItems });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name || !formData.bill_number) return alert("Required: Vendor and Bill Number");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...formData, company_id: cid, user_id: user?.id, is_deleted: false };
      delete payload.displayDate; delete payload.company_state; delete payload.vendor_state;
      
      const res = initialData?.id 
        ? await supabase.from('bills').update(payload).eq('id', initialData.id)
        : await supabase.from('bills').insert([payload]);

      if (res.error) throw res.error;
      window.dispatchEvent(new Event('appSettingsChanged'));
      onSubmit(payload);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-slate-50 p-6 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Type</label>
          <div className="flex p-1 bg-slate-200 rounded-md">
             {['Intra-State', 'Inter-State'].map(mode => (
               <button 
                 key={mode}
                 type="button"
                 onClick={() => recalculate(formData.items, mode)}
                 className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${formData.gst_type === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 {mode}
               </button>
             ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voucher Date</label>
          <input required value={formData.displayDate} onChange={e => setFormData({...formData, displayDate: e.target.value})} onBlur={() => { const iso = parseDateFromInput(formData.displayDate); if (iso) setFormData({...formData, date: iso, displayDate: formatDate(iso)}); }} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:border-slate-400 outline-none" placeholder={getDatePlaceholder()} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bill / Invoice No</label>
          <input required value={formData.bill_number} onChange={e => setFormData({...formData, bill_number: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-mono font-bold focus:border-slate-400 outline-none" placeholder="INV-001" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor / Party Name</label>
          <input required list="vlist" value={formData.vendor_name} onChange={e => handleVendorChange(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded text-sm font-medium focus:border-slate-400 outline-none shadow-inner bg-white" placeholder="Search party..." />
          <datalist id="vlist">{vendors.map(v => <option key={v.id} value={v.name}>{v.gstin}</option>)}</datalist>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden boxy-shadow">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-widest">
            <tr>
              <th className="p-4 border-r border-slate-800">Particulars (Item Name)</th>
              <th className="p-4 border-r border-slate-800 w-24 text-center">HSN</th>
              <th className="p-4 border-r border-slate-800 w-20 text-center">Qty</th>
              <th className="p-4 border-r border-slate-800 w-24 text-right">Rate</th>
              <th className="p-4 border-r border-slate-800 w-24 text-center">GST %</th>
              <th className="p-4 text-right w-32">Amount</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {formData.items.map((it: any, idx: number) => (
              <tr key={it.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-0 border-r border-slate-100">
                  <input list="slist" value={it.itemName} onChange={e => handleItemSelect(idx, e.target.value)} className="w-full p-4 border-none outline-none font-medium bg-transparent" placeholder="Select stock item..." />
                </td>
                <td className="p-0 border-r border-slate-100">
                  <input value={it.hsnCode} onChange={e => updateItemField(idx, 'hsnCode', e.target.value)} className="w-full p-4 border-none outline-none text-center text-slate-400 font-mono" />
                </td>
                <td className="p-0 border-r border-slate-100">
                  <input type="number" value={it.qty} onChange={e => updateItemField(idx, 'qty', Number(e.target.value))} className="w-full p-4 border-none outline-none text-center font-bold" />
                </td>
                <td className="p-0 border-r border-slate-100">
                  <input type="number" value={it.rate} onChange={e => updateItemField(idx, 'rate', Number(e.target.value))} className="w-full p-4 border-none outline-none text-right font-mono" />
                </td>
                <td className="p-0 border-r border-slate-100">
                  <select value={it.tax_rate} onChange={e => updateItemField(idx, 'tax_rate', Number(e.target.value))} className="w-full h-full p-4 border-none outline-none text-center bg-transparent font-black">
                    {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </td>
                <td className="p-4 text-right font-black text-slate-900 font-mono bg-slate-50/50">
                  {formatCurrency(it.taxableAmount)}
                </td>
                <td className="text-center">
                  <button type="button" onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addRow} className="w-full py-3 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 hover:bg-slate-100 transition-colors">
          + Add New Line Particular
        </button>
      </div>

      <div className="bg-slate-50 p-6 border border-slate-200 rounded-lg space-y-4">
          <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                <Calculator className="w-4 h-4 mr-2" /> Additional Ledgers & Charges
              </h4>
              <div className="flex flex-wrap gap-2">
                 {uniqueTaxMasters.map(tax => (
                   <button key={tax.id} type="button" onClick={() => addDuty(tax)} className="px-3 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold uppercase hover:bg-slate-100 transition-colors flex items-center">
                     <Plus className="w-3 h-3 mr-1" /> {tax.name}
                   </button>
                 ))}
              </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {formData.duties_and_taxes.map((d: any, idx: number) => (
               <div key={d.id || idx} className="bg-white border border-slate-200 rounded p-3 flex items-center justify-between group">
                  <div className="w-1/3">
                    <p className="text-[10px] font-black text-slate-900 uppercase">{d.name}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{d.type} - {d.calc_method}</p>
                  </div>
                  
                  <div className="flex items-center space-x-4 w-2/3 justify-end">
                    {(d.calc_method === 'Percentage' || d.calc_method === 'Both') && (
                      <div className="flex items-center bg-slate-50 rounded px-2 border border-slate-100">
                        <Percent className="w-3 h-3 text-slate-300 mr-2" />
                        <input type="number" step="0.01" value={d.rate} onChange={(e) => handleDutyFieldChange(d.id, 'rate', e.target.value)} className="w-16 bg-transparent border-none text-[11px] font-mono py-1.5 outline-none font-bold" />
                      </div>
                    )}
                    {(d.calc_method === 'Fixed' || d.calc_method === 'Both') && (
                      <div className="flex items-center bg-slate-50 rounded px-2 border border-slate-100">
                        <Banknote className="w-3 h-3 text-slate-300 mr-2" />
                        <input type="number" step="0.01" value={d.fixed_amount} onChange={(e) => handleDutyFieldChange(d.id, 'fixed_amount', e.target.value)} className="w-20 bg-transparent border-none text-[11px] font-mono py-1.5 outline-none font-bold" />
                      </div>
                    )}
                    <div className="w-32 text-right">
                       <span className={`text-sm font-black font-mono ${d.type === 'Deduction' ? 'text-red-500' : 'text-slate-900'}`}>
                         {d.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(d.amount))}
                       </span>
                    </div>
                    <button type="button" onClick={() => removeDuty(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
               </div>
            ))}
            {formData.duties_and_taxes.length === 0 && (
              <div className="py-4 text-center border-2 border-dashed border-slate-200 rounded bg-white/50">
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">No additional charges applied to this voucher.</p>
              </div>
            )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-5 boxy-shadow">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-2" /> GST Analysis Breakdown
                </h4>
                <table className="w-full text-[10px] font-medium border-collapse">
                    <thead className="text-slate-500 border-b border-slate-100">
                        <tr>
                            <th className="py-2 text-left">GST Rate</th>
                            <th className="py-2 text-right">Taxable Value</th>
                            {formData.gst_type === 'Intra-State' ? (
                                <>
                                    <th className="py-2 text-right">Central Tax (CGST)</th>
                                    <th className="py-2 text-right">State Tax (SGST)</th>
                                </>
                            ) : (
                                <th className="py-2 text-right">Integrated Tax (IGST)</th>
                            )}
                            <th className="py-2 text-right">Total Tax</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {gstAnalysis.map(g => (
                            <tr key={g.rate} className="text-slate-700">
                                <td className="py-2 font-bold">{g.rate}%</td>
                                <td className="py-2 text-right">{formatCurrency(g.taxable)}</td>
                                {formData.gst_type === 'Intra-State' ? (
                                    <>
                                        <td className="py-2 text-right">{formatCurrency(g.tax / 2)}</td>
                                        <td className="py-2 text-right">{formatCurrency(g.tax / 2)}</td>
                                    </>
                                ) : (
                                    <td className="py-2 text-right">{formatCurrency(g.tax)}</td>
                                )}
                                <td className="py-2 text-right font-bold">{formatCurrency(g.tax)}</td>
                            </tr>
                        ))}
                        <tr className="border-t-2 border-slate-100 bg-slate-50 font-black text-slate-900">
                            <td className="py-2">TOTAL</td>
                            <td className="py-2 text-right">{formatCurrency(formData.total_without_gst)}</td>
                            {formData.gst_type === 'Intra-State' ? (
                                <>
                                    <td className="py-2 text-right">{formatCurrency(formData.total_cgst)}</td>
                                    <td className="py-2 text-right">{formatCurrency(formData.total_sgst)}</td>
                                </>
                            ) : (
                                <td className="py-2 text-right">{formatCurrency(formData.total_igst)}</td>
                            )}
                            <td className="py-2 text-right">{formatCurrency(formData.total_gst)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-slate-400 resize-none h-20" placeholder="Narration (Optional)..." />
        </div>

        <div className="lg:col-span-5 bg-slate-900 text-white p-8 rounded-lg space-y-4 shadow-xl">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-4 mb-4">
                <span>Total Taxable Value</span>
                <span className="text-sm font-mono">{formatCurrency(formData.total_without_gst)}</span>
            </div>
            
            <div className="space-y-3 pb-4 border-b border-slate-800">
                {formData.gst_type === 'Intra-State' ? (
                    <>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">CGST @ Central Tax</span>
                            <span className="text-sm font-mono text-primary-light">{formatCurrency(formData.total_cgst)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">SGST @ State Tax</span>
                            <span className="text-sm font-mono text-primary-light">{formatCurrency(formData.total_sgst)}</span>
                        </div>
                    </>
                ) : (
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">IGST @ Integrated Tax</span>
                        <span className="text-sm font-mono text-primary-light">{formatCurrency(formData.total_igst)}</span>
                    </div>
                )}
            </div>

            {formData.duties_and_taxes.length > 0 && (
                <div className="space-y-3 pb-4 border-b border-slate-800">
                    {formData.duties_and_taxes.map((d: any, idx: number) => (
                        <div key={d.id || idx} className={`flex justify-between items-center text-[10px] font-bold uppercase ${d.type === 'Deduction' ? 'text-red-400' : 'text-slate-400'}`}>
                            <span>{d.name}</span>
                            <span className="text-sm font-mono">{d.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(d.amount))}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase italic">
                <span>Round Off</span>
                <span className="font-mono">{formData.round_off >= 0 ? '+' : ''}{formData.round_off.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-end pt-6">
                <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Total Payable</p>
                    <h2 className="text-4xl font-black font-mono tracking-tighter">{formatCurrency(formData.grand_total)}</h2>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-primary text-slate-900 px-10 py-4 rounded-md font-black uppercase text-xs tracking-widest hover:bg-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Voucher'}
                </button>
            </div>
        </div>
      </div>
      <datalist id="slist">{stockItems.map(s => <option key={s.id} value={s.name} />)}</datalist>
    </form>
  );
};

export default BillForm;
