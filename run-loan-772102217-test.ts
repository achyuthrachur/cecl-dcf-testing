/**
 * Test Loan 772102217 against Excel expected values
 */

import { calculateDCF, getMaturityPeriod } from './src/lib/calculation-engine';
import { LoanInput, ForecastCurve, ForecastPeriod } from './src/types';

// ============================================================================
// EXPECTED VALUES FROM EXCEL (Screenshot)
// ============================================================================
const EXCEL_EXPECTED = {
  npvOfCashFlows: 7373329.54,
  unamortizedAmount: -11822.35,
  reserveAmount: 27767.36,
  reservePercent: 0.3746,
  abrigoReserve: 27775.96,
  varianceDollar: -8.60,
  variancePercent: -0.03,
};

// ============================================================================
// LOAN DATA FROM EXCEL
// ============================================================================
const loan: LoanInput = {
  id: 'loan-772102217',
  segmentId: 'cre-noo',
  loanNumber: '772102217',
  calculationDate: new Date('2025-06-30'),
  bookBalance: 7412919.25,
  unamortizedAmount: -11822.35,
  interestRate: 0.0345,           // 3.4500%
  effectiveYield: 0.035905,       // 3.5905% (Manual Discount Rate)
  amortizationDays: 'Actual 360',
  paymentType: 'Fixed Payment',
  paymentAmount: 41265.50,
  paymentFrequency: 'Monthly',
  maturityDate: new Date('2031-09-24'), // Based on 75 remaining term from 6/30/2025
  periods: 86,                    // From Excel
  reamortize: true,               // "Reamortize Each Period: Yes"
  amortizationTerm: 255,          // "Inferred Am through: 255.0"
  cpr: 0.0337,                    // 3.3700% Prepayment Rate
  curtailmentRate: 0.0208,        // 2.0800%
  smm: 0.002853,                  // 0.2853%
  recoveryDelay: 12,              // Recovery Lag: 12
  actualPresentValue: EXCEL_EXPECTED.npvOfCashFlows,
  actualReserve: EXCEL_EXPECTED.abrigoReserve,
  actualReservePercent: EXCEL_EXPECTED.reservePercent,
  extractedAt: new Date(),
  confidence: 1,
  corrected: false,
};

// ============================================================================
// CREATE PD/LGD CURVES
// We need to estimate these since they're not shown in the screenshot
// Based on expected reserve of ~$28K on $7.4M loan (0.37%), PD/LGD must be very low
// ============================================================================

function createForecastCurve(
  type: 'PD' | 'LGD',
  rate: number,
  startDate: Date,
  periods: number
): ForecastCurve {
  const curvePeriods: ForecastPeriod[] = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < periods; i++) {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);

    curvePeriods.push({
      startDate: start,
      endDate: end,
      rateDecimal: rate,
      confidence: 1,
    });

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return {
    id: `curve-${type.toLowerCase()}`,
    type,
    periods: curvePeriods,
    extractedAt: new Date(),
    ratePeriod: 'quarterly',      // Excel uses quarterly rates
    conversionMethod: 'simple',   // Excel divides by 12
  };
}

// ============================================================================
// RUN TESTS WITH DIFFERENT PD/LGD ASSUMPTIONS
// ============================================================================

console.log('============================================================================');
console.log('LOAN 772102217 - EXCEL MATCHING TEST');
console.log('============================================================================');
console.log();

console.log('EXCEL EXPECTED VALUES:');
console.log(`  NPV of Cash Flows: $${EXCEL_EXPECTED.npvOfCashFlows.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`  Reserve Amount: $${EXCEL_EXPECTED.reserveAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`  Abrigo Reserve: $${EXCEL_EXPECTED.abrigoReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log();

console.log('LOAN INPUT:');
console.log(`  Book Balance: $${loan.bookBalance.toLocaleString()}`);
console.log(`  Interest Rate: ${(loan.interestRate * 100).toFixed(4)}%`);
console.log(`  Effective Yield: ${(loan.effectiveYield * 100).toFixed(4)}%`);
console.log(`  Payment: $${loan.paymentAmount.toLocaleString()}`);
console.log(`  Amortization Days: ${loan.amortizationDays}`);
console.log(`  Reamortize: ${loan.reamortize}`);
console.log(`  Amortization Term: ${loan.amortizationTerm}`);
console.log(`  Recovery Delay: ${loan.recoveryDelay}`);
console.log(`  SMM: ${(loan.smm * 100).toFixed(4)}%`);
console.log(`  Input Periods: ${loan.periods}`);
console.log(`  Maturity Date: ${loan.maturityDate.toISOString().split('T')[0]}`);
console.log();

// Derive maturity period
const derivedMaturity = getMaturityPeriod(loan.calculationDate, loan.maturityDate);
console.log(`DERIVED VALUES:`);
console.log(`  Maturity Period (derived): ${derivedMaturity}`);
console.log(`  Total with recovery tail: ${derivedMaturity + loan.recoveryDelay - 1}`);
console.log();

// Test with very low PD/LGD (typical for healthy CRE loans)
const pdLgdScenarios = [
  { name: 'Very Low (0.1% PD, 20% LGD)', pd: 0.001, lgd: 0.20 },
  { name: 'Low (0.5% PD, 25% LGD)', pd: 0.005, lgd: 0.25 },
  { name: 'Moderate (1% PD, 30% LGD)', pd: 0.01, lgd: 0.30 },
  { name: 'Higher (2% PD, 35% LGD)', pd: 0.02, lgd: 0.35 },
];

console.log('============================================================================');
console.log('TESTING DIFFERENT PD/LGD SCENARIOS');
console.log('============================================================================');

for (const scenario of pdLgdScenarios) {
  console.log(`\n--- ${scenario.name} ---`);
  console.log(`  Annual PD: ${(scenario.pd * 100).toFixed(2)}%, LGD: ${(scenario.lgd * 100).toFixed(0)}%`);

  const pdCurve = createForecastCurve('PD', scenario.pd, loan.calculationDate, 100);
  const lgdCurve = createForecastCurve('LGD', scenario.lgd, loan.calculationDate, 100);

  const result = calculateDCF(loan, pdCurve, lgdCurve);

  const npvVariance = result.netPresentValue - EXCEL_EXPECTED.npvOfCashFlows;
  const npvVariancePct = (npvVariance / EXCEL_EXPECTED.npvOfCashFlows) * 100;
  const reserveVariance = result.calculatedReserve - EXCEL_EXPECTED.abrigoReserve;
  const reserveVariancePct = EXCEL_EXPECTED.abrigoReserve !== 0
    ? (reserveVariance / EXCEL_EXPECTED.abrigoReserve) * 100
    : 0;

  console.log(`\n  RESULTS:`);
  console.log(`    NPV: $${result.netPresentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Reserve: $${result.calculatedReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Total Interest: $${result.totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Total Principal: $${result.totalPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Total Default: $${result.totalDefault.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Total Loss: $${result.totalLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Total Recovery: $${result.totalRecovery.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

  console.log(`\n  VARIANCE FROM EXCEL:`);
  console.log(`    NPV Variance: $${npvVariance.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${npvVariancePct.toFixed(2)}%)`);
  console.log(`    Reserve Variance: $${reserveVariance.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${reserveVariancePct.toFixed(2)}%)`);

  console.log(`\n  DEBUG INFO:`);
  console.log(`    Contractual Periods: ${result.debugInfo?.derivedMaturityPeriod}`);
  console.log(`    Total Periods: ${result.debugInfo?.totalPeriods}`);
  console.log(`    Balloon Applied: ${result.debugInfo?.balloonApplied}`);
  console.log(`    Balloon Amount: $${result.debugInfo?.balloonAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Balloon Period: ${result.debugInfo?.balloonPeriod}`);
  console.log(`    Cash Flows Generated: ${result.cashFlows.length}`);

  // Check if this scenario matches Excel
  if (Math.abs(npvVariancePct) < 1) {
    console.log(`\n  *** GOOD MATCH! NPV within 1% of Excel ***`);
  }
  if (Math.abs(reserveVariance) < 1000) {
    console.log(`  *** RESERVE within $1,000 of Excel ***`);
  }

  // Print first 3 and last 3 cash flows for debugging
  console.log(`\n  SAMPLE CASH FLOWS (First 3):`);
  result.cashFlows.slice(0, 3).forEach(cf => {
    console.log(`    Period ${cf.period}: Bal=${cf.beginningBalance.toFixed(2)}, Int=${cf.interestPayment.toFixed(2)}, Prin=${cf.scheduledPrincipal.toFixed(2)}, PV=${cf.presentValue.toFixed(2)}`);
  });

  if (result.cashFlows.length > 6) {
    console.log(`  ... (${result.cashFlows.length - 6} more periods) ...`);
  }

  console.log(`  SAMPLE CASH FLOWS (Last 3):`);
  result.cashFlows.slice(-3).forEach(cf => {
    console.log(`    Period ${cf.period}: Bal=${cf.beginningBalance.toFixed(2)}, Int=${cf.interestPayment.toFixed(2)}, Prin=${cf.scheduledPrincipal.toFixed(2)}, Recov=${cf.recoveryAmount.toFixed(2)}, PV=${cf.presentValue.toFixed(2)}`);
  });

  // Print any warnings
  if (result.warnings.length > 0) {
    console.log(`\n  WARNINGS (${result.warnings.length}):`);
    result.warnings.slice(0, 5).forEach(w => console.log(`    - ${w}`));
    if (result.warnings.length > 5) {
      console.log(`    ... and ${result.warnings.length - 5} more`);
    }
  }
}

console.log('\n============================================================================');
console.log('ANALYSIS');
console.log('============================================================================');
console.log(`
Key observations:
1. The derived maturity period from maturityDate should match Excel's "Remaining Term" (75)
2. Balloon should be applied at period 75 (maturity), not at period 86
3. Recovery tail periods (76-86) should have zero balance activity, only recoveries
4. Re-amortization term should decrease by 2 each period (Excel's "Am Thru" pattern)

If NPV still doesn't match:
- Check if the PD/LGD rates being used match Excel's forecast
- The actual PD/LGD curves from the Excel file are needed for exact matching
`);
