// ============================================================================
// CECL DCF Calculation Engine
// Replicates Excel Template.xlsm calculation logic
// ============================================================================

import {
  LoanInput,
  ForecastCurve,
  ForecastPeriod,
  PeriodCashFlow,
  CalculationResult,
  AmortizationDays,
} from '@/types';
import { addMonths, endOfMonth, differenceInDays, format } from 'date-fns';

// ----------------------------------------------------------------------------
// Date Utilities
// ----------------------------------------------------------------------------

/**
 * Generate end-of-month dates for the loan schedule
 */
export function generateScheduleDates(
  calculationDate: Date,
  periods: number
): Date[] {
  const dates: Date[] = [];
  for (let i = 1; i <= periods; i++) {
    const date = endOfMonth(addMonths(calculationDate, i));
    dates.push(date);
  }
  return dates;
}

/**
 * Get the number of days in a period for Actual/360 calculation
 */
export function getDaysInPeriod(
  periodStart: Date,
  periodEnd: Date,
  amortizationDays: AmortizationDays
): number {
  if (amortizationDays === 'Actual 360' || amortizationDays === 'Actual 365') {
    return differenceInDays(periodEnd, periodStart);
  }
  // 30/360 convention
  return 30;
}

/**
 * Get cumulative days from calculation date for discounting
 */
export function getCumulativeDays(
  calculationDate: Date,
  periodDate: Date
): number {
  return differenceInDays(periodDate, calculationDate);
}

// ----------------------------------------------------------------------------
// Rate Lookups
// ----------------------------------------------------------------------------

/**
 * Get the forecast rate for a specific date
 * Uses the rate from the period that contains this date
 * If date is beyond forecast horizon, extends the last known rate
 */
export function getForecastRate(
  curve: ForecastCurve,
  targetDate: Date
): number {
  if (!curve.periods || curve.periods.length === 0) {
    return 0;
  }

  // Sort periods by start date
  const sortedPeriods = [...curve.periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // Find the period that contains the target date
  for (const period of sortedPeriods) {
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);

    if (targetDate >= start && targetDate <= end) {
      return period.rateDecimal;
    }
  }

  // If date is beyond all periods, extend the last known rate
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  if (targetDate > new Date(lastPeriod.endDate)) {
    return lastPeriod.rateDecimal;
  }

  // If date is before all periods, use first rate
  return sortedPeriods[0].rateDecimal;
}

// ----------------------------------------------------------------------------
// Interest Calculation
// ----------------------------------------------------------------------------

/**
 * Calculate monthly interest rate based on amortization days convention
 */
export function calculateMonthlyInterestRate(
  annualRate: number,
  daysInMonth: number,
  amortizationDays: AmortizationDays
): number {
  switch (amortizationDays) {
    case 'Actual 360':
      return annualRate * (daysInMonth / 360);
    case 'Actual 365':
      return annualRate * (daysInMonth / 365);
    case '30/360':
    default:
      return annualRate / 12;
  }
}

/**
 * Calculate interest payment for the period
 */
export function calculateInterestPayment(
  balance: number,
  monthlyRate: number
): number {
  return balance * monthlyRate;
}

// ----------------------------------------------------------------------------
// Principal Calculation
// ----------------------------------------------------------------------------

/**
 * Calculate scheduled principal payment based on payment type
 */
export function calculateScheduledPrincipal(
  beginningBalance: number,
  interestPayment: number,
  paymentAmount: number,
  paymentType: string,
  remainingPeriods: number
): number {
  switch (paymentType) {
    case 'Fixed Payment':
      // Principal = Payment - Interest
      return Math.max(0, Math.min(paymentAmount - interestPayment, beginningBalance));

    case 'Fixed Principal':
      // Fixed principal amount per period (simplified)
      return Math.min(paymentAmount, beginningBalance);

    case 'Interest Only':
      // No principal payment
      return 0;

    case 'Line of Credit':
      // Line of credit - no scheduled principal
      return 0;

    default:
      // Default to amortizing
      return Math.max(0, paymentAmount - interestPayment);
  }
}

// ----------------------------------------------------------------------------
// Prepayment Calculation
// ----------------------------------------------------------------------------

/**
 * Get the SMM (Single Monthly Mortality) rate
 * SMM takes precedence over CPR if both are provided
 */
export function getSMM(loan: LoanInput): number {
  // SMM wins if explicitly provided
  if (loan.smm && loan.smm > 0) {
    return loan.smm;
  }

  // Convert CPR to SMM: SMM = 1 - (1 - CPR)^(1/12)
  if (loan.cpr && loan.cpr > 0) {
    return 1 - Math.pow(1 - loan.cpr, 1 / 12);
  }

  return 0;
}

/**
 * Calculate prepayment for the period
 *
 * Payment type determines which rate to use (matches Excel template logic):
 * - Fixed Payment / Fixed Principal: Use SMM/CPR prepayment rate only
 * - Interest Only / Line of Credit: Use Curtailment rate only
 *
 * Prepayment = Rate × (Beginning Balance - Scheduled Principal)
 */
export function calculatePrepayment(
  beginningBalance: number,
  scheduledPrincipal: number,
  smm: number,
  curtailmentRate: number,
  paymentType: string
): number {
  let effectiveRate: number;

  switch (paymentType) {
    case 'Interest Only':
    case 'Line of Credit':
      // Interest Only and LOC use curtailment rate only (per Excel template)
      effectiveRate = curtailmentRate;
      break;

    case 'Fixed Payment':
    case 'Fixed Principal':
    default:
      // Amortizing loans use SMM/CPR prepayment rate only (per Excel template)
      effectiveRate = smm;
      break;
  }

  const prepayableBalance = beginningBalance - scheduledPrincipal;
  return Math.max(0, prepayableBalance * effectiveRate);
}

// ----------------------------------------------------------------------------
// Default and Loss Calculation
// ----------------------------------------------------------------------------

/**
 * Calculate default amount for the period
 * Per Excel template: Defaulted Principal = MIN(PD × Beginning Balance, Beginning Balance - Principal)
 * PD is applied to full beginning balance, capped at available balance after principal
 */
export function calculateDefault(
  beginningBalance: number,
  scheduledPrincipal: number,
  prepayment: number,
  pdRate: number
): number {
  // Excel formula: MIN(PD × Beginning Balance, Beginning Balance - Principal)
  const calculatedDefault = beginningBalance * pdRate;
  const maxDefault = beginningBalance - scheduledPrincipal;
  return Math.max(0, Math.min(calculatedDefault, maxDefault));
}

/**
 * Calculate loss amount for the period
 * Loss = LGD × Default Amount
 */
export function calculateLoss(
  defaultAmount: number,
  lgdRate: number
): number {
  return defaultAmount * lgdRate;
}

/**
 * Calculate recovery amount
 * Recovery = Default - Loss (shifted by recovery delay)
 */
export function calculateRecovery(
  defaultAmount: number,
  lossAmount: number
): number {
  return defaultAmount - lossAmount;
}

// ----------------------------------------------------------------------------
// Discount Factor Calculation
// ----------------------------------------------------------------------------

/**
 * Calculate discount factor for present value calculation
 * Uses Effective Yield for discounting
 */
export function calculateDiscountFactor(
  effectiveYield: number,
  period: number,
  cumulativeDays: number,
  amortizationDays: AmortizationDays
): number {
  if (amortizationDays === 'Actual 360' || amortizationDays === 'Actual 365') {
    // Discount by actual days / 365
    return Math.pow(1 + effectiveYield, -(cumulativeDays / 365));
  }

  // Monthly discounting
  const monthlyRate = effectiveYield / 12;
  return Math.pow(1 + monthlyRate, -period);
}

// ----------------------------------------------------------------------------
// Main Calculation Engine
// ----------------------------------------------------------------------------

/**
 * Run the full DCF calculation for a loan
 */
export function calculateDCF(
  loan: LoanInput,
  pdCurve: ForecastCurve,
  lgdCurve: ForecastCurve
): CalculationResult {
  const cashFlows: PeriodCashFlow[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate inputs
  if (!loan.bookBalance || loan.bookBalance <= 0) {
    errors.push('Book balance must be positive');
  }
  if (!loan.effectiveYield || loan.effectiveYield <= 0) {
    warnings.push('Effective yield is zero or not provided');
  }
  if (!pdCurve.periods || pdCurve.periods.length === 0) {
    errors.push('PD forecast curve is empty');
  }
  if (!lgdCurve.periods || lgdCurve.periods.length === 0) {
    errors.push('LGD forecast curve is empty');
  }

  // Generate schedule dates
  const calculationDate = new Date(loan.calculationDate);
  const scheduleDates = generateScheduleDates(calculationDate, loan.periods);

  // Get SMM rate (SMM preferred over CPR)
  const smm = getSMM(loan);

  // Initialize tracking variables
  let balance = loan.bookBalance;
  let cumulativeDefault = 0;
  let cumulativeLoss = 0;
  let cumulativeRecovery = 0;

  // Store pending recoveries for delay
  const pendingRecoveries: { period: number; amount: number }[] = [];

  // Calculate each period
  let previousDate = calculationDate;

  for (let i = 0; i < loan.periods; i++) {
    const period = i + 1;
    const periodDate = scheduleDates[i];
    const remainingPeriods = loan.periods - i;

    // Get days in period
    const daysInPeriod = getDaysInPeriod(
      previousDate,
      periodDate,
      loan.amortizationDays
    );

    // Get cumulative days for discounting
    const cumulativeDays = getCumulativeDays(calculationDate, periodDate);

    // Get forecast rates for this period (these are annual rates)
    const annualPdRate = getForecastRate(pdCurve, periodDate);
    const lgdRate = getForecastRate(lgdCurve, periodDate);

    // Convert annual PD to monthly: Monthly PD = 1 - (1 - Annual PD)^(1/12)
    // This ensures proper compounding when applied monthly
    const pdRate = 1 - Math.pow(1 - annualPdRate, 1 / 12);

    // Calculate monthly interest rate
    const monthlyInterestRate = calculateMonthlyInterestRate(
      loan.interestRate,
      daysInPeriod,
      loan.amortizationDays
    );

    // Calculate interest payment
    const interestPayment = calculateInterestPayment(balance, monthlyInterestRate);

    // Calculate scheduled principal
    const scheduledPrincipal = calculateScheduledPrincipal(
      balance,
      interestPayment,
      loan.paymentAmount,
      loan.paymentType,
      remainingPeriods
    );

    // Calculate prepayment (rate depends on payment type per Excel template)
    const prepayment = calculatePrepayment(
      balance,
      scheduledPrincipal,
      smm,
      loan.curtailmentRate,
      loan.paymentType
    );

    // Calculate default
    const defaultAmount = calculateDefault(
      balance,
      scheduledPrincipal,
      prepayment,
      pdRate
    );

    // Calculate loss
    const lossAmount = calculateLoss(defaultAmount, lgdRate);

    // Calculate recovery (will be delayed)
    const recoveryAtDefault = calculateRecovery(defaultAmount, lossAmount);

    // Store recovery for delayed release
    if (recoveryAtDefault > 0) {
      pendingRecoveries.push({
        period: period + loan.recoveryDelay,
        amount: recoveryAtDefault,
      });
    }

    // Get actual recovery for this period (from delayed recoveries)
    const recoveryAmount = pendingRecoveries
      .filter((r) => r.period === period)
      .reduce((sum, r) => sum + r.amount, 0);

    // Update cumulative totals
    cumulativeDefault += defaultAmount;
    cumulativeLoss += lossAmount;
    cumulativeRecovery += recoveryAmount;

    // Calculate total cash flow for the period
    // Per Excel template: Cash Flow = Principal + Interest + Prepayments + Recovery
    // Loss is NOT subtracted - it's implicit in the reduced principal from defaults
    // (defaulted principal is removed from balance, recovery comes back later)
    const totalCashFlow =
      interestPayment +
      scheduledPrincipal +
      prepayment +
      recoveryAmount;

    // Calculate discount factor
    const discountFactor = calculateDiscountFactor(
      loan.effectiveYield,
      period,
      cumulativeDays,
      loan.amortizationDays
    );

    // Calculate present value
    const presentValue = totalCashFlow * discountFactor;

    // Calculate ending balance
    const endingBalance = Math.max(
      0,
      balance - scheduledPrincipal - prepayment - defaultAmount
    );

    // Store period cash flow
    cashFlows.push({
      period,
      date: periodDate,
      daysInPeriod,
      beginningBalance: balance,
      endingBalance,
      interestRateApplied: monthlyInterestRate,
      pdRate,
      lgdRate,
      smmRate: smm,
      interestPayment,
      scheduledPrincipal,
      prepayment,
      defaultAmount,
      lossAmount,
      recoveryAmount,
      totalCashFlow,
      discountFactor,
      presentValue,
      cumulativeDefault,
      cumulativeLoss,
      cumulativeRecovery,
    });

    // Update balance for next period
    balance = endingBalance;
    previousDate = periodDate;

    // Early exit if balance is zero
    if (balance <= 0.01) {
      break;
    }
  }

  // Calculate summary metrics
  const totalInterest = cashFlows.reduce((sum, cf) => sum + cf.interestPayment, 0);
  const totalPrincipal = cashFlows.reduce((sum, cf) => sum + cf.scheduledPrincipal, 0);
  const totalPrepayment = cashFlows.reduce((sum, cf) => sum + cf.prepayment, 0);
  const totalDefault = cashFlows.reduce((sum, cf) => sum + cf.defaultAmount, 0);
  const totalLoss = cashFlows.reduce((sum, cf) => sum + cf.lossAmount, 0);
  const totalRecovery = cashFlows.reduce((sum, cf) => sum + cf.recoveryAmount, 0);

  // Calculate NPV
  const netPresentValue = cashFlows.reduce((sum, cf) => sum + cf.presentValue, 0);

  // Calculate Reserve
  // Reserve = Book Balance + Unamortized Amount - NPV
  const calculatedReserve = loan.bookBalance + loan.unamortizedAmount - netPresentValue;

  // Calculate variance
  const varianceDollar = calculatedReserve - loan.actualReserve;
  const variancePercent =
    loan.actualReserve !== 0
      ? (varianceDollar / loan.actualReserve) * 100
      : calculatedReserve !== 0
        ? 100
        : 0;

  // Determine if result is valid
  const valid = errors.length === 0;

  return {
    id: `calc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    loanId: loan.id,
    segmentId: loan.segmentId,
    calculatedAt: new Date(),
    loanInput: loan,
    pdCurve,
    lgdCurve,
    cashFlows,
    totalInterest,
    totalPrincipal,
    totalPrepayment,
    totalDefault,
    totalLoss,
    totalRecovery,
    netPresentValue,
    calculatedReserve,
    actualReserve: loan.actualReserve,
    varianceDollar,
    variancePercent,
    valid,
    warnings,
    errors,
  };
}

// ----------------------------------------------------------------------------
// Validation Utilities
// ----------------------------------------------------------------------------

/**
 * Validate a loan input before calculation
 */
export function validateLoanInput(loan: Partial<LoanInput>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!loan.loanNumber) errors.push('Loan number is required');
  if (!loan.calculationDate) errors.push('Calculation date is required');
  if (!loan.bookBalance || loan.bookBalance <= 0) {
    errors.push('Book balance must be positive');
  }
  if (!loan.maturityDate) errors.push('Maturity date is required');
  if (!loan.periods || loan.periods <= 0) {
    errors.push('Number of periods must be positive');
  }

  // Rate validations
  if (loan.interestRate !== undefined && loan.interestRate < 0) {
    errors.push('Interest rate cannot be negative');
  }
  if (loan.effectiveYield !== undefined && loan.effectiveYield < 0) {
    errors.push('Effective yield cannot be negative');
  }

  // Payment type validations
  if (loan.paymentType === 'Fixed Payment' && (!loan.paymentAmount || loan.paymentAmount <= 0)) {
    errors.push('Payment amount required for Fixed Payment type');
  }

  // Warning checks
  if (!loan.effectiveYield || loan.effectiveYield === 0) {
    warnings.push('Effective yield is zero - no discounting will be applied');
  }
  if (loan.paymentFrequency && loan.paymentFrequency !== 'Monthly') {
    warnings.push(
      `Payment frequency is ${loan.paymentFrequency} - calculations assume monthly periods`
    );
  }

  // Book balance / Unamortized amount reconciliation
  if (loan.bookBalance && loan.unamortizedAmount) {
    const ratio = loan.unamortizedAmount / loan.bookBalance;
    if (ratio > 0.1) {
      warnings.push(
        'Unamortized amount is more than 10% of book balance - please verify'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate forecast curve
 */
export function validateForecastCurve(curve: Partial<ForecastCurve>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!curve.periods || curve.periods.length === 0) {
    errors.push('Forecast curve has no periods');
  } else {
    // Check for gaps in periods
    const sortedPeriods = [...curve.periods].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    for (let i = 1; i < sortedPeriods.length; i++) {
      const prevEnd = new Date(sortedPeriods[i - 1].endDate);
      const currStart = new Date(sortedPeriods[i].startDate);
      const gap = differenceInDays(currStart, prevEnd);

      if (gap > 1) {
        warnings.push(
          `Gap detected between periods ${i} and ${i + 1}: ${gap} days`
        );
      }
    }

    // Check for negative rates
    for (const period of curve.periods) {
      if (period.rateDecimal < 0) {
        errors.push(`Negative rate found: ${period.rateDecimal}`);
      }
      if (period.rateDecimal > 1) {
        warnings.push(
          `Rate ${period.rateDecimal} seems high (greater than 100%)`
        );
      }
    }

    // Check confidence scores
    const lowConfidencePeriods = curve.periods.filter((p) => p.confidence < 0.8);
    if (lowConfidencePeriods.length > 0) {
      warnings.push(
        `${lowConfidencePeriods.length} period(s) have low extraction confidence`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
