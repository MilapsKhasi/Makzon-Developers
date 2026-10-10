import React from 'react';
import { Database, Folder, Tag, Briefcase } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const MasterCard = ({ title, desc, icon: Icon }: { title: string, desc: string, icon: any }) => (
    <div className="bg-white p-6 hover:bg-slate-50 transition-all cursor-pointer group">
        <div className="w-12 h-12 bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
            <Icon className="w-6 h-6 text-slate-600 group-hover:text-slate-900" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 font-medium">{desc}</p>
    </div>
);

const Masters = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Database}
        iconColor="text-slate-700 dark:text-slate-200"
        title="Master Data Management"
        subtitle="Configure core system data and categories"
      />
        
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MasterCard title="Item Categories" desc="Manage product groups and classifications." icon={Folder} />
            <MasterCard title="Tax Rates" desc="Configure GST/VAT and other tax percentages." icon={Tag} />
            <MasterCard title="Units of Measure" desc="Define measurement units (kg, pcs, ltr)." icon={Database} />
            <MasterCard title="Expense Types" desc="Categorize different types of business expenses." icon={Briefcase} />
        </div>
    </div>
  );
};

export default Masters;