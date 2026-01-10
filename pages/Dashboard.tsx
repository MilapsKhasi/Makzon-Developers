
import React, { useEffect, useState, useRef } from 'react';
import { Search, Loader2, ChevronDown, TrendingUp, TrendingDown, Wallet, Clock, Receipt, ShoppingCart, Package, Users } from 'lucide-react';
import { getActiveCompanyId, formatDate, normalizeBill } from '../utils/helpers';
import DateFilter from '../components/DateFilter';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    totalSales: 0,
    totalPurchases: 0, 
    payables: 0,
    receivables: 0,
    gstPaid: 0,
    totalVendors: 0,
    stockItems: 0
  });
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; voucher: any | null }>({
    isOpen: false,
    voucher: null
  });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    try {
      // Fetch Bills
      let query = supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false);
      if (dateRange.startDate && dateRange.endDate) {
        query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }
      const { data: vouchers } = await query;
      
      // Fetch Masters for stats
      const { count: vendorCount } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('party_type', 'vendor').eq('is_deleted', false);
      const { count: itemCount } = await supabase.from('stock_items').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('is_deleted', false);

      const normalizedVouchers = (vouchers || []).map(normalizeBill);
      const purchaseItems = normalizedVouchers.filter(v => v.type === 'Purchase');
      const salesItems = normalizedVouchers.filter(v => v.type === 'Sale');

      setStats({ 
        totalSales: salesItems.reduce((acc, b) => acc + Number(b.grand_total || 0), 0), 
        totalPurchases: purchaseItems.reduce((acc, b) => acc + Number(b.grand_total || 0), 0), 
        payables: purchaseItems.filter(v => v.status === 'Pending').reduce((acc, v) => acc + Number(v.grand_total || 0), 0), 
        receivables: salesItems.filter(v => v.status === 'Pending').reduce((acc, v) => acc + Number(v.grand_total || 0), 0), 
        gstPaid: purchaseItems.reduce((acc, v) => acc + Number(v.total_gst || 0), 0),
        totalVendors: vendorCount || 0,
        stockItems: itemCount || 0
      });

      setRecentVouchers(normalizedVouchers.map(b => ({ 
        ...b, docNo: b.bill_number, party: b.vendor_name, displayType: b.type
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err: any) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange]);

  const filteredVouchers = recentVouchers.filter(v => {
    const search = searchQuery.toLowerCase();
    return v.docNo?.toLowerCase().includes(search) || v.party?.toLowerCase().includes(search);
  }).slice(0, 8);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Modal isOpen={isPurchaseModalOpen} onClose={() => { setIsPurchaseModalOpen(false); setEditingVoucher(null); }} title={editingVoucher ? "Edit Purchase Bill" : "Register Purchase Bill"} maxWidth="max-w-6xl">
        <BillForm initialData={editingVoucher} onSubmit={() => { setIsPurchaseModalOpen(false); setEditingVoucher(null); loadData(); }} onCancel={() => { setIsPurchaseModalOpen(false); setEditingVoucher(null); }} />
      </Modal>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Command Center</h1>
          <p className="text-slate-500 text-sm font-medium">Real-time overview of your digital finance desk.</p>
        </div>
        <div className="flex items-center space-x-3">
          <DateFilter onFilterChange={setDateRange} />
          <button onClick={() => setIsPurchaseModalOpen(true)} className="px-6 py-2.5 rounded-md font-bold text-xs bg-primary text-slate-900 hover:bg-primary-dark shadow-sm uppercase tracking-wider transition-all">New Purchase</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[
          { label: 'Purchases (Gross)', value: stats.totalPurchases, icon: ShoppingCart, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Net Payables', value: stats.payables, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'GST Input Credit', value: stats.gstPaid, icon: Receipt, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Active Vendors', value: stats.totalVendors, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', isCurrency: false },
          { label: 'Stock SKUs', value: stats.stockItems, icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50', isCurrency: false },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{stat.label}</span>
                <div className={`${stat.bg} p-2 rounded-lg`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
            </div>
            <span className={`text-xl font-bold leading-none font-mono ${stat.color}`}>
                {stat.isCurrency === false ? stat.value : stat.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent Transactions</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-3.5 h-3.5" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter..." className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-primary w-48" />
            </div>
          </div>
          
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Doc #</th>
                  <th>Party</th>
                  <th className="text-right">Amount</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                ) : filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => { setEditingVoucher(v); v.type === 'Sale' ? setIsSalesModalOpen(true) : setIsPurchaseModalOpen(true); }}>
                    <td className="text-slate-500">{formatDate(v.date)}</td>
                    <td className={`text-[10px] font-bold uppercase ${v.displayType === 'Sale' ? 'text-blue-600' : 'text-rose-600'}`}>{v.displayType}</td>
                    <td className="font-mono font-semibold">{v.docNo}</td>
                    <td className="uppercase font-medium text-slate-700 truncate max-w-[150px]">{v.party}</td>
                    <td className="text-right font-mono font-bold">{(v.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="text-center">
                      <span className={`text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase ${v.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{v.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
           <h2 className="text-lg font-bold text-slate-900">Purchase Insights</h2>
           <div className="bg-slate-900 text-white rounded-xl p-6 space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payable Ratio</p>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-primary" style={{ width: stats.totalPurchases ? `${(stats.payables / stats.totalPurchases) * 100}%` : '0%' }}></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span>UNPAID: ₹{stats.payables.toLocaleString()}</span>
                  <span>{stats.totalPurchases ? Math.round((stats.payables / stats.totalPurchases) * 100) : 0}%</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                 <p className="text-xs text-slate-400 leading-relaxed">
                   You have <span className="text-primary font-bold">{recentVouchers.filter(v => v.status === 'Pending' && v.type === 'Purchase').length}</span> pending purchase bills requiring settlement.
                 </p>
              </div>

              <button onClick={() => setIsPurchaseModalOpen(true)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-all">
                 Review All Payables
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
