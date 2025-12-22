
import React, { useState, useEffect, useMemo } from 'react';
import { Search, History, Trash2, Edit, Package, Maximize2, Minimize2, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { getActiveCompanyId, formatCurrency, formatDate } from '../utils/helpers';
import Modal from '../components/Modal';
import StockForm from '../components/StockForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const InfoCard = ({ label, value, desc }: { label: string, value: string | number, desc?: string }) => (
  <div className="bg-white p-6 border border-slate-200 rounded-md boxy-shadow hover:border-slate-300 transition-all flex flex-col justify-between">
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-900 truncate">{value}</p>
    </div>
    {desc && <p className="text-[9px] text-slate-400 font-medium mt-2 truncate">{desc}</p>}
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

    // Load actual stock items
    const { data: stockItems } = await supabase
      .from('stock_items')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false)
      .order('name', { ascending: true });

    // Load all bills for cross-reference (to find missing items)
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

    // If initial load or forced, run the invisible background sync
    if (shouldSync && purchaseBills && stockItems) {
      performBackgroundSync(purchaseBills, stockItems);
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
              sku: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
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
      console.log(`Auto-sync: Discovered ${discoveredItems.length} missing items from bills.`);
      await supabase.from('stock_items').insert(discoveredItems);
      // Silently reload to show the newly discovered items
      const { data: updatedStock } = await supabase
        .from('stock_items')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('name', { ascending: true });
      if (updatedStock) setItems(updatedStock);
    }
  };

  useEffect(() => {
    loadData(true); // Sync on initial load
    window.addEventListener('appSettingsChanged', () => loadData(true));
    return () => window.removeEventListener('appSettingsChanged', () => loadData(true));
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    await loadData(true);
    setSyncing(false);
    alert("Stock list synchronized with all purchase records.");
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
    <div className="space-y-8 h-full flex flex-col">
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? "Edit Item" : "New Item"}>
        <StockForm initialData={editingItem} onSubmit={handleSaveItem} onCancel={() => { setIsModalOpen(false); setEditingItem(null); }} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, item: null })}
        onConfirm={confirmDelete}
        title="Delete Stock Item"
        message={`Delete item "${deleteDialog.item?.name}"? You can restore it from settings.`}
      />

      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Stock Management</h1>
        <div className="flex items-center space-x-2">
            <button 
                onClick={handleManualSync} 
                disabled={syncing}
                className="flex items-center space-x-2 px-4 py-2 border border-slate-200 rounded-md text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
                {syncing || loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Refresh & Sync</span>
            </button>
            <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-primary text-slate-800 px-5 py-2 rounded-md font-bold text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-primary-dark transition-all shadow-sm active:scale-95">Add New Item</button>
        </div>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search product master..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 shadow-sm transition-all" 
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 flex gap-8 overflow-hidden min-h-0 relative">
          {!isFullScreen && (
            <div className="w-80 space-y-4 overflow-y-auto shrink-0 pr-2 pb-4">
              {filteredItems.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => setSelectedId(String(item.id))}
                  className={`p-4 border rounded-md cursor-pointer transition-all relative group ${
                    String(selectedId) === String(item.id) ? 'bg-slate-100 border-slate-400 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1 pr-6">
                    <h3 className="font-semibold text-slate-900 uppercase text-[11px] truncate">{item.name}</h3>
                    <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-600">{item.sku}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-4 font-mono">RATE: {formatCurrency(item.rate)} / {item.unit || 'UNIT'}</p>
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-tight">
                    <div className="bg-white/50 p-2 rounded border border-slate-100">
                      <p className="text-slate-400 mb-0.5">Quantity</p>
                      <p className="text-slate-900 text-sm">{item.in_stock || 0} {item.unit || 'PCS'}</p>
                    </div>
                    <div className="bg-white/50 p-2 rounded border border-slate-100">
                      <p className="text-slate-400 mb-0.5">Inventory Val</p>
                      <p className="text-primary-dark text-sm">{formatCurrency((item.in_stock || 0) * (item.rate || 0))}</p>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditingItem(item); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-900 bg-white border border-slate-200 rounded shadow-sm"><Edit className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteDialog({ isOpen: true, item }); }} className="p-1.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded shadow-sm"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="text-center py-20 text-slate-300 italic text-sm">
                   {searchQuery ? "No matching items." : "No items in stock. Add your first item or create a bill."}
                </div>
              )}
            </div>
          )}

          <div className={`flex-1 bg-white border border-slate-200 rounded-lg p-8 flex flex-col boxy-shadow overflow-y-auto min-w-0 transition-all duration-300`}>
            {selectedItem && itemStats ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">{selectedItem.name}</h2>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedItem.category || 'Standard Item'}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span className="text-[10px] font-mono text-slate-400">{selectedItem.sku || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2.5 border border-slate-200 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm" title={isFullScreen ? "Minimize" : "Full Screen"}>
                      {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditingItem(selectedItem); setIsModalOpen(true); }} className="p-2.5 border border-slate-200 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteDialog({ isOpen: true, item: selectedItem })} className="p-2.5 border border-slate-200 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <InfoCard label="Total Purchased" value={`${itemStats.totalQtyPurchased} ${selectedItem.unit}`} desc="From all vouchers" />
                  <InfoCard label="In Stock" value={`${selectedItem.in_stock || 0} ${selectedItem.unit}`} desc="Available Balance" />
                  <InfoCard label="Stock Value" value={formatCurrency((selectedItem.in_stock || 0) * (selectedItem.rate || 0))} desc="Inventory Asset" />
                  <InfoCard label="Avg Rate" value={formatCurrency(itemStats.totalQtyPurchased > 0 ? itemStats.totalValuePurchased / itemStats.totalQtyPurchased : selectedItem.rate)} desc="Landed Cost" />
                  <InfoCard label="Vendor Count" value={itemStats.vendorCount} desc="Unique Suppliers" />
                  <InfoCard label="Main Vendor" value={itemStats.mainVendor} desc="Primary Source" />
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <History className="w-4 h-4 text-slate-400" />
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linked Purchase Records</h3>
                    </div>
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden boxy-shadow bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] table-auto border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4 border-r border-slate-200">Date</th>
                            <th className="py-3 px-4 border-r border-slate-200">Bill No</th>
                            <th className="py-3 px-4 border-r border-slate-200">Vendor / Party</th>
                            <th className="py-3 px-4 text-right border-r border-slate-200">Qty</th>
                            <th className="py-3 px-4 text-right border-r border-slate-200">Rate</th>
                            <th className="py-3 px-4 text-right font-bold">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemStats.transactions.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 text-slate-600 border-r border-slate-100">{formatDate(t.date)}</td>
                              <td className="py-3 px-4 font-mono font-medium border-r border-slate-100">{t.billNo}</td>
                              <td className="py-3 px-4 uppercase font-semibold text-slate-700 border-r border-slate-100">{t.vendor}</td>
                              <td className="py-3 px-4 text-right border-r border-slate-100">{t.qty}</td>
                              <td className="py-3 px-4 text-right border-r border-slate-100">{formatCurrency(t.rate)}</td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(t.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-sm py-20">
                <Package className="w-16 h-16 opacity-10 mb-4" />
                <p>Select a product to view its life-cycle and stock analytics.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
