
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

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    let query = supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false).eq('type', 'Purchase');
    if (dateRange.startDate && dateRange.endDate) {
      query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
    }
    const { data: vouchers } = await query;
    const items = vouchers || [];

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
      type: 'Purchase', 
      docNo: b.bill_number, 
      party: b.vendor_name 
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setRecentVouchers(combined.slice(0, 10));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange]);

  return (
    <div className="space-y-6">
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
          { label: 'TOTAL PURCHASE', value: stats.withGst.toFixed(2) },
          { label: 'WITHOUT GST', value: stats.withoutGst.toFixed(2) },
          { label: 'GST', value: stats.gst.toFixed(2) },
          { label: 'WITH GST', value: stats.withGst.toFixed(2) },
          { label: 'GST PAID', value: stats.gstPaid.toFixed(2) },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col">
            <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight mb-1">{stat.label}</span>
            <span className="text-[24px] font-normal text-slate-900 leading-none">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search anything" 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none"
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
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Loading entries...</td></tr>
              ) : recentVouchers.map((v, i) => (
                <tr key={v.id}>
                  <td>{i + 1}</td>
                  <td>{formatDate(v.date)}</td>
                  <td className="font-mono">{v.docNo}</td>
                  <td className="uppercase">{v.party}</td>
                  <td>{v.total_without_gst.toFixed(2)}</td>
                  <td>{v.total_gst.toFixed(2)}</td>
                  <td className="font-medium text-slate-900">{v.grand_total.toFixed(2)}</td>
                  <td>
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase ${v.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td>---</td>
                </tr>
              ))}
              {!loading && recentVouchers.length === 0 && (
                <tr><td colSpan={9} className="text-center py-20 text-slate-400 italic">No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
