
import React from 'react';
import { X, FileSpreadsheet, FileText, Crown, File } from 'lucide-react';
import Modal from './Modal';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (type: 'excel' | 'csv' | 'pdf') => void;
  reportName: string;
}

const ExportOption = ({ 
    icon: Icon, 
    title, 
    desc, 
    onClick, 
    disabled = false, 
    premium = false 
}: { 
    icon: any, 
    title: string, 
    desc: string, 
    onClick?: () => void, 
    disabled?: boolean, 
    premium?: boolean 
}) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`flex items-start p-4 border rounded-lg text-left transition-all w-full relative group ${
            disabled 
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-70' 
            : 'bg-white border-slate-200 hover:border-primary hover:shadow-md hover:bg-slate-50'
        }`}
    >
        <div className={`p-3 rounded-lg mr-4 ${disabled ? 'bg-slate-200 text-slate-400' : 'bg-primary/10 text-slate-700 group-hover:bg-primary group-hover:text-slate-900 transition-colors'}`}>
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <h4 className={`font-bold text-sm mb-1 ${disabled ? 'text-slate-500' : 'text-slate-900'}`}>{title}</h4>
            <p className="text-xs text-slate-500">{desc}</p>
        </div>
        {premium && (
            <div className="absolute top-2 right-2">
                <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            </div>
        )}
    </button>
);

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport, reportName }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Report" maxWidth="max-w-md">
        <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-md border border-slate-100 mb-6">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Selected Report</p>
                <p className="text-sm font-medium text-slate-900">{reportName}</p>
            </div>

            <p className="text-sm text-slate-500 mb-2">Choose export format:</p>
            
            <div className="space-y-3">
                <ExportOption 
                    icon={FileSpreadsheet} 
                    title="Excel (.xlsx)" 
                    desc="Formatted report with company details." 
                    onClick={() => onExport('excel')} 
                />
                
                <ExportOption 
                    icon={FileText} 
                    title="CSV (.csv)" 
                    desc="Raw data for analysis." 
                    onClick={() => onExport('csv')} 
                />
                
                <ExportOption 
                    icon={File} 
                    title="PDF Document" 
                    desc="Professional printable document." 
                    disabled={true} 
                    premium={true} 
                />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400">PDF Export is available in the Premium plan.</p>
            </div>
        </div>
    </Modal>
  );
};

export default ExportModal;
