import { supabase } from '../lib/supabase';
import { safeSupabaseSave } from './helpers';

/**
 * Entity Identity Architecture for ZenterPrime:
 * Names are editable display data. IDs are permanent identity.
 * A Party, Stock Item, or Additional Charge must have one permanent unique ID
 * from the moment it is created. Changing its name must NEVER regenerate a new ID.
 * All historical and future transactions reference the permanent entity ID.
 */

export const generatePermanentId = (prefix: 'PRT' | 'STK' | 'CHG' | 'ENT'): string => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${ts}_${rand}`;
};

/**
 * Propagate a party rename across all historical and current transactions.
 * Ensures all transactions (sales invoices, purchase bills, payment vouchers, cashbooks)
 * are definitively linked to partyId and display the updated name.
 */
export const propagatePartyRename = async (
  companyId: string,
  partyId: string,
  oldName: string,
  newName: string
) => {
  if (!companyId || !partyId) return;
  const oldTrim = (oldName || '').trim().toUpperCase();
  const newTrim = (newName || '').trim().toUpperCase();
  if (oldTrim === newTrim && oldTrim.length > 0) return;

  try {
    // 1. Update sales_invoices
    const { data: salesData } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_deleted', false);

    if (salesData && salesData.length > 0) {
      for (const inv of salesData) {
        const invPartyId = inv.party_id || inv.customer_id || inv.items?.party_id || inv.items?.customer_id;
        const matchesId = invPartyId && String(invPartyId) === String(partyId);
        const matchesOldName = oldTrim && inv.customer_name?.trim().toUpperCase() === oldTrim;

        if (matchesId || matchesOldName) {
          const itemsObj = typeof inv.items === 'object' && inv.items !== null ? { ...inv.items } : {};
          itemsObj.party_id = partyId;
          itemsObj.customer_id = partyId;

          const updatedPayload: any = {
            customer_name: newTrim,
            items: itemsObj
          };

          try {
            await supabase.from('sales_invoices').update({
              ...updatedPayload,
              party_id: partyId,
              customer_id: partyId
            }).eq('id', inv.id);
          } catch {
            await supabase.from('sales_invoices').update(updatedPayload).eq('id', inv.id);
          }
        }
      }
    }

    // 2. Update purchase_bills
    const { data: purchaseData } = await supabase
      .from('purchase_bills')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_deleted', false);

    if (purchaseData && purchaseData.length > 0) {
      for (const bill of purchaseData) {
        const billPartyId = bill.party_id || bill.vendor_id || bill.items?.party_id || bill.items?.vendor_id;
        const matchesId = billPartyId && String(billPartyId) === String(partyId);
        const matchesOldName = oldTrim && bill.vendor_name?.trim().toUpperCase() === oldTrim;

        if (matchesId || matchesOldName) {
          const itemsObj = typeof bill.items === 'object' && bill.items !== null ? { ...bill.items } : {};
          itemsObj.party_id = partyId;
          itemsObj.vendor_id = partyId;

          const updatedPayload: any = {
            vendor_name: newTrim,
            items: itemsObj
          };

          try {
            await supabase.from('purchase_bills').update({
              ...updatedPayload,
              party_id: partyId,
              vendor_id: partyId
            }).eq('id', bill.id);
          } catch {
            await supabase.from('purchase_bills').update(updatedPayload).eq('id', bill.id);
          }
        }
      }
    }

    // 3. Update legacy customers table if record exists there
    try {
      await supabase
        .from('customers')
        .update({ name: newTrim })
        .eq('company_id', companyId)
        .eq('id', partyId);
    } catch {
      // ignore
    }

    // 4. Update cashbooks if particulars reference old name
    if (oldTrim) {
      try {
        const { data: cashbookRows } = await supabase
          .from('cashbooks')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_deleted', false);

        if (cashbookRows) {
          for (const cb of cashbookRows) {
            const raw = cb.raw_data || {};
            let changed = false;
            const incomeRows = (raw.incomeRows || []).map((r: any) => {
              if (r.particulars && r.particulars.toUpperCase().includes(oldTrim)) {
                changed = true;
                return { ...r, particulars: r.particulars.replace(new RegExp(oldTrim, 'gi'), newTrim) };
              }
              return r;
            });
            const expenseRows = (raw.expenseRows || []).map((r: any) => {
              if (r.particulars && r.particulars.toUpperCase().includes(oldTrim)) {
                changed = true;
                return { ...r, particulars: r.particulars.replace(new RegExp(oldTrim, 'gi'), newTrim) };
              }
              return r;
            });
            if (changed) {
              await supabase.from('cashbooks').update({
                raw_data: { ...raw, incomeRows, expenseRows }
              }).eq('id', cb.id);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    window.dispatchEvent(new Event('partiesUpdated'));
    window.dispatchEvent(new Event('appSettingsChanged'));
  } catch (err) {
    console.error('Error in propagatePartyRename:', err);
  }
};

/**
 * Propagate a stock item rename across all transactions referencing this stock item.
 */
export const propagateStockItemRename = async (
  companyId: string,
  itemId: string,
  oldName: string,
  newName: string
) => {
  if (!companyId || !itemId) return;
  const oldTrim = (oldName || '').trim().toUpperCase();
  const newTrim = (newName || '').trim().toUpperCase();
  if (oldTrim === newTrim && oldTrim.length > 0) return;

  try {
    // 1. Update sales_invoices
    const { data: salesData } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_deleted', false);

    if (salesData) {
      for (const inv of salesData) {
        const itemsObj = typeof inv.items === 'object' && inv.items !== null ? { ...inv.items } : {};
        const lineItems = Array.isArray(itemsObj) ? itemsObj : (itemsObj.line_items || []);
        let changed = false;

        const updatedLines = lineItems.map((line: any) => {
          const matchesId = (line.stock_item_id && String(line.stock_item_id) === String(itemId)) ||
                            (line.item_id && String(line.item_id) === String(itemId));
          const matchesOldName = oldTrim && line.itemName?.trim().toUpperCase() === oldTrim;

          if (matchesId || matchesOldName) {
            changed = true;
            return {
              ...line,
              stock_item_id: itemId,
              item_id: itemId,
              itemName: newTrim
            };
          }
          return line;
        });

        if (changed) {
          const newItemsObj = Array.isArray(itemsObj) ? updatedLines : { ...itemsObj, line_items: updatedLines };
          await supabase.from('sales_invoices').update({ items: newItemsObj }).eq('id', inv.id);
        }
      }
    }

    // 2. Update purchase_bills
    const { data: purchaseData } = await supabase
      .from('purchase_bills')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_deleted', false);

    if (purchaseData) {
      for (const bill of purchaseData) {
        const itemsObj = typeof bill.items === 'object' && bill.items !== null ? { ...bill.items } : {};
        const lineItems = Array.isArray(itemsObj) ? itemsObj : (itemsObj.line_items || []);
        let changed = false;

        const updatedLines = lineItems.map((line: any) => {
          const matchesId = (line.stock_item_id && String(line.stock_item_id) === String(itemId)) ||
                            (line.item_id && String(line.item_id) === String(itemId));
          const matchesOldName = oldTrim && line.itemName?.trim().toUpperCase() === oldTrim;

          if (matchesId || matchesOldName) {
            changed = true;
            return {
              ...line,
              stock_item_id: itemId,
              item_id: itemId,
              itemName: newTrim
            };
          }
          return line;
        });

        if (changed) {
          const newItemsObj = Array.isArray(itemsObj) ? updatedLines : { ...itemsObj, line_items: updatedLines };
          await supabase.from('purchase_bills').update({ items: newItemsObj }).eq('id', bill.id);
        }
      }
    }

    window.dispatchEvent(new Event('stockUpdated'));
    window.dispatchEvent(new Event('appSettingsChanged'));
  } catch (err) {
    console.error('Error in propagateStockItemRename:', err);
  }
};

/**
 * Propagate an additional charge rename across all transactions referencing this charge.
 */
export const propagateChargeRename = async (
  companyId: string,
  chargeId: string,
  oldName: string,
  newName: string
) => {
  if (!companyId || !chargeId) return;
  const oldTrim = (oldName || '').trim().toUpperCase();
  const newTrim = (newName || '').trim().toUpperCase();
  if (oldTrim === newTrim && oldTrim.length > 0) return;

  try {
    const [{ data: salesData }, { data: purchaseData }] = await Promise.all([
      supabase.from('sales_invoices').select('*').eq('company_id', companyId).eq('is_deleted', false),
      supabase.from('purchase_bills').select('*').eq('company_id', companyId).eq('is_deleted', false)
    ]);

    for (const inv of (salesData || [])) {
      const itemsObj = typeof inv.items === 'object' && inv.items !== null ? { ...inv.items } : {};
      const duties = itemsObj.duties_and_taxes;
      if (Array.isArray(duties)) {
        let changed = false;
        const updatedDuties = duties.map((d: any) => {
          if ((d.id && String(d.id) === String(chargeId)) || (oldTrim && d.name?.trim().toUpperCase() === oldTrim)) {
            changed = true;
            return { ...d, id: chargeId, charge_id: chargeId, name: newTrim };
          }
          return d;
        });
        if (changed) {
          await supabase.from('sales_invoices').update({ items: { ...itemsObj, duties_and_taxes: updatedDuties } }).eq('id', inv.id);
        }
      }
    }

    for (const bill of (purchaseData || [])) {
      const itemsObj = typeof bill.items === 'object' && bill.items !== null ? { ...bill.items } : {};
      const duties = itemsObj.duties_and_taxes;
      if (Array.isArray(duties)) {
        let changed = false;
        const updatedDuties = duties.map((d: any) => {
          if ((d.id && String(d.id) === String(chargeId)) || (oldTrim && d.name?.trim().toUpperCase() === oldTrim)) {
            changed = true;
            return { ...d, id: chargeId, charge_id: chargeId, name: newTrim };
          }
          return d;
        });
        if (changed) {
          await supabase.from('purchase_bills').update({ items: { ...itemsObj, duties_and_taxes: updatedDuties } }).eq('id', bill.id);
        }
      }
    }

    window.dispatchEvent(new Event('appSettingsChanged'));
  } catch (err) {
    console.error('Error in propagateChargeRename:', err);
  }
};

/**
 * Idempotent historical data recovery and migration:
 * Connects older transactions to permanent IDs (parties, stock items, charges).
 * Never deletes any data.
 * Safe to run multiple times without duplicating or corrupting records.
 */
export const runHistoricalIdMigration = async (
  companyId: string
): Promise<{ migratedInvoices: number; migratedBills: number }> => {
  if (!companyId) return { migratedInvoices: 0, migratedBills: 0 };

  try {
    const [{ data: vendors }, { data: customers }, { data: stockItems }, { data: charges }] = await Promise.all([
      supabase.from('vendors').select('*').eq('company_id', companyId).eq('is_deleted', false),
      supabase.from('customers').select('*').eq('company_id', companyId).eq('is_deleted', false),
      supabase.from('stock_items').select('*').eq('company_id', companyId).eq('is_deleted', false),
      supabase.from('duties_taxes').select('*').eq('company_id', companyId).eq('is_deleted', false)
    ]);

    const partyByName = new Map<string, string>(); // upperName -> permanent party id
    const partyById = new Set<string>();

    (vendors || []).forEach((v: any) => {
      if (v.id) {
        partyById.add(String(v.id));
        if (v.name) partyByName.set(v.name.trim().toUpperCase(), String(v.id));
      }
    });
    (customers || []).forEach((c: any) => {
      if (c.id) {
        partyById.add(String(c.id));
        if (c.name && !partyByName.has(c.name.trim().toUpperCase())) {
          partyByName.set(c.name.trim().toUpperCase(), String(c.id));
        }
      }
    });

    const stockByName = new Map<string, string>();
    (stockItems || []).forEach((s: any) => {
      if (s.id && s.name) {
        stockByName.set(s.name.trim().toUpperCase(), String(s.id));
      }
    });

    const chargeByName = new Map<string, string>();
    (charges || []).forEach((c: any) => {
      if (c.id && c.name) {
        chargeByName.set(c.name.trim().toUpperCase(), String(c.id));
      }
    });

    let migratedInvoices = 0;
    let migratedBills = 0;

    // 1. Inspect sales_invoices
    const { data: salesData } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_deleted', false);

    if (salesData && salesData.length > 0) {
      for (const inv of salesData) {
        let changed = false;
        const itemsObj = typeof inv.items === 'object' && inv.items !== null ? { ...inv.items } : {};
        let currentPartyId = inv.party_id || inv.customer_id || itemsObj.party_id || itemsObj.customer_id;

        if (!currentPartyId || !partyById.has(String(currentPartyId))) {
          const custNameUpper = (inv.customer_name || '').trim().toUpperCase();
          const matchedPartyId = partyByName.get(custNameUpper);
          if (matchedPartyId) {
            currentPartyId = matchedPartyId;
            itemsObj.party_id = matchedPartyId;
            itemsObj.customer_id = matchedPartyId;
            changed = true;
          }
        }

        if (Array.isArray(itemsObj.line_items)) {
          const updatedLines = itemsObj.line_items.map((line: any) => {
            if (!line.stock_item_id && !line.item_id) {
              const matchedStockId = stockByName.get((line.itemName || '').trim().toUpperCase());
              if (matchedStockId) {
                changed = true;
                return { ...line, stock_item_id: matchedStockId, item_id: matchedStockId };
              }
            }
            return line;
          });
          if (changed) itemsObj.line_items = updatedLines;
        }

        if (Array.isArray(itemsObj.duties_and_taxes)) {
          const updatedDuties = itemsObj.duties_and_taxes.map((duty: any) => {
            if (!duty.charge_id && !duty.id?.startsWith('ro_') && !duty.name?.includes('GST')) {
              const matchedChargeId = chargeByName.get((duty.name || '').trim().toUpperCase());
              if (matchedChargeId) {
                changed = true;
                return { ...duty, id: matchedChargeId, charge_id: matchedChargeId };
              }
            }
            return duty;
          });
          if (changed) itemsObj.duties_and_taxes = updatedDuties;
        }

        if (changed) {
          try {
            await supabase.from('sales_invoices').update({
              items: itemsObj,
              party_id: currentPartyId,
              customer_id: currentPartyId
            }).eq('id', inv.id);
          } catch {
            await supabase.from('sales_invoices').update({ items: itemsObj }).eq('id', inv.id);
          }
          migratedInvoices++;
        }
      }
    }

    // 2. Inspect purchase_bills
    const { data: purchaseData } = await supabase
      .from('purchase_bills')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_deleted', false);

    if (purchaseData && purchaseData.length > 0) {
      for (const bill of purchaseData) {
        let changed = false;
        const itemsObj = typeof bill.items === 'object' && bill.items !== null ? { ...bill.items } : {};
        let currentPartyId = bill.party_id || bill.vendor_id || itemsObj.party_id || itemsObj.vendor_id;

        if (!currentPartyId || !partyById.has(String(currentPartyId))) {
          const vendNameUpper = (bill.vendor_name || '').trim().toUpperCase();
          const matchedPartyId = partyByName.get(vendNameUpper);
          if (matchedPartyId) {
            currentPartyId = matchedPartyId;
            itemsObj.party_id = matchedPartyId;
            itemsObj.vendor_id = matchedPartyId;
            changed = true;
          }
        }

        if (Array.isArray(itemsObj.line_items)) {
          const updatedLines = itemsObj.line_items.map((line: any) => {
            if (!line.stock_item_id && !line.item_id) {
              const matchedStockId = stockByName.get((line.itemName || '').trim().toUpperCase());
              if (matchedStockId) {
                changed = true;
                return { ...line, stock_item_id: matchedStockId, item_id: matchedStockId };
              }
            }
            return line;
          });
          if (changed) itemsObj.line_items = updatedLines;
        }

        if (Array.isArray(itemsObj.duties_and_taxes)) {
          const updatedDuties = itemsObj.duties_and_taxes.map((duty: any) => {
            if (!duty.charge_id && !duty.id?.startsWith('ro_') && !duty.name?.includes('GST')) {
              const matchedChargeId = chargeByName.get((duty.name || '').trim().toUpperCase());
              if (matchedChargeId) {
                changed = true;
                return { ...duty, id: matchedChargeId, charge_id: matchedChargeId };
              }
            }
            return duty;
          });
          if (changed) itemsObj.duties_and_taxes = updatedDuties;
        }

        if (changed) {
          try {
            await supabase.from('purchase_bills').update({
              items: itemsObj,
              party_id: currentPartyId,
              vendor_id: currentPartyId
            }).eq('id', bill.id);
          } catch {
            await supabase.from('purchase_bills').update({ items: itemsObj }).eq('id', bill.id);
          }
          migratedBills++;
        }
      }
    }

    if (migratedInvoices > 0 || migratedBills > 0) {
      window.dispatchEvent(new Event('appSettingsChanged'));
      window.dispatchEvent(new Event('partiesUpdated'));
      window.dispatchEvent(new Event('stockUpdated'));
    }

    return { migratedInvoices, migratedBills };
  } catch (err) {
    console.error('Error in runHistoricalIdMigration:', err);
    return { migratedInvoices: 0, migratedBills: 0 };
  }
};

/**
 * Check if a transaction belongs to a given party using permanent ID first,
 * with safe fallback to legacy name comparison if no ID exists on the transaction.
 */
export const isTransactionForParty = (
  transaction: any,
  partyId: string,
  partyName?: string
): boolean => {
  if (!transaction || !partyId) return false;
  const pIdStr = String(partyId);
  const tPartyId = transaction.party_id ||
                   transaction.customer_id ||
                   transaction.vendor_id ||
                   transaction.items_raw?.party_id ||
                   transaction.items_raw?.customer_id ||
                   transaction.items_raw?.vendor_id ||
                   transaction.items?.party_id ||
                   transaction.items?.customer_id ||
                   transaction.items?.vendor_id;

  if (tPartyId) {
    return String(tPartyId) === pIdStr;
  }

  // Safe fallback for unmigrated legacy transactions
  if (partyName) {
    const pNameNorm = partyName.trim().toLowerCase();
    const cName = (transaction.customer_name || '').trim().toLowerCase();
    const vName = (transaction.vendor_name || '').trim().toLowerCase();
    return cName === pNameNorm || vName === pNameNorm;
  }

  return false;
};

/**
 * Check if a transaction line item belongs to a given stock item using permanent ID first,
 * with safe fallback to legacy item name comparison.
 */
export const isLineItemForStock = (
  lineItem: any,
  stockItemId: string,
  stockItemName?: string
): boolean => {
  if (!lineItem || !stockItemId) return false;
  const sIdStr = String(stockItemId);
  const lineStockId = lineItem.stock_item_id || lineItem.item_id;

  if (lineStockId) {
    return String(lineStockId) === sIdStr;
  }

  if (stockItemName) {
    return (lineItem.itemName || '').trim().toLowerCase() === stockItemName.trim().toLowerCase();
  }

  return false;
};
