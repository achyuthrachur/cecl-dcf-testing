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
 *
 * TWO METHODS:
 * 1. SIMPLE (Excel/Abrigo): rate / 12
 *    - Treats "quarterly" rates as annualized rates
 *
 * 2. COMPOUND (mathematically correct): 1 - (1-rate)^(1/n)
 *    - True compound rate conversion
 */
function convertRateToMonthly(rate, ratePeriod, method = 'simple') {
  if (rate === 0) return 0;
  if (ratePeriod === 'monthly') return rate;

  // SIMPLE METHOD: Divide by 12 (Excel/Abrigo approach)
  if (method === 'simple') {
    return roundTo6(rate / 12);
  }

  // COMPOUND METHOD: Mathematically correct
  switch (ratePeriod) {
    case 'quarterly':
      return roundTo6(1 - Math.pow(1 - rate, 1 / 3));
    case 'annual':
      return roundTo6(1 - Math.pow(1 - rate, 1 / 12));
    default:
      return roundTo6(1 - Math.pow(1 - rate, 1 / 3));
  }
}

function runCalculation(quarterlyPd, lgd, ratePeriod, method, scenarioName) {
  console.log('-'.repeat(80));
  console.log(`SCENARIO: ${scenarioName}`);
  console.log(`  Input PD: ${(quarterlyPd * 100).toFixed(4)}% (labeled as ${ratePeriod})`);
  console.log(`  Conversion Method: ${method}`);
  console.log(`  LGD: ${(lgd * 100).toFixed(2)}%`);

  // Convert to monthly based on method
  const monthlyPd = convertRateToMonthly(quarterlyPd, ratePeriod, method);
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
console.log('Comparing Excel/Abrigo "simple" method vs "compound" method');
console.log('='.repeat(80));
console.log();

// Show what's in the Excel data
console.log('FROM YOUR EXCEL SCREENSHOTS:');
console.log('  Quarterly PD (Q1): 0.5449%');
console.log('  Monthly PD (M1-3): 0.0455%');
console.log();
console.log('CONVERSION COMPARISON:');
console.log('  Excel/Abrigo (simple): 0.5449% / 12 = 0.0454% ✓ MATCHES');
console.log('  Compound formula:      1-(1-0.5449%)^(1/3) = 0.1823% ✗ DIFFERENT');
console.log();

console.log('LOAN DATA:');
console.log(`  Book Balance:      $${LOAN.bookBalance.toLocaleString()}`);
console.log(`  Actual Reserve:    $${LOAN.actualReserve.toLocaleString()}`);
console.log();

// Using rates from your forecast curves
// Note: The "quarterly" rates in Excel are actually annualized rates!
const quarterlyPd = 0.005449;  // 0.5449% (this is actually an annualized rate)
const lgd = 0.078015;          // 7.8015% LGD from your data

console.log('='.repeat(80));
console.log('CALCULATION COMPARISON');
console.log('='.repeat(80));

// OLD: Compound method (what we were using)
console.log();
console.log('OLD CALCULATION (compound method - WRONG for Excel rates):');
const oldResult = runCalculation(quarterlyPd, lgd, 'quarterly', 'compound', 'OLD - Using 1-(1-rate)^(1/3)');

// NEW: Simple method (what Excel/Abrigo uses)
console.log();
console.log('NEW CALCULATION (simple method - MATCHES Excel/Abrigo):');
const newResult = runCalculation(quarterlyPd, lgd, 'quarterly', 'simple', 'NEW - Using rate/12');

console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();
console.log('Method Comparison:');
console.log(`  Old (compound): Reserve = $${oldResult.reserve.toLocaleString(undefined, {minimumFractionDigits: 2})}, Variance = ${oldResult.variancePct.toFixed(2)}%`);
console.log(`  New (simple):   Reserve = $${newResult.reserve.toLocaleString(undefined, {minimumFractionDigits: 2})}, Variance = ${newResult.variancePct.toFixed(2)}%`);
console.log();
console.log('IMPROVEMENT:');
const improvement = Math.abs(oldResult.variancePct) - Math.abs(newResult.variancePct);
console.log(`  Variance reduced by ${improvement.toFixed(2)} percentage points`);
console.log();

if (Math.abs(newResult.variancePct) < 5) {
  console.log('✓ SUCCESS: Variance is within 5% of actual reserve!');
} else if (Math.abs(newResult.variancePct) < 20) {
  console.log('~ IMPROVED: Variance reduced but still significant');
  console.log('  (May need to also check prepay/curtailment conversion)');
} else {
  console.log('✗ ISSUE: Variance still large - may need additional adjustments');
}
console.log();
