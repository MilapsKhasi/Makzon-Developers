import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Printer, Truck, Calendar, User, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, safeSupabaseSave, ensureParty, ensureStockItems, normalizeBill } from '../utils/helpers';

interface DeliveryChallanFormProps {
  initialData?: any;
  onSubmit: (challan: any, shouldPrint: boolean, isSaveAndNew: boolean) => void;
  onCancel: () => void;
}

export const DeliveryChallanForm: React.FC<DeliveryChallanFormProps> = ({
  initialData,
  onSubmit,
  onCancel
}) => {
  const cid = getActiveCompanyId();

  const [date, setDate] = useState<string>(
    initialData?.date || new Date().toISOString().split('T')[0]
  );
  const [challanNumber, setChallanNumber] = useState<string>(
    initialData?.invoice_number || initialData?.bill_number || ''
  );
  const [partyName, setPartyName] = useState<string>(
    initialData?.customer_name || initialData?.vendor_name || ''
  );
  const [vehicleNo, setVehicleNo] = useState<string>(
    initialData?.items_raw?.vehicle_no || ''
  );
  const [driverName, setDriverName] = useState<string>(
    initialData?.items_raw?.driver_name || ''
  );
  const [ewayBillNo, setEwayBillNo] = useState<string>(
    initialData?.items_raw?.eway_bill_no || ''
  );
  const [dispatchDestination, setDispatchDestination] = useState<string>(
    initialData?.items_raw?.dispatch_destination || ''
  );
  const [notes, setNotes] = useState<string>(
    initialData?.description || ''
  );

  const [parties, setParties] = useState<any[]>([]);
  const [stockItemsList, setStockItemsList] = useState<any[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [loadingChallanNo, setLoadingChallanNo] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lineItems, setLineItems] = useState<any[]>(() => {
    if (initialData?.items && Array.isArray(initialData.items) && initialData.items.length > 0) {
      return initialData.items.map((item: any) => ({
        id: item.id || Math.random().toString(),
        item_name: item.item_name || item.description || '',
        hsn: item.hsn || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'PCS',
        rate: item.rate || item.price || 0,
        tax_rate: item.tax_rate || 0,
        amount: item.amount || (Number(item.quantity || 1) * Number(item.rate || 0))
      }));
    }
    return [
      { id: '1', item_name: '', hsn: '', quantity: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0 }
    ];
  });

  // Load parties and stock items
  useEffect(() => {
    if (!cid) return;

    const loadRefData = async () => {
      setLoadingParties(true);
      try {
        const [{ data: custs }, { data: vends }, { data: items }] = await Promise.all([
          supabase.from('customers').select('*').eq('company_id', cid).eq('is_deleted', false),
          supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false),
          supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false)
        ]);

        const pMap = new Map();
        (custs || []).forEach((c: any) => pMap.set(c.name?.trim().toUpperCase() || c.id, c));
        (vends || []).forEach((v: any) => pMap.set(v.name?.trim().toUpperCase() || v.id, v));

        setParties(Array.from(pMap.values()));
        setStockItemsList(items || []);
      } catch (err) {
        console.error('Error loading ref data:', err);
      } finally {
        setLoadingParties(false);
      }
    };

    loadRefData();
  }, [cid]);

  // Generate Challan Number if creating new
  useEffect(() => {
    if (initialData || !cid) return;

    const generateNumber = async () => {
      setLoadingChallanNo(true);
      try {
        const { data } = await supabase
          .from('sales_invoices')
          .select('invoice_number')
          .eq('company_id', cid)
          .eq('is_deleted', false);

        let maxSeq = 0;
        if (data) {
          data.forEach((inv: any) => {
            const no = inv.invoice_number;
            if (no && no.startsWith('DC-')) {
              const numPart = no.substring(3);
              if (/^\d+$/.test(numPart)) {
                const parsed = parseInt(numPart, 10);
                if (!isNaN(parsed) && parsed > maxSeq) {
                  maxSeq = parsed;
                }
              }
            }
          });
        }
        setChallanNumber(`DC-${(maxSeq + 1).toString().padStart(3, '0')}`);
      } catch (err) {
        console.error('Error generating DC number:', err);
        setChallanNumber('DC-001');
      } finally {
        setLoadingChallanNo(false);
      }
    };

    generateNumber();
  }, [cid, initialData]);

  const handleLineChange = (index: number, field: string, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === 'item_name') {
        const found = stockItemsList.find(
          s => s.name?.toLowerCase() === String(value).toLowerCase()
        );
        if (found) {
          row.hsn = found.hsn || '';
          row.unit = found.unit || 'PCS';
          row.rate = found.selling_price || found.rate || 0;
          row.tax_rate = found.tax_rate || 0;
        }
      }

      const qty = parseFloat(row.quantity) || 0;
      const rate = parseFloat(row.rate) || 0;
      row.amount = qty * rate;

      updated[index] = row;
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: Math.random().toString(), item_name: '', hsn: '', quantity: 1, unit: 'PCS', rate: 0, tax_rate: 0, amount: 0 }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  const totalGst = lineItems.reduce((acc, row) => {
    const amt = Number(row.amount) || 0;
    const taxRate = Number(row.tax_rate) || 0;
    return acc + (amt * taxRate / 100);
  }, 0);
  const grandTotal = subtotal + totalGst;

  const handleSave = async (shouldPrint: boolean = false, isSaveAndNew: boolean = false) => {
    if (!cid) {
      alert('Workspace company not loaded.');
      return;
    }
    if (!partyName.trim()) {
      alert('Please select or enter a Customer/Party Name.');
      return;
    }
    if (!challanNumber.trim()) {
      alert('Please enter a Delivery Challan Number.');
      return;
    }

    const validItems = lineItems.filter(item => item.item_name.trim() !== '');
    if (validItems.length === 0) {
      alert('Please add at least one stock item.');
      return;
    }

    setSaving(true);
    try {
      // Auto register party & stock items
      await ensureParty(partyName, 'customer', cid);
      await ensureStockItems(validItems, cid);

      const itemsPayload = {
        is_delivery_challan: true,
        vehicle_no: vehicleNo.trim(),
        driver_name: driverName.trim(),
        eway_bill_no: ewayBillNo.trim(),
        dispatch_destination: dispatchDestination.trim(),
        line_items: validItems.map(i => ({
          item_name: i.item_name,
          hsn: i.hsn,
          quantity: Number(i.quantity) || 0,
          unit: i.unit,
          rate: Number(i.rate) || 0,
          tax_rate: Number(i.tax_rate) || 0,
          amount: Number(i.amount) || 0
        }))
      };

      const payload = {
        company_id: cid,
        customer_name: partyName.trim(),
        invoice_number: challanNumber.trim(),
        date: date,
        total_without_gst: subtotal,
        total_gst: totalGst,
        grand_total: grandTotal,
        status: 'Dispatched',
        is_deleted: false,
        description: notes.trim(),
        items: itemsPayload
      };

      const savedRes = await safeSupabaseSave('sales_invoices', payload, initialData?.id);
      const savedData = savedRes?.data?.[0] || { ...payload, id: initialData?.id || 'new-dc' };
      const normalized = normalizeBill(savedData);

      onSubmit(normalized, shouldPrint, isSaveAndNew);
    } catch (err: any) {
      console.error('Error saving delivery challan:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-5">
      {/* Basic Info Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-md border border-slate-200/80 dark:border-slate-800">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Customer / Party Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              list="dc-parties-list"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Select or enter party name"
              className="w-full h-10 pl-9 pr-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
            />
            <datalist id="dc-parties-list">
              {parties.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Challan Number *
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={challanNumber}
              onChange={(e) => setChallanNumber(e.target.value)}
              placeholder={loadingChallanNo ? 'Generating...' : 'e.g. DC-001'}
              className="w-full h-10 pl-9 pr-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Challan Date *
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Transport & Vehicle Details */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-200/80 dark:border-slate-800 space-y-3">
        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
          <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Dispatch & Transport Details</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Vehicle Number
            </label>
            <input
              type="text"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              placeholder="e.g. MH-12-AB-1234"
              className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Driver Name / Phone
            </label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Ramesh / 9876543210"
              className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              E-Way Bill No.
            </label>
            <input
              type="text"
              value={ewayBillNo}
              onChange={(e) => setEwayBillNo(e.target.value)}
              placeholder="e.g. 123456789012"
              className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Destination Location
            </label>
            <input
              type="text"
              value={dispatchDestination}
              onChange={(e) => setDispatchDestination(e.target.value)}
              placeholder="e.g. Warehouse 3, Pune"
              className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Dispatched Stock Items Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden bg-white dark:bg-slate-900">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Dispatched Items & Quantities
          </span>
          <button
            type="button"
            onClick={addLineItem}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium flex items-center space-x-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <th className="p-2.5 w-10 text-center">#</th>
                <th className="p-2.5 min-w-[180px]">Item Name</th>
                <th className="p-2.5 w-24">HSN</th>
                <th className="p-2.5 w-24 text-right">Qty</th>
                <th className="p-2.5 w-20">Unit</th>
                <th className="p-2.5 w-28 text-right">Rate (₹)</th>
                <th className="p-2.5 w-20 text-right">GST %</th>
                <th className="p-2.5 w-28 text-right">Amount (₹)</th>
                <th className="p-2.5 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lineItems.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      list="dc-stock-list"
                      value={item.item_name}
                      onChange={(e) => handleLineChange(idx, 'item_name', e.target.value)}
                      placeholder="Item name or code"
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                    <datalist id="dc-stock-list">
                      {stockItemsList.map(s => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={item.hsn}
                      onChange={(e) => handleLineChange(idx, 'hsn', e.target.value)}
                      placeholder="HSN"
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white text-right focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleLineChange(idx, 'unit', e.target.value)}
                      placeholder="PCS"
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white uppercase focus:outline-none focus:border-emerald-500"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.rate}
                      onChange={(e) => handleLineChange(idx, 'rate', e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white text-right focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </td>
                  <td className="p-2.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.tax_rate}
                      onChange={(e) => handleLineChange(idx, 'tax_rate', e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white text-right focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </td>
                  <td className="p-2.5 text-right font-mono font-medium text-slate-900 dark:text-white">
                    {(Number(item.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      disabled={lineItems.length === 1}
                      className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Dispatch Notes / Terms
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Goods delivered in good condition. Subject to verification at destination."
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-slate-600"
          />
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-md border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Taxable Subtotal</span>
            <span className="font-mono font-medium text-slate-900 dark:text-white">
              ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>GST Amount</span>
            <span className="font-mono font-medium text-slate-900 dark:text-white">
              ₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
            <span>Grand Total Goods Value</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-10 px-4 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => handleSave(true, false)}
          disabled={saving}
          className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium flex items-center space-x-2 transition-colors shadow-xs"
        >
          <Printer className="w-4 h-4" />
          <span>Save & Print</span>
        </button>

        <button
          type="button"
          onClick={() => handleSave(false, false)}
          disabled={saving}
          className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center space-x-2 transition-colors shadow-xs"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Delivery Challan'}</span>
        </button>
      </div>
    </div>
  );
};

export default DeliveryChallanForm;
