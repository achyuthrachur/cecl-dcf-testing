/**
 * Manual Calculation Verification Script
 *
 * This script tests the calculation engine with the exact data from the screenshot
 * and performs step-by-step verification.
 */

// Import the calculation functions (when run via tsx)
// For manual verification, we'll do the math inline

// ============================================================================
// DATA FROM SCREENSHOT (Loan 772102217)
// ============================================================================

const LOAN_DATA = {
  loanNumber: '772102217',
  bookBalance: 7412919.25,
  unamortizedAmount: -11822.35,
  calculationDate: new Date('2025-06-30'),
  interestRate: 0.0345,           // 3.4500% as decimal
  effectiveYield: 0.035905,       // 3.5905% as decimal
  paymentType: 'Fixed Payment',
  paymentAmount: 41265.50,
  maturityDate: new Date('2031-09-24'),
  periods: 86,
  cpr: 0.0337,                    // 3.3700% as decimal
  smm: 0.002853,                  // 0.2853% as decimal
  recoveryDelay: 12,
  actualReserve: 27775.96,
  amortizationDays: '30/360' as const,
};

// EXPECTED RESULT (reverse-engineered from screenshot)
// Reserve = Book Balance + Unamortized Amount - NPV
// 27,775.96 = 7,412,919.25 + (-11,822.35) - NPV
// NPV = 7,412,919.25 - 11,822.35 - 27,775.96 = 7,373,320.94
const EXPECTED_NPV = 7373320.94;

// ENGINE RESULT (from screenshot)
const ENGINE_NPV = 4548146.81;
const ENGINE_RESERVE = 2852950.09;

console.log('============================================================================');
console.log('CECL DCF CALCULATION VERIFICATION');
console.log('============================================================================');
console.log();

console.log('LOAN DATA:');
console.log(`  Loan Number: ${LOAN_DATA.loanNumber}`);
console.log(`  Book Balance: $${LOAN_DATA.bookBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`  Unamortized Amount: $${LOAN_DATA.unamortizedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`  Interest Rate: ${(LOAN_DATA.interestRate * 100).toFixed(4)}%`);
console.log(`  Effective Yield: ${(LOAN_DATA.effectiveYield * 100).toFixed(4)}%`);
console.log(`  Payment Amount: $${LOAN_DATA.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`  Periods: ${LOAN_DATA.periods}`);
console.log(`  CPR: ${(LOAN_DATA.cpr * 100).toFixed(4)}%`);
console.log(`  SMM: ${(LOAN_DATA.smm * 100).toFixed(4)}%`);
console.log(`  Recovery Delay: ${LOAN_DATA.recoveryDelay} months`);
console.log(`  Actual Reserve: $${LOAN_DATA.actualReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log();

console.log('EXPECTED VS ENGINE RESULTS:');
console.log(`  Expected NPV: $${EXPECTED_NPV.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`  Engine NPV:   $${ENGINE_NPV.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`  Difference:   $${(EXPECTED_NPV - ENGINE_NPV).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log();

// ============================================================================
// MANUAL PERIOD-BY-PERIOD CALCULATION
// ============================================================================

console.log('============================================================================');
console.log('MANUAL PERIOD-BY-PERIOD CALCULATION (First 5 Periods)');
console.log('============================================================================');
console.log();

// Assuming LOW PD/LGD rates (typical for healthy loans)
// These would need to be known from the actual forecast curves
const TEST_SCENARIOS = [
  { name: 'Scenario A: Very Low PD/LGD (0.1% PD, 20% LGD)', annualPd: 0.001, lgd: 0.20 },
  { name: 'Scenario B: Low PD/LGD (1% PD, 30% LGD)', annualPd: 0.01, lgd: 0.30 },
  { name: 'Scenario C: Moderate PD/LGD (5% PD, 40% LGD)', annualPd: 0.05, lgd: 0.40 },
  { name: 'Scenario D: High PD/LGD (10% PD, 50% LGD)', annualPd: 0.10, lgd: 0.50 },
  { name: 'Scenario E: WRONG SCALE - PD=1.0 (100%), LGD=0.5', annualPd: 1.0, lgd: 0.50 },
  { name: 'Scenario F: WRONG SCALE - PD as percentage (1.5)', annualPd: 1.5, lgd: 0.50 },
];

for (const scenario of TEST_SCENARIOS) {
  console.log(`\n--- ${scenario.name} ---`);

  const annualPd = scenario.annualPd;
  const lgd = scenario.lgd;

  // Convert annual PD to monthly (as the engine does)
  let monthlyPd: number;
  if (annualPd >= 1) {
    // If annualPd >= 1, the formula 1 - (1 - annualPd)^(1/12) would involve negative base
    console.log(`  WARNING: Annual PD >= 100% (${annualPd * 100}%) - formula would produce invalid results`);
    if (annualPd === 1) {
      monthlyPd = 1 - Math.pow(0, 1/12); // 0^(1/12) = 0
    } else {
      // (1 - 1.5)^(1/12) = (-0.5)^(1/12) = NaN in JS
      const base = 1 - annualPd;
      const result = Math.pow(base, 1/12);
      console.log(`  Math.pow(${base}, 1/12) = ${result}`);
      monthlyPd = 1 - result;
    }
  } else {
    monthlyPd = 1 - Math.pow(1 - annualPd, 1 / 12);
  }

  console.log(`  Annual PD: ${(annualPd * 100).toFixed(4)}%`);
  console.log(`  Monthly PD: ${(monthlyPd * 100).toFixed(4)}% (or ${isNaN(monthlyPd) ? 'NaN' : monthlyPd.toFixed(6)})`);
  console.log(`  LGD: ${(lgd * 100).toFixed(2)}%`);

  if (isNaN(monthlyPd)) {
    console.log('  RESULT: Calculation would fail with NaN values');
    continue;
  }

  // Run simplified calculation for 86 periods
  let balance = LOAN_DATA.bookBalance;
  let totalPV = 0;
  let totalDefaults = 0;
  let totalLosses = 0;

  for (let period = 1; period <= LOAN_DATA.periods; period++) {
    if (balance <= 0.01) break;

    // Monthly interest rate (30/360)
    const monthlyInterestRate = LOAN_DATA.interestRate / 12;

    // Interest payment
    const interest = balance * monthlyInterestRate;

    // Scheduled principal (Fixed Payment)
    const scheduledPrincipal = Math.max(0, Math.min(LOAN_DATA.paymentAmount - interest, balance));

    // Prepayment (SMM applied to beginning balance, capped)
    const rawPrepayment = balance * LOAN_DATA.smm;
    const prepayment = Math.max(0, Math.min(rawPrepayment, balance - scheduledPrincipal));

    // Default (monthly PD applied to beginning balance, capped)
    const rawDefault = balance * monthlyPd;
    const maxDefault = balance - scheduledPrincipal - prepayment;
    const defaultAmt = Math.max(0, Math.min(rawDefault, maxDefault));

    // Loss
    const loss = defaultAmt * lgd;

    // Total cash flow (simplified - ignoring recovery delay for now)
    const recovery = defaultAmt - loss;
    const totalCashFlow = interest + scheduledPrincipal + prepayment + recovery;

    // Discount factor (30/360 convention - period-based)
    const exponent = period / 12;
    const discountFactor = 1 / Math.pow(1 + LOAN_DATA.effectiveYield, exponent);

    // Present value
    const presentValue = totalCashFlow * discountFactor;
    totalPV += presentValue;

    totalDefaults += defaultAmt;
    totalLosses += loss;

    // Ending balance
    const endingBalance = balance - scheduledPrincipal - prepayment - defaultAmt;

    // Print first 3 periods for debugging
    if (period <= 3) {
      console.log(`  Period ${period}:`);
      console.log(`    Beginning Balance: $${balance.toFixed(2)}`);
      console.log(`    Interest: $${interest.toFixed(2)}`);
      console.log(`    Principal: $${scheduledPrincipal.toFixed(2)}`);
      console.log(`    Prepayment: $${prepayment.toFixed(2)}`);
      console.log(`    Default: $${defaultAmt.toFixed(2)}`);
      console.log(`    Loss: $${loss.toFixed(2)}`);
      console.log(`    Cash Flow: $${totalCashFlow.toFixed(2)}`);
      console.log(`    Discount Factor: ${discountFactor.toFixed(6)}`);
      console.log(`    Present Value: $${presentValue.toFixed(2)}`);
      console.log(`    Ending Balance: $${endingBalance.toFixed(2)}`);
    }

    balance = endingBalance;
  }

  // Calculate reserve
  const calculatedNPV = totalPV;
  const calculatedReserve = LOAN_DATA.bookBalance + LOAN_DATA.unamortizedAmount - calculatedNPV;

  console.log(`\n  FINAL RESULTS:`);
  console.log(`    Total NPV: $${calculatedNPV.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Calculated Reserve: $${calculatedReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Total Defaults: $${totalDefaults.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`    Total Losses: $${totalLosses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

  // Compare to engine result
  const npvDiff = Math.abs(calculatedNPV - ENGINE_NPV);
  if (npvDiff < 10000) {
    console.log(`\n  *** THIS SCENARIO MATCHES THE ENGINE OUTPUT (within $10K) ***`);
  }

  // Compare to expected
  const expectedDiff = Math.abs(calculatedNPV - EXPECTED_NPV);
  if (expectedDiff < 10000) {
    console.log(`\n  *** THIS SCENARIO MATCHES THE EXPECTED OUTPUT (within $10K) ***`);
  }
}

console.log('\n============================================================================');
console.log('ANALYSIS');
console.log('============================================================================');
console.log(`
Key Finding: The NPV discrepancy suggests the PD and/or LGD rates being used
are significantly different from what's expected.

If the expected NPV is ~$7.37M (implying reserve of ~$28K, or 0.37% of balance),
the PD/LGD rates must be very low.

But the engine calculated NPV of ~$4.55M (implying reserve of ~$2.85M, or 38% of balance),
suggesting the PD/LGD rates being used are MUCH HIGHER than expected.

LIKELY CAUSE:
1. PD/LGD rates from forecast curves may be in percentage form (e.g., 1.5)
   instead of decimal form (0.015)
2. The calculation engine does NOT normalize PD/LGD rates from forecast curves,
   unlike loan rates which ARE normalized
3. If AI extraction returns rates as percentages, they would be used as-is

SOLUTION:
Add normalizeRateToDecimal() calls for PD and LGD rates in calculation-engine.ts
`);
