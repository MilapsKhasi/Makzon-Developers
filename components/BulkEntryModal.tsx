
import React, { useState, useEffect, useCallback } from 'react';
import { X, Undo, Redo, Share2, RotateCcw, Eraser, Check, Plus } from 'lucide-react';
import Modal from './Modal';

export interface ColumnDef {
  header: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // For select type
  width?: string;
  // Placeholder removed
}

interface BulkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  columns: ColumnDef[];
  onSave: (data: any[]) => void;
}

const INITIAL_ROWS = 50;

const BulkEntryModal: React.FC<BulkEntryModalProps> = ({ isOpen, onClose, title, columns, onSave }) => {
  // Initialize grid with empty strings
  const createEmptyRows = (count: number) => Array(count).fill(null).map(() => 
    columns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {})
  );

  const [gridData, setGridData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      const initial = createEmptyRows(INITIAL_ROWS);
      setGridData(initial);
      setHistory([initial]);
      setHistoryIndex(0);
    }
  }, [isOpen, columns]);

  const addToHistory = (newData: any[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newData))); // Deep copy
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleCellChange = (rowIndex: number, key: string, value: string) => {
    const newData = [...gridData];
    newData[rowIndex] = { ...newData[rowIndex], [key]: value };
    setGridData(newData);
  };

  const handleBlur = () => {
    // Commit to history on blur (to avoid history spam on every keystroke)
    // Only if different from current history head
    if (history.length > 0 && JSON.stringify(gridData) !== JSON.stringify(history[historyIndex])) {
        addToHistory(gridData);
    }
  };

  const handleAddRows = () => {
    const newRows = createEmptyRows(10);
    const newData = [...gridData, ...newRows];
    setGridData(newData);
    addToHistory(newData);
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
      const initial = createEmptyRows(INITIAL_ROWS);
      setGridData(initial);
      setHistory([initial]);
      setHistoryIndex(0);
  };

  const handleClearAll = () => {
      if (confirm('Are you sure you want to clear all data?')) {
          // Keep the rows, just clear content
          const cleared = gridData.map(() => columns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {}));
          setGridData(cleared);
          addToHistory(cleared);
      }
  };

  const handleShare = () => {
      const textData = gridData.map(row => Object.values(row).join('\t')).join('\n');
      navigator.clipboard.writeText(textData);
      alert('Table data copied to clipboard!');
  };

  const handleCreate = () => {
      // Filter out empty rows
      const validRows = gridData.filter(row => {
          return Object.values(row).some(val => val !== '' && val !== null);
      });
      
      if (validRows.length === 0) {
          alert("Please enter at least one row of data.");
          return;
      }

      onSave(validRows);
  };

  const TooltipButton = ({ icon: Icon, onClick, tip, disabled = false }: any) => (
      <button 
        onClick={onClick} 
        disabled={disabled}
        className={`p-2 rounded hover:bg-slate-100 transition-colors relative group ${disabled ? 'opacity-50 cursor-not-allowed' : 'text-slate-600 hover:text-slate-900'}`}
      >
          <Icon className="w-5 h-5" />
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {tip}
          </span>
      </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-[95vw]">
      <div className="flex flex-col h-[80vh]">
        {/* Toolbar */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-3 shrink-0">
            <div className="flex items-center border-r border-slate-200 pr-2 mr-2 space-x-1">
                <TooltipButton icon={Undo} onClick={handleUndo} tip="Undo" disabled={historyIndex === 0} />
                <TooltipButton icon={Redo} onClick={handleRedo} tip="Redo" disabled={historyIndex === history.length - 1} />
            </div>
            <div className="flex items-center space-x-1">
                <TooltipButton icon={Share2} onClick={handleShare} tip="Share / Copy" />
                <TooltipButton icon={RotateCcw} onClick={handleReset} tip="Reset Table" />
                <TooltipButton icon={Eraser} onClick={handleClearAll} tip="Clear All" />
            </div>
            <div className="flex-1"></div>
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-xs font-bold border border-blue-100">
                Bulk Entry Mode
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
                    </tr>
                </thead>
                <tbody>
                    {gridData.map((row, rIndex) => (
                        <tr key={rIndex} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="border-r border-b border-slate-200 bg-slate-50 text-xs text-slate-400 text-center font-mono select-none group-hover:bg-blue-50/50">
                                {rIndex + 1}
                            </td>
                            {columns.map((col) => (
                                <td key={`${rIndex}-${col.key}`} className="border-r border-b border-slate-200 p-0 bg-white">
                                    {col.type === 'select' ? (
                                        <select
                                            value={row[col.key]}
                                            onChange={(e) => handleCellChange(rIndex, col.key, e.target.value)}
                                            onBlur={handleBlur}
                                            className="w-full h-full px-2 py-2 text-sm bg-transparent outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500/50 cursor-pointer text-slate-900"
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
                                            className="w-full h-full px-2 py-2 text-sm bg-transparent outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500/50 font-normal text-slate-900"
                                        />
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={columns.length + 1} className="p-2 bg-slate-50 border-t border-slate-200">
                             <button 
                                onClick={handleAddRows}
                                className="w-full py-2 text-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded border border-dashed border-slate-300 transition-colors text-sm font-medium flex items-center justify-center"
                             >
                                <Plus className="w-4 h-4 mr-2" /> Add 10 More Rows
                             </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 flex justify-end">
            <button 
                onClick={handleCreate}
                className="flex items-center px-6 py-2 bg-primary text-slate-900 font-bold rounded-md hover:bg-yellow-400 transition-colors shadow-sm"
            >
                <Check className="w-4 h-4 mr-2" />
                Create Entries
            </button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkEntryModal;
