
import React, { useEffect, useState } from 'react';
import { Search, Loader2, ChevronDown } from 'lucide-react';
import { getActiveCompanyId, formatDate } from '../utils/helpers';
import DateFilter from '../components/DateFilter';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    totalPurchases: 0, 
    withoutGst: 0,
    gst: 0,
    withGst: 0,
    gstPaid: 0
  });
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      // Fetch all non-deleted bills for the active workspace
      let query = supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false);
      
      if (dateRange.startDate && dateRange.endDate) {
        query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }
      
      const { data: vouchers, error } = await query;
      if (error) throw error;

      // Filter for Purchases (type 'Purchase' or untyped) to match Bills screen logic
      const items = (vouchers || []).filter(v => v.type === 'Purchase' || !v.type);

      const totalWithoutGst = items.reduce((acc, b) => acc + Number(b.total_without_gst || 0), 0);
      const totalGst = items.reduce((acc, b) => acc + Number(b.total_gst || 0), 0);
      const totalWithGst = items.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
      const paidGst = items.filter(i => i.status === 'Paid').reduce((acc, i) => acc + Number(i.total_gst || 0), 0);

      setStats({
        totalPurchases: items.length,
        withoutGst: totalWithoutGst,
        gst: totalGst,
        withGst: totalWithGst,
        gstPaid: paidGst
      });

      const combined = items.map(b => ({ 
        ...b, 
        docNo: b.bill_number, 
        party: b.vendor_name 
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRecentVouchers(combined);
    } catch (err) {
      console.error("Dashboard load error:", err);
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Purchase Bill" maxWidth="max-w-4xl">
        <BillForm onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Dashboard</h1>
        <div className="flex items-center space-x-3">
          <DateFilter onFilterChange={setDateRange} />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark transition-none"
          >
            NEW ENTRY
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'TOTAL PURCHASE', value: (Number(stats.withGst) || 0).toFixed(2) },
          { label: 'WITHOUT GST', value: (Number(stats.withoutGst) || 0).toFixed(2) },
          { label: 'GST', value: (Number(stats.gst) || 0).toFixed(2) },
          { label: 'WITH GST', value: (Number(stats.withGst) || 0).toFixed(2) },
          { label: 'GST PAID', value: (Number(stats.gstPaid) || 0).toFixed(2) },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col">
            <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight mb-1 block">{stat.label}</span>
            <span className="text-[24px] font-normal text-slate-900 leading-none">{stat.value}</span>
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
            placeholder="Search recent entries..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300"
          />
        </div>
        
        <h2 className="text-[16px] font-normal text-slate-900">Recent Entries</h2>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="clean-table">
            <thead>
              <tr>
                <th className="w-16">SR NO</th>
                <th>DATE</th>
                <th>BILL NO</th>
                <th>VENDOR</th>
                <th>WITHOUT GST</th>
                <th>GST</th>
                <th>WITH GST</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading entries...</td></tr>
              ) : filteredVouchers.map((v, i) => (
                <tr key={v.id} className="hover:bg-slate-50/50">
                  <td>{i + 1}</td>
                  <td>{formatDate(v.date)}</td>
                  <td className="font-mono">{v.docNo}</td>
                  <td className="uppercase">{v.party}</td>
                  <td>{(Number(v.total_without_gst) || 0).toFixed(2)}</td>
                  <td>{(Number(v.total_gst) || 0).toFixed(2)}</td>
                  <td className="font-medium text-slate-900">{(Number(v.grand_total) || 0).toFixed(2)}</td>
                  <td>
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase ${v.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {v.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filteredVouchers.length === 0 && (
                <tr><td colSpan={8} className="text-center py-20 text-slate-400 italic">No purchase transactions found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
