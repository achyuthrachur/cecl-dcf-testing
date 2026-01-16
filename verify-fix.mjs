/**
 * Verification Script - Extract Excel Data and Compare Before/After Fix
 */
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Loan data from screenshot
const LOAN = {
  bookBalance: 7412919.25,
  unamortizedAmount: -11822.35,
  interestRate: 0.0345,
  effectiveYield: 0.035905,
  paymentAmount: 41265.50,
  periods: 86,
  smm: 0.002853,
  recoveryDelay: 12,
  actualReserve: 27775.96,
};

// Normalization function (the fix)
function normalizeRateToDecimal(rate, fieldName) {
  if (rate === 0 || rate === undefined || rate === null) {
    return { value: 0, wasConverted: false };
  }
  if (rate > 0.25) {
    const convertedRate = rate / 100;
    return {
      value: convertedRate,
      wasConverted: true,
      warning: `${fieldName} was ${rate}, converted to ${convertedRate.toFixed(6)}`
    };
  }
  return { value: rate, wasConverted: false };
}

// Calculation function
function calculateNPV(loan, annualPdInput, lgdInput, applyFix) {
  let annualPd = annualPdInput;
  let lgd = lgdInput;
  const conversions = [];

  if (applyFix) {
    const pdNorm = normalizeRateToDecimal(annualPdInput, 'PD');
    const lgdNorm = normalizeRateToDecimal(lgdInput, 'LGD');
    annualPd = pdNorm.value;
    lgd = lgdNorm.value;
    if (pdNorm.wasConverted) conversions.push(pdNorm.warning);
    if (lgdNorm.wasConverted) conversions.push(lgdNorm.warning);
  }

  // Convert annual PD to monthly
  const monthlyPd = 1 - Math.pow(1 - annualPd, 1 / 12);

  let balance = loan.bookBalance;
  let totalPV = 0;
  let totalDefaults = 0;
  let totalLosses = 0;
  const pendingRecoveries = [];

  for (let period = 1; period <= loan.periods; period++) {
    if (balance <= 0.01) break;

    const monthlyRate = loan.interestRate / 12;
    const interest = Math.round(balance * monthlyRate * 100) / 100;
    const principal = Math.round(Math.max(0, Math.min(loan.paymentAmount - interest, balance)) * 100) / 100;
    const rawPrepay = balance * loan.smm;
    const prepayment = Math.round(Math.max(0, Math.min(rawPrepay, balance - principal)) * 100) / 100;
    const rawDefault = balance * monthlyPd;
    const maxDefault = balance - principal - prepayment;
    const defaultAmt = Math.round(Math.max(0, Math.min(rawDefault, maxDefault)) * 100) / 100;
    const loss = Math.round(defaultAmt * lgd * 100) / 100;
    const recoveryAtDefault = defaultAmt - loss;

    if (recoveryAtDefault > 0) {
      pendingRecoveries.push({ period: period + loan.recoveryDelay, amount: recoveryAtDefault });
    }

    const recovery = pendingRecoveries
      .filter(r => r.period === period)
      .reduce((sum, r) => sum + r.amount, 0);

    const cashFlow = interest + principal + prepayment + recovery;
    const discountFactor = 1 / Math.pow(1 + loan.effectiveYield, period / 12);
    const pv = cashFlow * discountFactor;
    totalPV += pv;
    totalDefaults += defaultAmt;
    totalLosses += loss;

    balance = Math.max(0, balance - principal - prepayment - defaultAmt);
  }

  const calculatedReserve = loan.bookBalance + loan.unamortizedAmount - totalPV;
  const variance = calculatedReserve - loan.actualReserve;
  const variancePct = (variance / loan.actualReserve) * 100;

  return {
    annualPdUsed: annualPd,
    lgdUsed: lgd,
    monthlyPd,
    totalPV,
    calculatedReserve,
    variance,
    variancePct,
    totalDefaults,
    totalLosses,
    conversions
  };
}

async function extractExcelRates() {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(__dirname, 'Template.xlsm');

  console.log('Reading Excel template...');
  await workbook.xlsx.readFile(templatePath);

  const rates = { pd: [], lgd: [] };

  // Search through worksheets for PD/LGD data
  for (const worksheet of workbook.worksheets) {
    const name = worksheet.name.toLowerCase();
    console.log(`\nChecking sheet: ${worksheet.name}`);

    // Look for PD or LGD in sheet name or content
    for (let rowNum = 1; rowNum <= Math.min(worksheet.rowCount, 50); rowNum++) {
      const row = worksheet.getRow(rowNum);
      for (let colNum = 1; colNum <= Math.min(20, worksheet.columnCount); colNum++) {
        const cell = row.getCell(colNum);
        let value = cell.value;

        // Handle formula results
        if (typeof value === 'object' && value !== null && value.result !== undefined) {
          value = value.result;
        }

        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower.includes('pd') || lower.includes('probability') || lower.includes('default rate')) {
            // Check adjacent cells for rate values
            for (let checkCol = colNum + 1; checkCol <= colNum + 5; checkCol++) {
              const rateCell = row.getCell(checkCol);
              let rateValue = rateCell.value;
              if (typeof rateValue === 'object' && rateValue !== null && rateValue.result !== undefined) {
                rateValue = rateValue.result;
              }
              if (typeof rateValue === 'number' && rateValue > 0 && rateValue < 100) {
                rates.pd.push({ row: rowNum, col: checkCol, value: rateValue, label: value });
              }
            }
          }
          if (lower.includes('lgd') || lower.includes('loss given') || lower.includes('loss rate')) {
            for (let checkCol = colNum + 1; checkCol <= colNum + 5; checkCol++) {
              const rateCell = row.getCell(checkCol);
              let rateValue = rateCell.value;
              if (typeof rateValue === 'object' && rateValue !== null && rateValue.result !== undefined) {
                rateValue = rateValue.result;
              }
              if (typeof rateValue === 'number' && rateValue > 0 && rateValue < 100) {
                rates.lgd.push({ row: rowNum, col: checkCol, value: rateValue, label: value });
              }
            }
          }
        }
      }
    }
  }

  return rates;
}

async function main() {
  console.log('='.repeat(80));
  console.log('VERIFICATION: NPV Calculation Fix');
  console.log('='.repeat(80));

  // Try to extract rates from Excel
  let excelRates;
  try {
    excelRates = await extractExcelRates();
    console.log('\nFound PD rates:', excelRates.pd.length > 0 ? excelRates.pd : 'None found');
    console.log('Found LGD rates:', excelRates.lgd.length > 0 ? excelRates.lgd : 'None found');
  } catch (err) {
    console.log('Could not read Excel:', err.message);
  }

  // Test scenarios - simulating what might be in the forecast curves
  const testCases = [
    { name: 'Scenario 1: PD=0.5 (50%), LGD=0.4 (40%) - LIKELY WRONG SCALE', pd: 0.5, lgd: 0.4 },
    { name: 'Scenario 2: PD=1.5 (150%), LGD=0.4 (40%) - DEFINITELY WRONG', pd: 1.5, lgd: 0.4 },
    { name: 'Scenario 3: PD=0.005 (0.5%), LGD=0.4 (40%) - CORRECT SCALE', pd: 0.005, lgd: 0.4 },
    { name: 'Scenario 4: PD=0.01 (1%), LGD=0.35 (35%) - CORRECT SCALE', pd: 0.01, lgd: 0.35 },
    { name: 'Scenario 5: PD=0.3 (30%), LGD=0.5 (50%) - WRONG SCALE', pd: 0.3, lgd: 0.5 },
  ];

  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON: Before Fix vs After Fix');
  console.log('='.repeat(80));
  console.log(`\nActual Reserve from Excel: $${LOAN.actualReserve.toLocaleString()}`);
  console.log(`Expected NPV: $${(LOAN.bookBalance + LOAN.unamortizedAmount - LOAN.actualReserve).toLocaleString()}`);

  for (const tc of testCases) {
    console.log('\n' + '-'.repeat(80));
    console.log(tc.name);
    console.log('-'.repeat(80));

    // Calculate WITHOUT fix (old behavior)
    const beforeFix = calculateNPV(LOAN, tc.pd, tc.lgd, false);

    // Calculate WITH fix (new behavior)
    const afterFix = calculateNPV(LOAN, tc.pd, tc.lgd, true);

    console.log('\nBEFORE FIX (no normalization):');
    console.log(`  PD used: ${(beforeFix.annualPdUsed * 100).toFixed(4)}%`);
    console.log(`  LGD used: ${(beforeFix.lgdUsed * 100).toFixed(2)}%`);
    console.log(`  Monthly PD: ${(beforeFix.monthlyPd * 100).toFixed(4)}%`);
    console.log(`  Total Defaults: $${beforeFix.totalDefaults.toLocaleString()}`);
    console.log(`  Total Losses: $${beforeFix.totalLosses.toLocaleString()}`);
    console.log(`  Calculated NPV: $${beforeFix.totalPV.toLocaleString(undefined, {maximumFractionDigits: 2})}`);
    console.log(`  Calculated Reserve: $${beforeFix.calculatedReserve.toLocaleString(undefined, {maximumFractionDigits: 2})}`);
    console.log(`  Variance: $${beforeFix.variance.toLocaleString(undefined, {maximumFractionDigits: 2})} (${beforeFix.variancePct.toFixed(2)}%)`);

    console.log('\nAFTER FIX (with normalization):');
    if (afterFix.conversions.length > 0) {
      console.log(`  Conversions applied: ${afterFix.conversions.join(', ')}`);
    }
    console.log(`  PD used: ${(afterFix.annualPdUsed * 100).toFixed(4)}%`);
    console.log(`  LGD used: ${(afterFix.lgdUsed * 100).toFixed(2)}%`);
    console.log(`  Monthly PD: ${(afterFix.monthlyPd * 100).toFixed(4)}%`);
    console.log(`  Total Defaults: $${afterFix.totalDefaults.toLocaleString()}`);
    console.log(`  Total Losses: $${afterFix.totalLosses.toLocaleString()}`);
    console.log(`  Calculated NPV: $${afterFix.totalPV.toLocaleString(undefined, {maximumFractionDigits: 2})}`);
    console.log(`  Calculated Reserve: $${afterFix.calculatedReserve.toLocaleString(undefined, {maximumFractionDigits: 2})}`);
    console.log(`  Variance: $${afterFix.variance.toLocaleString(undefined, {maximumFractionDigits: 2})} (${afterFix.variancePct.toFixed(2)}%)`);

    // Show improvement
    if (Math.abs(afterFix.variancePct) < Math.abs(beforeFix.variancePct)) {
      const improvement = Math.abs(beforeFix.variancePct) - Math.abs(afterFix.variancePct);
      console.log(`\n  >>> IMPROVEMENT: Variance reduced by ${improvement.toFixed(2)} percentage points <<<`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`
The fix normalizes PD/LGD rates that are > 0.25 (25%) by dividing by 100.

If your forecast curves have rates like:
  - PD = 0.5 (meaning 0.5%), the fix converts it to 0.005
  - PD = 1.5 (meaning 1.5%), the fix converts it to 0.015
  - LGD = 40 (meaning 40%), the fix converts it to 0.40

This should bring the variance from ~10,000% down to a reasonable level.
`);
}

main().catch(console.error);
