/**
 * Test calculation for Interest Only loan 772202465
 * Parameters from user screenshot
 */

import { calculateDCF } from '../src/lib/calculation-engine.js';
import { LoanInput, ForecastCurve } from '../src/types/index.js';

// Loan parameters from screenshot
const loan: LoanInput = {
  id: 'test-772202465',
  segmentId: 'residential-re',
  loanNumber: '772202465',
  calculationDate: new Date('2025-06-30'),
  maturityDate: new Date('2037-10-05'),
  bookBalance: 52863.23,
  unamortizedAmount: 871.45,
  interestRate: 0.0595,        // 5.95%
  effectiveYield: 0.058365,    // 5.8365%
  amortizationDays: 'Actual 360',
  paymentType: 'Interest Only',
  paymentAmount: 827.87,
  paymentFrequency: 'Monthly',
  periods: 159,
  reamortize: false,           // Interest Only typically doesn't reamortize
  cpr: 0.0593,                 // 5.93% CPR (will be ignored for IO)
  smm: 0.005081,               // 0.5081% SMM (will be ignored for IO)
  curtailmentRate: 0.1257,     // 12.57% curtailment rate
  recoveryDelay: 12,
  actualReserve: 279.54,       // From screenshot for comparison
  actualPresentValue: 53455.08, // From Excel
  actualReservePercent: 0.53,
  extractedAt: new Date(),
  confidence: 1,
  corrected: false,
};

// Actual PD Forecast from user's screenshot
const pdCurve: ForecastCurve = {
  id: 'pd-curve-772202465',
  type: 'PD' as const,
  extractedAt: new Date(),
  periods: [
    { startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30'), rateDecimal: 0.006279, confidence: 1 },
    { startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31'), rateDecimal: 0.006867, confidence: 1 },
    { startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), rateDecimal: 0.006829, confidence: 1 },
    { startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), rateDecimal: 0.006790, confidence: 1 },
    { startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), rateDecimal: 0.007227, confidence: 1 },
    { startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), rateDecimal: 0.007664, confidence: 1 },
    { startDate: new Date('2027-01-01'), endDate: new Date('2027-03-31'), rateDecimal: 0.008101, confidence: 1 },
    { startDate: new Date('2027-04-01'), endDate: new Date('2027-06-30'), rateDecimal: 0.008538, confidence: 1 },
    { startDate: new Date('2027-07-01'), endDate: new Date('2027-09-30'), rateDecimal: 0.008975, confidence: 1 },
    { startDate: new Date('2027-10-01'), endDate: new Date('2027-12-31'), rateDecimal: 0.009412, confidence: 1 },
    { startDate: new Date('2028-01-01'), endDate: new Date('2028-03-31'), rateDecimal: 0.009849, confidence: 1 },
    { startDate: new Date('2028-04-01'), endDate: new Date('2028-06-30'), rateDecimal: 0.010286, confidence: 1 },
  ],
  ratePeriod: 'quarterly' as const,
  conversionMethod: 'compound' as const,  // Excel uses compound: 1-(1-rate)^(1/12)
};

// Actual LGD Forecast from user's screenshot
const lgdCurve: ForecastCurve = {
  id: 'lgd-curve-772202465',
  type: 'LGD' as const,
  extractedAt: new Date(),
  periods: [
    { startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30'), rateDecimal: 0.054445, confidence: 1 },
    { startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31'), rateDecimal: 0.055912, confidence: 1 },
    { startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), rateDecimal: 0.055820, confidence: 1 },
    { startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'), rateDecimal: 0.055727, confidence: 1 },
    { startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), rateDecimal: 0.056776, confidence: 1 },
    { startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31'), rateDecimal: 0.057789, confidence: 1 },
    { startDate: new Date('2027-01-01'), endDate: new Date('2027-03-31'), rateDecimal: 0.058768, confidence: 1 },
    { startDate: new Date('2027-04-01'), endDate: new Date('2027-06-30'), rateDecimal: 0.059716, confidence: 1 },
    { startDate: new Date('2027-07-01'), endDate: new Date('2027-09-30'), rateDecimal: 0.060636, confidence: 1 },
    { startDate: new Date('2027-10-01'), endDate: new Date('2027-12-31'), rateDecimal: 0.061531, confidence: 1 },
    { startDate: new Date('2028-01-01'), endDate: new Date('2028-03-31'), rateDecimal: 0.062401, confidence: 1 },
    { startDate: new Date('2028-04-01'), endDate: new Date('2028-06-30'), rateDecimal: 0.063250, confidence: 1 },
  ],
  ratePeriod: 'quarterly' as const,
  conversionMethod: 'simple' as const,
};

console.log('='.repeat(80));
console.log('CECL DCF Calculation - Loan 772202465 (Interest Only)');
console.log('='.repeat(80));
console.log('');

// PRECISION DIAGNOSTICS
console.log('PRECISION DIAGNOSTICS:');
console.log('-'.repeat(40));

// Check curtailment calculation
const curtailmentRate = 0.1257;
const jsRaw = 1 - Math.pow(1 - curtailmentRate, 1 / 12);
const jsRounded6 = Math.round(jsRaw * 1000000) / 1000000;
console.log(`Curtailment Rate:     ${curtailmentRate}`);
console.log(`JS Raw:               ${jsRaw.toFixed(15)}`);
console.log(`JS Rounded to 6:      ${jsRounded6}`);
console.log(`Excel Expected:       0.011132`);
console.log(`Difference:           ${(jsRounded6 - 0.011132).toFixed(10)}`);
console.log('');

// Check PD rate conversion for Period 1
const pdRate = 0.006279;
const pdMonthlyRaw = 1 - Math.pow(1 - pdRate, 1 / 12);
const pdMonthlyRounded = Math.round(pdMonthlyRaw * 1000000) / 1000000;
console.log(`PD Annual Rate:       ${pdRate}`);
console.log(`Monthly PD Raw:       ${pdMonthlyRaw.toFixed(15)}`);
console.log(`Monthly PD Rounded:   ${pdMonthlyRounded}`);
console.log(`Excel Expected:       0.000525`);
console.log(`Difference:           ${(pdMonthlyRounded - 0.000525).toFixed(10)}`);
console.log('');

console.log('INPUT PARAMETERS:');
console.log('-'.repeat(40));
console.log(`Loan Number:        ${loan.loanNumber}`);
console.log(`Book Balance:       $${loan.bookBalance.toLocaleString()}`);
console.log(`Unamortized Amount: $${loan.unamortizedAmount.toLocaleString()}`);
console.log(`Interest Rate:      ${(loan.interestRate * 100).toFixed(4)}%`);
console.log(`Effective Yield:    ${(loan.effectiveYield * 100).toFixed(4)}%`);
console.log(`Payment Type:       ${loan.paymentType}`);
console.log(`Payment Amount:     $${loan.paymentAmount.toLocaleString()}`);
console.log(`Amortization Days:  ${loan.amortizationDays}`);
console.log(`Calculation Date:   ${loan.calculationDate.toISOString().split('T')[0]}`);
console.log(`Maturity Date:      ${loan.maturityDate.toISOString().split('T')[0]}`);
console.log(`Periods:            ${loan.periods}`);
console.log(`CPR:                ${((loan.cpr || 0) * 100).toFixed(2)}% (IGNORED for IO)`);
console.log(`SMM:                ${((loan.smm || 0) * 100).toFixed(4)}% (IGNORED for IO)`);
console.log(`Curtailment Rate:   ${((loan.curtailmentRate || 0) * 100).toFixed(2)}%`);
console.log(`Recovery Delay:     ${loan.recoveryDelay} months`);
console.log('');

// Run calculation
const result = calculateDCF(loan, pdCurve, lgdCurve);

console.log('CALCULATION RESULTS:');
console.log('-'.repeat(40));
console.log(`Net Present Value:  $${result.netPresentValue.toLocaleString()}`);
console.log(`Calculated Reserve: $${result.calculatedReserve.toLocaleString()}`);
console.log(`Actual Reserve:     $${result.actualReserve.toLocaleString()}`);
console.log(`Variance ($):       $${result.varianceDollar.toFixed(2)}`);
console.log(`Variance (%):       ${result.variancePercent.toFixed(4)}%`);
console.log('');

// Excel comparison
console.log('EXCEL COMPARISON:');
console.log('-'.repeat(40));
console.log(`Excel NPV:          $53,455.08`);
console.log(`My NPV:             $${result.netPresentValue.toFixed(2)}`);
console.log(`NPV Difference:     $${(result.netPresentValue - 53455.08).toFixed(2)}`);
console.log('');
console.log(`Excel Reserve:      $279.60`);
console.log(`My Reserve:         $${result.calculatedReserve.toFixed(2)}`);
console.log(`Reserve Difference: $${(result.calculatedReserve - 279.60).toFixed(2)}`);
console.log('');
console.log(`Abrigo Reserve:     $279.54`);
console.log(`Abrigo Difference:  $${(result.calculatedReserve - 279.54).toFixed(2)}`);
console.log('');

console.log('SUMMARY TOTALS:');
console.log('-'.repeat(40));
console.log(`Total Interest:     $${result.totalInterest.toLocaleString()}`);
console.log(`Total Principal:    $${result.totalPrincipal.toLocaleString()}`);
console.log(`Total Prepayment:   $${result.totalPrepayment.toLocaleString()}`);
console.log(`Total Default:      $${result.totalDefault.toLocaleString()}`);
console.log(`Total Loss:         $${result.totalLoss.toLocaleString()}`);
console.log(`Total Recovery:     $${result.totalRecovery.toLocaleString()}`);
console.log('');

console.log('DEBUG INFO:');
console.log('-'.repeat(40));
console.log(`Derived Maturity Period:  ${result.debugInfo?.derivedMaturityPeriod}`);
console.log(`Total Periods Generated:  ${result.debugInfo?.totalPeriods}`);
console.log(`Balloon Applied:          ${result.debugInfo?.balloonApplied}`);
console.log(`Balloon Amount:           $${result.debugInfo?.balloonAmount?.toLocaleString() || 0}`);
console.log(`Balloon Period:           ${result.debugInfo?.balloonPeriod || 'N/A'}`);
console.log('');

if (result.warnings.length > 0) {
  console.log('WARNINGS:');
  console.log('-'.repeat(40));
  result.warnings.forEach(w => console.log(`  - ${w}`));
  console.log('');
}

if (result.errors.length > 0) {
  console.log('ERRORS:');
  console.log('-'.repeat(40));
  result.errors.forEach(e => console.log(`  - ${e}`));
  console.log('');
}

// Show first 12 periods of cash flows with more detail
console.log('CASH FLOWS (First 12 Periods):');
console.log('-'.repeat(140));
console.log('Period | Date       | Beg Balance | Interest  | Principal | Prepay    | Default   | Loss      | DF         | PV');
console.log('-'.repeat(140));

result.cashFlows.slice(0, 12).forEach(cf => {
  const dateStr = cf.date.toISOString().split('T')[0];
  console.log(
    `${cf.period.toString().padStart(6)} | ${dateStr} | ` +
    `$${cf.beginningBalance.toFixed(2).padStart(10)} | ` +
    `$${cf.interestPayment.toFixed(2).padStart(8)} | ` +
    `$${cf.scheduledPrincipal.toFixed(2).padStart(8)} | ` +
    `$${cf.prepayment.toFixed(2).padStart(8)} | ` +
    `$${cf.defaultAmount.toFixed(2).padStart(8)} | ` +
    `$${cf.lossAmount.toFixed(2).padStart(8)} | ` +
    `${cf.discountFactor.toFixed(8).padStart(10)} | ` +
    `$${cf.presentValue.toFixed(2).padStart(8)}`
  );
});

console.log('-'.repeat(140));
console.log('');

// Show last few periods including maturity
console.log('CASH FLOWS (Last 5 Periods - Including Maturity):');
console.log('-'.repeat(140));
console.log('Period | Date       | Beg Balance | Interest  | Principal | Prepay    | Default   | Loss      | DF         | PV');
console.log('-'.repeat(140));

result.cashFlows.slice(-5).forEach(cf => {
  const dateStr = cf.date.toISOString().split('T')[0];
  console.log(
    `${cf.period.toString().padStart(6)} | ${dateStr} | ` +
    `$${cf.beginningBalance.toFixed(2).padStart(10)} | ` +
    `$${cf.interestPayment.toFixed(2).padStart(8)} | ` +
    `$${cf.scheduledPrincipal.toFixed(2).padStart(8)} | ` +
    `$${cf.prepayment.toFixed(2).padStart(8)} | ` +
    `$${cf.defaultAmount.toFixed(2).padStart(8)} | ` +
    `$${cf.lossAmount.toFixed(2).padStart(8)} | ` +
    `${cf.discountFactor.toFixed(8).padStart(10)} | ` +
    `$${cf.presentValue.toFixed(2).padStart(8)}`
  );
});

console.log('-'.repeat(140));
console.log('');

// Verification
console.log('VERIFICATION:');
console.log('-'.repeat(40));
console.log(`Reserve Formula: Book Balance + Unamortized - NPV`);
console.log(`                 $${loan.bookBalance} + $${loan.unamortizedAmount} - $${result.netPresentValue}`);
console.log(`                 = $${(loan.bookBalance + loan.unamortizedAmount - result.netPresentValue).toFixed(2)}`);
console.log('');

const expectedReserve = 279.54;
const reserveDiff = Math.abs(result.calculatedReserve - expectedReserve);
console.log(`Expected Reserve (from screenshot): $${expectedReserve}`);
console.log(`Calculated Reserve:                 $${result.calculatedReserve.toFixed(2)}`);
console.log(`Difference:                         $${reserveDiff.toFixed(2)}`);
console.log('');

if (reserveDiff < 1) {
  console.log('✓ MATCH: Reserve matches expected value within $1');
} else if (reserveDiff < 50) {
  console.log('~ CLOSE: Reserve is within $50 of expected value');
} else {
  console.log('✗ VARIANCE: Reserve differs significantly from expected value');
  console.log('  Note: This may be due to different PD/LGD curves than the actual forecast');
}

console.log('');
console.log('='.repeat(80));
