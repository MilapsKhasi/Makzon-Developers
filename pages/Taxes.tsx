import React, { useState, useEffect } from 'react';
import { 
  Percent, ArrowUpRight, ArrowDownLeft, 
  Download, Filter, Loader2, Landmark 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId, formatCurrency } from '../utils/helpers';

const Taxes = () => {
  const [loading, setLoading] = useState(true);
  const [taxData, setTaxData] = useState<any[]>([]);
  const cid = getActiveCompanyId();

  useEffect(() => {
    fetchTaxData();
  }, [cid]);

  const fetchTaxData = async () => {
    if (!cid) return;
    setLoading(true);
    try {
      // In a real app, you'd fetch from invoices. 
      // For now, we pull Ledger entries categorized as 'Tax'
      const { data, error } = await supabase
        .from('ledgers')
        .select('*')
        .eq('company_id', cid)
        .ilike('particulars', '%TAX%') // Finds GST, VAT, Tax entries
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (error) throw error;
      setTaxData(data || []);
    } catch (err) {
      console.error("Tax Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalInputTax = taxData.filter(e => e.type === 'OUT').reduce((sum, e) => sum + Number(e.amount), 0);
  const totalOutputTax = taxData.filter(e => e.type === 'IN').reduce((sum, e) => sum + Number(e.amount), 0);
  const netPayable = totalOutputTax - totalInputTax;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Duties & Taxes</h1>
          <p className="text-sm text-slate-500">Monitor your tax liability and GST/VAT filings</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
          <Download className="w-4 h-4 mr-2" /> Export Tax Report
        </button>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Input Tax (ITC)</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ArrowDownLeft size={16}/></div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">{formatCurrency(totalInputTax)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Tax paid on purchases</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output Tax</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><ArrowUpRight size={16}/></div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono">{formatCurrency(totalOutputTax)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Tax collected on sales</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-500">Net Tax Payable</span>
            <div className="p-2 bg-primary/20 rounded-lg text-primary"><Percent size={16}/></div>
          </div>
          <p className={`text-2xl font-bold font-mono ${netPayable >= 0 ? 'text-primary' : 'text-green-400'}`}>
            {formatCurrency(Math.abs(netPayable))}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {netPayable >= 0 ? 'To be paid to Govt.' : 'Tax Credit Available'}
          </p>
        </div>
      </div>

      {/* Tax Transaction Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-800 flex items-center">
            <Landmark className="w-4 h-4 mr-2 text-slate-400" /> Recent Tax Transactions
          </h3>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"><Filter size={14}/></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Particulars</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></td></tr>
              ) : taxData.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic text-sm">No tax transactions found in Ledger.</td></tr>
              ) : taxData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs font-medium text-slate-600 font-mono">{item.date}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 uppercase">{item.particulars}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${item.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.type === 'IN' ? 'Output Tax' : 'Input Tax'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Taxes;
