
import React, { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { formatCurrency, getActiveCompanyId, formatDate } from '../utils/helpers';
import DateFilter from '../components/DateFilter';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import { supabase } from '../lib/supabase';

const StatCard = ({ label, value }: { label: string, value: string }) => (
  <div className="bg-white p-6 border border-slate-200 rounded-lg min-w-[160px] boxy-shadow transition-all hover:border-primary">
    <p className="text-xs font-medium text-slate-500 uppercase tracking-tight mb-2">{label}</p>
    <h2 className="text-2xl font-semibold text-slate-900">{value}</h2>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    totalPurchases: 0, 
    withoutGst: 0, 
    gst: 0, 
    withGst: 0, 
    gstPaid: 0 
  });
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    let query = supabase
      .from('bills')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false)
      .order('date', { ascending: false });

    if (dateRange.startDate && dateRange.endDate) {
      query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
    }

    const { data } = await query;
    const bills = data || [];

    const summary = bills.reduce((acc: any, b: any) => ({
      totalPurchases: acc.totalPurchases + Number(b.grand_total || 0),
      withoutGst: acc.withoutGst + Number(b.total_without_gst || 0),
      gst: acc.gst + Number(b.total_gst || 0),
      withGst: acc.withGst + Number(b.grand_total || 0),
      gstPaid: acc.gstPaid + (b.status === 'Paid' ? Number(b.total_gst || 0) : 0)
    }), { totalPurchases: 0, withoutGst: 0, gst: 0, withGst: 0, gstPaid: 0 });
    
    setStats(summary);
    setRecentBills(bills.slice(0, 10));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange]);

  return (
    <div className="space-y-8">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Purchase Voucher">
        <BillForm onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Dashboard Overview</h1>
        <div className="flex items-center space-x-3">
          <DateFilter onFilterChange={setDateRange} />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-slate-800 px-5 py-2 rounded-md font-bold text-[10px] uppercase tracking-widest hover:bg-primary-dark transition-all border border-slate-200 shadow-sm"
          >
            Quick Voucher
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Purchases" value={formatCurrency(stats.totalPurchases)} />
        <StatCard label="Without GST" value={formatCurrency(stats.withoutGst)} />
        <StatCard label="GST" value={formatCurrency(stats.gst)} />
        <StatCard label="With GST" value={formatCurrency(stats.withGst)} />
        <StatCard label="GST Paid" value={formatCurrency(stats.gstPaid)} />
      </div>

      <div className="space-y-4 pt-4">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Activity</h2>
        <div className="border border-slate-200 rounded-md overflow-hidden boxy-shadow">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 border-r border-slate-200 w-12 text-center">#</th>
                  <th className="py-3 px-4 border-r border-slate-200">Date</th>
                  <th className="py-3 px-4 border-r border-slate-200">Bill No</th>
                  <th className="py-3 px-4 border-r border-slate-200">Vendor</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-right">Taxable</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-right font-bold">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBills.map((bill, i) => (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 border-r border-slate-200 text-slate-400 text-center font-mono text-[10px]">{i + 1}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-xs">{formatDate(bill.date)}</td>
                    <td className="py-3 px-4 border-r border-slate-200 font-mono text-[11px]">{bill.bill_number}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-xs font-medium uppercase truncate max-w-[200px]">{bill.vendor_name}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-right text-xs">{formatCurrency(bill.total_without_gst)}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-right text-xs font-bold text-slate-900">{formatCurrency(bill.grand_total)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${bill.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{bill.status}</span>
                    </td>
                  </tr>
                ))}
                {recentBills.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400 italic text-xs">No recent activity detected in this workspace.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
