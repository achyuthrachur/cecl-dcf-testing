// Test script to verify rate conversion fix
// Run with: node test-rate-fix.mjs

const LOAN = {
  bookBalance: 7412919.25,
  unamortizedAmount: -11822.35,
  interestRate: 0.0345,        // 3.45%
  effectiveYield: 0.035905,    // 3.5905%
  paymentAmount: 41265.50,
  periods: 86,
  smm: 0.002853,               // 0.2853%
  recoveryDelay: 12,
  actualReserve: 27775.96,
};

// Round to 6 decimals like Excel
function roundTo6(value) {
  return Math.round(value * 1000000) / 1000000;
}

// Round to 2 decimals like Excel
function roundTo2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Convert rate from source period to monthly
 */
function convertRateToMonthly(rate, ratePeriod) {
  if (rate === 0) return 0;

  switch (ratePeriod) {
    case 'monthly':
      return rate;
    case 'quarterly':
      // Convert quarterly to monthly: 1 - (1 - quarterly_rate)^(1/3)
      return roundTo6(1 - Math.pow(1 - rate, 1 / 3));
    case 'annual':
      // Convert annual to monthly: 1 - (1 - annual_rate)^(1/12)
      return roundTo6(1 - Math.pow(1 - rate, 1 / 12));
    default:
      return roundTo6(1 - Math.pow(1 - rate, 1 / 3)); // Default to quarterly
  }
}

function runCalculation(quarterlyPd, lgd, ratePeriod, scenarioName) {
  console.log('-'.repeat(80));
  console.log(`SCENARIO: ${scenarioName}`);
  console.log(`  Input PD: ${(quarterlyPd * 100).toFixed(4)}% (${ratePeriod})`);
  console.log(`  LGD: ${(lgd * 100).toFixed(2)}%`);

  // Convert to monthly based on period
  const monthlyPd = convertRateToMonthly(quarterlyPd, ratePeriod);
  console.log(`  Monthly PD: ${(monthlyPd * 100).toFixed(6)}%`);

  let balance = LOAN.bookBalance;
  let totalPV = 0;
  let totalDefaults = 0;
  let totalLosses = 0;

  // Store recoveries for delay
  const pendingRecoveries = [];

  console.log();
  console.log('  First 3 periods:');

  for (let period = 1; period <= LOAN.periods; period++) {
    if (balance <= 0.01) break;

    const monthlyRate = LOAN.interestRate / 12;
    const interest = roundTo2(balance * monthlyRate);

    // Scheduled principal
    const principal = roundTo2(Math.max(0, Math.min(LOAN.paymentAmount - interest, balance)));

    // Prepayment
    const rawPrepay = balance * LOAN.smm;
    const prepayment = roundTo2(Math.max(0, Math.min(rawPrepay, balance - principal)));

    // Default - using CONVERTED monthly PD
    const rawDefault = balance * monthlyPd;
    const maxDefault = balance - principal - prepayment;
    const defaultAmt = roundTo2(Math.max(0, Math.min(rawDefault, maxDefault)));

    // Loss and Recovery
    const loss = roundTo2(defaultAmt * lgd);
    const recoveryAtDefault = defaultAmt - loss;

    if (recoveryAtDefault > 0) {
      pendingRecoveries.push({ period: period + LOAN.recoveryDelay, amount: recoveryAtDefault });
    }

    const recovery = pendingRecoveries
      .filter(r => r.period === period)
      .reduce((sum, r) => sum + r.amount, 0);

    const cashFlow = interest + principal + prepayment + recovery;

    // Discount factor (30/360)
    const discountFactor = 1 / Math.pow(1 + LOAN.effectiveYield, period / 12);
    const pv = cashFlow * discountFactor;
    totalPV += pv;

    totalDefaults += defaultAmt;
    totalLosses += loss;

    if (period <= 3) {
      console.log(`    Period ${period}:`);
      console.log(`      Balance: $${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
      console.log(`      Default: $${defaultAmt.toLocaleString()}, Loss: $${loss.toLocaleString()}`);
    }

    balance = Math.max(0, balance - principal - prepayment - defaultAmt);
  }

  const calculatedReserve = LOAN.bookBalance + LOAN.unamortizedAmount - totalPV;
  const varianceVsActual = calculatedReserve - LOAN.actualReserve;
  const variancePct = (varianceVsActual / LOAN.actualReserve) * 100;

  console.log();
  console.log('  RESULTS:');
  console.log(`    Total Defaults:    $${totalDefaults.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Total Losses:      $${totalLosses.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Calculated NPV:    $${totalPV.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Calculated Reserve: $${calculatedReserve.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log();
  console.log(`  VARIANCE vs ACTUAL ($27,775.96):`);
  console.log(`    Dollar Variance:   $${varianceVsActual.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Percent Variance:  ${variancePct.toFixed(2)}%`);
  console.log();

  return { npv: totalPV, reserve: calculatedReserve, variancePct };
}

// Header
console.log('='.repeat(80));
console.log('RATE CONVERSION FIX VERIFICATION');
console.log('='.repeat(80));
console.log();
console.log('LOAN DATA:');
console.log(`  Book Balance:      $${LOAN.bookBalance.toLocaleString()}`);
console.log(`  Actual Reserve:    $${LOAN.actualReserve.toLocaleString()}`);
console.log();

// Demonstrate the conversion formula
console.log('RATE CONVERSION FORMULAS:');
const testQtrRate = 0.005449; // 0.5449% quarterly PD
console.log(`  Quarterly PD: ${(testQtrRate * 100).toFixed(4)}%`);
console.log(`  Monthly PD = 1 - (1 - ${testQtrRate})^(1/3)`);
console.log(`             = 1 - ${Math.pow(1 - testQtrRate, 1/3).toFixed(8)}`);
console.log(`             = ${((1 - Math.pow(1 - testQtrRate, 1/3)) * 100).toFixed(6)}% (monthly)`);
console.log();

// Typical quarterly PD values from Excel (based on screenshots)
const quarterlyPd = 0.005449;  // 0.5449% quarterly
const lgd = 0.40;              // 40% LGD

console.log('='.repeat(80));
console.log('COMPARISON: OLD vs NEW CALCULATION');
console.log('='.repeat(80));

// OLD: Annual conversion (wrong)
console.log();
console.log('OLD CALCULATION (assuming annual rates):');
runCalculation(quarterlyPd, lgd, 'annual', 'OLD - Using ^(1/12) - WRONG');

// NEW: Quarterly conversion (correct)
console.log();
console.log('NEW CALCULATION (using quarterly rates):');
const result = runCalculation(quarterlyPd, lgd, 'quarterly', 'NEW - Using ^(1/3) - CORRECT');

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();
if (Math.abs(result.variancePct) < 5) {
  console.log('✓ SUCCESS: Variance is within 5% of actual reserve!');
} else if (Math.abs(result.variancePct) < 20) {
  console.log('~ IMPROVED: Variance reduced but still significant');
} else {
  console.log('✗ ISSUE: Variance still large - may need additional adjustments');
}
console.log();
