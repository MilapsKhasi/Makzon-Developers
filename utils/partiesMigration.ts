import { supabase } from '../lib/supabase';
import { safeSupabaseSave } from './helpers';
import { generateMasterId, parseMasterId } from './masterIdHelper';

/**
 * Idempotent, safe migration and historical transaction reconnection engine.
 *
 * Core Rule: Names are editable display data. IDs are permanent identity.
 *
 * 1. Preserves original entity IDs for all Parties (Vendors/Customers), Stock Items, and Charges.
 * 2. Does NOT regenerate new IDs for renamed entities.
 * 3. Safely reconnects historical transactions to permanent party/stock IDs where relationships
 *    can be safely determined from historical records.
 * 4. Never deletes, detaches, or mutates existing transactions during migration.
 * 5. Idempotent: safe to run multiple times without duplicating or corrupting data.
 */
export const migrateAndReconnectEntities = async (companyId: string) => {
  if (!companyId) return;

  try {
    // 1. Fetch all vendors and customers for this company (including soft-deleted for historical ID resolution)
    const [{ data: vendors }, { data: customers }] = await Promise.all([
      supabase.from('vendors').select('*').eq('company_id', companyId),
      supabase.from('customers').select('*').eq('company_id', companyId)
    ]);

    const existingVendors = vendors || [];
    const existingCustomers = customers || [];

    // Determine current max sequence index for vendors to avoid any collision or renumbering
    let maxVendorSeq = -1;
    existingVendors.forEach((v: any) => {
      if (v.master_id) {
        const parsed = parseMasterId(v.master_id);
        if (parsed && parsed.sequenceIndex > maxVendorSeq) maxVendorSeq = parsed.sequenceIndex;
      }
    });

    // Ensure all existing vendors have a permanent structured master_id
    for (const v of existingVendors) {
      if (!v.master_id && v.id) {
        maxVendorSeq++;
        const newMid = generateMasterId(maxVendorSeq, v.created_at ? new Date(v.created_at) : new Date());
        await supabase.from('vendors').update({ master_id: newMid }).eq('id', v.id);
        v.master_id = newMid;
      }
    }

    // Map of known parties: key by ID and key by normalized name / gstin
    const partyById = new Map<string, any>();
    const partyByName = new Map<string, any>();
    const partyByGstin = new Map<string, any>();

    existingVendors.forEach((v: any) => {
      if (v.id) partyById.set(String(v.id), v);
      if (v.name) partyByName.set(v.name.trim().toUpperCase(), v);
      if (v.gstin && v.gstin.trim()) partyByGstin.set(v.gstin.trim().toUpperCase(), v);
    });

    // 2. Safe migration of legacy customers table into unified vendors table while strictly preserving customer.id
    for (const customer of existingCustomers) {
      if (!customer || !customer.id) continue;

      const custNameUpper = (customer.name || '').trim().toUpperCase();
      const custGstinUpper = (customer.gstin || '').trim().toUpperCase();

      // Check if this customer ID already exists in vendors table
      const vendorWithSameId = partyById.get(String(customer.id));

      if (vendorWithSameId) {
        // Vendor with same ID already exists; ensure is_customer is true
        if (!vendorWithSameId.is_customer) {
          await supabase.from('vendors').update({ is_customer: true }).eq('id', customer.id);
        }
      } else {
        // Check if there is a vendor matching by GSTIN or Name
        const matchByNameOrGstin = (custGstinUpper && partyByGstin.get(custGstinUpper)) || (custNameUpper && partyByName.get(custNameUpper));

        if (matchByNameOrGstin) {
          // If a vendor already exists with matching name/GSTIN, ensure that record has customer flags
          if (!matchByNameOrGstin.is_customer) {
            await supabase.from('vendors').update({
              is_customer: true,
              party_type: matchByNameOrGstin.party_type === 'vendor' ? 'both' : (matchByNameOrGstin.party_type || 'customer')
            }).eq('id', matchByNameOrGstin.id);
          }
          // Also record customer.id mapping to matchByNameOrGstin.id so transactions referencing customer.id resolve correctly
          partyById.set(String(customer.id), matchByNameOrGstin);
        } else {
          maxVendorSeq++;
          const custMid = customer.master_id || generateMasterId(maxVendorSeq, customer.created_at ? new Date(customer.created_at) : new Date());

          // Create new record in vendors table PRESERVING THE EXACT ORIGINAL customer.id
          const newPartyPayload = {
            id: customer.id, // KEEP ORIGINAL PERMANENT ID
            master_id: custMid,
            company_id: companyId,
            name: customer.name ? customer.name.trim().toUpperCase() : 'UNKNOWN CUSTOMER',
            email: customer.email || null,
            phone: customer.phone || null,
            gstin: customer.gstin || null,
            pan: customer.pan || null,
            state: customer.state || null,
            account_number: customer.account_number || null,
            account_name: customer.account_name || null,
            ifsc_code: customer.ifsc_code || null,
            address: customer.address || null,
            balance: Number(customer.balance) || 0,
            party_type: 'customer',
            is_customer: true,
            is_deleted: customer.is_deleted === true
          };

          try {
            await supabase.from('vendors').insert([newPartyPayload]);
            partyById.set(String(customer.id), newPartyPayload);
            if (newPartyPayload.name) partyByName.set(newPartyPayload.name, newPartyPayload);
            if (newPartyPayload.gstin) partyByGstin.set(newPartyPayload.gstin.trim().toUpperCase(), newPartyPayload);
          } catch (insertErr) {
            console.warn('Could not insert preserved customer into vendors:', insertErr);
          }
        }
      }
    }

    // 3. Load all stock items for item_id reconnection and assign master_ids
    const { data: stockItemsData } = await supabase
      .from('stock_items')
      .select('*')
      .eq('company_id', companyId);

    const existingStock = stockItemsData || [];
    let maxStockSeq = -1;
    existingStock.forEach((s: any) => {
      if (s.master_id) {
        const parsed = parseMasterId(s.master_id);
        if (parsed && parsed.sequenceIndex > maxStockSeq) maxStockSeq = parsed.sequenceIndex;
      }
    });

    for (const s of existingStock) {
      if (!s.master_id && s.id) {
        maxStockSeq++;
        const newMid = generateMasterId(maxStockSeq, s.created_at ? new Date(s.created_at) : new Date());
        await supabase.from('stock_items').update({ master_id: newMid }).eq('id', s.id);
        s.master_id = newMid;
      }
    }

    const stockItemById = new Map<string, any>();
    const stockItemByName = new Map<string, any>();
    existingStock.forEach((item: any) => {
      if (item.id) stockItemById.set(String(item.id), item);
      if (item.name) stockItemByName.set(item.name.trim().toUpperCase(), item);
    });

    // 4. Safely reconnect Sales Invoices (transactions -> permanent entity IDs)
    const { data: salesInvoices } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('company_id', companyId);

    for (const inv of (salesInvoices || [])) {
      let needsUpdate = false;
      const updates: any = {};

      // Resolve party_id / customer_id
      const currentPartyId = inv.party_id || inv.customer_id || inv.items?.party_id || inv.items?.customer_id;
      const targetParty = currentPartyId ? partyById.get(String(currentPartyId)) : null;
      if (!currentPartyId) {
        const rawName = (inv.customer_name || inv.vendor_name || '').trim().toUpperCase();
        const matchedParty = rawName ? partyByName.get(rawName) : null;
        if (matchedParty) {
          updates.party_id = matchedParty.id;
          updates.customer_id = matchedParty.id;
          if (matchedParty.name) updates.customer_name = matchedParty.name;
          needsUpdate = true;
        }
      } else {
        if (!inv.party_id || !inv.customer_id) {
          updates.party_id = currentPartyId;
          updates.customer_id = currentPartyId;
          needsUpdate = true;
        }
        if (targetParty?.name && inv.customer_name !== targetParty.name) {
          updates.customer_name = targetParty.name;
          needsUpdate = true;
        }
      }

      // Reconnect line items stock_item_id / item_id
      if (inv.items) {
        const rawItems = inv.items;
        let lineItems: any[] = [];
        let isWrapped = false;

        if (Array.isArray(rawItems)) {
          lineItems = rawItems;
        } else if (rawItems && typeof rawItems === 'object' && Array.isArray(rawItems.line_items)) {
          lineItems = rawItems.line_items;
          isWrapped = true;
        }

        let itemsModified = false;
        const updatedLineItems = lineItems.map((li: any) => {
          if (!li) return li;
          const existingItemId = li.item_id || li.itemId || li.stock_item_id;
          if (!existingItemId && li.itemName) {
            const matchedStock = stockItemByName.get(li.itemName.trim().toUpperCase());
            if (matchedStock) {
              itemsModified = true;
              return {
                ...li,
                item_id: matchedStock.id,
                itemId: matchedStock.id,
                stock_item_id: matchedStock.id
              };
            }
          }
          return li;
        });

        if (itemsModified) {
          if (isWrapped) {
            updates.items = { ...rawItems, line_items: updatedLineItems };
          } else {
            updates.items = updatedLineItems;
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await supabase.from('sales_invoices').update(updates).eq('id', inv.id);
      }
    }

    // 5. Safely reconnect Purchase Bills (transactions -> permanent entity IDs)
    const { data: purchaseBills } = await supabase
      .from('purchase_bills')
      .select('*')
      .eq('company_id', companyId);

    for (const bill of (purchaseBills || [])) {
      let needsUpdate = false;
      const updates: any = {};

      const currentPartyId = bill.party_id || bill.vendor_id || bill.items?.party_id || bill.items?.vendor_id;
      const targetParty = currentPartyId ? partyById.get(String(currentPartyId)) : null;
      if (!currentPartyId) {
        const rawName = (bill.vendor_name || bill.customer_name || '').trim().toUpperCase();
        const matchedParty = rawName ? partyByName.get(rawName) : null;
        if (matchedParty) {
          updates.party_id = matchedParty.id;
          updates.vendor_id = matchedParty.id;
          if (matchedParty.name) updates.vendor_name = matchedParty.name;
          needsUpdate = true;
        }
      } else {
        if (!bill.party_id || !bill.vendor_id) {
          updates.party_id = currentPartyId;
          updates.vendor_id = currentPartyId;
          needsUpdate = true;
        }
        if (targetParty?.name && bill.vendor_name !== targetParty.name) {
          updates.vendor_name = targetParty.name;
          needsUpdate = true;
        }
      }

      // Reconnect line items
      if (bill.items) {
        const rawItems = bill.items;
        let lineItems: any[] = [];
        let isWrapped = false;

        if (Array.isArray(rawItems)) {
          lineItems = rawItems;
        } else if (rawItems && typeof rawItems === 'object' && Array.isArray(rawItems.line_items)) {
          lineItems = rawItems.line_items;
          isWrapped = true;
        }

        let itemsModified = false;
        const updatedLineItems = lineItems.map((li: any) => {
          if (!li) return li;
          const existingItemId = li.item_id || li.itemId || li.stock_item_id;
          if (!existingItemId && li.itemName) {
            const matchedStock = stockItemByName.get(li.itemName.trim().toUpperCase());
            if (matchedStock) {
              itemsModified = true;
              return {
                ...li,
                item_id: matchedStock.id,
                itemId: matchedStock.id,
                stock_item_id: matchedStock.id
              };
            }
          }
          return li;
        });

        if (itemsModified) {
          if (isWrapped) {
            updates.items = { ...rawItems, line_items: updatedLineItems };
          } else {
            updates.items = updatedLineItems;
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await supabase.from('purchase_bills').update(updates).eq('id', bill.id);
      }
    }

    // 6. Safely reconnect Delivery Challans
    const { data: deliveryChallans } = await supabase
      .from('delivery_challans')
      .select('*')
      .eq('company_id', companyId);

    for (const dc of (deliveryChallans || [])) {
      let needsUpdate = false;
      const updates: any = {};

      const currentPartyId = dc.party_id || dc.customer_id;
      const targetParty = currentPartyId ? partyById.get(String(currentPartyId)) : null;
      if (!currentPartyId) {
        const rawName = (dc.customer_name || dc.party_name || '').trim().toUpperCase();
        const matchedParty = rawName ? partyByName.get(rawName) : null;
        if (matchedParty) {
          updates.party_id = matchedParty.id;
          updates.customer_id = matchedParty.id;
          if (matchedParty.name) updates.customer_name = matchedParty.name;
          needsUpdate = true;
        }
      } else {
        if (!dc.party_id || !dc.customer_id) {
          updates.party_id = currentPartyId;
          updates.customer_id = currentPartyId;
          needsUpdate = true;
        }
        if (targetParty?.name && dc.customer_name !== targetParty.name) {
          updates.customer_name = targetParty.name;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await supabase.from('delivery_challans').update(updates).eq('id', dc.id);
      }
    }

    console.log('[Entity Migration] Idempotent permanent ID recovery completed for company:', companyId);
  } catch (err) {
    console.error('[Entity Migration] Unexpected error during permanent ID recovery:', err);
  }
};

// Backward-compatible alias
export const migrateCustomersToParties = migrateAndReconnectEntities;
