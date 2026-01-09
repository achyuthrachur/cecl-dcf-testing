// ============================================================================
// Excel Export with ExcelJS
// Generates formatted workbook with summary sheet and per-loan sheets
// ============================================================================

import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import {
  Segment,
  CalculationResult,
  ForecastCurve,
  LoanInput,
  PeriodCashFlow,
} from '@/types';

// ----------------------------------------------------------------------------
// Style Definitions
// ----------------------------------------------------------------------------

const STYLES = {
  header: {
    font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FF0070C4' },
    },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      left: { style: 'thin' as const },
      right: { style: 'thin' as const },
    },
  },
  subHeader: {
    font: { bold: true, size: 11, color: { argb: 'FF072849' } },
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFE0EFFE' },
    },
    alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      left: { style: 'thin' as const },
      right: { style: 'thin' as const },
    },
  },
  dataCell: {
    alignment: { vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin' as const, color: { argb: 'FFD0D0D0' } },
    },
  },
  currency: {
    numFmt: '"$"#,##0.00',
  },
  percent: {
    numFmt: '0.000%',
  },
  percentShort: {
    numFmt: '0.00%',
  },
  date: {
    numFmt: 'yyyy-mm-dd',
  },
  number: {
    numFmt: '#,##0.00',
  },
  integer: {
    numFmt: '#,##0',
  },
  positiveVariance: {
    font: { color: { argb: 'FF529652' } },
  },
  negativeVariance: {
    font: { color: { argb: 'FFDC2626' } },
  },
  altRow: {
    fill: {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFF8FAFC' },
    },
  },
};

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = STYLES.header.font;
    cell.fill = STYLES.header.fill;
    cell.alignment = STYLES.header.alignment;
    cell.border = STYLES.header.border;
  });
  row.height = 24;
}

function applySubHeaderStyle(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = STYLES.subHeader.font;
    cell.fill = STYLES.subHeader.fill;
    cell.alignment = STYLES.subHeader.alignment;
    cell.border = STYLES.subHeader.border;
  });
  row.height = 20;
}

function applyDataCellStyle(cell: ExcelJS.Cell, isAltRow: boolean = false): void {
  cell.border = STYLES.dataCell.border;
  cell.alignment = STYLES.dataCell.alignment;
  if (isAltRow) {
    cell.fill = STYLES.altRow.fill;
  }
}

function formatCurrency(cell: ExcelJS.Cell): void {
  cell.numFmt = STYLES.currency.numFmt;
}

function formatPercent(cell: ExcelJS.Cell, short: boolean = false): void {
  cell.numFmt = short ? STYLES.percentShort.numFmt : STYLES.percent.numFmt;
}

function formatDate(cell: ExcelJS.Cell): void {
  cell.numFmt = STYLES.date.numFmt;
}

function formatNumber(cell: ExcelJS.Cell): void {
  cell.numFmt = STYLES.number.numFmt;
}

function sanitizeSheetName(name: string): string {
  // Excel sheet names have restrictions
  return name
    .replace(/[\\/*?[\]:]/g, '_')
    .substring(0, 31);
}

// ----------------------------------------------------------------------------
// Summary Sheet
// ----------------------------------------------------------------------------

function createSummarySheet(
  workbook: ExcelJS.Workbook,
  segment: Segment,
  results: CalculationResult[]
): void {
  const sheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
  });

  // Title row
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `CECL DCF Analysis - ${segment.name}`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF072849' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Metadata row
  sheet.mergeCells('A2:H2');
  const metaCell = sheet.getCell('A2');
  metaCell.value = `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Loans: ${results.length}`;
  metaCell.font = { size: 10, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Blank row
  sheet.getRow(3).height = 10;

  // Summary statistics
  const totalActualReserve = results.reduce((sum, r) => sum + r.actualReserve, 0);
  const totalCalculatedReserve = results.reduce((sum, r) => sum + r.calculatedReserve, 0);
  const totalVariance = totalCalculatedReserve - totalActualReserve;
  const avgConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + r.loanInput.confidence, 0) / results.length
    : 0;

  sheet.getCell('A4').value = 'Total Actual Reserve:';
  sheet.getCell('A4').font = { bold: true };
  sheet.getCell('B4').value = totalActualReserve;
  formatCurrency(sheet.getCell('B4'));

  sheet.getCell('C4').value = 'Total Calculated Reserve:';
  sheet.getCell('C4').font = { bold: true };
  sheet.getCell('D4').value = totalCalculatedReserve;
  formatCurrency(sheet.getCell('D4'));

  sheet.getCell('E4').value = 'Total Variance:';
  sheet.getCell('E4').font = { bold: true };
  sheet.getCell('F4').value = totalVariance;
  formatCurrency(sheet.getCell('F4'));
  sheet.getCell('F4').font = {
    ...sheet.getCell('F4').font,
    color: { argb: totalVariance >= 0 ? 'FF529652' : 'FFDC2626' },
  };

  sheet.getCell('G4').value = 'Avg Confidence:';
  sheet.getCell('G4').font = { bold: true };
  sheet.getCell('H4').value = avgConfidence;
  formatPercent(sheet.getCell('H4'), true);

  // Headers
  const headers = [
    'Loan Number',
    'Calculation Date',
    'Book Balance',
    'Effective Yield',
    'Actual Reserve',
    'Calculated Reserve',
    'Variance $',
    'Variance %',
  ];

  const headerRow = sheet.addRow(headers);
  applyHeaderStyle(headerRow);

  // Column widths
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 18;
  sheet.getColumn(7).width = 14;
  sheet.getColumn(8).width = 12;

  // Data rows
  results.forEach((result, idx) => {
    const loan = result.loanInput;
    const isAltRow = idx % 2 === 1;

    const row = sheet.addRow([
      loan.loanNumber,
      new Date(loan.calculationDate),
      loan.bookBalance,
      loan.effectiveYield,
      result.actualReserve,
      result.calculatedReserve,
      result.varianceDollar,
      result.variancePercent / 100,
    ]);

    row.eachCell((cell, colNumber) => {
      applyDataCellStyle(cell, isAltRow);
      switch (colNumber) {
        case 2:
          formatDate(cell);
          break;
        case 3:
        case 5:
        case 6:
        case 7:
          formatCurrency(cell);
          break;
        case 4:
        case 8:
          formatPercent(cell, true);
          break;
      }

      // Color variance
      if (colNumber === 7 || colNumber === 8) {
        const value = cell.value as number;
        cell.font = {
          color: { argb: value >= 0 ? 'FF529652' : 'FFDC2626' },
        };
      }
    });
  });

  // Add link to each loan sheet
  sheet.getColumn(1).eachCell((cell, rowNumber) => {
    if (rowNumber > 5 && cell.value) {
      const loanNumber = cell.value.toString();
      const sheetName = sanitizeSheetName(`Loan_${loanNumber}`);
      cell.value = {
        text: loanNumber,
        hyperlink: `#'${sheetName}'!A1`,
      };
      cell.font = { ...cell.font, underline: true, color: { argb: 'FF0070C4' } };
    }
  });
}

// ----------------------------------------------------------------------------
// Loan Sheet
// ----------------------------------------------------------------------------

function createLoanSheet(
  workbook: ExcelJS.Workbook,
  result: CalculationResult,
  pdCurve: ForecastCurve,
  lgdCurve: ForecastCurve
): void {
  const loan = result.loanInput;
  const sheetName = sanitizeSheetName(`Loan_${loan.loanNumber}`);

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  let currentRow = 1;

  // ---- Loan Header Section ----
  sheet.mergeCells(`A${currentRow}:H${currentRow}`);
  const titleCell = sheet.getCell(`A${currentRow}`);
  titleCell.value = `Loan: ${loan.loanNumber}`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF072849' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getRow(currentRow).height = 26;
  currentRow++;

  // ---- Input Parameters Section ----
  currentRow++;
  const inputHeaderRow = sheet.addRow(['Loan Input Parameters']);
  sheet.mergeCells(`A${currentRow}:D${currentRow}`);
  applySubHeaderStyle(inputHeaderRow);
  currentRow++;

  const inputFields = [
    ['Loan Number', loan.loanNumber, 'Calculation Date', format(new Date(loan.calculationDate), 'yyyy-MM-dd')],
    ['Book Balance', loan.bookBalance, 'Unamortized Amount', loan.unamortizedAmount],
    ['Interest Rate', loan.interestRate, 'Effective Yield', loan.effectiveYield],
    ['Payment Type', loan.paymentType, 'Payment Amount', loan.paymentAmount],
    ['Payment Frequency', loan.paymentFrequency, 'Amortization Days', loan.amortizationDays],
    ['Maturity Date', format(new Date(loan.maturityDate), 'yyyy-MM-dd'), 'Periods', loan.periods],
    ['CPR', loan.cpr, 'SMM', loan.smm],
    ['Curtailment Rate', loan.curtailmentRate, 'Recovery Delay', loan.recoveryDelay],
  ];

  inputFields.forEach((fields) => {
    const row = sheet.addRow(fields);
    row.getCell(1).font = { bold: true };
    row.getCell(3).font = { bold: true };

    // Format values
    const val2 = row.getCell(2);
    const val4 = row.getCell(4);

    if (typeof fields[1] === 'number') {
      if (fields[0].toString().includes('Rate') || fields[0].toString().includes('Yield') ||
          fields[0].toString().includes('CPR') || fields[0].toString().includes('SMM')) {
        formatPercent(val2, true);
      } else if (fields[0].toString().includes('Balance') || fields[0].toString().includes('Amount')) {
        formatCurrency(val2);
      }
    }
    if (typeof fields[3] === 'number') {
      if (fields[2].toString().includes('Rate') || fields[2].toString().includes('Yield') ||
          fields[2].toString().includes('CPR') || fields[2].toString().includes('SMM')) {
        formatPercent(val4, true);
      } else if (fields[2].toString().includes('Balance') || fields[2].toString().includes('Amount')) {
        formatCurrency(val4);
      }
    }
    currentRow++;
  });

  // ---- Results Section ----
  currentRow++;
  const resultsHeaderRow = sheet.addRow(['Calculation Results']);
  sheet.mergeCells(`A${currentRow}:D${currentRow}`);
  applySubHeaderStyle(resultsHeaderRow);
  currentRow++;

  const resultFields = [
    ['Net Present Value', result.netPresentValue, 'Calculated Reserve', result.calculatedReserve],
    ['Actual Reserve', result.actualReserve, 'Variance $', result.varianceDollar],
    ['Variance %', result.variancePercent / 100, 'Extraction Confidence', loan.confidence],
    ['Total Interest', result.totalInterest, 'Total Principal', result.totalPrincipal],
    ['Total Prepayment', result.totalPrepayment, 'Total Default', result.totalDefault],
    ['Total Loss', result.totalLoss, 'Total Recovery', result.totalRecovery],
  ];

  resultFields.forEach((fields) => {
    const row = sheet.addRow(fields);
    row.getCell(1).font = { bold: true };
    row.getCell(3).font = { bold: true };

    const val2 = row.getCell(2);
    const val4 = row.getCell(4);

    if (typeof fields[1] === 'number') {
      if (fields[0].toString().includes('%') || fields[0].toString().includes('Confidence')) {
        formatPercent(val2, true);
      } else {
        formatCurrency(val2);
      }
    }
    if (typeof fields[3] === 'number') {
      if (fields[2].toString().includes('%') || fields[2].toString().includes('Confidence')) {
        formatPercent(val4, true);
        // Color variance
        if (fields[2].toString().includes('Variance')) {
          val4.font = {
            color: { argb: (fields[3] as number) >= 0 ? 'FF529652' : 'FFDC2626' },
          };
        }
      } else {
        formatCurrency(val4);
        // Color variance
        if (fields[2].toString().includes('Variance')) {
          val4.font = {
            color: { argb: (fields[3] as number) >= 0 ? 'FF529652' : 'FFDC2626' },
          };
        }
      }
    }
    currentRow++;
  });

  // ---- PD/LGD Curves Section ----
  currentRow += 2;
  const forecastHeaderRow = sheet.addRow(['Forecast Curves']);
  sheet.mergeCells(`A${currentRow}:H${currentRow}`);
  applySubHeaderStyle(forecastHeaderRow);
  currentRow++;

  // PD Curve
  const pdHeader = sheet.addRow(['PD Curve', '', '', '', 'LGD Curve']);
  pdHeader.getCell(1).font = { bold: true };
  pdHeader.getCell(5).font = { bold: true };
  currentRow++;

  const forecastColHeaders = sheet.addRow(['Start Date', 'End Date', 'PD Rate', '', 'Start Date', 'End Date', 'LGD Rate']);
  forecastColHeaders.eachCell((cell) => {
    if (cell.value) {
      cell.font = { bold: true };
      cell.fill = STYLES.subHeader.fill;
    }
  });
  currentRow++;

  const maxPeriods = Math.max(pdCurve.periods?.length || 0, lgdCurve.periods?.length || 0);

  for (let i = 0; i < maxPeriods; i++) {
    const pdPeriod = pdCurve.periods?.[i];
    const lgdPeriod = lgdCurve.periods?.[i];

    const row = sheet.addRow([
      pdPeriod ? format(new Date(pdPeriod.startDate), 'yyyy-MM-dd') : '',
      pdPeriod ? format(new Date(pdPeriod.endDate), 'yyyy-MM-dd') : '',
      pdPeriod ? pdPeriod.rateDecimal : '',
      '',
      lgdPeriod ? format(new Date(lgdPeriod.startDate), 'yyyy-MM-dd') : '',
      lgdPeriod ? format(new Date(lgdPeriod.endDate), 'yyyy-MM-dd') : '',
      lgdPeriod ? lgdPeriod.rateDecimal : '',
    ]);

    if (pdPeriod) formatPercent(row.getCell(3));
    if (lgdPeriod) formatPercent(row.getCell(7));
    currentRow++;
  }

  // ---- Cash Flow Schedule ----
  currentRow += 2;
  const cfHeaderRow = sheet.addRow(['Cash Flow Schedule']);
  sheet.mergeCells(`A${currentRow}:M${currentRow}`);
  applySubHeaderStyle(cfHeaderRow);
  currentRow++;

  const cfHeaders = [
    'Period',
    'Date',
    'Beginning Balance',
    'Interest',
    'Principal',
    'Prepayment',
    'Default',
    'Loss',
    'Recovery',
    'Total CF',
    'Discount Factor',
    'Present Value',
    'Ending Balance',
  ];

  const cfHeaderRow2 = sheet.addRow(cfHeaders);
  applyHeaderStyle(cfHeaderRow2);
  currentRow++;

  // Set column widths
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 14;
  sheet.getColumn(8).width = 14;
  sheet.getColumn(9).width = 14;
  sheet.getColumn(10).width = 14;
  sheet.getColumn(11).width = 14;
  sheet.getColumn(12).width = 14;
  sheet.getColumn(13).width = 16;

  // Cash flow data
  result.cashFlows.forEach((cf, idx) => {
    const isAltRow = idx % 2 === 1;
    const row = sheet.addRow([
      cf.period,
      new Date(cf.date),
      cf.beginningBalance,
      cf.interestPayment,
      cf.scheduledPrincipal,
      cf.prepayment,
      cf.defaultAmount,
      cf.lossAmount,
      cf.recoveryAmount,
      cf.totalCashFlow,
      cf.discountFactor,
      cf.presentValue,
      cf.endingBalance,
    ]);

    row.eachCell((cell, colNumber) => {
      applyDataCellStyle(cell, isAltRow);
      if (colNumber === 2) {
        formatDate(cell);
      } else if (colNumber === 11) {
        formatNumber(cell);
      } else if (colNumber >= 3) {
        formatCurrency(cell);
      }
    });
  });
}

// ----------------------------------------------------------------------------
// Main Export Function
// ----------------------------------------------------------------------------

export async function generateExcelReport(
  segment: Segment,
  results: CalculationResult[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Set workbook properties
  workbook.creator = 'CECL DCF Testing App';
  workbook.lastModifiedBy = 'CECL DCF Testing App';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  // Create summary sheet
  createSummarySheet(workbook, segment, results);

  // Create individual loan sheets
  for (const result of results) {
    createLoanSheet(
      workbook,
      result,
      segment.pdCurve!,
      segment.lgdCurve!
    );
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ----------------------------------------------------------------------------
// CSV Export (Alternative)
// ----------------------------------------------------------------------------

export function generateCSVExport(results: CalculationResult[]): string {
  const headers = [
    'Loan Number',
    'Calculation Date',
    'Book Balance',
    'Unamortized Amount',
    'Effective Yield',
    'Interest Rate',
    'Periods',
    'Payment Type',
    'Actual Reserve',
    'Calculated Reserve',
    'Variance $',
    'Variance %',
    'Extraction Confidence',
  ];

  const rows = results.map((r) => {
    const loan = r.loanInput;
    return [
      loan.loanNumber,
      format(new Date(loan.calculationDate), 'yyyy-MM-dd'),
      loan.bookBalance.toFixed(2),
      loan.unamortizedAmount.toFixed(2),
      (loan.effectiveYield * 100).toFixed(4),
      (loan.interestRate * 100).toFixed(4),
      loan.periods,
      loan.paymentType,
      r.actualReserve.toFixed(2),
      r.calculatedReserve.toFixed(2),
      r.varianceDollar.toFixed(2),
      r.variancePercent.toFixed(4),
      (loan.confidence * 100).toFixed(2),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
