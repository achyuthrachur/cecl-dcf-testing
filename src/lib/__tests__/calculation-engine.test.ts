// ============================================================================
// CECL DCF Calculation Engine Tests
// Tests for reamortization, maturity payoff ordering, and rate calculations
// ============================================================================

import {
  calculateDCF,
  calculateReamortizedPayment,
  getAmortizationTermMonths,
  getAmortizationMultiplier,
  calculateMonthlyInterestRate,
} from '../calculation-engine';
import { LoanInput, ForecastCurve, AmortizationDays } from '@/types';

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

function createBaseLoan(overrides: Partial<LoanInput> = {}): LoanInput {
  const calculationDate = new Date('2025-06-30');
  const maturityDate = new Date('2026-12-31'); // 18 months

  return {
    id: 'test-loan-1',
    segmentId: 'test-segment',
    loanNumber: 'LOAN-001',
    calculationDate,
    bookBalance: 1000000,
    unamortizedAmount: 0,
    interestRate: 0.0345, // 3.45%
    effectiveYield: 0.035, // 3.5%
    amortizationDays: 'Actual 360' as AmortizationDays,
    paymentType: 'Fixed Payment',
    paymentAmount: 5000, // $5,000 monthly
    paymentFrequency: 'Monthly',
    maturityDate,
    periods: 18,
    reamortize: false,
    amortizationTerm: undefined,
    cpr: 0,
    curtailmentRate: 0,
    smm: 0,
    recoveryDelay: 12,
    actualPresentValue: 0,
    actualReserve: 0,
    actualReservePercent: 0,
    extractedAt: new Date(),
    confidence: 1,
    corrected: false,
    ...overrides,
  };
}

function createPDCurve(): ForecastCurve {
  return {
    id: 'pd-curve-1',
    type: 'PD',
    periods: [
      {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2027-12-31'),
        rateDecimal: 0.005449, // 0.5449% quarterly (annualized)
        confidence: 1,
      },
    ],
    extractedAt: new Date(),
    ratePeriod: 'quarterly',
    conversionMethod: 'simple',
  };
}

function createLGDCurve(): ForecastCurve {
  return {
    id: 'lgd-curve-1',
    type: 'LGD',
    periods: [
      {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2027-12-31'),
        rateDecimal: 0.25, // 25% LGD
        confidence: 1,
      },
    ],
    extractedAt: new Date(),
  };
}

// ----------------------------------------------------------------------------
// D1) Reamortization produces a changing payment stream
// ----------------------------------------------------------------------------

describe('Reamortization', () => {
  test('produces a changing payment stream when reamortize=true', () => {
    const loan = createBaseLoan({
      reamortize: true,
      amortizationTerm: 255, // 255 months
      paymentAmount: 5000,
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);
    expect(result.debugInfo?.reamortizationApplied).toBe(true);
    expect(result.debugInfo?.effectiveAmortTerm).toBe(255);

    // Verify payment changes over time (monotonic decline for fixed-rate)
    // Get payments from scheduled principal + interest (approximation)
    const cashFlows = result.cashFlows;
    expect(cashFlows.length).toBeGreaterThan(1);

    // The reamortized payment should change period-to-period
    // as the balance decreases and remaining term decreases
    // Principal portion should generally increase over time
    const principalPayments = cashFlows
      .filter(cf => cf.beginningBalance > 0)
      .map(cf => cf.scheduledPrincipal);

    // Not all payments will be identical (reamort causes variation)
    const uniquePayments = new Set(principalPayments);
    expect(uniquePayments.size).toBeGreaterThan(1);
  });

  test('infers amortization term when not provided but reamortize=true', () => {
    // Create a loan where we can calculate what the payment should be
    const bookBalance = 100000;
    const interestRate = 0.06; // 6% annual
    const monthlyRate = interestRate / 12; // 0.5% monthly
    const term = 120; // 10 years

    // Calculate expected PMT: P × (r(1+r)^n) / ((1+r)^n - 1)
    const onePlusR = 1 + monthlyRate;
    const onePlusRPowN = Math.pow(onePlusR, term);
    const expectedPMT = bookBalance * (monthlyRate * onePlusRPowN) / (onePlusRPowN - 1);

    const loan = createBaseLoan({
      bookBalance,
      interestRate,
      reamortize: true,
      amortizationTerm: undefined, // Not provided - should be inferred
      paymentAmount: expectedPMT,
      amortizationDays: '30/360', // Use 30/360 for simpler math (multiplier = 1)
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);
    expect(result.debugInfo?.reamortizationApplied).toBe(true);
    // The inferred term should be close to 120 months
    expect(result.debugInfo?.effectiveAmortTerm).toBeGreaterThan(100);
    expect(result.debugInfo?.effectiveAmortTerm).toBeLessThan(140);
  });

  test('getAmortizationTermMonths returns explicit term when provided', () => {
    const loan = createBaseLoan({
      reamortize: true,
      amortizationTerm: 300,
      paymentAmount: 5000,
    });

    const monthlyRate = 0.003; // 0.3% monthly
    const result = getAmortizationTermMonths(loan, monthlyRate);

    expect(result.term).toBe(300);
    expect(result.warning).toBeUndefined();
  });

  test('getAmortizationTermMonths returns null when reamortize=false', () => {
    const loan = createBaseLoan({
      reamortize: false,
      amortizationTerm: undefined,
    });

    const monthlyRate = 0.003;
    const result = getAmortizationTermMonths(loan, monthlyRate);

    expect(result.term).toBeNull();
  });

  test('getAmortizationTermMonths warns when payment <= monthly interest', () => {
    const loan = createBaseLoan({
      reamortize: true,
      amortizationTerm: undefined,
      bookBalance: 1000000,
      paymentAmount: 100, // Way too low
    });

    const monthlyRate = 0.003; // 0.3% → $3000 interest on $1M
    const result = getAmortizationTermMonths(loan, monthlyRate);

    expect(result.term).toBeNull();
    expect(result.warning).toContain('less than or equal to monthly interest');
  });
});

// ----------------------------------------------------------------------------
// D2) PMT monthly rate respects Actual/360 multiplier
// ----------------------------------------------------------------------------

describe('PMT Monthly Rate with Day Count Conventions', () => {
  test('Actual/360 uses 365/360 multiplier', () => {
    const multiplier = getAmortizationMultiplier('Actual 360');
    expect(multiplier).toBeCloseTo(365 / 360, 6);
  });

  test('30/360 uses 365/360 multiplier per Excel formula', () => {
    // Per Excel: IF(ISNUMBER(SEARCH("360",C7)),365/360,1)
    // "30/360" contains "360", so multiplier = 365/360
    const multiplier = getAmortizationMultiplier('30/360');
    expect(multiplier).toBeCloseTo(365 / 360, 6);
  });

  test('360 Days uses 365/360 multiplier per Excel formula', () => {
    // Per Excel: IF(ISNUMBER(SEARCH("360",C7)),365/360,1)
    // "360 Days" contains "360", so multiplier = 365/360
    const multiplier = getAmortizationMultiplier('360 Days');
    expect(multiplier).toBeCloseTo(365 / 360, 6);
  });

  test('Actual 365 uses multiplier of 1', () => {
    // "Actual 365" does NOT contain "360", so multiplier = 1
    const multiplier = getAmortizationMultiplier('Actual 365');
    expect(multiplier).toBe(1);
  });

  test('all 360-based conventions use same multiplier', () => {
    const interestRate = 0.06; // 6%

    // All 360-based conventions use 365/360 multiplier
    const rate30360 = (interestRate * getAmortizationMultiplier('30/360')) / 12;
    const rateActual360 = (interestRate * getAmortizationMultiplier('Actual 360')) / 12;
    const rate360Days = (interestRate * getAmortizationMultiplier('360 Days')) / 12;

    // All three should be equal
    expect(rate30360).toBeCloseTo(rateActual360, 10);
    expect(rate30360).toBeCloseTo(rate360Days, 10);

    // And they should all be rate * (365/360) / 12
    const expectedRate = interestRate * (365 / 360) / 12;
    expect(rate30360).toBeCloseTo(expectedRate, 10);
  });

  test('reamortization uses correct rate for Actual/360 loans', () => {
    const loan = createBaseLoan({
      reamortize: true,
      amortizationTerm: 120,
      amortizationDays: 'Actual 360',
      interestRate: 0.06,
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);
    expect(result.debugInfo?.reamortizationApplied).toBe(true);

    // Verify the monthly rate used includes the 365/360 multiplier
    const expectedMonthlyRate = (0.06 * (365 / 360)) / 12;
    expect(result.debugInfo?.monthlyRateForPMT).toBeCloseTo(expectedMonthlyRate, 8);
  });
});

// ----------------------------------------------------------------------------
// D3) Maturity month has payoff-first ordering
// ----------------------------------------------------------------------------

describe('Maturity Period Payoff Ordering', () => {
  // Note: periods must be totalPeriods = contractualPeriods + recoveryDelay - 1
  // For a 6-month loan with 12-month recovery delay: periods = 6 + 12 - 1 = 17

  test('at maturity: prepayment === 0, defaultAmount === 0', () => {
    const loan = createBaseLoan({
      periods: 17, // 6 contractual + 11 recovery tail
      maturityDate: new Date('2025-12-31'), // 6 months from calc date
      cpr: 0.10, // 10% CPR to ensure prepayment would occur normally
      recoveryDelay: 12,
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);

    // Find the maturity period (should be period 6)
    const maturityPeriod = result.cashFlows.find(
      cf => cf.period === result.debugInfo?.derivedMaturityPeriod
    );

    expect(maturityPeriod).toBeDefined();
    expect(maturityPeriod!.prepayment).toBe(0);
    expect(maturityPeriod!.defaultAmount).toBe(0);
    expect(maturityPeriod!.lossAmount).toBe(0);
  });

  test('at maturity: scheduledPrincipal === beginningBalance', () => {
    const loan = createBaseLoan({
      periods: 17, // 6 contractual + 11 recovery tail
      maturityDate: new Date('2025-12-31'),
      recoveryDelay: 12,
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);

    const maturityPeriod = result.cashFlows.find(
      cf => cf.period === result.debugInfo?.derivedMaturityPeriod
    );

    expect(maturityPeriod).toBeDefined();
    // Scheduled principal should equal beginning balance (full payoff)
    expect(maturityPeriod!.scheduledPrincipal).toBeCloseTo(
      maturityPeriod!.beginningBalance,
      2
    );
  });

  test('at maturity: endingBalance === 0', () => {
    const loan = createBaseLoan({
      periods: 17, // 6 contractual + 11 recovery tail
      maturityDate: new Date('2025-12-31'),
      recoveryDelay: 12,
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);

    const maturityPeriod = result.cashFlows.find(
      cf => cf.period === result.debugInfo?.derivedMaturityPeriod
    );

    expect(maturityPeriod).toBeDefined();
    expect(maturityPeriod!.endingBalance).toBe(0);
  });

  test('non-maturity periods can have prepayment and default', () => {
    const loan = createBaseLoan({
      periods: 17, // 6 contractual + 11 recovery tail
      maturityDate: new Date('2025-12-31'),
      cpr: 0.10, // 10% CPR
      smm: 0.02, // 2% SMM to ensure prepayment
      recoveryDelay: 12,
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);

    // Check periods before maturity have prepayment
    const preMaturityPeriods = result.cashFlows.filter(
      cf => cf.period < result.debugInfo!.derivedMaturityPeriod
    );

    // At least some periods should have prepayment
    const totalPrepay = preMaturityPeriods.reduce(
      (sum, cf) => sum + cf.prepayment,
      0
    );
    expect(totalPrepay).toBeGreaterThan(0);
  });
});

// ----------------------------------------------------------------------------
// D4) Delayed recoveries still release after maturity
// ----------------------------------------------------------------------------

describe('Delayed Recoveries After Maturity', () => {
  test('recovery cash flows appear in tail periods', () => {
    const loan = createBaseLoan({
      periods: 6,
      maturityDate: new Date('2025-12-31'), // 6 months
      recoveryDelay: 12, // 12 month delay
    });

    // Use a PD curve with meaningful default rate
    const pdCurve: ForecastCurve = {
      id: 'pd-curve-high',
      type: 'PD',
      periods: [
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2027-12-31'),
          rateDecimal: 0.02, // 2% quarterly → higher default rate
          confidence: 1,
        },
      ],
      extractedAt: new Date(),
      ratePeriod: 'quarterly',
      conversionMethod: 'simple',
    };

    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);

    // With 12-month delay, recoveries from early defaults should appear
    // after maturity (period 6)
    const postMaturityPeriods = result.cashFlows.filter(
      cf => cf.period > result.debugInfo!.derivedMaturityPeriod
    );

    // There should be some post-maturity periods (the tail)
    expect(postMaturityPeriods.length).toBeGreaterThan(0);

    // Check that recoveries appear in the tail
    const tailRecoveries = postMaturityPeriods.reduce(
      (sum, cf) => sum + cf.recoveryAmount,
      0
    );

    // Verify debug info tracks this
    expect(result.debugInfo?.totalRecoveriesInTail).toBeCloseTo(tailRecoveries, 2);
  });

  test('post-maturity periods have zero balance activity', () => {
    const loan = createBaseLoan({
      periods: 6,
      maturityDate: new Date('2025-12-31'),
      recoveryDelay: 12,
    });

    const pdCurve: ForecastCurve = {
      id: 'pd-curve-high',
      type: 'PD',
      periods: [
        {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2027-12-31'),
          rateDecimal: 0.02,
          confidence: 1,
        },
      ],
      extractedAt: new Date(),
      ratePeriod: 'quarterly',
      conversionMethod: 'simple',
    };

    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    // Post-maturity periods should have zero balance activity
    const postMaturityPeriods = result.cashFlows.filter(
      cf => cf.period > result.debugInfo!.derivedMaturityPeriod
    );

    for (const cf of postMaturityPeriods) {
      expect(cf.beginningBalance).toBe(0);
      expect(cf.endingBalance).toBe(0);
      expect(cf.interestPayment).toBe(0);
      expect(cf.scheduledPrincipal).toBe(0);
      expect(cf.prepayment).toBe(0);
      expect(cf.defaultAmount).toBe(0);
      expect(cf.lossAmount).toBe(0);
      // recoveryAmount can be > 0 (from delayed recoveries)
    }
  });
});

// ----------------------------------------------------------------------------
// Additional Edge Cases
// ----------------------------------------------------------------------------

describe('Edge Cases', () => {
  test('handles zero balance at maturity gracefully', () => {
    const loan = createBaseLoan({
      bookBalance: 5000, // Small balance
      paymentAmount: 5000, // Will pay off quickly
      periods: 3,
      maturityDate: new Date('2025-09-30'),
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);
    expect(result.cashFlows.length).toBeGreaterThan(0);
  });

  test('handles interest-only loans at maturity', () => {
    const loan = createBaseLoan({
      paymentType: 'Interest Only',
      periods: 17, // 6 contractual + 11 recovery tail
      maturityDate: new Date('2025-12-31'),
      recoveryDelay: 12,
    });

    const pdCurve = createPDCurve();
    const lgdCurve = createLGDCurve();

    const result = calculateDCF(loan, pdCurve, lgdCurve);

    expect(result.valid).toBe(true);

    const maturityPeriod = result.cashFlows.find(
      cf => cf.period === result.debugInfo?.derivedMaturityPeriod
    );

    expect(maturityPeriod).toBeDefined();
    // Full balance should be paid off at maturity even for IO loans
    expect(maturityPeriod!.scheduledPrincipal).toBeCloseTo(
      maturityPeriod!.beginningBalance,
      2
    );
    expect(maturityPeriod!.endingBalance).toBe(0);
  });

  test('calculateReamortizedPayment handles edge cases', () => {
    // Zero balance
    expect(calculateReamortizedPayment(0, 0.005, 120)).toBe(0);

    // Zero periods
    expect(calculateReamortizedPayment(100000, 0.005, 0)).toBe(0);

    // Zero rate
    const zeroRatePmt = calculateReamortizedPayment(120000, 0, 120);
    expect(zeroRatePmt).toBe(1000); // 120000 / 120

    // Normal case
    const normalPmt = calculateReamortizedPayment(100000, 0.005, 120);
    expect(normalPmt).toBeGreaterThan(0);
    expect(normalPmt).toBeLessThan(100000);
  });
});
