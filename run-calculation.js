// Direct calculation script - no dependencies needed
// Run with: node run-calculation.js

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

// Expected NPV (from actual reserve)
const EXPECTED_NPV = LOAN.bookBalance + LOAN.unamortizedAmount - LOAN.actualReserve;
console.log('='.repeat(80));
console.log('CECL DCF CALCULATION VERIFICATION');
console.log('='.repeat(80));
console.log();
console.log('LOAN DATA FROM SCREENSHOT:');
console.log(`  Book Balance:      $${LOAN.bookBalance.toLocaleString()}`);
console.log(`  Unamortized:       $${LOAN.unamortizedAmount.toLocaleString()}`);
console.log(`  Actual Reserve:    $${LOAN.actualReserve.toLocaleString()}`);
console.log(`  Expected NPV:      $${EXPECTED_NPV.toLocaleString()} (derived from actual reserve)`);
console.log();
console.log('ENGINE OUTPUT FROM SCREENSHOT:');
console.log(`  Engine NPV:        $4,548,146.81`);
console.log(`  Engine Reserve:    $2,852,950.09`);
console.log();

function runCalculation(annualPd, lgd, scenarioName) {
  console.log('-'.repeat(80));
  console.log(`SCENARIO: ${scenarioName}`);
  console.log(`  Annual PD: ${(annualPd * 100).toFixed(4)}% (decimal: ${annualPd})`);
  console.log(`  LGD: ${(lgd * 100).toFixed(2)}%`);

  // Check for invalid PD
  if (annualPd >= 1) {
    const base = 1 - annualPd;
    console.log(`  WARNING: Annual PD >= 100%, Math.pow(${base}, 1/12) = ${Math.pow(base, 1/12)}`);
    if (isNaN(Math.pow(base, 1/12))) {
      console.log(`  RESULT: Calculation fails with NaN\n`);
      return null;
    }
  }

  const monthlyPd = 1 - Math.pow(1 - annualPd, 1/12);
  console.log(`  Monthly PD: ${(monthlyPd * 100).toFixed(6)}%`);

  let balance = LOAN.bookBalance;
  let totalPV = 0;
  let totalDefaults = 0;
  let totalLosses = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let totalPrepayment = 0;

  // Store recoveries for delay
  const pendingRecoveries = [];

  console.log();
  console.log('  First 3 periods:');

  for (let period = 1; period <= LOAN.periods; period++) {
    if (balance <= 0.01) break;

    // Monthly interest (30/360)
    const monthlyRate = LOAN.interestRate / 12;
    const interest = Math.round(balance * monthlyRate * 100) / 100;

    // Scheduled principal (Fixed Payment)
    const principal = Math.round(Math.max(0, Math.min(LOAN.paymentAmount - interest, balance)) * 100) / 100;

    // Prepayment
    const rawPrepay = balance * LOAN.smm;
    const prepayment = Math.round(Math.max(0, Math.min(rawPrepay, balance - principal)) * 100) / 100;

    // Default
    const rawDefault = balance * monthlyPd;
    const maxDefault = balance - principal - prepayment;
    const defaultAmt = Math.round(Math.max(0, Math.min(rawDefault, maxDefault)) * 100) / 100;

    // Loss and Recovery
    const loss = Math.round(defaultAmt * lgd * 100) / 100;
    const recoveryAtDefault = defaultAmt - loss;

    // Store recovery for delayed release
    if (recoveryAtDefault > 0) {
      pendingRecoveries.push({ period: period + LOAN.recoveryDelay, amount: recoveryAtDefault });
    }

    // Get recovery for this period (from 12 months ago)
    const recovery = pendingRecoveries
      .filter(r => r.period === period)
      .reduce((sum, r) => sum + r.amount, 0);

    // Cash flow
    const cashFlow = interest + principal + prepayment + recovery;

    // Discount factor (30/360 - period based)
    const discountFactor = 1 / Math.pow(1 + LOAN.effectiveYield, period / 12);

    // Present value
    const pv = cashFlow * discountFactor;
    totalPV += pv;

    totalDefaults += defaultAmt;
    totalLosses += loss;
    totalInterest += interest;
    totalPrincipal += principal;
    totalPrepayment += prepayment;

    // Print first 3 periods
    if (period <= 3) {
      console.log(`    Period ${period}:`);
      console.log(`      Balance: $${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
      console.log(`      Interest: $${interest.toLocaleString()}, Principal: $${principal.toLocaleString()}, Prepay: $${prepayment.toLocaleString()}`);
      console.log(`      Default: $${defaultAmt.toLocaleString()}, Loss: $${loss.toLocaleString()}, Recovery: $${recovery.toLocaleString()}`);
      console.log(`      Cash Flow: $${cashFlow.toLocaleString()}, DF: ${discountFactor.toFixed(6)}, PV: $${pv.toLocaleString()}`);
    }

    // Ending balance
    balance = Math.max(0, balance - principal - prepayment - defaultAmt);
  }

  const calculatedReserve = LOAN.bookBalance + LOAN.unamortizedAmount - totalPV;
  const varianceVsActual = calculatedReserve - LOAN.actualReserve;
  const variancePct = (varianceVsActual / LOAN.actualReserve) * 100;

  console.log();
  console.log('  RESULTS:');
  console.log(`    Total Interest:    $${totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Total Principal:   $${totalPrincipal.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Total Prepayment:  $${totalPrepayment.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Total Defaults:    $${totalDefaults.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Total Losses:      $${totalLosses.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log();
  console.log(`    Calculated NPV:      $${totalPV.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Calculated Reserve:  $${calculatedReserve.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log();
  console.log('  VARIANCE vs ACTUAL ($27,775.96):');
  console.log(`    Dollar Variance:   $${varianceVsActual.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
  console.log(`    Percent Variance:  ${variancePct.toFixed(2)}%`);

  // Check if this matches engine output
  const matchesEngine = Math.abs(totalPV - 4548146.81) < 50000;
  const matchesExpected = Math.abs(totalPV - EXPECTED_NPV) < 50000;

  if (matchesEngine) {
    console.log();
    console.log('  >>> THIS SCENARIO MATCHES THE ENGINE OUTPUT! <<<');
  }
  if (matchesExpected) {
    console.log();
    console.log('  >>> THIS SCENARIO MATCHES THE EXPECTED/CORRECT OUTPUT! <<<');
  }

  console.log();
  return { npv: totalPV, reserve: calculatedReserve, variance: varianceVsActual, variancePct };
}

// Run scenarios
console.log('='.repeat(80));
console.log('RUNNING CALCULATION SCENARIOS');
console.log('='.repeat(80));

// Scenario 1: Very low PD (correct for healthy loan)
runCalculation(0.005, 0.40, 'A: Very Low PD (0.5% annual, 40% LGD) - CORRECT SCALE');

// Scenario 2: Low PD
runCalculation(0.01, 0.40, 'B: Low PD (1% annual, 40% LGD)');

// Scenario 3: What if PD was 0.5 (50%) - WRONG SCALE
runCalculation(0.50, 0.40, 'C: WRONG SCALE - PD entered as 0.5 for "0.5%"');

// Scenario 4: What if PD was 0.3 (30%)
runCalculation(0.30, 0.40, 'D: WRONG SCALE - PD entered as 0.3 for "0.3%"');

// Scenario 5: Moderate but plausible
runCalculation(0.05, 0.40, 'E: Moderate PD (5% annual, 40% LGD)');

// Scenario 6: Higher
runCalculation(0.10, 0.50, 'F: Higher PD (10% annual, 50% LGD)');

// Summary
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();
console.log('The engine is producing NPV of $4,548,146.81');
console.log('The expected NPV (from actual reserve) is $7,373,320.94');
console.log();
console.log('If the calculation matches Scenario C (PD=0.5 used as 50% instead of 0.5%),');
console.log('this confirms the PD/LGD rates are NOT being normalized from percentage to decimal.');
