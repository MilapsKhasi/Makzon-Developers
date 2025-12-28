
import React, { useState, useEffect, useMemo } from 'react';
import { Search, History, Trash2, Edit, Package, Maximize2, Minimize2, Loader2, RefreshCw, Plus } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, formatDate } from '../utils/helpers';
import Modal from '../components/Modal';
import StockForm from '../components/StockForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const InfoCard = ({ label, value, desc }: { label: string, value: string | number, desc?: string }) => (
  <div className="bg-white p-8 border border-slate-200 rounded-2xl boxy-shadow hover:border-slate-300 transition-all flex flex-col justify-between h-full">
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-900 truncate tracking-tight">{value}</p>
    </div>
    {desc && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 truncate">{desc}</p>}
  </div>
);

const Stock = () => {
  const [items, setItems] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; item: any | null }>({
    isOpen: false,
    item: null
  });

  const loadData = async (shouldSync = false) => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    const { data: stockItems } = await supabase.from('stock_items').select('*').eq('company_id', cid).eq('is_deleted', false).order('name', { ascending: true });
    const { data: voucherData } = await supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false);

    setItems(stockItems || []);
    setVouchers(voucherData || []);
    
    if (stockItems && stockItems.length > 0 && !selectedId) setSelectedId(String(stockItems[0].id));
    setLoading(false);
  };

  useEffect(() => {
    loadData(true); 
    const handleGlobalUpdate = () => loadData(true);
    window.addEventListener('appSettingsChanged', handleGlobalUpdate);
    return () => window.removeEventListener('appSettingsChanged', handleGlobalUpdate);
  }, []);

  const handleSaveItem = async (itemData: any) => {
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (editingItem) await supabase.from('stock_items').update({ ...itemData }).eq('id', editingItem.id);
    else await supabase.from('stock_items').insert([{ ...itemData, company_id: cid, user_id: user?.id }]);
    loadData(false); setIsModalOpen(false); setEditingItem(null);
  };

  const confirmDelete = async () => {
    if (!deleteDialog.item) return;
    await supabase.from('stock_items').update({ is_deleted: true }).eq('id', deleteDialog.item.id);
    loadData(false); if (selectedId === String(deleteDialog.item.id)) setSelectedId(null);
    window.dispatchEvent(new Event('appSettingsChanged'));
  };

  const selectedItem = items.find(i => String(i.id) === String(selectedId));

  const itemStats = useMemo(() => {
    if (!selectedItem) return null;
    
    const transactions: any[] = [];
    let totalQtyPurchased = 0;
    let totalQtySold = 0;

    vouchers.forEach(v => {
      v.items?.forEach((it: any) => {
        if (it.itemName?.trim().toLowerCase() === selectedItem.name?.trim().toLowerCase()) {
          const type = v.type === 'Sale' ? 'Sale' : 'Purchase';
          transactions.push({ 
              date: v.date, 
              docNo: v.bill_number, 
              party: v.vendor_name, 
              qty: it.qty, 
              rate: it.rate, 
              total: it.amount, 
              type 
          });
          if (type === 'Purchase') totalQtyPurchased += Number(it.qty || 0);
          else totalQtySold += Number(it.qty || 0);
        }
      });
    });

    return {
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalQtyPurchased,
      totalQtySold,
      stockBalance: (selectedItem.in_stock || 0) + totalQtyPurchased - totalQtySold
    };
  }, [selectedItem, vouchers]);

  const filteredItems = items.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? "Edit Stock Item" : "Create New Stock Item"}>
        <StockForm initialData={editingItem} onSubmit={handleSaveItem} onCancel={() => { setIsModalOpen(false); setEditingItem(null); }} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, item: null })} onConfirm={confirmDelete} title="Delete Stock Item" message={`Delete item "${deleteDialog.item?.name}"?`} />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Stock Management</h1>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }} 
          className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark transition-none"
        >
          NEW ITEM
        </button>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search items..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none" />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0 relative">
          {!isFullScreen && (
            <div className="w-64 space-y-2 overflow-y-auto shrink-0 pr-2 pb-4 custom-scrollbar">
              {filteredItems.map((item) => (
                <div key={item.id} onClick={() => setSelectedId(String(item.id))} className={`p-4 border rounded-md cursor-pointer transition-none ${String(selectedId) === String(item.id) ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                  <h3 className="font-normal text-slate-900 uppercase text-[12px] truncate mb-1">{item.name}</h3>
                  <div className="flex justify-between items-center text-[10px] font-normal text-slate-400 uppercase tracking-tight"><p>In Stock</p><p className="text-slate-900 font-mono">{item.in_stock || 0}</p></div>
                </div>
              ))}
            </div>
          )}

          <div className={`flex-1 bg-white border border-slate-200 rounded-md p-8 flex flex-col overflow-y-auto min-w-0 transition-none`}>
            {selectedItem && itemStats ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                  <div><h2 className="text-2xl font-normal text-slate-900 uppercase tracking-tight mb-2">{selectedItem.name}</h2><p className="text-[10px] font-mono font-normal text-slate-400 bg-slate-50 px-3 py-1 rounded border border-slate-100 inline-block">{selectedItem.sku || 'N/A'}</p></div>
                  <div className="flex space-x-2">
                    <button onClick={() => { setEditingItem(selectedItem); setIsModalOpen(true); }} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-none"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteDialog({ isOpen: true, item: selectedItem })} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-red-500 transition-none"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-none">{isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-6 rounded-md border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Total Inward</p>
                    <p className="text-xl font-normal text-slate-900">{itemStats.totalQtyPurchased} {selectedItem.unit}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-md border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Total Outward</p>
                    <p className="text-xl font-normal text-slate-900">{itemStats.totalQtySold} {selectedItem.unit}</p>
                  </div>
                  <div className="bg-primary/10 p-6 rounded-md border border-primary/20">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Current Inventory</p>
                    <p className="text-xl font-bold text-slate-900">{itemStats.stockBalance} {selectedItem.unit}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><History className="w-4 h-4 mr-2 text-slate-300" /> Movement Register</p>
                  <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                      <table className="clean-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Voucher</th>
                            <th>Type</th>
                            <th>Party</th>
                            <th className="text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemStats.transactions.map((t, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(t.date)}</td>
                              <td className="font-mono">{t.docNo}</td>
                              <td><span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase ${t.type === 'Purchase' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{t.type}</span></td>
                              <td className="uppercase">{t.party}</td>
                              <td className={`text-right font-bold font-mono ${t.type === 'Purchase' ? 'text-green-600' : 'text-blue-600'}`}>{t.type === 'Purchase' ? '+' : '-'}{t.qty}</td>
                            </tr>
                          ))}
                          {itemStats.transactions.length === 0 && (
                            <tr><td colSpan={5} className="py-10 text-center text-slate-400 italic">No movements recorded.</td></tr>
                          )}
                        </tbody>
                      </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 italic py-20"><Package className="w-16 h-16 opacity-5 mb-4" /><p>Select a product to view inward/outward movement.</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
