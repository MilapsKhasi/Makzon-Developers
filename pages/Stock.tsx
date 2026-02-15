import React, { useState, useEffect, useMemo } from 'react';
import { Search, History, Trash2, Edit, Package, Maximize2, Minimize2, Plus, TrendingUp, TrendingDown, Layers, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { getActiveCompanyId, formatDate, normalizeBill } from '../utils/helpers';
import Modal from '../components/Modal';
import StockForm from '../components/StockForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const Stock = () => {
  const [items, setItems] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; item: any | null }>({
    isOpen: false,
    item: null
  });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;
    try {
      const { data: stockItems } = await supabase
        .from('stock_items')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('name', { ascending: true });
      
      const [{ data: purchaseData }, { data: saleData }] = await Promise.all([
        supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false),
        supabase.from('sales_invoices').select('*').eq('company_id', cid).eq('is_deleted', false)
      ]);
      
      const normalizedVouchers = [
        ...(purchaseData || []).map(normalizeBill),
        ...(saleData || []).map(normalizeBill)
      ];

      setItems(stockItems || []);
      setVouchers(normalizedVouchers);
      
      if (stockItems && stockItems.length > 0 && !selectedId) {
        setSelectedId(String(stockItems[0].id));
      }
    } catch (err) {
      console.error("Stock load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, []);

  const handleSaveItem = async (itemData: any) => {
    const cid = getActiveCompanyId();
    if (editingItem) await supabase.from('stock_items').update({ ...itemData }).eq('id', editingItem.id);
    else await supabase.from('stock_items').insert([{ ...itemData, company_id: cid }]);
    loadData(); setIsModalOpen(false); setEditingItem(null);
  };

  const confirmDelete = async () => {
    if (!deleteDialog.item) return;
    await supabase.from('stock_items').update({ is_deleted: true }).eq('id', deleteDialog.item.id);
    loadData(); if (selectedId === String(deleteDialog.item.id)) setSelectedId(null);
  };

  const selectedItem = items.find(i => String(i.id) === String(selectedId));

  const itemStats = useMemo(() => {
    if (!selectedItem) return null;
    const transactions: any[] = [];
    let inwardTotal = 0;
    let outwardTotal = 0;
    
    vouchers.forEach(v => {
      v.items?.forEach((it: any) => {
        if (it.itemName?.trim().toLowerCase() === selectedItem.name?.trim().toLowerCase()) {
          const isPurchase = v.type === 'Purchase';
          const qty = Number(it.qty || 0);
          transactions.push({ 
            date: v.date, 
            docNo: v.bill_number || v.invoice_number, 
            party: v.vendor_name || v.customer_name, 
            qty: qty, 
            type: v.type 
          });
          if (isPurchase) inwardTotal += qty;
          else outwardTotal += qty;
        }
      });
    });

    const stockBalance = (Number(selectedItem.in_stock) || 0) + inwardTotal - outwardTotal;

    return { 
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
      inwardTotal,
      outwardTotal,
      stockBalance
    };
  }, [selectedItem, vouchers]);

  const filteredItems = items.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? "Edit Stock Master" : "Add New Stock Item"}>
        <StockForm initialData={editingItem} onSubmit={handleSaveItem} onCancel={() => { setIsModalOpen(false); setEditingItem(null); }} />
      </Modal>
      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, item: null })} onConfirm={confirmDelete} title="Delete Stock Item" message={`Are you sure you want to remove "${deleteDialog.item?.name}" from master?`} />
      
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-[20px] font-medium text-slate-900 capitalize">Inventory Control</h1>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-primary text-slate-900 px-8 py-2 rounded-md font-medium text-sm hover:bg-primary-dark transition-all capitalize flex items-center shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> New Sku Item
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        {!isFullScreen && (
          <div className="w-80 flex flex-col space-y-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter items..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-primary" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredItems.map((item) => {
                let inward = 0; let outward = 0;
                vouchers.forEach(v => { v.items?.forEach((it: any) => {
                  if (it.itemName?.toLowerCase() === item.name?.toLowerCase()) {
                    if (v.type === 'Purchase') inward += Number(it.qty || 0);
                    else outward += Number(it.qty || 0);
                  }
                });});
                const currentBalance = (Number(item.in_stock) || 0) + inward - outward;
                const isSelected = String(selectedId) === String(item.id);

                return (
                  <div key={item.id} onClick={() => setSelectedId(String(item.id))} className={`p-4 border rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-primary border-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <h3 className={`font-medium capitalize text-[11px] truncate mb-1 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{item.name}</h3>
                      <div className="flex justify-between items-end">
                          <span className="text-[10px] font-medium text-slate-400 capitalize tracking-tighter">Hsn: {item.hsn || 'N/A'}</span>
                          <span className={`font-mono text-lg font-medium leading-none ${isSelected ? 'text-slate-900' : 'text-slate-900'}`}>
                              {currentBalance.toFixed(0)} <span className="text-[10px] opacity-60 font-sans">{item.unit || 'PCS'}</span>
                          </span>
                      </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden ${isFullScreen ? 'fixed inset-4 z-[500] m-0 shadow-2xl' : ''}`}>
          {selectedItem && itemStats ? (
            <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm">
                    <Package className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-slate-900 capitalize tracking-tight">{selectedItem.name}</h2>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[9px] font-medium text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded capitalize">Hsn {selectedItem.hsn || 'N/A'}</span>
                      <span className="text-[9px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded capitalize">Sku {selectedItem.sku || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2.5 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-slate-900 shadow-sm">{isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                  <button onClick={() => { setEditingItem(selectedItem); setIsModalOpen(true); }} className="p-2.5 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-slate-900 shadow-sm"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteDialog({ isOpen: true, item: selectedItem })} className="p-2.5 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-rose-500 shadow-sm"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white text-slate-900 p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[9px] font-medium text-slate-400 capitalize tracking-widest mb-1">Current Balance</p>
                      <p className="text-3xl font-medium font-mono text-primary-dark">{itemStats.stockBalance.toFixed(0)} <span className="text-xs font-normal opacity-50">{selectedItem.unit}</span></p>
                  </div>
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
                      <p className="text-[9px] font-medium text-slate-400 capitalize tracking-widest mb-1">Purchased (Inward)</p>
                      <div className="flex items-center text-emerald-600">
                        <ArrowDownLeft className="w-4 h-4 mr-1" />
                        <p className="text-2xl font-medium font-mono">{itemStats.inwardTotal.toFixed(0)}</p>
                      </div>
                  </div>
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
                      <p className="text-[9px] font-medium text-slate-400 capitalize tracking-widest mb-1">Sold (Outward)</p>
                      <div className="flex items-center text-rose-600">
                        <ArrowUpRight className="w-4 h-4 mr-1" />
                        <p className="text-2xl font-medium font-mono">{itemStats.outwardTotal.toFixed(0)}</p>
                      </div>
                  </div>
                  <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
                      <p className="text-[9px] font-medium text-slate-400 capitalize tracking-widest mb-1">Standard Cost</p>
                      <p className="text-2xl font-medium text-slate-900 font-mono">₹{selectedItem.rate || 0}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[11px] font-medium text-slate-400 capitalize tracking-widest flex items-center">
                      <History className="w-4 h-4 mr-2" /> Stock Movement Log
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <table className="clean-table">
                      <thead>
                          <tr>
                              <th className="font-medium capitalize">Date</th>
                              <th className="font-medium capitalize">Voucher #</th>
                              <th className="font-medium capitalize">Type</th>
                              <th className="font-medium capitalize">Party</th>
                              <th className="text-right font-medium capitalize">Quantity</th>
                          </tr>
                      </thead>
                      <tbody>
                          {itemStats.transactions.map((t, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-none">
                                  <td className="text-slate-500">{formatDate(t.date)}</td>
                                  <td className="font-mono font-medium text-slate-900">{t.docNo}</td>
                                  <td>
                                      <span className={`text-[9px] font-medium capitalize px-2 py-0.5 rounded-sm ${t.type === 'Sale' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>
                                          {t.type}
                                      </span>
                                  </td>
                                  <td className="capitalize font-medium text-slate-700 truncate max-w-[200px]">{t.party}</td>
                                  <td className={`text-right font-medium font-mono ${t.type === 'Purchase' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {t.type === 'Purchase' ? '+' : '-'}{t.qty}
                                  </td>
                              </tr>
                          ))}
                          {itemStats.transactions.length === 0 && (
                              <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic">No inventory activity for this SKU.</td></tr>
                          )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 italic py-20">
                <Layers className="w-16 h-16 opacity-5 mb-4" />
                <p className="text-sm font-medium">Select an item to view detailed analytics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Stock;