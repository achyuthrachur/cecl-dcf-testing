/**
 * Quick test script to run a loan through the calculation engine
 *
 * Usage: npx ts-node scripts/test-loan.ts
 * Or add to package.json: "test:loan": "ts-node scripts/test-loan.ts"
 */

import { calculateDCF } from '../src/lib/calculation-engine';
import { LoanInput, ForecastCurve, AmortizationDays } from '../src/types';

// ============================================================================
// CONFIGURE YOUR LOAN HERE - Values from Excel screenshot
// ============================================================================

const loan: LoanInput = {
  id: 'test-loan-1',
  segmentId: 'CRE-Nonowner',
  loanNumber: '772400892',

  // Dates
  calculationDate: new Date('2025-06-30'),
  // Remaining Term = 115 months from 6/30/2025
  maturityDate: new Date('2035-01-31'),  // 115 months from calc date

  // Balance
  bookBalance: 7816559.59,
  unamortizedAmount: -34898.48,  // Negative per Excel

  // Rates (as decimals)
  interestRate: 0.06751,        // 6.7510%
  effectiveYield: 0.071497,     // 7.1497% (Manual Discount Rate from Excel)

  // Payment structure
  amortizationDays: 'Actual 360' as AmortizationDays,
  paymentType: 'Fixed Payment',
  paymentAmount: 56752.65,
  paymentFrequency: 'Monthly',

  // Term
  periods: 126,                 // From Excel

  // Reamortization settings
  reamortize: true,             // "Reamortize Each Period: Yes"
  amortizationTerm: 271,        // "Inferred Am through: 271.0"

  // Prepayment (as decimals)
  // Prepay/Curtail use same Excel formula: =ROUND(1-(1-rate)^(1/12),6)
  cpr: 0.0337,                  // 3.3700% Prepayment Rate (annual, will be converted)
  smm: 0,                       // Let engine convert CPR to SMM using compound formula
  curtailmentRate: 0.0208,      // 2.0800% Curtailment Rate (annual)

  // Recovery
  recoveryDelay: 12,            // Recovery Lag: 12

  // Actual values for comparison (from Excel)
  actualPresentValue: 7736974.94,
  actualReserve: 44688.32,      // Abrigo Reserve
  actualReservePercent: 0.005717,

  // Metadata
  extractedAt: new Date(),
  confidence: 1,
  corrected: false,
};

// ============================================================================
// PD CURVE - Quarterly rates from Excel (will be converted to monthly)
// ============================================================================

// Helper to create quarterly periods aligned with schedule periods
// Excel maps periods to quarters: ROUNDUP(period/3,0)
// So periods 1-3 → Q1, periods 4-6 → Q2, etc.
// Schedule periods are end-of-month starting one month after calcDate
function createQuarterlyPeriod(quarterIndex: number, startDate: Date): { start: Date; end: Date } {
  // Q1 should cover schedule periods 1-3 (months 1-3 after calcDate)
  // Q2 should cover schedule periods 4-6 (months 4-6 after calcDate)
  // etc.

  // Start: first day of the quarter's first month (1 month after calcDate for Q1)
  const start = new Date(startDate);
  start.setMonth(start.getMonth() + 1 + (quarterIndex - 1) * 3);
  start.setDate(1);  // First of month

  // End: last day of the quarter's third month
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);  // Move to first of next quarter
  end.setDate(0);  // Back to last day of previous month

  return { start, end };
}

const calcDate = new Date('2025-06-30');

// PD rates by quarter from Excel (as decimals)
const pdRatesByQuarter = [
  0.005449,  // Q1: 0.5449%
  0.006000,  // Q2: 0.6000%
  0.005945,  // Q3: 0.5945%
  0.005891,  // Q4: 0.5891%
  0.006175,  // Q5: 0.6175%
  0.006459,  // Q6: 0.6459%
  0.006743,  // Q7: 0.6743%
  0.007028,  // Q8: 0.7028%
  0.007312,  // Q9: 0.7312%
  0.007596,  // Q10: 0.7596%
  0.007881,  // Q11: 0.7881%
  0.008165,  // Q12: 0.8165%
  0.008165,  // Q13: 0.8165%
  0.008165,  // Q14: 0.8165%
  0.008165,  // Q15: 0.8165%
  0.008165,  // Q16: 0.8165%
  0.008165,  // Q17: 0.8165%
  0.008165,  // Q18: 0.8165%
  0.008165,  // Q19: 0.8165%
  0.008165,  // Q20: 0.8165%
];

// LGD rates by quarter from Excel (as decimals)
const lgdRatesByQuarter = [
  0.078015,  // Q1: 7.8015%
  0.079967,  // Q2: 7.9967%
  0.079778,  // Q3: 7.9778%
  0.079588,  // Q4: 7.9588%
  0.080563,  // Q5: 8.0563%
  0.081509,  // Q6: 8.1509%
  0.082429,  // Q7: 8.2429%
  0.083324,  // Q8: 8.3324%
  0.084197,  // Q9: 8.4197%
  0.085049,  // Q10: 8.5049%
  0.085881,  // Q11: 8.5881%
  0.086694,  // Q12: 8.6694%
  0.086694,  // Q13: 8.6694%
  0.086694,  // Q14: 8.6694%
  0.086694,  // Q15: 8.6694%
  0.086694,  // Q16: 8.6694%
  0.086694,  // Q17: 8.6694%
  0.086694,  // Q18: 8.6694%
  0.086694,  // Q19: 8.6694%
  0.086694,  // Q20: 8.6694%
];

const pdCurve: ForecastCurve = {
  id: 'pd-curve-1',
  type: 'PD',
  periods: pdRatesByQuarter.map((rate, i) => {
    const { start, end } = createQuarterlyPeriod(i + 1, calcDate);
    return {
      startDate: start,
      endDate: end,
      rateDecimal: rate,
      confidence: 1,
    };
  }),
  extractedAt: new Date(),
  // Excel formula: =ROUND(1-(1-rate)^(1/12),6)
  // Rates are ANNUAL (indexed by quarter), convert with compound formula
  ratePeriod: 'annual',         // Rates are ANNUAL
  conversionMethod: 'compound', // 1 - (1 - rate)^(1/12) per Excel formula
};

// ============================================================================
// LGD CURVE - Quarterly rates from Excel
// ============================================================================

const lgdCurve: ForecastCurve = {
  id: 'lgd-curve-1',
  type: 'LGD',
  periods: lgdRatesByQuarter.map((rate, i) => {
    const { start, end } = createQuarterlyPeriod(i + 1, calcDate);
    return {
      startDate: start,
      endDate: end,
      rateDecimal: rate,
      confidence: 1,
    };
  }),
  extractedAt: new Date(),
};

// ============================================================================
// RUN CALCULATION
// ============================================================================

console.log('='.repeat(80));
console.log('CECL DCF Calculation Test');
console.log('='.repeat(80));

const result = calculateDCF(loan, pdCurve, lgdCurve);

// Print summary
console.log('\n--- LOAN SUMMARY ---');
console.log(`Loan Number: ${loan.loanNumber}`);
console.log(`Book Balance: $${loan.bookBalance.toLocaleString()}`);
console.log(`Interest Rate: ${(loan.interestRate * 100).toFixed(2)}%`);
console.log(`Maturity: ${loan.maturityDate.toISOString().split('T')[0]}`);
console.log(`Reamortize: ${loan.reamortize}`);
console.log(`Amortization Term: ${loan.amortizationTerm || 'Not specified (will infer)'}`);

console.log('\n--- CALCULATION RESULTS ---');
console.log(`Valid: ${result.valid}`);
console.log(`Net Present Value: $${result.netPresentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`Calculated Reserve: $${result.calculatedReserve.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`Total Periods: ${result.cashFlows.length}`);

console.log('\n--- COMPARISON WITH EXCEL/ABRIGO ---');
console.log(`                        Engine          Excel/Abrigo      Variance`);
console.log(`NPV of Cash Flows:    $${result.netPresentValue.toFixed(2).padStart(12)}    $${loan.actualPresentValue.toFixed(2).padStart(12)}    $${(result.netPresentValue - loan.actualPresentValue).toFixed(2).padStart(10)}`);
console.log(`Reserve Amount:       $${result.calculatedReserve.toFixed(2).padStart(12)}    $${loan.actualReserve.toFixed(2).padStart(12)}    $${(result.calculatedReserve - loan.actualReserve).toFixed(2).padStart(10)}`);
const engineReservePct = (result.calculatedReserve / loan.bookBalance) * 100;
const abrigoReservePct = loan.actualReservePercent * 100;
console.log(`Reserve %:                  ${engineReservePct.toFixed(4)}%           ${abrigoReservePct.toFixed(4)}%       ${(engineReservePct - abrigoReservePct).toFixed(4)}%`);

// Variance as percentage of RESERVE (not loan balance)
const varianceDollar = result.calculatedReserve - loan.actualReserve;
const variancePctOfReserve = loan.actualReserve !== 0 ? (varianceDollar / loan.actualReserve) * 100 : 0;
console.log(`\nVariance % of Reserve:      ${variancePctOfReserve.toFixed(4)}%`);

console.log('\n--- INTEREST CALCULATION DEBUG ---');
// Excel formula: InterestRate × AmortizationMultiplier × (Days/365)
const interestRate = 0.06751;
const amortMultiplier = 365/360;
const daysInPeriod1 = result.cashFlows[0]?.daysInPeriod || 31;
const excelMonthlyIntRate = interestRate * amortMultiplier * (daysInPeriod1 / 365);
const expectedInterest = loan.bookBalance * excelMonthlyIntRate;
console.log(`Interest Rate: ${(interestRate * 100).toFixed(4)}%`);
console.log(`Amort Multiplier (365/360): ${amortMultiplier.toFixed(10)}`);
console.log(`Days in Period 1: ${daysInPeriod1}`);
console.log(`Monthly Interest Rate: ${(excelMonthlyIntRate * 100).toFixed(6)}%`);
console.log(`Expected Interest: $${expectedInterest.toFixed(2)}`);
console.log(`Engine Interest:   $${result.cashFlows[0]?.interestPayment.toFixed(2)}`);
console.log(`Excel Interest:    $45,440.48`);
console.log(`Engine vs Excel:   $${(result.cashFlows[0]?.interestPayment - 45440.48).toFixed(2)}`);

// Back-calculate what Days would give Excel's interest
const excelInterest = 45404.48;
const impliedMonthlyRate = excelInterest / loan.bookBalance;
const impliedDays = (impliedMonthlyRate * 365) / (interestRate * amortMultiplier);
console.log(`\nBack-calculated from Excel's interest:`);
console.log(`Implied Monthly Rate: ${(impliedMonthlyRate * 100).toFixed(6)}%`);
console.log(`Implied Days: ${impliedDays.toFixed(2)}`);

console.log('\n--- RATE CONVERSION DEBUG ---');
// Verify the monthly PD rate conversion matches Excel
// Excel formula: =ROUND(1-(1-rate)^(1/12),6)
const q1Pd = 0.005449;
const compoundMonthlyPd = Math.round((1 - Math.pow(1 - q1Pd, 1/12)) * 1000000) / 1000000;
const simpleMonthlyPd = Math.round((q1Pd / 12) * 1000000) / 1000000;
console.log(`Q1 PD annual rate: ${(q1Pd * 100).toFixed(4)}%`);
console.log(`Compound monthly (1-(1-r)^(1/12)): ${(compoundMonthlyPd * 100).toFixed(6)}%`);
console.log(`Simple monthly (r/12):             ${(simpleMonthlyPd * 100).toFixed(6)}%`);
console.log(`First period PD rate in engine:    ${(result.cashFlows[0]?.pdRate * 100).toFixed(6)}%`);

// Verify prepay conversion
const annualPrepay = 0.0337;
const excelMonthlySMM = Math.round((1 - Math.pow(1 - annualPrepay, 1/12)) * 1000000) / 1000000;
console.log(`Prepay annual rate: ${(annualPrepay * 100).toFixed(4)}%`);
console.log(`Converted SMM (Excel formula): ${(excelMonthlySMM * 100).toFixed(6)}%`);
console.log(`SMM in engine:                 ${(result.cashFlows[0]?.smmRate * 100).toFixed(6)}%`);

console.log('\n--- REAMORTIZATION DEBUG ---');
console.log(`Reamortization Applied: ${result.debugInfo?.reamortizationApplied}`);
console.log(`Effective Amort Term: ${result.debugInfo?.effectiveAmortTerm} months`);
console.log(`Monthly Rate for PMT: ${((result.debugInfo?.monthlyRateForPMT || 0) * 100).toFixed(6)}%`);
console.log(`Last Reamort Payment: $${result.debugInfo?.reamortPaymentUsed?.toFixed(2)}`);
console.log(`Last Remaining Periods: ${result.debugInfo?.remainingAmortPeriodsUsed}`);

console.log('\n--- MATURITY/BALLOON DEBUG ---');
console.log(`Balloon Applied: ${result.debugInfo?.balloonApplied}`);
console.log(`Balloon Amount: $${result.debugInfo?.balloonAmount?.toFixed(2)}`);
console.log(`Balloon Period: ${result.debugInfo?.balloonPeriod}`);

// Excel PV values for comparison (CORRECTED from screenshot)
const excelPVs = [78590.99, 77824.98, 77102.57, 76357.81, 75645.11, 74910.54, 74196.89, 73531.85, 72790.03, 72109.89];

// Output ALL periods to find where variance starts
console.log('\n--- FULL CASH FLOW COMPARISON ---');
console.log('Period | Beg Bal | Interest | Principal | Prepay | Default | Recovery | Cash Flow | PV');
console.log('-'.repeat(110));

let totalEnginePV = 0;
let totalEngineCF = 0;
let firstVariancePeriod = 0;

result.cashFlows.forEach((cf, i) => {
  totalEnginePV += cf.presentValue;
  totalEngineCF += cf.totalCashFlow;

  // Only print every 10th period, plus first 10, last 15, and maturity area
  const period = cf.period;
  const showPeriod = period <= 10 ||
                     period % 10 === 0 ||
                     period >= 110 ||
                     (period >= 113 && period <= 120);

  if (showPeriod) {
    console.log(
      `${period.toString().padStart(6)} | ` +
      `$${(cf.beginningBalance/1000).toFixed(1).padStart(7)}k | ` +
      `$${cf.interestPayment.toFixed(0).padStart(8)} | ` +
      `$${cf.scheduledPrincipal.toFixed(0).padStart(9)} | ` +
      `$${cf.prepayment.toFixed(0).padStart(6)} | ` +
      `$${cf.defaultAmount.toFixed(0).padStart(7)} | ` +
      `$${cf.recoveryAmount.toFixed(0).padStart(8)} | ` +
      `$${cf.totalCashFlow.toFixed(0).padStart(9)} | ` +
      `$${cf.presentValue.toFixed(2).padStart(10)}`
    );
  }
});

console.log('-'.repeat(110));
console.log(`Total Engine PV (sum of all periods): $${totalEnginePV.toFixed(2)}`);
console.log(`Total Engine CF (undiscounted): $${totalEngineCF.toFixed(2)}`);
console.log(`Engine NPV (from result): $${result.netPresentValue.toFixed(2)}`);
console.log(`Excel NPV: $7,736,974.94`);
console.log(`NPV Variance: $${(result.netPresentValue - 7736974.94).toFixed(2)}`);

// Analyze recovery periods specifically
console.log('\n--- RECOVERY ANALYSIS ---');
const totalRecoveries = result.cashFlows.reduce((sum, cf) => sum + cf.recoveryAmount, 0);
const totalDefaults = result.cashFlows.reduce((sum, cf) => sum + cf.defaultAmount, 0);
const totalLosses = result.cashFlows.reduce((sum, cf) => sum + cf.lossAmount, 0);
console.log(`Total Defaults: $${totalDefaults.toFixed(2)}`);
console.log(`Total Losses: $${totalLosses.toFixed(2)}`);
console.log(`Total Recoveries: $${totalRecoveries.toFixed(2)}`);
console.log(`Expected Recoveries (Defaults - Losses): $${(totalDefaults - totalLosses).toFixed(2)}`);

// Show recovery by period
console.log('\nRecovery amounts by period:');
result.cashFlows.filter(cf => cf.recoveryAmount > 0).forEach(cf => {
  console.log(`  Period ${cf.period}: $${cf.recoveryAmount.toFixed(2)} (from defaults in period ${cf.period - 12})`);
});

// Show discount calculation details for Period 1
console.log('\n--- DISCOUNT FACTOR DEBUG (Period 1) ---');
const cf1 = result.cashFlows[0];
const effectiveYield = 0.071497;
const period1Date = new Date(cf1.date);
const calcDateForDebug = new Date('2025-06-30');
const cumDays1 = Math.floor((period1Date.getTime() - calcDateForDebug.getTime()) / (1000 * 60 * 60 * 24));
console.log(`Effective Yield: ${(effectiveYield * 100).toFixed(4)}%`);
console.log(`Period 1 Date: ${period1Date.toISOString().split('T')[0]}`);
console.log(`Cumulative Days: ${cumDays1}`);
console.log(`Discount exponent (days/365): ${(cumDays1 / 365).toFixed(8)}`);
console.log(`Discount exponent (period/12): ${(1 / 12).toFixed(8)}`);
console.log(`Discount factor (days method): ${(1 / Math.pow(1 + effectiveYield, cumDays1 / 365)).toFixed(8)}`);
console.log(`Discount factor (period method): ${(1 / Math.pow(1 + effectiveYield, 1 / 12)).toFixed(8)}`);
console.log(`Engine discount factor: ${cf1.discountFactor.toFixed(8)}`);
console.log(`Cash Flow: $${cf1.totalCashFlow.toFixed(2)}`);
console.log(`Engine PV: $${cf1.presentValue.toFixed(2)}`);
console.log(`Excel PV:  $${excelPVs[0].toFixed(2)}`);

if (result.warnings.length > 0) {
  console.log('\n--- WARNINGS ---');
  result.warnings.forEach((w, i) => console.log(`${i + 1}. ${w}`));
}

if (result.errors.length > 0) {
  console.log('\n--- ERRORS ---');
  result.errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
}

// Print first 5 and last 3 cash flows
console.log('\n--- CASH FLOWS (First 5 periods) ---');
console.log('Period | Beg Balance | Interest | Sched Prin | Prepay | Default | End Balance');
console.log('-'.repeat(85));

const firstFlows = result.cashFlows.slice(0, 5);
firstFlows.forEach(cf => {
  console.log(
    `${cf.period.toString().padStart(6)} | ` +
    `$${cf.beginningBalance.toFixed(2).padStart(10)} | ` +
    `$${cf.interestPayment.toFixed(2).padStart(7)} | ` +
    `$${cf.scheduledPrincipal.toFixed(2).padStart(9)} | ` +
    `$${cf.prepayment.toFixed(2).padStart(6)} | ` +
    `$${cf.defaultAmount.toFixed(2).padStart(7)} | ` +
    `$${cf.endingBalance.toFixed(2).padStart(10)}`
  );
});

if (result.cashFlows.length > 8) {
  console.log('  ...  |    ...      |   ...   |    ...     |  ...   |   ...   |    ...');
}

console.log('\n--- CASH FLOWS (Last 3 periods including maturity) ---');
const lastFlows = result.cashFlows.slice(-3);
lastFlows.forEach(cf => {
  console.log(
    `${cf.period.toString().padStart(6)} | ` +
    `$${cf.beginningBalance.toFixed(2).padStart(10)} | ` +
    `$${cf.interestPayment.toFixed(2).padStart(7)} | ` +
    `$${cf.scheduledPrincipal.toFixed(2).padStart(9)} | ` +
    `$${cf.prepayment.toFixed(2).padStart(6)} | ` +
    `$${cf.defaultAmount.toFixed(2).padStart(7)} | ` +
    `$${cf.endingBalance.toFixed(2).padStart(10)}`
  );
});

console.log('\n' + '='.repeat(80));
