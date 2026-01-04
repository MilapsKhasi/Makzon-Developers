
import React, { useEffect, useState } from 'react';
import { Search, Loader2, ChevronDown, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { getActiveCompanyId, formatDate } from '../utils/helpers';
import DateFilter from '../components/DateFilter';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    totalPurchases: 0, 
    totalSales: 0,
    cashIn: 0,
    cashOut: 0,
    netProfit: 0
  });
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
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
      let query = supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false);
      if (dateRange.startDate && dateRange.endDate) {
        query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }
      const { data: vouchers, error } = await query;
      if (error) throw error;
      
      const purchaseItems = (vouchers || []).filter(v => v.type === 'Purchase' || !v.type);
      const salesItems = (vouchers || []).filter(v => v.type === 'Sale');

      const totalPurchases = purchaseItems.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
      const totalSales = salesItems.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
      
      const cashIn = salesItems.filter(v => v.status === 'Paid').reduce((acc, v) => acc + Number(v.grand_total || 0), 0);
      const cashOut = purchaseItems.filter(v => v.status === 'Paid').reduce((acc, v) => acc + Number(v.grand_total || 0), 0);

      setStats({
        totalPurchases,
        totalSales,
        cashIn,
        cashOut,
        netProfit: totalSales - totalPurchases
      });

      const combined = (vouchers || []).map(b => ({ 
        ...b, 
        docNo: b.bill_number, 
        party: b.vendor_name,
        displayType: b.type === 'Sale' ? 'Sale' : 'Purchase'
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setRecentVouchers(combined);
    } catch (err: any) {
      console.error("Dashboard load error:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('appSettingsChanged', handleRefresh);
    return () => window.removeEventListener('appSettingsChanged', handleRefresh);
  }, [dateRange]);

  const filteredVouchers = recentVouchers.filter(v => {
    const search = searchQuery.toLowerCase();
    return v.docNo?.toLowerCase().includes(search) || v.party?.toLowerCase().includes(search);
  }).slice(0, 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Modal isOpen={isPurchaseModalOpen} onClose={() => setIsPurchaseModalOpen(false)} title="Register Purchase Bill" maxWidth="max-w-4xl">
        <BillForm onSubmit={() => { setIsPurchaseModalOpen(false); loadData(); }} onCancel={() => setIsPurchaseModalOpen(false)} />
      </Modal>

      <Modal isOpen={isSalesModalOpen} onClose={() => setIsSalesModalOpen(false)} title="Generate Sales Invoice" maxWidth="max-w-4xl">
        <SalesInvoiceForm onSubmit={() => { setIsSalesModalOpen(false); loadData(); }} onCancel={() => setIsSalesModalOpen(false)} />
      </Modal>

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Dashboard Overview</h1>
        <div className="flex items-center space-x-3">
          <DateFilter onFilterChange={setDateRange} />
          <div className="flex space-x-2">
            <button 
                onClick={() => setIsSalesModalOpen(true)}
                className="bg-link text-white px-6 py-2 rounded-md font-normal text-sm hover:bg-link/90 transition-none"
            >
                NEW SALE
            </button>
            <button 
                onClick={() => setIsPurchaseModalOpen(true)}
                className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark transition-none"
            >
                NEW PURCHASE
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'TOTAL SALES', value: stats.totalSales, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'TOTAL PURCHASES', value: stats.totalPurchases, icon: TrendingDown, color: 'text-rose-600' },
          { label: 'CASH INFLOW', value: stats.cashIn, icon: Wallet, color: 'text-emerald-600' },
          { label: 'CASH OUTFLOW', value: stats.cashOut, icon: Wallet, color: 'text-rose-600' },
          { label: 'NET PROFIT', value: stats.netProfit, icon: TrendingUp, color: stats.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight block">{stat.label}</span>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
            </div>
            <span className={`text-[24px] font-normal leading-none font-mono ${stat.color}`}>
                {stat.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recent entries (Bill #, Party)..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300"
          />
        </div>
        
        <h2 className="text-[16px] font-normal text-slate-900">Recent Transactions</h2>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="clean-table">
            <thead>
              <tr>
                <th className="w-16">SR</th>
                <th>DATE</th>
                <th>TYPE</th>
                <th>VOUCHER #</th>
                <th>PARTY NAME</th>
                <th className="text-right">AMOUNT</th>
                <th className="text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400 font-semibold tracking-widest text-[10px] uppercase">Loading register...</td></tr>
              ) : filteredVouchers.map((v, i) => (
                <tr key={v.id} className="hover:bg-slate-50/50">
                  <td>{i + 1}</td>
                  <td>{formatDate(v.date)}</td>
                  <td>
                    <span className={`text-[10px] font-bold uppercase ${v.displayType === 'Sale' ? 'text-link' : 'text-primary-dark'}`}>
                        {v.displayType}
                    </span>
                  </td>
                  <td className="font-mono">{v.docNo}</td>
                  <td className="uppercase font-medium text-slate-700">{v.party}</td>
                  <td className={`text-right font-mono font-bold ${v.displayType === 'Sale' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {(Number(v.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase ${v.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {v.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filteredVouchers.length === 0 && (
                <tr><td colSpan={7} className="text-center py-20 text-slate-400 italic">No recent transactions recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
