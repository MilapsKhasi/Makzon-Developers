
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
 * Specialized export for Cashbook Entry Sheet with precise formatting for PDF:
 * - Vertical layout (Income then Expense)
 * - Exact text formatting and alignments
 */
export const exportCashbookEntryToPDF = (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string }
) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    // --- 1. Header Section ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(config.companyName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`DAILY CASH STATEMENT - DATE: ${config.date}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // --- 2. Income Section ---
    autoTable(doc, {
        startY: currentY,
        head: [
            [{ content: 'INCOME (INWARD)', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }],
            ['SR NO', 'PARTICULARS / SOURCE', 'AMOUNT (INR)']
        ],
        body: incomeRows.map((row, i) => [i + 1, row.particulars, parseFloat(row.amount).toFixed(2)]),
        foot: [['TOTAL', '', incomeRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0).toFixed(2)]],
        theme: 'grid',
        styles: { 
            fontSize: 9, 
            cellPadding: 3,
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        headStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold', 
            halign: 'left',
            cellPadding: { left: 5, top: 3, bottom: 3, right: 3 }
        },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 40, halign: 'left' }
        },
        footStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold',
            halign: 'left'
        },
        didParseCell: (data) => {
            if (data.section === 'foot') {
                if (data.column.index === 0) data.cell.styles.halign = 'center';
                if (data.column.index === 2) data.cell.styles.cellPadding = { left: 5, top: 3, bottom: 3 };
            }
            if (data.section === 'body' || (data.section === 'head' && data.row.index === 1)) {
                data.cell.styles.cellPadding = { left: 5, top: 3, bottom: 3, right: 3 };
            }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- 3. Expense Section ---
    autoTable(doc, {
        startY: currentY,
        head: [
            [{ content: 'EXPENSE (OUTWARD)', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }],
            ['SR NO', 'PARTICULARS / USAGE', 'AMOUNT (INR)']
        ],
        body: expenseRows.map((row, i) => [i + 1, row.particulars, parseFloat(row.amount).toFixed(2)]),
        foot: [['TOTAL', '', expenseRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0).toFixed(2)]],
        theme: 'grid',
        styles: { 
            fontSize: 9, 
            cellPadding: 3,
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        headStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold', 
            halign: 'left',
            cellPadding: { left: 5, top: 3, bottom: 3, right: 3 }
        },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 40, halign: 'left' }
        },
        footStyles: { 
            fillColor: [255, 255, 255], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold',
            halign: 'left'
        },
        didParseCell: (data) => {
            if (data.section === 'foot') {
                if (data.column.index === 0) data.cell.styles.halign = 'center';
                if (data.column.index === 2) data.cell.styles.cellPadding = { left: 5, top: 3, bottom: 3 };
            }
            if (data.section === 'body' || (data.section === 'head' && data.row.index === 1)) {
                data.cell.styles.cellPadding = { left: 5, top: 3, bottom: 3, right: 3 };
            }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // --- 4. Closing Balance ---
    const totalIncome = incomeRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    const totalExpense = expenseRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    const netBalance = totalIncome - totalExpense;

    autoTable(doc, {
        startY: currentY,
        body: [['CLOSING NET BALANCE:', '', netBalance.toFixed(2)]],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 4, fontStyle: 'normal' },
        columnStyles: {
            0: { cellWidth: 'auto', halign: 'center' },
            1: { cellWidth: 0 }, // dummy to match columns
            2: { cellWidth: 40, halign: 'left', cellPadding: { left: 5, top: 4, bottom: 4 } }
        }
    });

    doc.save(`Daily_Cash_Statement_${config.date.replace(/[\/\-]/g, '_')}.pdf`);
};

/**
 * Specialized export for Cashbook Entry Sheet with precise formatting for Excel
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

    // Styling logic simplified for standard SheetJS compatibility
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
