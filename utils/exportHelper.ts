
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

    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 12) }));
    ws['!cols'] = colWidths;

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
 * - Includes Opening Balance contextually from the record's raw_data
 */
export const exportCashbookEntryToPDF = (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string; openingBalance: number; openingDateText: string }
) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 25;

    // 1. Company Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(config.companyName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    // 2. Daily Cash Statement
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`DAILY CASH STATEMENT - DATE: ${config.date}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    // 3. Opening Balance Section (Explicit row as requested)
    autoTable(doc, {
        startY: currentY,
        body: [
            [`OPENING BALANCE OF DATE ${config.openingDateText}:`, config.openingBalance.toFixed(2)]
        ],
        theme: 'grid',
        styles: { fontSize: 10, fontStyle: 'bold', cellPadding: 5, textColor: [0, 0, 0], lineWidth: 0.2 },
        columnStyles: {
            0: { halign: 'left', cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 45 }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 4. Income Section
    autoTable(doc, {
        startY: currentY,
        head: [
            [{ content: 'INCOME (INWARD)', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }],
            ['SR NO', 'PARTICULARS / SOURCE', 'AMOUNT (INR)']
        ],
        body: incomeRows.map((row, i) => [i + 1, row.particulars, parseFloat(row.amount).toFixed(2)]),
        foot: [['TOTAL INWARD', '', incomeRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0).toFixed(2)]],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4, lineWidth: 0.1, lineColor: [150, 150, 150] },
        columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 45, halign: 'right' } },
        footStyles: { fontStyle: 'bold', fillColor: [245, 255, 245] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 5. Expense Section
    autoTable(doc, {
        startY: currentY,
        head: [
            [{ content: 'EXPENSE (OUTWARD)', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }],
            ['SR NO', 'PARTICULARS / USAGE', 'AMOUNT (INR)']
        ],
        body: expenseRows.map((row, i) => [i + 1, row.particulars, parseFloat(row.amount).toFixed(2)]),
        foot: [['TOTAL OUTWARD', '', expenseRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0).toFixed(2)]],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4, lineWidth: 0.1, lineColor: [150, 150, 150] },
        columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 45, halign: 'right' } },
        footStyles: { fontStyle: 'bold', fillColor: [255, 245, 245] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 6. Final Summary
    const totalIn = incomeRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    const totalOut = expenseRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    const net = config.openingBalance + totalIn - totalOut;

    autoTable(doc, {
        startY: currentY,
        body: [
            ['NET CLOSING BALANCE:', net.toFixed(2)]
        ],
        theme: 'grid',
        styles: { fontSize: 12, fontStyle: 'bold', cellPadding: 6, fillColor: [255, 255, 255] },
        columnStyles: {
            0: { halign: 'right' },
            1: { halign: 'right', cellWidth: 45 }
        }
    });

    doc.save(`Cashbook_${config.date}.pdf`);
};

export const exportCashbookEntryToExcel = (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string; openingBalance: number; openingDateText: string }
) => {
    const ws_data: any[][] = [];
    ws_data.push([config.companyName.toUpperCase()]);
    ws_data.push([`DAILY CASH STATEMENT - DATE: ${config.date}`]);
    ws_data.push([]);
    
    // Explicit Opening Balance Row
    ws_data.push([`OPENING BALANCE OF DATE ${config.openingDateText}`, "", config.openingBalance]);
    ws_data.push([]);

    ws_data.push(["INCOME (INWARD)"]);
    ws_data.push(["SR NO", "PARTICULARS", "AMOUNT"]);
    let totalIn = 0;
    incomeRows.forEach((r, i) => {
        const amt = parseFloat(r.amount) || 0;
        totalIn += amt;
        ws_data.push([i + 1, r.particulars, amt]);
    });
    ws_data.push(["TOTAL INWARD", "", totalIn]);
    
    ws_data.push([]);
    ws_data.push(["EXPENSE (OUTWARD)"]);
    ws_data.push(["SR NO", "PARTICULARS", "AMOUNT"]);
    let totalOut = 0;
    expenseRows.forEach((r, i) => {
        const amt = parseFloat(r.amount) || 0;
        totalOut += amt;
        ws_data.push([i + 1, r.particulars, amt]);
    });
    ws_data.push(["TOTAL OUTWARD", "", totalOut]);
    
    ws_data.push([]);
    const closing = config.openingBalance + totalIn - totalOut;
    ws_data.push(["NET CLOSING BALANCE", "", closing]);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `Cashbook_${config.date}.xlsx`);
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
