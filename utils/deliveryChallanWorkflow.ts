import { supabase } from '../lib/supabase';
import { safeSupabaseSave, getActiveCompanyId } from './helpers';

export interface DispatchItemDifference {
  itemName: string;
  hsn: string;
  unit: string;
  rate: number;
  tax_rate: number;
  qty: number;
}

/**
 * Checks if dispatch-related information has changed between original dispatch records and edited sales invoice.
 * Dispatch fields: Customer Name/ID, Items, Quantities (increased), Rates, Tax Rates, HSN, Units, Discounts.
 * Ignores: Invoice Number, Invoice Date, Payment details, Remarks/Status.
 */
export const hasDispatchInfoChanged = (
  originalChallan: any,
  allSupplementaryChallans: any[],
  currentInvoiceData: any
): boolean => {
  if (!originalChallan) return false;

  const origCustomer = (originalChallan.customer_name || originalChallan.vendor_name || '').trim().toUpperCase();
  const currentCustomer = (currentInvoiceData.customer_name || '').trim().toUpperCase();

  // 1. Customer changed -> Dispatch customer changed!
  if (origCustomer && currentCustomer && origCustomer !== currentCustomer) {
    return true;
  }

  // Calculate cumulative dispatched quantities for each item across original + supplementary challans
  const dispatchedMap = new Map<string, { qty: number; rate: number; hsn: string; unit: string; tax_rate: number }>();

  const accumulateItems = (itemsList: any[]) => {
    if (!Array.isArray(itemsList)) return;
    itemsList.forEach((it: any) => {
      const name = (it.itemName || it.item_name || '').trim().toUpperCase();
      if (!name) return;
      const q = Number(it.qty ?? it.quantity ?? 0);
      const r = Number(it.rate ?? 0);
      const hsn = (it.hsnCode || it.hsn || '').toString();
      const unit = (it.unit || 'Pcs').toString();
      const taxRate = Number(it.tax_rate ?? 0);

      const existing = dispatchedMap.get(name);
      if (existing) {
        existing.qty += q;
      } else {
        dispatchedMap.set(name, { qty: q, rate: r, hsn, unit, tax_rate: taxRate });
      }
    });
  };

  // Original line items
  const origItems = originalChallan.items_raw?.line_items || originalChallan.items || [];
  accumulateItems(origItems);

  // Supplementary line items
  (allSupplementaryChallans || []).forEach(supp => {
    const suppItems = supp.items_raw?.line_items || supp.items || [];
    accumulateItems(suppItems);
  });

  // Compare with current invoice line items
  const invoiceItems = currentInvoiceData.items || [];

  for (const invItem of invoiceItems) {
    const name = (invItem.itemName || invItem.item_name || '').trim().toUpperCase();
    if (!name) continue;

    const invQty = Number(invItem.qty || 0);
    const invRate = Number(invItem.rate || 0);
    const invHsn = (invItem.hsnCode || invItem.hsn || '').toString();
    const invUnit = (invItem.unit || 'Pcs').toString();
    const invTax = Number(invItem.tax_rate || 0);

    const prevDispatched = dispatchedMap.get(name);

    // New item added that wasn't previously dispatched
    if (!prevDispatched) {
      if (invQty > 0) return true;
    } else {
      // Quantity increased beyond previously dispatched
      if (invQty > prevDispatched.qty) return true;
      // Rate / HSN / Unit / Tax rate changed on dispatched items
      if (invRate !== prevDispatched.rate || invHsn !== prevDispatched.hsn || invUnit !== prevDispatched.unit || invTax !== prevDispatched.tax_rate) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Calculates the exact additional dispatch quantities required for a Supplementary Delivery Challan.
 */
export const calculateSupplementaryItems = (
  originalChallan: any,
  allSupplementaryChallans: any[],
  currentInvoiceData: any
): DispatchItemDifference[] => {
  const diffItems: DispatchItemDifference[] = [];
  if (!originalChallan) return diffItems;

  const origCustomer = (originalChallan.customer_name || originalChallan.vendor_name || '').trim().toUpperCase();
  const currentCustomer = (currentInvoiceData.customer_name || '').trim().toUpperCase();

  // If customer changed, the entire invoice items belong to a new Supplementary Delivery Challan
  if (origCustomer && currentCustomer && origCustomer !== currentCustomer) {
    (currentInvoiceData.items || []).forEach((invItem: any) => {
      const q = Number(invItem.qty || 0);
      if (q > 0) {
        diffItems.push({
          itemName: invItem.itemName || invItem.item_name || '',
          hsn: invItem.hsnCode || invItem.hsn || '',
          unit: invItem.unit || 'Pcs',
          rate: Number(invItem.rate || 0),
          tax_rate: Number(invItem.tax_rate || 0),
          qty: q
        });
      }
    });
    return diffItems;
  }

  // Calculate cumulative dispatched quantities for each item
  const dispatchedMap = new Map<string, number>();

  const accumulateItems = (itemsList: any[]) => {
    if (!Array.isArray(itemsList)) return;
    itemsList.forEach((it: any) => {
      const name = (it.itemName || it.item_name || '').trim().toUpperCase();
      if (!name) return;
      const q = Number(it.qty ?? it.quantity ?? 0);
      dispatchedMap.set(name, (dispatchedMap.get(name) || 0) + q);
    });
  };

  const origItems = originalChallan.items_raw?.line_items || originalChallan.items || [];
  accumulateItems(origItems);

  (allSupplementaryChallans || []).forEach(supp => {
    const suppItems = supp.items_raw?.line_items || supp.items || [];
    accumulateItems(suppItems);
  });

  // Calculate positive differences (additional quantities or new items)
  (currentInvoiceData.items || []).forEach((invItem: any) => {
    const name = (invItem.itemName || invItem.item_name || '').trim().toUpperCase();
    if (!name) return;

    const invQty = Number(invItem.qty || 0);
    const prevQty = dispatchedMap.get(name) || 0;
    const additionalQty = invQty - prevQty;

    if (additionalQty > 0) {
      diffItems.push({
        itemName: invItem.itemName || invItem.item_name || '',
        hsn: invItem.hsnCode || invItem.hsn || '',
        unit: invItem.unit || 'Pcs',
        rate: Number(invItem.rate || 0),
        tax_rate: Number(invItem.tax_rate || 0),
        qty: additionalQty
      });
    }
  });

  return diffItems;
};

/**
 * Creates a Supplementary Delivery Challan automatically in database when invoice details change.
 */
export const createSupplementaryDeliveryChallan = async (
  companyId: string,
  originalChallan: any,
  salesInvoice: any,
  supplementaryItems: DispatchItemDifference[]
): Promise<any | null> => {
  if (!companyId || !originalChallan || supplementaryItems.length === 0) return null;

  try {
    const parentChallanNo = originalChallan.challan_number || originalChallan.invoice_number || originalChallan.bill_number || 'DC-001';
    
    // Fetch existing count of supplementary challans for numbering
    const { data: existingSupps } = await supabase
      .from('delivery_challans')
      .select('id, challan_number')
      .eq('company_id', companyId)
      .eq('is_deleted', false)
      .filter('items->>parent_challan_id', 'eq', originalChallan.id);

    const suppSeq = (existingSupps?.length || 0) + 1;
    const suppChallanNo = `SDC-${parentChallanNo}-${suppSeq}`;

    let subtotal = 0;
    const lineItemsPayload = supplementaryItems.map(item => {
      const amt = item.qty * item.rate;
      subtotal += amt;
      return {
        item_name: item.itemName,
        hsn: item.hsn,
        quantity: item.qty,
        unit: item.unit,
        rate: item.rate,
        tax_rate: item.tax_rate,
        amount: amt
      };
    });

    const itemsPayload = {
      is_delivery_challan: true,
      is_supplementary: true,
      parent_challan_id: originalChallan.id,
      parent_challan_number: parentChallanNo,
      linked_invoice_id: salesInvoice.id,
      linked_invoice_number: salesInvoice.invoice_number,
      vehicle_no: originalChallan.items_raw?.vehicle_no || '',
      driver_name: originalChallan.items_raw?.driver_name || '',
      eway_bill_no: originalChallan.items_raw?.eway_bill_no || '',
      dispatch_destination: originalChallan.items_raw?.dispatch_destination || '',
      line_items: lineItemsPayload
    };

    const payload = {
      company_id: companyId,
      customer_name: (salesInvoice.customer_name || originalChallan.customer_name || '').trim().toUpperCase(),
      challan_number: suppChallanNo,
      invoice_number: suppChallanNo,
      date: new Date().toISOString().split('T')[0],
      total_goods_value: subtotal,
      total_without_gst: subtotal,
      total_gst: 0,
      grand_total: subtotal,
      status: 'Supplementary',
      is_deleted: false,
      description: `Supplementary Delivery Challan for Invoice ${salesInvoice.invoice_number} (Ref: ${parentChallanNo})`,
      items: itemsPayload
    };

    const res = await safeSupabaseSave('delivery_challans', payload);
    return res?.data?.[0] || null;
  } catch (err) {
    console.error('Failed to create Supplementary Delivery Challan:', err);
    return null;
  }
};

/**
 * Marks original delivery challan as Converted to Invoice without altering original dispatch records.
 */
export const markChallanAsConverted = async (
  challanId: string,
  invoiceId: string,
  invoiceNumber: string
) => {
  if (!challanId) return;

  try {
    // 1. Fetch current challan to preserve items_raw
    const { data: curr } = await supabase
      .from('delivery_challans')
      .select('*')
      .eq('id', challanId)
      .maybeSingle();

    const updatedItems = {
      ...(curr?.items || curr?.items_raw || {}),
      converted_to_invoice: true,
      linked_invoice_id: invoiceId,
      linked_invoice_number: invoiceNumber
    };

    await supabase
      .from('delivery_challans')
      .update({
        status: 'Converted to Invoice',
        items: updatedItems
      })
      .eq('id', challanId);

    // Also update legacy sales_invoices if present
    await supabase
      .from('sales_invoices')
      .update({
        status: 'Converted to Invoice',
        items: updatedItems
      })
      .eq('id', challanId);
  } catch (err) {
    console.warn('Error marking delivery challan as converted:', err);
  }
};
