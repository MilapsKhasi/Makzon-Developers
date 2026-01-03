
import React, { useState, useEffect } from 'react';
import { X, Undo, Redo, Share2, RotateCcw, Save, Trash2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export interface ColumnDef {
  header: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  width?: string;
  readOnly?: boolean;
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  columns: ColumnDef[];
  initialData: any[];
  onSave: (data: any[]) => void;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose, title, columns, initialData, onSave }) => {
  const [gridData, setGridData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; rowIndex: number | null }>({
      isOpen: false,
      rowIndex: null
  });

  useEffect(() => {
    if (isOpen) {
      const dataCopy = JSON.parse(JSON.stringify(initialData));
      setGridData(dataCopy);
      setHistory([dataCopy]);
      setHistoryIndex(0);
    }
  }, [isOpen, initialData]);

  const addToHistory = (newData: any[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newData)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleCellChange = (rowIndex: number, key: string, value: string) => {
    const newData = [...gridData];
    newData[rowIndex] = { ...newData[rowIndex], [key]: value };
    setGridData(newData);
  };

  const handleBlur = () => {
    if (history.length > 0 && JSON.stringify(gridData) !== JSON.stringify(history[historyIndex])) {
        addToHistory(gridData);
    }
  };

  const handleDeleteRequest = (index: number) => {
      setDeleteConfirm({ isOpen: true, rowIndex: index });
  };

  const confirmDelete = () => {
      if (deleteConfirm.rowIndex !== null) {
          const newData = gridData.filter((_, idx) => idx !== deleteConfirm.rowIndex);
          setGridData(newData);
          addToHistory(newData);
          setDeleteConfirm({ isOpen: false, rowIndex: null });
      }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setGridData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setGridData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const handleReset = () => {
      if (confirm('Reset all changes to original state?')) {
        const initial = JSON.parse(JSON.stringify(initialData));
        setGridData(initial);
        addToHistory(initial);
      }
  };

  const handleShare = () => {
      const textData = gridData.map(row => Object.values(row).join('\t')).join('\n');
      navigator.clipboard.writeText(textData);
      alert('Table data copied to clipboard!');
  };

  const handleSave = () => {
      onSave(gridData);
  };

  const TooltipButton = ({ icon: Icon, onClick, tip, disabled = false, className = '' }: any) => (
      <button 
        onClick={onClick} 
        disabled={disabled}
        className={`p-2 rounded hover:bg-slate-100 transition-colors relative group ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-600 hover:text-slate-900'} ${className}`}
      >
          <Icon className="w-5 h-5" />
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {tip}
          </span>
      </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-[95vw]">
      <div className="flex flex-col h-[80vh] relative">
        
        {/* Delete Confirmation Popup */}
        {deleteConfirm.isOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px]">
                <div className="bg-white p-6 rounded-lg shadow-xl border border-red-100 max-w-xs w-full animate-in zoom-in-95 duration-200">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-red-50 rounded-full">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <h4 className="text-lg font-bold text-center text-slate-900 mb-2">Delete Row?</h4>
                    <p className="text-xs text-center text-slate-500 mb-6">This will remove this entry from the list upon saving.</p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setDeleteConfirm({ isOpen: false, rowIndex: null })}
                            className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded text-xs hover:bg-slate-200"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-2 bg-red-600 text-white font-bold rounded text-xs hover:bg-red-700"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-3 shrink-0">
            <div className="flex items-center border-r border-slate-200 pr-2 mr-2 space-x-1">
                <TooltipButton icon={Undo} onClick={handleUndo} tip="Undo" disabled={historyIndex === 0} />
                <TooltipButton icon={Redo} onClick={handleRedo} tip="Redo" disabled={historyIndex === history.length - 1} />
            </div>
            <div className="flex items-center space-x-1">
                <TooltipButton icon={Share2} onClick={handleShare} tip="Share / Copy" />
                <TooltipButton icon={RotateCcw} onClick={handleReset} tip="Reset to Original" />
            </div>
            <div className="flex-1"></div>
            <div className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded text-xs font-bold border border-yellow-100 flex items-center">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse"></span>
                Bulk Edit Mode
            </div>
        </div>

        {/* Spreadsheet Area */}
        <div className="flex-1 overflow-auto border border-slate-300 bg-white shadow-inner relative">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm ring-1 ring-slate-200">
                    <tr>
                        <th className="w-10 border-r border-b border-slate-300 bg-slate-200 text-xs font-bold text-slate-500 p-2 text-center uppercase">#</th>
                        {columns.map((col) => (
                            <th 
                                key={col.key} 
                                className="border-r border-b border-slate-300 text-xs font-bold text-slate-700 p-2 text-left min-w-[120px] uppercase"
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                        <th className="w-12 border-b border-slate-300 bg-slate-200 text-xs font-bold text-slate-500 p-2 text-center">
                            <Trash2 className="w-4 h-4 mx-auto" />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {gridData.map((row, rIndex) => (
                        <tr key={row.id || rIndex} className="hover:bg-yellow-50/30 transition-colors group">
                            <td className="border-r border-b border-slate-200 bg-slate-50 text-xs text-slate-400 text-center font-mono select-none group-hover:bg-yellow-50/50">
                                {rIndex + 1}
                            </td>
                            {columns.map((col) => (
                                <td key={`${rIndex}-${col.key}`} className="border-r border-b border-slate-200 p-0 bg-white">
                                    {col.readOnly ? (
                                        <div className="w-full h-full px-2 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed">
                                            {row[col.key]}
                                        </div>
                                    ) : col.type === 'select' ? (
                                        <select
                                            value={row[col.key]}
                                            onChange={(e) => handleCellChange(rIndex, col.key, e.target.value)}
                                            onBlur={handleBlur}
                                            className="w-full h-full px-2 py-2 text-sm bg-transparent outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-inset focus:ring-yellow-500/50 cursor-pointer text-slate-900"
                                        >
                                            <option value="">Select...</option>
                                            {col.options?.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text"
                                            value={row[col.key]}
                                            onChange={(e) => handleCellChange(rIndex, col.key, e.target.value)}
                                            onBlur={handleBlur}
                                            className="w-full h-full px-2 py-2 text-sm bg-transparent outline-none focus:bg-yellow-50 focus:ring-2 focus:ring-inset focus:ring-yellow-500/50 font-normal text-slate-900"
                                        />
                                    )}
                                </td>
                            ))}
                            <td className="border-b border-slate-200 text-center p-0">
                                <button 
                                    onClick={() => handleDeleteRequest(rIndex)}
                                    className="w-full h-full flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete Row"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {gridData.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + 2} className="p-8 text-center text-slate-400 italic">
                                No entries to edit.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 flex justify-end">
            <button 
                onClick={handleSave}
                className="flex items-center px-6 py-2 bg-primary text-slate-900 font-bold rounded-md hover:bg-yellow-400 transition-colors shadow-sm"
            >
                <Save className="w-4 h-4 mr-2" />
                Update Entries
            </button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkEditModal;
