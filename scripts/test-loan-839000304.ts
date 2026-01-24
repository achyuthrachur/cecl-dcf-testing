/**
 * Test script for Loan 839000304 - Revolving Line of Credit
 * Target: Reserve $308.22, NPV $58,938.91
 */

import { calculateDCF } from '../src/lib/calculation-engine';
import { LoanInput, ForecastCurve } from '../src/types/index';

// Loan parameters from Abrigo
const loan: LoanInput = {
  id: 'loan-839000304',
  loanNumber: '839000304',
  segmentId: 'residential-re',
  calculationDate: new Date(Date.UTC(2025, 5, 30)), // June 30, 2025
  bookBalance: 59247.13,
  unamortizedAmount: 0.00,
  interestRate: 0.075, // 7.5000%
  effectiveYield: 0.077632, // 7.7632%
  amortizationDays: 'Actual 365',
  paymentType: 'Line of Credit', // Revolving Line of Credit
  paymentAmount: 686.88,
  paymentFrequency: 'Monthly',
  maturityDate: new Date(Date.UTC(2040, 11, 5)), // December 5, 2040
  periods: 197,
  cpr: 0.0593, // 5.93%
  smm: 0.005081, // 0.5081%
  curtailmentRate: 0.1257, // 12.57%
  recoveryDelay: 12,
  actualPresentValue: 58938.91,
  actualReserve: 308.22,
  actualReservePercent: 0.5202,
  extractedAt: new Date(),
  confidence: 1.0,
  corrected: false,
  reamortize: false,
};

// PD Forecast - quarterly rates (annualized), last rate extends
const pdCurve: ForecastCurve = {
  id: 'pd-839000304',
  type: 'PD',
  ratePeriod: 'quarterly',
  conversionMethod: 'simple',  // Excel/Abrigo divides by 12
  extractedAt: new Date(),
  periods: [
    { startDate: new Date(Date.UTC(2025, 6, 1)), endDate: new Date(Date.UTC(2025, 8, 30)), rateDecimal: 0.006279, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2025, 9, 1)), endDate: new Date(Date.UTC(2025, 11, 31)), rateDecimal: 0.006867, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 0, 1)), endDate: new Date(Date.UTC(2026, 2, 31)), rateDecimal: 0.006829, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 3, 1)), endDate: new Date(Date.UTC(2026, 5, 30)), rateDecimal: 0.006790, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 6, 1)), endDate: new Date(Date.UTC(2026, 8, 30)), rateDecimal: 0.007227, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 9, 1)), endDate: new Date(Date.UTC(2026, 11, 31)), rateDecimal: 0.007664, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 0, 1)), endDate: new Date(Date.UTC(2027, 2, 31)), rateDecimal: 0.008101, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 3, 1)), endDate: new Date(Date.UTC(2027, 5, 30)), rateDecimal: 0.008538, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 6, 1)), endDate: new Date(Date.UTC(2027, 8, 30)), rateDecimal: 0.008975, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 9, 1)), endDate: new Date(Date.UTC(2027, 11, 31)), rateDecimal: 0.009412, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2028, 0, 1)), endDate: new Date(Date.UTC(2028, 2, 31)), rateDecimal: 0.009849, confidence: 1.0 },
    // Last rate extends to end of loan
    { startDate: new Date(Date.UTC(2028, 3, 1)), endDate: new Date(Date.UTC(2050, 11, 31)), rateDecimal: 0.010286, confidence: 1.0 },
  ],
};

// LGD Forecast - quarterly rates (not converted, LGD is loss percentage)
const lgdCurve: ForecastCurve = {
  id: 'lgd-839000304',
  type: 'LGD',
  ratePeriod: 'quarterly',
  extractedAt: new Date(),
  periods: [
    { startDate: new Date(Date.UTC(2025, 6, 1)), endDate: new Date(Date.UTC(2025, 8, 30)), rateDecimal: 0.054445, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2025, 9, 1)), endDate: new Date(Date.UTC(2025, 11, 31)), rateDecimal: 0.055912, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 0, 1)), endDate: new Date(Date.UTC(2026, 2, 31)), rateDecimal: 0.055820, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 3, 1)), endDate: new Date(Date.UTC(2026, 5, 30)), rateDecimal: 0.055727, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 6, 1)), endDate: new Date(Date.UTC(2026, 8, 30)), rateDecimal: 0.056776, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2026, 9, 1)), endDate: new Date(Date.UTC(2026, 11, 31)), rateDecimal: 0.057789, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 0, 1)), endDate: new Date(Date.UTC(2027, 2, 31)), rateDecimal: 0.058768, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 3, 1)), endDate: new Date(Date.UTC(2027, 5, 30)), rateDecimal: 0.059716, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 6, 1)), endDate: new Date(Date.UTC(2027, 8, 30)), rateDecimal: 0.060636, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2027, 9, 1)), endDate: new Date(Date.UTC(2027, 11, 31)), rateDecimal: 0.061531, confidence: 1.0 },
    { startDate: new Date(Date.UTC(2028, 0, 1)), endDate: new Date(Date.UTC(2028, 2, 31)), rateDecimal: 0.062401, confidence: 1.0 },
    // Last rate extends to end of loan
    { startDate: new Date(Date.UTC(2028, 3, 1)), endDate: new Date(Date.UTC(2050, 11, 31)), rateDecimal: 0.063250, confidence: 1.0 },
  ],
};

// Run the calculation
const result = calculateDCF(loan, pdCurve, lgdCurve);

// Display results
console.log('\n' + '='.repeat(70));
console.log('LOAN 839000304 - REVOLVING LINE OF CREDIT TEST');
console.log('='.repeat(70));

console.log('\nLoan Parameters:');
console.log(`  Book Balance:      $${loan.bookBalance.toLocaleString()}`);
console.log(`  Interest Rate:     ${(loan.interestRate * 100).toFixed(4)}%`);
console.log(`  Effective Yield:   ${(loan.effectiveYield * 100).toFixed(4)}%`);
console.log(`  Payment Type:      ${loan.paymentType}`);
console.log(`  Day Count:         ${loan.amortizationDays}`);
console.log(`  Maturity:          ${loan.maturityDate.toISOString().split('T')[0]}`);
console.log(`  Periods:           ${loan.periods}`);
console.log(`  CPR:               ${((loan.cpr || 0) * 100).toFixed(4)}%`);
console.log(`  SMM:               ${((loan.smm || 0) * 100).toFixed(4)}%`);
console.log(`  Curtailment:       ${((loan.curtailmentRate || 0) * 100).toFixed(4)}%`);
console.log(`  Recovery Delay:    ${loan.recoveryDelay}`);

console.log('\n' + '-'.repeat(70));
console.log('RESULTS COMPARISON');
console.log('-'.repeat(70));

const targetNPV = 58938.91;
const targetReserve = 308.22;

console.log('\n                     My Engine        Abrigo         Variance');
console.log('  ' + '-'.repeat(60));
console.log(`  NPV:               $${result.netPresentValue.toFixed(2).padStart(10)}    $${targetNPV.toFixed(2).padStart(10)}    $${(result.netPresentValue - targetNPV).toFixed(2).padStart(8)}`);
console.log(`  Reserve:           $${result.calculatedReserve.toFixed(2).padStart(10)}    $${targetReserve.toFixed(2).padStart(10)}    $${(result.calculatedReserve - targetReserve).toFixed(2).padStart(8)}`);

const variancePercent = ((result.calculatedReserve - targetReserve) / targetReserve * 100).toFixed(2);
console.log(`  Variance %:        ${variancePercent}%`);

console.log('\n' + '-'.repeat(70));
console.log('CASH FLOW SUMMARY');
console.log('-'.repeat(70));
console.log(`  Total Interest:    $${result.totalInterest.toFixed(2)}`);
console.log(`  Total Principal:   $${result.totalPrincipal.toFixed(2)}`);
console.log(`  Total Prepayment:  $${result.totalPrepayment.toFixed(2)}`);
console.log(`  Total Default:     $${result.totalDefault.toFixed(2)}`);
console.log(`  Total Loss:        $${result.totalLoss.toFixed(2)}`);
console.log(`  Total Recovery:    $${result.totalRecovery.toFixed(2)}`);

console.log('\n' + '-'.repeat(70));
console.log('DEBUG INFO');
console.log('-'.repeat(70));
console.log(`  Input Periods:           ${result.debugInfo?.inputPeriods}`);
console.log(`  Derived Maturity Period: ${result.debugInfo?.derivedMaturityPeriod}`);
console.log(`  Total Periods (w/tail):  ${result.debugInfo?.totalPeriods}`);
console.log(`  Balloon Applied:         ${result.debugInfo?.balloonApplied}`);
console.log(`  Balloon Amount:          $${result.debugInfo?.balloonAmount?.toFixed(2)}`);
console.log(`  Balloon Period:          ${result.debugInfo?.balloonPeriod}`);

// Show first few periods
console.log('\n' + '-'.repeat(70));
console.log('FIRST 6 PERIODS');
console.log('-'.repeat(70));
console.log('Per  Date        Beg Bal      Interest    Principal   Prepay      Default     End Bal      PV');
console.log('-'.repeat(110));

for (let i = 0; i < Math.min(6, result.cashFlows.length); i++) {
  const cf = result.cashFlows[i];
  const dateStr = cf.date.toISOString().split('T')[0];
  console.log(
    `${cf.period.toString().padStart(3)}  ${dateStr}  ` +
    `$${cf.beginningBalance.toFixed(2).padStart(10)}  ` +
    `$${cf.interestPayment.toFixed(2).padStart(8)}  ` +
    `$${cf.scheduledPrincipal.toFixed(2).padStart(8)}  ` +
    `$${cf.prepayment.toFixed(2).padStart(8)}  ` +
    `$${cf.defaultAmount.toFixed(2).padStart(8)}  ` +
    `$${cf.endingBalance.toFixed(2).padStart(10)}  ` +
    `$${cf.presentValue.toFixed(2).padStart(8)}`
  );
}

// Show last few periods (around maturity)
console.log('\n' + '-'.repeat(70));
console.log('LAST 6 PERIODS (AROUND MATURITY)');
console.log('-'.repeat(70));

const lastPeriods = result.cashFlows.slice(-6);
for (const cf of lastPeriods) {
  const dateStr = cf.date.toISOString().split('T')[0];
  console.log(
    `${cf.period.toString().padStart(3)}  ${dateStr}  ` +
    `$${cf.beginningBalance.toFixed(2).padStart(10)}  ` +
    `$${cf.interestPayment.toFixed(2).padStart(8)}  ` +
    `$${cf.scheduledPrincipal.toFixed(2).padStart(8)}  ` +
    `$${cf.prepayment.toFixed(2).padStart(8)}  ` +
    `$${cf.defaultAmount.toFixed(2).padStart(8)}  ` +
    `$${cf.endingBalance.toFixed(2).padStart(10)}  ` +
    `$${cf.presentValue.toFixed(2).padStart(8)}`
  );
}

// Show warnings
if (result.warnings.length > 0) {
  console.log('\n' + '-'.repeat(70));
  console.log('WARNINGS');
  console.log('-'.repeat(70));
  result.warnings.forEach(w => console.log(`  - ${w}`));
}

// Show errors
if (result.errors.length > 0) {
  console.log('\n' + '-'.repeat(70));
  console.log('ERRORS');
  console.log('-'.repeat(70));
  result.errors.forEach(e => console.log(`  - ${e}`));
}

console.log('\n' + '='.repeat(70));
