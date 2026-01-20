/**
 * Diagnostic script to identify the root cause of NPV variance
 *
 * Run with: npx ts-node scripts/diagnose-variance.ts
 */

import { differenceInDays, endOfMonth, addMonths } from 'date-fns';

// Loan parameters from the test
const bookBalance = 8687693.51;
const interestRate = 0.0705;
const effectiveYield = 0.074312;
const calculationDate = new Date('2025-06-30');

console.log('='.repeat(80));
console.log('VARIANCE DIAGNOSIS');
console.log('='.repeat(80));

// ============================================================================
// ISSUE 1: Days in Period Calculation
// ============================================================================
console.log('\n--- ISSUE 1: Days in Period ---');

const period1End = endOfMonth(addMonths(calculationDate, 1)); // July 31, 2025
const daysInPeriod1 = differenceInDays(period1End, calculationDate);

console.log(`Calculation Date: ${calculationDate.toISOString().split('T')[0]}`);
console.log(`Period 1 End:     ${period1End.toISOString().split('T')[0]}`);
console.log(`Days in Period:   ${daysInPeriod1}`);

// What interest SHOULD be with different day counts
const interestWith31Days = bookBalance * interestRate * 31 / 360;
const interestWith32Days = bookBalance * interestRate * 32 / 360;

console.log(`\nInterest calculation (Actual/360):`);
console.log(`  With 31 days: $${interestWith31Days.toFixed(2)}`);
console.log(`  With 32 days: $${interestWith32Days.toFixed(2)}`);
console.log(`  Engine shows: $54,442.88`);

// Back-calculate what days the engine is using
const engineInterest = 54442.88;
const impliedDays = engineInterest * 360 / (bookBalance * interestRate);
console.log(`  Implied days:  ${impliedDays.toFixed(2)}`);

// ============================================================================
// ISSUE 2: Discount Factor Offset
// ============================================================================
console.log('\n--- ISSUE 2: Discount Factor Offset ---');

// Calculate cumulative days with and without offset
const prevMonth = addMonths(calculationDate, -1); // May 30, 2025
const daysOffset = differenceInDays(calculationDate, endOfMonth(prevMonth));
console.log(`Previous month end: ${endOfMonth(prevMonth).toISOString().split('T')[0]}`);
console.log(`Days offset added:  ${daysOffset}`);

const baseDaysP1 = differenceInDays(period1End, calculationDate);
const cumulativeDaysWithOffset = baseDaysP1 + daysOffset;
const cumulativeDaysNoOffset = baseDaysP1;

console.log(`\nPeriod 1 cumulative days:`);
console.log(`  Without offset: ${cumulativeDaysNoOffset}`);
console.log(`  With offset:    ${cumulativeDaysWithOffset}`);

// Calculate discount factors
const dfNoOffset = 1 / Math.pow(1 + effectiveYield, cumulativeDaysNoOffset / 365);
const dfWithOffset = 1 / Math.pow(1 + effectiveYield, cumulativeDaysWithOffset / 365);

console.log(`\nDiscount factors (Period 1):`);
console.log(`  Without offset: ${dfNoOffset.toFixed(6)} (exponent = ${(cumulativeDaysNoOffset/365).toFixed(4)})`);
console.log(`  With offset:    ${dfWithOffset.toFixed(6)} (exponent = ${(cumulativeDaysWithOffset/365).toFixed(4)})`);
console.log(`  Difference:     ${((dfNoOffset - dfWithOffset) * 100).toFixed(4)}%`);

// ============================================================================
// ISSUE 3: Simulate impact across all periods
// ============================================================================
console.log('\n--- IMPACT SIMULATION ---');

// Simple simulation: generate cash flows and discount them both ways
let balance = bookBalance;
const smm = 0.002853;
const curtailment = 0.0208;
const periods = 111; // Maturity period

let npvNoOffset = 0;
let npvWithOffset = 0;

for (let p = 1; p <= periods; p++) {
  const periodEnd = endOfMonth(addMonths(calculationDate, p));
  const prevPeriodEnd = p === 1 ? calculationDate : endOfMonth(addMonths(calculationDate, p - 1));
  const daysInPeriod = differenceInDays(periodEnd, prevPeriodEnd);

  // Interest
  const monthlyRate = interestRate * daysInPeriod / 360;
  const interest = balance * monthlyRate;

  // Simplified principal (just for estimation)
  const payment = 59128.33; // Original payment
  const principal = Math.min(Math.max(0, payment - interest), balance);

  // Prepay/Default simplified
  const prepay = balance * smm;
  const pd = 0.005449 / 12; // Quarterly rate / 12
  const defaultAmt = balance * pd;
  const lgd = 0.078015;
  const loss = defaultAmt * lgd;
  const recovery = defaultAmt - loss;

  // Total cash flow
  const cashFlow = interest + principal + prepay + recovery;

  // Cumulative days
  const baseDays = differenceInDays(periodEnd, calculationDate);
  const cumDaysOffset = baseDays + daysOffset;

  // Discount factors
  const dfNo = 1 / Math.pow(1 + effectiveYield, baseDays / 365);
  const dfWith = 1 / Math.pow(1 + effectiveYield, cumDaysOffset / 365);

  npvNoOffset += cashFlow * dfNo;
  npvWithOffset += cashFlow * dfWith;

  // Update balance
  balance = Math.max(0, balance - principal - prepay - defaultAmt);

  if (balance <= 0.01) break;
}

console.log(`Simulated NPV without offset: $${npvNoOffset.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`Simulated NPV with offset:    $${npvWithOffset.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`Difference:                   $${(npvNoOffset - npvWithOffset).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`\nExcel/Abrigo NPV:             $8,615,666.18`);
console.log(`Engine NPV:                   $8,568,312.92`);
console.log(`Variance:                     $${(8615666.18 - 8568312.92).toFixed(2)}`);

// ============================================================================
// RECOMMENDATION
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('RECOMMENDATION');
console.log('='.repeat(80));
console.log(`
The discount offset (${daysOffset} days) is causing over-discounting.

To match Excel/Abrigo, try setting addDiscountOffset = false in getCumulativeDays().

This can be done by:
1. Adding a loan-level option to control the offset
2. Or modifying the default behavior based on the day count convention

The ~$47K variance aligns with what removing the offset would produce.
`);
