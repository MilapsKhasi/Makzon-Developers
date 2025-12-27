
import React, { useState, useEffect, useMemo } from 'react';
import { Search, History, Trash2, Edit, Package, Maximize2, Minimize2, Loader2, RefreshCw, AlertCircle, Plus } from 'lucide-react';
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
  const [bills, setBills] = useState<any[]>([]);
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

    const { data: stockItems } = await supabase
      .from('stock_items')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false)
      .order('name', { ascending: true });

    const { data: purchaseBills } = await supabase
      .from('bills')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false);

    setItems(stockItems || []);
    setBills(purchaseBills || []);
    
    if (stockItems && stockItems.length > 0 && !selectedId) {
      setSelectedId(String(stockItems[0].id));
    }

    setLoading(false);

    if (shouldSync && purchaseBills && stockItems) {
      await performBackgroundSync(purchaseBills, stockItems);
    }
  };

  const performBackgroundSync = async (billData: any[], masterData: any[]) => {
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !cid) return;

    const existingNames = new Set(masterData.map(i => i.name.toLowerCase().trim()));
    const discoveredItems: any[] = [];
    const localProcessed = new Set<string>();

    billData.forEach(bill => {
      if (Array.isArray(bill.items)) {
        bill.items.forEach((it: any) => {
          const name = it.itemName?.trim();
          if (name && !existingNames.has(name.toLowerCase()) && !localProcessed.has(name.toLowerCase())) {
            discoveredItems.push({
              company_id: cid,
              user_id: user.id,
              name: name,
              sku: `AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
              unit: it.unit || 'PCS',
              rate: Number(it.rate) || 0,
              hsn: it.hsnCode || '',
              in_stock: 0,
              is_deleted: false
            });
            localProcessed.add(name.toLowerCase());
          }
        });
      }
    });

    if (discoveredItems.length > 0) {
      const { error } = await supabase.from('stock_items').insert(discoveredItems);
      if (!error) {
        const { data: updatedStock } = await supabase
          .from('stock_items')
          .select('*')
          .eq('company_id', cid)
          .eq('is_deleted', false)
          .order('name', { ascending: true });
        if (updatedStock) setItems(updatedStock);
      }
    }
  };

  useEffect(() => {
    loadData(true); 
    const handleGlobalUpdate = () => loadData(true);
    window.addEventListener('appSettingsChanged', handleGlobalUpdate);
    return () => window.removeEventListener('appSettingsChanged', handleGlobalUpdate);
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    await loadData(true);
    setSyncing(false);
    alert("Discovery Complete: Stock list synchronized with all historical purchase records.");
  };

  const handleSaveItem = async (itemData: any) => {
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (editingItem) {
      await supabase.from('stock_items').update({ ...itemData }).eq('id', editingItem.id);
    } else {
      await supabase.from('stock_items').insert([{ ...itemData, company_id: cid, user_id: user?.id }]);
    }
    
    loadData(false);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const confirmDelete = async () => {
    if (!deleteDialog.item) return;
    
    const { error } = await supabase
      .from('stock_items')
      .update({ is_deleted: true })
      .eq('id', deleteDialog.item.id);
    
    if (error) {
      alert('Error deleting item: ' + error.message);
    } else {
      loadData(false);
      if (selectedId === String(deleteDialog.item.id)) setSelectedId(null);
      window.dispatchEvent(new Event('appSettingsChanged'));
    }
  };

  const selectedItem = items.find(i => String(i.id) === String(selectedId));

  const itemStats = useMemo(() => {
    if (!selectedItem) return null;
    
    const transactions: any[] = [];
    let totalQtyPurchased = 0;
    let totalValuePurchased = 0;
    const vendors = new Set<string>();

    bills.forEach(bill => {
      if (bill.items) {
        bill.items.forEach((it: any) => {
          if (it.itemName?.trim().toLowerCase() === selectedItem.name?.trim().toLowerCase()) {
            transactions.push({
              date: bill.date,
              billNo: bill.bill_number,
              vendor: bill.vendor_name,
              qty: it.qty,
              rate: it.rate,
              total: it.amount
            });
            totalQtyPurchased += Number(it.qty || 0);
            totalValuePurchased += Number(it.amount || 0);
            vendors.add(bill.vendor_name);
          }
        });
      }
    });

    return {
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalQtyPurchased,
      totalValuePurchased,
      vendorCount: vendors.size,
      mainVendor: Array.from(vendors)[0] || 'N/A'
    };
  }, [selectedItem, bills]);

  const filteredItems = items.filter(i => 
    i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10 h-full flex flex-col animate-in fade-in duration-500">
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? "Edit Stock Item" : "Create New Stock Item"}>
        <StockForm initialData={editingItem} onSubmit={handleSaveItem} onCancel={() => { setIsModalOpen(false); setEditingItem(null); }} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, item: null })}
        onConfirm={confirmDelete}
        title="Delete Stock Item"
        message={`Delete item "${deleteDialog.item?.name}"? You can restore it from settings.`}
      />

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">Stock Management</h1>
          <p className="text-slate-500 font-medium text-sm">Inventory master ledger and cloud-synced stock movement analytics.</p>
        </div>
        <div className="flex items-center space-x-4">
            <button 
                onClick={handleManualSync} 
                disabled={syncing}
                className="flex items-center space-x-2 px-6 py-3 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-500 bg-white hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
            >
                {syncing || loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Deep Sync History</span>
            </button>
            <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-primary text-slate-900 px-8 py-3 rounded-lg font-bold text-sm border border-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 flex items-center">
                <Plus className="w-4.5 h-4.5 mr-2" /> Create New Item
            </button>
        </div>
      </div>

      <div className="relative shrink-0 mb-6">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items by name, SKU, or HSN Code..." 
          className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-xl text-base outline-none focus:border-slate-400 shadow-sm transition-all font-medium" 
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 flex gap-8 overflow-hidden min-h-0 relative">
          {!isFullScreen && (
            <div className="w-80 space-y-4 overflow-y-auto shrink-0 pr-2 pb-4 custom-scrollbar">
              {filteredItems.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => setSelectedId(String(item.id))}
                  className={`p-5 border rounded-xl cursor-pointer transition-all relative group shadow-sm ${
                    String(selectedId) === String(item.id) ? 'bg-slate-100 border-slate-400' : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2 pr-8">
                    <h3 className="font-bold text-slate-900 uppercase text-[12px] truncate leading-tight">{item.name}</h3>
                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-mono font-bold text-slate-600">{item.sku}</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 mb-5 font-mono uppercase tracking-tighter">RATE: {formatCurrency(item.rate)} / {item.unit || 'UNIT'}</p>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-widest">
                    <div className="bg-white/50 p-3 rounded-lg border border-slate-100 shadow-inner">
                      <p className="text-slate-400 mb-1 leading-none">In Stock</p>
                      <p className="text-slate-900 text-base font-mono">{item.in_stock || 0}</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg border border-slate-100 shadow-inner">
                      <p className="text-slate-400 mb-1 leading-none">Valuation</p>
                      <p className="text-primary-dark text-sm font-mono">{formatCurrency((item.in_stock || 0) * (item.rate || 0))}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm"><Edit className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteDialog({ isOpen: true, item }); }} className="p-2 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-lg shadow-sm"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="text-center py-20 text-slate-300 italic text-base">
                   {searchQuery ? "No matching products found." : "No stock items registered in master."}
                </div>
              )}
            </div>
          )}

          <div className={`flex-1 bg-white border border-slate-200 rounded-2xl p-10 flex flex-col boxy-shadow overflow-y-auto min-w-0 transition-all duration-300`}>
            {selectedItem && itemStats ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-start border-b border-slate-100 pb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight mb-4 leading-none">{selectedItem.name}</h2>
                    <div className="flex items-center space-x-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{selectedItem.category || 'Product Master'}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{selectedItem.sku || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-slate-900 transition-all shadow-sm bg-white hover:bg-slate-50">
                      {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button onClick={() => { setEditingItem(selectedItem); setIsModalOpen(true); }} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-slate-900 transition-all shadow-sm bg-white hover:bg-slate-50"><Edit className="w-5 h-5" /></button>
                    <button onClick={() => setDeleteDialog({ isOpen: true, item: selectedItem })} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-red-500 transition-all shadow-sm bg-white hover:bg-slate-50"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                  <InfoCard label="Total Procured" value={`${itemStats.totalQtyPurchased} ${selectedItem.unit}`} desc="From Vouchers" />
                  <InfoCard label="Current Stock" value={`${selectedItem.in_stock || 0} ${selectedItem.unit}`} desc="In Hand" />
                  <InfoCard label="Asset Value" value={formatCurrency((selectedItem.in_stock || 0) * (selectedItem.rate || 0))} desc="Valuation" />
                  <InfoCard label="Avg Unit Price" value={formatCurrency(itemStats.totalQtyPurchased > 0 ? itemStats.totalValuePurchased / itemStats.totalQtyPurchased : selectedItem.rate)} desc="Landed Cost" />
                  <InfoCard label="Vendors" value={itemStats.vendorCount} desc="Sources" />
                  <InfoCard label="Top Supplier" value={itemStats.mainVendor} desc="Primary" />
                </div>

                <div className="space-y-6 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><History className="w-4 h-4 mr-2.5 text-slate-300" /> Stock Movement History</h3>
                  </div>
                  
                  <div className="border border-slate-200 rounded-2xl overflow-hidden boxy-shadow bg-white custom-scrollbar">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm table-auto border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                            <th className="py-4 px-8 border-r border-slate-200">Date</th>
                            <th className="py-4 px-8 border-r border-slate-200">Voucher No</th>
                            <th className="py-4 px-8 border-r border-slate-200">Supplier / Vendor</th>
                            <th className="py-4 px-8 text-right border-r border-slate-200">Quantity</th>
                            <th className="py-4 px-8 text-right border-r border-slate-200">Unit Rate</th>
                            <th className="py-4 px-8 text-right font-bold">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemStats.transactions.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-8 text-slate-600 border-r border-slate-100 font-bold">{formatDate(t.date)}</td>
                              <td className="py-4 px-8 font-mono font-bold text-slate-900 border-r border-slate-100">{t.billNo}</td>
                              <td className="py-4 px-8 uppercase font-bold text-slate-700 border-r border-slate-100 truncate max-w-[200px]">{t.vendor}</td>
                              <td className="py-4 px-8 text-right border-r border-slate-100 font-mono">{t.qty}</td>
                              <td className="py-4 px-8 text-right border-r border-slate-100 font-mono">{formatCurrency(t.rate)}</td>
                              <td className="py-4 px-8 text-right font-bold text-slate-900 font-mono">{formatCurrency(t.total)}</td>
                            </tr>
                          ))}
                          {itemStats.transactions.length === 0 && <tr><td colSpan={6} className="py-32 text-center text-slate-300 italic text-base">No movement history records found.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-base py-24">
                <Package className="w-20 h-20 opacity-5 mb-6" />
                <p className="font-medium">Select a product from the stock list to visualize historical procurement analytics.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
