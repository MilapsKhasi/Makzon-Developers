import React, { useEffect, useState } from 'react';
import { Search, Loader2, ShoppingCart, Package, Users, Receipt, Clock, BadgeIndianRupee } from 'lucide-react';
import { Wallet, TrendingUp, Users, ShoppingCart } from 'lucide-react';
import { getActiveCompanyId, formatDate, normalizeBill, formatCurrency } from '../utils/helpers';
import DateFilter from '../components/DateFilter';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    totalSales: 0,
    totalPurchases: 0, 
    payables: 0,
    receivables: 0,
    gstPaid: 0,
    totalVendors: 0,
    totalCustomers: 0,
    stockItems: 0
  });
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    try {
      // Dual query: Bills (Purchases) and Sales Invoices (Sales)
      let billQuery = supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false);
      let saleQuery = supabase.from('sales_invoices').select('*').eq('company_id', cid).eq('is_deleted', false);

      if (dateRange.startDate && dateRange.endDate) {
        billQuery = billQuery.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
        saleQuery = saleQuery.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }
      
      const [{ data: bills }, { data: sales }] = await Promise.all([billQuery, saleQuery]);
      
      const { count: vendorCount } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('party_type', 'vendor').eq('is_deleted', false);
      const { count: customerCount } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('party_type', 'customer').eq('is_deleted', false);
      const { count: itemCount } = await supabase.from('stock_items').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('is_deleted', false);

      const normalizedPurchases = (bills || []).map(normalizeBill);
      const normalizedSales = (sales || []).map(normalizeBill);

      setStats({ 
        totalSales: normalizedSales.reduce((acc, b) => acc + Number(b.grand_total || 0), 0), 
        totalPurchases: normalizedPurchases.reduce((acc, b) => acc + Number(b.grand_total || 0), 0), 
        payables: normalizedPurchases.filter(v => v.status === 'Pending').reduce((acc, v) => acc + Number(v.grand_total || 0), 0), 
        receivables: normalizedSales.filter(v => v.status === 'Pending').reduce((acc, v) => acc + Number(v.grand_total || 0), 0), 
        gstPaid: normalizedPurchases.reduce((acc, v) => acc + Number(v.total_gst || 0), 0),
        totalVendors: vendorCount || 0,
        totalCustomers: customerCount || 0,
        stockItems: itemCount || 0
      });

      const combined = [...normalizedPurchases, ...normalizedSales];
      setRecentVouchers(combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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
    const partyName = v.vendor_name || v.customer_name || '';
    return v.bill_number?.toLowerCase().includes(search) || partyName.toLowerCase().includes(search);
  }).slice(0, 10);

  const StatBox = ({ label, value, subLabel, icon: Icon }: any) => (
    <div className="bg-white border border-slate-200 p-4 rounded hover:border-slate-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
        <Icon className="w-3.5 h-3.5 text-slate-300" />
      </div>
      <div className="text-xl font-bold text-slate-900 leading-none mb-1">{value}</div>
      {subLabel && <div className="text-[10px] text-slate-400 font-medium uppercase">{subLabel}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <Modal isOpen={isPurchaseModalOpen} onClose={() => setIsPurchaseModalOpen(false)} title="New Purchase Entry">
        <BillForm onSubmit={() => { setIsPurchaseModalOpen(false); loadData(); }} onCancel={() => setIsPurchaseModalOpen(false)} />
      </Modal>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 uppercase">Executive Summary</h1>
        <div className="flex items-center space-x-2">
          <DateFilter onFilterChange={setDateRange} />
          <button onClick={() => setIsPurchaseModalOpen(true)} className="px-4 py-2 bg-primary text-slate-900 font-bold text-xs rounded uppercase hover:bg-primary-dark">New Purchase</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Sales (Gross)" value={formatCurrency(stats.totalSales)} subLabel={`Net Recv: ${formatCurrency(stats.receivables)}`} icon={BadgeIndianRupee} />
        <StatBox label="Purchases" value={formatCurrency(stats.totalPurchases)} subLabel={`Net Payable: ${formatCurrency(stats.payables)}`} icon={ShoppingCart} />
        <StatBox label="Active Partners" value={stats.totalVendors + stats.totalCustomers} subLabel={`${stats.totalVendors} Vendors / ${stats.totalCustomers} Customers`} icon={Users} />
        <StatBox label="Inventory" value={stats.stockItems} subLabel="Registered SKU items" icon={Package} />
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-700 uppercase">Recent Transactions</h2>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 w-3.5 h-3.5" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter list..." className="pl-7 pr-3 py-1 border border-slate-200 rounded text-xs outline-none focus:border-slate-300 w-48" />
          </div>
        </div>
        
        <table className="clean-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Document #</th>
              <th>Party Name</th>
              <th className="text-right">Total Amount</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-20 text-slate-400 uppercase text-[10px] font-bold tracking-widest">Refreshing Data...</td></tr>
            ) : filteredVouchers.map((v) => (
              <tr key={v.id}>
                <td className="text-slate-500">{formatDate(v.date)}</td>
                <td className={`text-[10px] font-bold uppercase ${v.type === 'Sale' ? 'text-blue-600' : 'text-rose-600'}`}>{v.type}</td>
                <td className="font-mono font-bold">{v.bill_number}</td>
                <td className="uppercase font-medium text-slate-700">{v.vendor_name || v.customer_name}</td>
                <td className="text-right font-mono font-bold">{formatCurrency(v.grand_total, false)}</td>
                <td className="text-center">
                  <span className={`text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase ${v.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{v.status}</span>
                </td>
              </tr>
            ))}
            {!loading && filteredVouchers.length === 0 && (
              <tr><td colSpan={6} className="py-20 text-center text-slate-300 italic">No transactions found for the selected period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
