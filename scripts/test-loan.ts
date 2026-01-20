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
  loanNumber: '772400484',

  // Dates
  calculationDate: new Date('2025-06-30'),
  // Remaining Term = 111 months from 6/30/2025
  maturityDate: new Date('2034-09-30'),  // 111 months from calc date

  // Balance
  bookBalance: 8687693.51,
  unamortizedAmount: -20465.76,  // Negative per Excel

  // Rates (as decimals)
  interestRate: 0.0705,         // 7.0500%
  effectiveYield: 0.074312,     // 7.4312% (Manual Discount Rate from Excel)

  // Payment structure
  amortizationDays: 'Actual 360' as AmortizationDays,
  paymentType: 'Fixed Payment',
  paymentAmount: 59128.33,
  paymentFrequency: 'Monthly',

  // Term
  periods: 122,                 // From Excel

  // Reamortization settings
  reamortize: true,             // "Reamortize Each Period: Yes"
  amortizationTerm: 351,        // "Inferred Am through: 351.0"

  // Prepayment (as decimals)
  cpr: 0,                       // Forecast Prepay: No
  smm: 0.002853,                // 0.2853% SMM
  curtailmentRate: 0.0208,      // 2.0800% Curtailment Rate

  // Recovery
  recoveryDelay: 12,            // Recovery Lag: 12

  // Actual values for comparison (from Excel)
  actualPresentValue: 8615666.18,
  actualReserve: 52329.79,      // Abrigo Reserve
  actualReservePercent: 0.005935,

  // Metadata
  extractedAt: new Date(),
  confidence: 1,
  corrected: false,
};

// ============================================================================
// PD CURVE - Quarterly rates from Excel (will be converted to monthly)
// ============================================================================

// Helper to create quarterly periods starting from calculation date
function createQuarterlyPeriod(quarterIndex: number, startDate: Date): { start: Date; end: Date } {
  const start = new Date(startDate);
  start.setMonth(start.getMonth() + (quarterIndex - 1) * 3);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  end.setDate(end.getDate() - 1);
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
  ratePeriod: 'quarterly',     // Rates are quarterly
  conversionMethod: 'simple',  // Divide by 12 (Excel/Abrigo method)
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
