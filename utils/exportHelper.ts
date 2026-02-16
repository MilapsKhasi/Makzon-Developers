
import * as XLSX from 'xlsx';

export interface ExportConfig {
    companyName: string;
    gstin: string;
    email: string;
    phone: string;
    address: string;
    reportTitle: string;
    dateRange: string;
}

export const exportToExcel = (
    headers: string[], 
    rows: any[][], 
    config: ExportConfig
) => {
    const sheetData: any[][] = [];
    
    // Header Section for Excel
    sheetData.push([config.companyName.toUpperCase()]); 
    sheetData.push([`GSTIN: ${config.gstin || 'N/A'} | Address: ${config.address || 'N/A'}`]); 
    sheetData.push([`REPORT: ${config.reportTitle} | PERIOD: ${config.dateRange}`]);
    sheetData.push([]); // Spacer
    sheetData.push(headers);

    rows.forEach(row => {
        sheetData.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-size columns based on headers
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 12) }));
    ws['!cols'] = colWidths;

    // Merges for the header
    const lastColIndex = headers.length - 1;
    if (lastColIndex > 0) {
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIndex } }
        ];
    }

    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${config.reportTitle.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
};

/**
 * Specialized export for Cashbook Entry Sheet with precise formatting:
 * - Specific row heights
 * - Alignments (Center/Left)
 * - Bold text where required
 * - Indentations
 */
export const exportCashbookEntryToExcel = (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string }
) => {
    const ws_data: any[][] = [];
    const merges: XLSX.Range[] = [];
    const rowHeights: any[] = [];

    // --- 1. Company Header ---
    ws_data.push([config.companyName.toUpperCase(), null, null]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });
    rowHeights.push({ hpt: 25.50 }); // Height 25.50

    // --- 2. Daily Cash Statement Header ---
    ws_data.push([`DAILY CASH STATEMENT - DATE: ${config.date}`, null, null]);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 2 } });
    rowHeights.push({ hpt: 18.75 }); // Height 18.75

    // --- 3. Spacer ---
    ws_data.push([]);
    rowHeights.push({ hpt: 12 });

    // --- 4. INCOME SECTION ---
    const incomeHeaderIdx = ws_data.length;
    ws_data.push(["INCOME (INWARD)", null, null]);
    merges.push({ s: { r: incomeHeaderIdx, c: 0 }, e: { r: incomeHeaderIdx, c: 2 } });
    rowHeights.push({ hpt: 20.25 }); // Height 20.25

    const incomeSubHeaderIdx = ws_data.length;
    ws_data.push(["SR NO", "PARTICULARS / SOURCE", "AMOUNT (INR)"]);
    rowHeights.push({ hpt: 20.25 }); // Height 20.25

    let totalIncome = 0;
    const cleanIncome = incomeRows.filter(r => r.particulars.trim() !== '' || r.amount !== '');
    cleanIncome.forEach((row, idx) => {
        const amt = parseFloat(row.amount) || 0;
        totalIncome += amt;
        ws_data.push([idx + 1, row.particulars, amt]);
        rowHeights.push({ hpt: 17.75 }); // Height 17.75
    });

    const incomeTotalIdx = ws_data.length;
    ws_data.push(["TOTAL", null, totalIncome]);
    merges.push({ s: { r: incomeTotalIdx, c: 0 }, e: { r: incomeTotalIdx, c: 1 } });
    rowHeights.push({ hpt: 18.75 }); // Height 18.75

    // --- 5. Spacer ---
    ws_data.push([]);
    rowHeights.push({ hpt: 12 });

    // --- 6. EXPENSE SECTION ---
    const expenseHeaderIdx = ws_data.length;
    ws_data.push(["EXPENSE (OUTWARD)", null, null]);
    merges.push({ s: { r: expenseHeaderIdx, c: 0 }, e: { r: expenseHeaderIdx, c: 2 } });
    rowHeights.push({ hpt: 20.25 }); // Height 20.25

    const expenseSubHeaderIdx = ws_data.length;
    ws_data.push(["SR NO", "PARTICULARS / USAGE", "AMOUNT (INR)"]);
    rowHeights.push({ hpt: 20.25 }); // Height 20.25

    let totalExpense = 0;
    const cleanExpense = expenseRows.filter(r => r.particulars.trim() !== '' || r.amount !== '');
    cleanExpense.forEach((row, idx) => {
        const amt = parseFloat(row.amount) || 0;
        totalExpense += amt;
        ws_data.push([idx + 1, row.particulars, amt]);
        rowHeights.push({ hpt: 17.75 }); // Height 17.75
    });

    const expenseTotalIdx = ws_data.length;
    ws_data.push(["TOTAL", null, totalExpense]);
    merges.push({ s: { r: expenseTotalIdx, c: 0 }, e: { r: expenseTotalIdx, c: 1 } });
    rowHeights.push({ hpt: 18.75 }); // Height 18.75

    // --- 7. Spacer ---
    ws_data.push([]);
    rowHeights.push({ hpt: 12 });

    // --- 8. CLOSING SUMMARY ---
    const netBalance = totalIncome - totalExpense;
    const closingIdx = ws_data.length;
    ws_data.push(["CLOSING NET BALANCE:", null, netBalance]);
    merges.push({ s: { r: closingIdx, c: 0 }, e: { r: closingIdx, c: 1 } });
    rowHeights.push({ hpt: 18.75 }); // Height 18.75

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Apply specific styles (Alignment, Bold, Indent)
    // Note: Standard XLSX library might not save all style metadata in community version,
    // but the object structure follows the standard for compatible viewers/writers.
    Object.keys(ws).forEach(cellKey => {
        if (cellKey.startsWith('!')) return;
        const cell = ws[cellKey];
        const cellInfo = XLSX.utils.decode_cell(cellKey);
        const rowIdx = cellInfo.r;
        const colIdx = cellInfo.c;

        if (!cell.s) cell.s = {};
        if (!cell.s.alignment) cell.s.alignment = {};
        if (!cell.s.font) cell.s.font = {};

        // Rules based on user requirements:
        
        // 1. Company Header (Row 0)
        if (rowIdx === 0) {
            cell.s.alignment.horizontal = 'center';
            cell.s.font.bold = true;
            cell.s.font.sz = 14;
        }
        
        // 2. Daily Statement (Row 1)
        if (rowIdx === 1) {
            cell.s.alignment.horizontal = 'center';
            cell.s.font.bold = false;
        }

        // 3. Section Headers (Income/Expense)
        if (rowIdx === incomeHeaderIdx || rowIdx === expenseHeaderIdx) {
            cell.s.alignment.horizontal = 'center';
            cell.s.font.bold = true;
        }

        // 4. Sub Headers (Sr No, Particulars, Amount)
        if (rowIdx === incomeSubHeaderIdx || rowIdx === expenseSubHeaderIdx) {
            cell.s.font.bold = true;
            cell.s.alignment.horizontal = 'left';
            cell.s.alignment.indent = 1;
        }

        // 5. Data Rows
        const isDataRow = (rowIdx > incomeSubHeaderIdx && rowIdx < incomeTotalIdx) || 
                          (rowIdx > expenseSubHeaderIdx && rowIdx < expenseTotalIdx);
        if (isDataRow) {
            cell.s.font.bold = false;
            cell.s.alignment.horizontal = 'left';
            cell.s.alignment.indent = 1;
        }

        // 6. Total Rows
        if (rowIdx === incomeTotalIdx || rowIdx === expenseTotalIdx) {
            if (colIdx === 0) {
                cell.s.alignment.horizontal = 'center';
                cell.s.font.bold = true;
            } else if (colIdx === 2) {
                cell.s.alignment.horizontal = 'left';
                cell.s.alignment.indent = 1;
                cell.s.font.bold = true;
            }
        }

        // 7. Closing Balance Row
        if (rowIdx === closingIdx) {
            if (colIdx === 0) {
                cell.s.alignment.horizontal = 'center';
                cell.s.font.bold = false;
            } else if (colIdx === 2) {
                cell.s.alignment.horizontal = 'left';
                cell.s.alignment.indent = 1;
                cell.s.font.bold = false;
            }
        }
    });

    // Final Sheet Config
    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;
    ws['!cols'] = [
        { wch: 15 }, // Sr No
        { wch: 65 }, // Particulars
        { wch: 25 }  // Amount
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `Cashbook_Statement_${config.date.replace(/[\/\-]/g, '_')}.xlsx`);
};

export const exportToCSV = (headers: string[], rows: any[][], config: ExportConfig) => {
    const csvContent = [
        `"${config.companyName.replace(/"/g, '""')}"`,
        `"GSTIN: ${config.gstin}","Address: ${config.address}"`,
        `"Report: ${config.reportTitle}","Period: ${config.dateRange}"`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => {
            const stringCell = String(cell ?? '');
            if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
                return `"${stringCell.replace(/"/g, '""')}"`;
            }
            return stringCell;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${config.reportTitle.replace(/\s+/g, '_')}_Data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const triggerPrint = () => {
    window.print();
};
