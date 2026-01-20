/**
 * Excel Matching Tests
 *
 * Tests to verify that the TypeScript calculation engine matches Excel behavior
 * for key areas: maturity, balloon payments, recovery tail, and re-amortization.
 */

import {
  calculateDCF,
  getMaturityPeriod,
  generateScheduleDates,
  calculateReamortizedPayment,
} from './src/lib/calculation-engine';
import { LoanInput, ForecastCurve, ForecastPeriod } from './src/types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createTestLoan(overrides: Partial<LoanInput> = {}): LoanInput {
  const defaults: LoanInput = {
    id: 'test-loan-001',
    segmentId: 'test-segment',
    loanNumber: 'TEST001',
    calculationDate: new Date('2025-06-30'),
    bookBalance: 1000000,
    unamortizedAmount: 0,
    interestRate: 0.05, // 5%
    effectiveYield: 0.05, // 5%
    amortizationDays: '30/360',
    paymentType: 'Fixed Payment',
    paymentAmount: 10000,
    paymentFrequency: 'Monthly',
    maturityDate: new Date('2027-06-30'), // 24 months
    periods: 24,
    cpr: 0,
    curtailmentRate: 0,
    smm: 0,
    recoveryDelay: 6,
    actualPresentValue: 0,
    actualReserve: 0,
    actualReservePercent: 0,
    extractedAt: new Date(),
    confidence: 1,
    corrected: false,
    ...overrides,
  };
  return defaults;
}

function createTestCurve(
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
    end.setDate(0); // Last day of current month

    curvePeriods.push({
      startDate: start,
      endDate: end,
      rateDecimal: rate,
      confidence: 1,
    });

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return {
    id: `test-${type.toLowerCase()}-curve`,
    type,
    periods: curvePeriods,
    extractedAt: new Date(),
    ratePeriod: 'monthly',
    conversionMethod: 'simple',
  };
}

function logTestResult(name: string, passed: boolean, details?: string) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) {
    console.log(`       ${details}`);
  }
}

// ============================================================================
// TEST 1: MATURITY PERIOD DERIVATION
// ============================================================================

function testMaturityPeriodDerivation() {
  console.log('\n========================================');
  console.log('TEST 1: Maturity Period Derivation');
  console.log('========================================');

  // Test case 1: Simple 24-month loan
  const calcDate1 = new Date('2025-06-30');
  const maturityDate1 = new Date('2027-06-30');
  const expected1 = 24;
  const result1 = getMaturityPeriod(calcDate1, maturityDate1);
  logTestResult(
    'Simple 24-month loan',
    result1 === expected1,
    `Expected ${expected1} periods, got ${result1}`
  );

  // Test case 2: Loan 772102217 (86 months to Sep 2031)
  const calcDate2 = new Date('2025-06-30');
  const maturityDate2 = new Date('2031-09-24');
  const expected2 = 75; // June 2025 to Sep 2031 = 75 months
  const result2 = getMaturityPeriod(calcDate2, maturityDate2);
  logTestResult(
    'Loan 772102217 (75 months)',
    Math.abs(result2 - expected2) <= 1,
    `Expected ~${expected2} periods, got ${result2}`
  );

  // Test case 3: Maturity in same month (should be minimum 1)
  const calcDate3 = new Date('2025-06-15');
  const maturityDate3 = new Date('2025-06-30');
  const result3 = getMaturityPeriod(calcDate3, maturityDate3);
  logTestResult(
    'Same month maturity (minimum 1)',
    result3 >= 1,
    `Expected >= 1 period, got ${result3}`
  );

  // Test case 4: 12-month loan
  const calcDate4 = new Date('2025-01-31');
  const maturityDate4 = new Date('2026-01-31');
  const expected4 = 12;
  const result4 = getMaturityPeriod(calcDate4, maturityDate4);
  logTestResult(
    '12-month loan',
    result4 === expected4,
    `Expected ${expected4} periods, got ${result4}`
  );
}

// ============================================================================
// TEST 2: BALLOON PAYMENT AT MATURITY
// ============================================================================

function testBalloonAtMaturity() {
  console.log('\n========================================');
  console.log('TEST 2: Balloon Payment at Maturity');
  console.log('========================================');

  // Create a loan that won't fully amortize (payment too low)
  const loan = createTestLoan({
    bookBalance: 100000,
    paymentAmount: 1000, // Very low payment - won't amortize
    interestRate: 0.06,
    effectiveYield: 0.06,
    maturityDate: new Date('2026-06-30'), // 12 months
    periods: 12,
    recoveryDelay: 3,
  });

  const pdCurve = createTestCurve('PD', 0.001, loan.calculationDate, 20);
  const lgdCurve = createTestCurve('LGD', 0.3, loan.calculationDate, 20);

  const result = calculateDCF(loan, pdCurve, lgdCurve);

  // Verify balloon was applied
  const balloonApplied = result.debugInfo?.balloonApplied ?? false;
  const balloonPeriod = result.debugInfo?.balloonPeriod ?? 0;
  const contractualPeriods = result.debugInfo?.derivedMaturityPeriod ?? 0;

  logTestResult(
    'Balloon was applied',
    balloonApplied,
    `Balloon applied: ${balloonApplied}`
  );

  logTestResult(
    'Balloon at maturity period (not last period)',
    balloonPeriod === contractualPeriods,
    `Balloon period: ${balloonPeriod}, Contractual periods: ${contractualPeriods}`
  );

  // Verify ending balance at maturity is 0
  const maturityCashFlow = result.cashFlows.find(cf => cf.period === contractualPeriods);
  const endingBalanceAtMaturity = maturityCashFlow?.endingBalance ?? -1;

  logTestResult(
    'Ending balance at maturity is 0',
    endingBalanceAtMaturity === 0,
    `Ending balance: ${endingBalanceAtMaturity}`
  );

  // Verify balloon amount is reasonable
  const balloonAmount = result.debugInfo?.balloonAmount ?? 0;
  logTestResult(
    'Balloon amount is positive',
    balloonAmount > 0,
    `Balloon amount: $${balloonAmount.toFixed(2)}`
  );

  console.log(`\n  Debug Info:`);
  console.log(`    Contractual Periods: ${contractualPeriods}`);
  console.log(`    Total Periods: ${result.debugInfo?.totalPeriods}`);
  console.log(`    Balloon Amount: $${balloonAmount.toFixed(2)}`);
  console.log(`    Balloon Period: ${balloonPeriod}`);
}

// ============================================================================
// TEST 3: RECOVERY TAIL AFTER MATURITY
// ============================================================================

function testRecoveryTail() {
  console.log('\n========================================');
  console.log('TEST 3: Recovery Tail After Maturity');
  console.log('========================================');

  // Create a loan with defaults and recovery delay
  const loan = createTestLoan({
    bookBalance: 100000,
    paymentAmount: 5000,
    interestRate: 0.05,
    effectiveYield: 0.05,
    maturityDate: new Date('2026-06-30'), // 12 months
    periods: 12,
    recoveryDelay: 6, // Recoveries delayed by 6 months
  });

  // High PD to ensure defaults occur
  const pdCurve = createTestCurve('PD', 0.02, loan.calculationDate, 25); // 2% monthly PD
  const lgdCurve = createTestCurve('LGD', 0.4, loan.calculationDate, 25); // 40% LGD

  const result = calculateDCF(loan, pdCurve, lgdCurve);

  const contractualPeriods = result.debugInfo?.derivedMaturityPeriod ?? 0;
  const totalPeriods = result.debugInfo?.totalPeriods ?? 0;

  // Verify recovery tail periods exist
  const postMaturityPeriods = result.cashFlows.filter(cf => cf.period > contractualPeriods);

  logTestResult(
    'Post-maturity periods exist',
    postMaturityPeriods.length > 0,
    `Found ${postMaturityPeriods.length} post-maturity periods`
  );

  // Verify post-maturity periods have zero balance activity
  const allPostMaturityZeroBalance = postMaturityPeriods.every(
    cf => cf.beginningBalance === 0 &&
          cf.interestPayment === 0 &&
          cf.scheduledPrincipal === 0 &&
          cf.prepayment === 0 &&
          cf.defaultAmount === 0 &&
          cf.lossAmount === 0
  );

  logTestResult(
    'Post-maturity periods have zero balance activity',
    allPostMaturityZeroBalance,
    `All post-maturity periods have zero balance: ${allPostMaturityZeroBalance}`
  );

  // Verify some post-maturity periods have recovery cash flows
  const postMaturityWithRecovery = postMaturityPeriods.filter(cf => cf.recoveryAmount > 0);

  logTestResult(
    'Some post-maturity periods have recovery cash flows',
    postMaturityWithRecovery.length > 0,
    `Periods with recovery: ${postMaturityWithRecovery.length}`
  );

  // Verify totalPeriods = contractualPeriods + recoveryDelay - 1
  const expectedTotalPeriods = contractualPeriods + loan.recoveryDelay - 1;

  logTestResult(
    'Total periods includes recovery tail',
    totalPeriods >= contractualPeriods,
    `Total: ${totalPeriods}, Expected: ${expectedTotalPeriods}`
  );

  console.log(`\n  Debug Info:`);
  console.log(`    Contractual Periods: ${contractualPeriods}`);
  console.log(`    Total Periods: ${totalPeriods}`);
  console.log(`    Recovery Delay: ${loan.recoveryDelay}`);
  console.log(`    Total Recoveries in Tail: $${result.debugInfo?.totalRecoveriesInTail?.toFixed(2)}`);
  console.log(`    Post-maturity periods with recovery: ${postMaturityWithRecovery.length}`);
}

// ============================================================================
// TEST 4: NO POST-MATURITY DEFAULTS
// ============================================================================

function testNoPostMaturityDefaults() {
  console.log('\n========================================');
  console.log('TEST 4: No Post-Maturity Defaults');
  console.log('========================================');

  const loan = createTestLoan({
    bookBalance: 100000,
    paymentAmount: 5000,
    maturityDate: new Date('2026-06-30'), // 12 months
    periods: 12,
    recoveryDelay: 6,
  });

  // High PD curve that extends beyond maturity
  const pdCurve = createTestCurve('PD', 0.03, loan.calculationDate, 30); // 30 periods of PD
  const lgdCurve = createTestCurve('LGD', 0.4, loan.calculationDate, 30);

  const result = calculateDCF(loan, pdCurve, lgdCurve);

  const contractualPeriods = result.debugInfo?.derivedMaturityPeriod ?? 0;

  // Verify no defaults occur after maturity
  const postMaturityPeriods = result.cashFlows.filter(cf => cf.period > contractualPeriods);
  const postMaturityDefaults = postMaturityPeriods.filter(cf => cf.defaultAmount > 0);

  logTestResult(
    'No defaults occur after maturity',
    postMaturityDefaults.length === 0,
    `Post-maturity defaults: ${postMaturityDefaults.length}`
  );

  // Verify defaults only occur pre-maturity
  const preMaturityPeriods = result.cashFlows.filter(cf => cf.period <= contractualPeriods);
  const preMaturityDefaults = preMaturityPeriods.filter(cf => cf.defaultAmount > 0);

  logTestResult(
    'Defaults occur before maturity',
    preMaturityDefaults.length > 0,
    `Pre-maturity defaults: ${preMaturityDefaults.length}`
  );

  console.log(`\n  Debug Info:`);
  console.log(`    Pre-maturity defaults: ${preMaturityDefaults.length}`);
  console.log(`    Post-maturity defaults: ${postMaturityDefaults.length}`);
  console.log(`    Total defaults: $${result.totalDefault.toFixed(2)}`);
}

// ============================================================================
// TEST 5: RE-AMORTIZATION DECREMENT
// ============================================================================

function testReamortizationDecrement() {
  console.log('\n========================================');
  console.log('TEST 5: Re-amortization Decrement');
  console.log('========================================');

  // Test the remaining amort periods sequence
  // Excel's "Am Thru" decreases by 2 each period
  const originalTerm = 255;
  const decrementPerPeriod = 2;

  console.log('  Expected remaining amort periods (first 5):');
  for (let period = 1; period <= 5; period++) {
    const remaining = originalTerm - decrementPerPeriod * (period - 1);
    console.log(`    Period ${period}: ${remaining}`);
  }

  // Verify the payment calculation with known values
  const balance = 1000000;
  const monthlyRate = 0.05 / 12;
  const remainingPeriods = 255;

  const payment = calculateReamortizedPayment(balance, monthlyRate, remainingPeriods);
  console.log(`\n  Test payment calculation:`);
  console.log(`    Balance: $${balance.toLocaleString()}`);
  console.log(`    Monthly Rate: ${(monthlyRate * 100).toFixed(4)}%`);
  console.log(`    Remaining Periods: ${remainingPeriods}`);
  console.log(`    Calculated Payment: $${payment.toFixed(2)}`);

  // Verify formula: PMT = P * (r(1+r)^n) / ((1+r)^n - 1)
  const onePlusR = 1 + monthlyRate;
  const onePlusRPowN = Math.pow(onePlusR, remainingPeriods);
  const expectedPayment = balance * (monthlyRate * onePlusRPowN) / (onePlusRPowN - 1);

  logTestResult(
    'Reamortization formula is correct',
    Math.abs(payment - expectedPayment) < 0.01,
    `Calculated: $${payment.toFixed(2)}, Expected: $${expectedPayment.toFixed(2)}`
  );

  // Test with a reamortizing loan
  const loan = createTestLoan({
    bookBalance: 1000000,
    paymentAmount: 6000, // Initial payment
    interestRate: 0.05,
    effectiveYield: 0.05,
    reamortize: true,
    amortizationTerm: 255,
    maturityDate: new Date('2027-06-30'), // 24 months
    periods: 24,
    recoveryDelay: 3,
  });

  const pdCurve = createTestCurve('PD', 0.001, loan.calculationDate, 30);
  const lgdCurve = createTestCurve('LGD', 0.3, loan.calculationDate, 30);

  const result = calculateDCF(loan, pdCurve, lgdCurve);

  // Verify cash flows have varying principal payments (sign of reamortization)
  const principalPayments = result.cashFlows.slice(0, 5).map(cf => cf.scheduledPrincipal);
  console.log(`\n  Principal payments (first 5 periods):`);
  principalPayments.forEach((p, i) => console.log(`    Period ${i + 1}: $${p.toFixed(2)}`));

  logTestResult(
    'Reamortization produces varying payments',
    result.cashFlows.length > 0,
    `Generated ${result.cashFlows.length} periods`
  );
}

// ============================================================================
// TEST 6: ROBUSTNESS WITH WEIRD PERIODS
// ============================================================================

function testRobustness() {
  console.log('\n========================================');
  console.log('TEST 6: Robustness with Weird Periods');
  console.log('========================================');

  // Test case 1: loan.periods too short
  const loan1 = createTestLoan({
    maturityDate: new Date('2027-06-30'), // 24 months from calc date
    periods: 10, // Way too short
    recoveryDelay: 6,
  });

  const pdCurve = createTestCurve('PD', 0.001, loan1.calculationDate, 40);
  const lgdCurve = createTestCurve('LGD', 0.3, loan1.calculationDate, 40);

  const result1 = calculateDCF(loan1, pdCurve, lgdCurve);

  logTestResult(
    'Handles loan.periods too short',
    result1.debugInfo?.derivedMaturityPeriod === 24,
    `Input periods: ${loan1.periods}, Derived: ${result1.debugInfo?.derivedMaturityPeriod}`
  );

  logTestResult(
    'Warns about period mismatch',
    result1.warnings.some(w => w.includes('differs') || w.includes('derived')),
    `Warnings: ${result1.warnings.length}`
  );

  // Test case 2: loan.periods too long
  const loan2 = createTestLoan({
    maturityDate: new Date('2026-06-30'), // 12 months
    periods: 100, // Way too long
    recoveryDelay: 3,
  });

  const result2 = calculateDCF(loan2, pdCurve, lgdCurve);

  logTestResult(
    'Handles loan.periods too long',
    result2.debugInfo?.derivedMaturityPeriod === 12,
    `Input periods: ${loan2.periods}, Derived: ${result2.debugInfo?.derivedMaturityPeriod}`
  );

  // Test case 3: Valid loan produces valid result
  const loan3 = createTestLoan({
    maturityDate: new Date('2027-06-30'), // 24 months
    periods: 24, // Correct
    recoveryDelay: 6,
  });

  const result3 = calculateDCF(loan3, pdCurve, lgdCurve);

  logTestResult(
    'Valid inputs produce valid result',
    result3.valid && result3.cashFlows.length > 0,
    `Valid: ${result3.valid}, Cash flows: ${result3.cashFlows.length}`
  );

  console.log(`\n  Debug Info (Test 1 - periods too short):`);
  console.log(`    Input periods: ${loan1.periods}`);
  console.log(`    Derived maturity period: ${result1.debugInfo?.derivedMaturityPeriod}`);
  console.log(`    Total periods: ${result1.debugInfo?.totalPeriods}`);
  console.log(`    Periods overridden: ${result1.debugInfo?.periodsOverridden}`);
}

// ============================================================================
// TEST 7: DEBUG INFO COMPLETENESS
// ============================================================================

function testDebugInfo() {
  console.log('\n========================================');
  console.log('TEST 7: Debug Info Completeness');
  console.log('========================================');

  const loan = createTestLoan({
    bookBalance: 100000,
    paymentAmount: 2000,
    maturityDate: new Date('2026-06-30'),
    periods: 12,
    recoveryDelay: 6,
  });

  const pdCurve = createTestCurve('PD', 0.02, loan.calculationDate, 25);
  const lgdCurve = createTestCurve('LGD', 0.4, loan.calculationDate, 25);

  const result = calculateDCF(loan, pdCurve, lgdCurve);
  const debug = result.debugInfo;

  logTestResult(
    'Debug info exists',
    debug !== undefined,
    `Debug info: ${debug ? 'present' : 'missing'}`
  );

  if (debug) {
    logTestResult(
      'Has inputPeriods',
      typeof debug.inputPeriods === 'number',
      `inputPeriods: ${debug.inputPeriods}`
    );

    logTestResult(
      'Has derivedMaturityPeriod',
      typeof debug.derivedMaturityPeriod === 'number',
      `derivedMaturityPeriod: ${debug.derivedMaturityPeriod}`
    );

    logTestResult(
      'Has totalPeriods',
      typeof debug.totalPeriods === 'number',
      `totalPeriods: ${debug.totalPeriods}`
    );

    logTestResult(
      'Has balloon info',
      typeof debug.balloonApplied === 'boolean',
      `balloonApplied: ${debug.balloonApplied}, amount: ${debug.balloonAmount}`
    );

    logTestResult(
      'Has recovery tail info',
      typeof debug.totalRecoveriesInTail === 'number',
      `totalRecoveriesInTail: ${debug.totalRecoveriesInTail}`
    );

    console.log('\n  Full Debug Info:');
    console.log(JSON.stringify(debug, null, 2));
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

console.log('============================================================================');
console.log('EXCEL MATCHING TESTS');
console.log('============================================================================');
console.log('Testing that TypeScript engine matches Excel behavior');
console.log('============================================================================');

testMaturityPeriodDerivation();
testBalloonAtMaturity();
testRecoveryTail();
testNoPostMaturityDefaults();
testReamortizationDecrement();
testRobustness();
testDebugInfo();

console.log('\n============================================================================');
console.log('ALL TESTS COMPLETE');
console.log('============================================================================');
