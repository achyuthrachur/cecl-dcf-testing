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
  RatePeriod,
  RateConversionMethod,
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
 * Get the amortization multiplier based on day count convention
 * Per Excel: AmortizationMultiplier = IF(AmortizationDays contains "360", 365/360, 1)
 */
export function getAmortizationMultiplier(amortizationDays: AmortizationDays): number {
  if (amortizationDays === 'Actual 360') {
    return 365 / 360;
  }
  return 1;
}

/**
 * Calculate monthly interest rate based on amortization days convention
 * Per Excel: InterestRate × AmortizationMultiplier × IF(SEARCH("Actual", AmortizationDays), DaysInMonth/365, 1/12)
 */
export function calculateMonthlyInterestRate(
  annualRate: number,
  daysInMonth: number,
  amortizationDays: AmortizationDays
): number {
  const amortMultiplier = getAmortizationMultiplier(amortizationDays);

  switch (amortizationDays) {
    case 'Actual 360':
      // Excel: Rate × (365/360) × (Days/365) = Rate × Days / 360 with multiplier
      return annualRate * amortMultiplier * (daysInMonth / 365);
    case 'Actual 365':
      // Excel: Rate × 1 × (Days/365)
      return annualRate * amortMultiplier * (daysInMonth / 365);
    case '30/360':
    default:
      // Excel: Rate × 1 × (1/12)
      return annualRate * amortMultiplier * (1 / 12);
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
 * Per Excel: For Interest Only loans, principal = Beginning Balance × monthly curtailment rate
 * where monthly curtailment = ROUND(1 - (1 - CurtailmentRate)^(1/12), 6)
 */
export function calculateScheduledPrincipal(
  beginningBalance: number,
  interestPayment: number,
  paymentAmount: number,
  paymentType: string,
  remainingPeriods: number,
  curtailmentRate: number = 0
): number {
  switch (paymentType) {
    case 'Fixed Payment':
      // Principal = Payment - Interest
      return roundTo2Decimals(Math.max(0, Math.min(paymentAmount - interestPayment, beginningBalance)));

    case 'Fixed Principal':
      // Fixed principal amount per period (simplified)
      return roundTo2Decimals(Math.min(paymentAmount, beginningBalance));

    case 'Interest Only':
      // Per Excel: Interest Only loans use curtailment rate for principal reduction
      // Formula: Beginning Balance × ROUND(1 - (1 - CurtailmentRate)^(1/12), 6)
      if (curtailmentRate > 0) {
        const monthlyCurtailment = roundTo6Decimals(1 - Math.pow(1 - curtailmentRate, 1 / 12));
        return roundTo2Decimals(beginningBalance * monthlyCurtailment);
      }
      return 0;

    case 'Line of Credit':
      // Line of credit - no scheduled principal
      return 0;

    default:
      // Default to amortizing
      return roundTo2Decimals(Math.max(0, paymentAmount - interestPayment));
  }
}

/**
 * Round to 2 decimal places (matches Excel ROUND(..., 2))
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round to 6 decimal places (matches Excel ROUND(..., 6))
 */
function roundTo6Decimals(value: number): number {
  return Math.round(value * 1000000) / 1000000;
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
 * Per Excel formula (Column I):
 * IF(Loan Type = "Interest Only", 0,
 *    ROUND(MAX(MIN(SMM × Beginning Balance, Beginning Balance - Principal), 0), 2))
 *
 * Key difference from previous implementation:
 * - SMM is applied to FULL Beginning Balance first
 * - Then result is CAPPED at (Beginning Balance - Principal)
 * - Interest Only loans have 0 prepayment (curtailment used for principal instead)
 * - Line of Credit also has 0 prepayment
 */
export function calculatePrepayment(
  beginningBalance: number,
  scheduledPrincipal: number,
  smm: number,
  _curtailmentRate: number,  // Kept for API compatibility; curtailment now used in principal calc
  paymentType: string
): number {
  switch (paymentType) {
    case 'Interest Only':
      // Per Excel: Interest Only loans have 0 prepayment
      // (curtailment is used for principal reduction instead)
      return 0;

    case 'Line of Credit':
      // Per Excel: Line of Credit has 0 prepayment (uses curtailment for principal)
      return 0;

    case 'Fixed Payment':
    case 'Fixed Principal':
    default:
      // Per Excel: Prepayment = MIN(SMM × Beginning Balance, Beginning Balance - Principal)
      // SMM applied to FULL beginning balance, then capped
      const calculatedPrepayment = beginningBalance * smm;
      const maxPrepayment = beginningBalance - scheduledPrincipal;
      return roundTo2Decimals(Math.max(0, Math.min(calculatedPrepayment, maxPrepayment)));
  }
}

// ----------------------------------------------------------------------------
// Default and Loss Calculation
// ----------------------------------------------------------------------------

/**
 * Calculate default amount for the period
 * Per Excel formula (Column J):
 * ROUND(MIN(Beginning Balance × PD Rate, Beginning Balance - Principal - Prepayments), 2)
 *
 * Key: The max default is capped at (Beginning Balance - Principal - Prepayments)
 * This ensures defaults can't exceed available balance after principal and prepayments
 */
export function calculateDefault(
  beginningBalance: number,
  scheduledPrincipal: number,
  prepayment: number,
  pdRate: number
): number {
  // Excel formula: MIN(PD × Beginning Balance, Beginning Balance - Principal - Prepayments)
  const calculatedDefault = beginningBalance * pdRate;
  const maxDefault = beginningBalance - scheduledPrincipal - prepayment;
  return roundTo2Decimals(Math.max(0, Math.min(calculatedDefault, maxDefault)));
}

/**
 * Calculate loss amount for the period
 * Per Excel: Loss = ROUND(LGD × Default Amount, 2)
 */
export function calculateLoss(
  defaultAmount: number,
  lgdRate: number
): number {
  return roundTo2Decimals(defaultAmount * lgdRate);
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
 *
 * Per Excel formula (Column Q - Present Value):
 * Cash Flow / ((1 + ActualRateToUse)^(
 *   IF(SEARCH("Actual", AmortizationDays), Running Total / 365, Period / 12)
 * ))
 *
 * Key difference:
 * - For "Actual" day count conventions: Use cumulative days / 365
 * - For 30/360 convention: Use period number / 12 (period-based discounting)
 */
export function calculateDiscountFactor(
  effectiveYield: number,
  period: number,
  cumulativeDays: number,
  amortizationDays: AmortizationDays
): number {
  let exponent: number;

  if (amortizationDays === '30/360') {
    // For 30/360: Use period-based discounting (Period / 12)
    exponent = period / 12;
  } else {
    // For Actual 360 and Actual 365: Use calendar days / 365
    exponent = cumulativeDays / 365;
  }

  // Discount factor = 1 / (1 + rate)^exponent
  return 1 / Math.pow(1 + effectiveYield, exponent);
}

// ----------------------------------------------------------------------------
// Rate Normalization Utilities
// ----------------------------------------------------------------------------

/**
 * Normalize a rate to decimal format
 * Rates should be in decimal form (e.g., 0.035 for 3.5%)
 * If a rate appears to be in percentage form (> 1), convert it to decimal
 *
 * Examples:
 *   3.5 -> 0.035 (was percentage, converted to decimal)
 *   0.035 -> 0.035 (already decimal, unchanged)
 *   0.5 -> 0.005 (ambiguous but > 0.25 suggests percentage, convert)
 *   0.15 -> 0.15 (could be 15% in decimal form, leave as-is)
 */
export function normalizeRateToDecimal(rate: number, fieldName: string = 'rate'): {
  value: number;
  wasConverted: boolean;
  warning?: string;
} {
  if (rate === 0 || rate === undefined || rate === null) {
    return { value: 0, wasConverted: false };
  }

  // If rate is greater than 0.25 (25%), it's very likely in percentage form
  // Most loan interest rates and yields are below 25%
  if (rate > 0.25) {
    const convertedRate = rate / 100;
    return {
      value: convertedRate,
      wasConverted: true,
      warning: `${fieldName} appears to be in percentage form (${rate}). Converted to decimal (${convertedRate.toFixed(6)}).`
    };
  }

  return { value: rate, wasConverted: false };
}

// ----------------------------------------------------------------------------
// Rate Period Conversion
// ----------------------------------------------------------------------------

/**
 * Convert a rate from its source period to monthly.
 *
 * Two conversion methods are supported:
 *
 * 1. COMPOUND METHOD (mathematically correct):
 *    monthly_rate = 1 - (1 - period_rate)^(1/n)
 *    Where n is the number of months in the source period:
 *    - quarterly: n = 3
 *    - annual: n = 12
 *
 * 2. SIMPLE METHOD (Excel/Abrigo approach):
 *    monthly_rate = annual_rate / 12
 *    This treats "quarterly" rates as ANNUALIZED rates (not per-quarter).
 *    Excel divides all rates by 12 regardless of whether they're labeled
 *    "quarterly" or "annual".
 *
 * IMPORTANT: This conversion is for PD, Prepay, and Curtailment rates ONLY.
 * LGD is NOT a periodic rate - it's the loss percentage at default - so it
 * should NOT be converted.
 *
 * @param rate - The rate in decimal form (e.g., 0.005449 for 0.5449%)
 * @param ratePeriod - The time period the rate represents
 * @param conversionMethod - 'simple' (Excel/Abrigo) or 'compound' (mathematically correct)
 * @returns The equivalent monthly rate
 */
export function convertRateToMonthly(
  rate: number,
  ratePeriod: RatePeriod,
  conversionMethod: RateConversionMethod = 'simple'
): number {
  if (rate === 0 || rate === undefined || rate === null) {
    return 0;
  }

  // If already monthly, no conversion needed
  if (ratePeriod === 'monthly') {
    return rate;
  }

  // SIMPLE METHOD: Divide by 12 (Excel/Abrigo approach)
  // Treats all non-monthly rates as annualized rates
  if (conversionMethod === 'simple') {
    return roundTo6Decimals(rate / 12);
  }

  // COMPOUND METHOD: Use mathematically correct formula
  switch (ratePeriod) {
    case 'quarterly':
      // Convert quarterly to monthly: 1 - (1 - quarterly_rate)^(1/3)
      // Example: 0.5449% quarterly → 0.1823% monthly
      return roundTo6Decimals(1 - Math.pow(1 - rate, 1 / 3));

    case 'annual':
      // Convert annual to monthly: 1 - (1 - annual_rate)^(1/12)
      // Example: 2.2% annual → 0.185% monthly
      return roundTo6Decimals(1 - Math.pow(1 - rate, 1 / 12));

    default:
      // Default to quarterly compound conversion
      return roundTo6Decimals(1 - Math.pow(1 - rate, 1 / 3));
  }
}

/**
 * Detect the likely rate period based on the rate magnitude and context.
 * This is a heuristic and should be verified by the user.
 *
 * Typical PD rate ranges:
 * - Monthly: 0.01% - 0.5% (0.0001 - 0.005)
 * - Quarterly: 0.1% - 2% (0.001 - 0.02)
 * - Annual: 0.5% - 10% (0.005 - 0.1)
 *
 * @param rate - The rate in decimal form
 * @param curveType - 'PD' or 'LGD'
 * @returns The detected rate period and confidence
 */
export function detectRatePeriod(rate: number, curveType: 'PD' | 'LGD'): {
  period: RatePeriod;
  confidence: number;
  reasoning: string;
} {
  // LGD is not a periodic rate - it's always just a percentage
  if (curveType === 'LGD') {
    return {
      period: 'quarterly', // Doesn't matter for LGD, but return something sensible
      confidence: 1.0,
      reasoning: 'LGD is not a periodic rate - no conversion needed'
    };
  }

  // For PD rates, use magnitude to guess the period
  if (rate < 0.001) {
    // Very small rate (< 0.1%) - likely already monthly
    return {
      period: 'monthly',
      confidence: 0.7,
      reasoning: `Rate ${(rate * 100).toFixed(4)}% is very small, likely already monthly`
    };
  } else if (rate < 0.015) {
    // Small rate (0.1% - 1.5%) - likely quarterly
    return {
      period: 'quarterly',
      confidence: 0.8,
      reasoning: `Rate ${(rate * 100).toFixed(4)}% is in typical quarterly PD range`
    };
  } else {
    // Larger rate (> 1.5%) - likely annual
    return {
      period: 'annual',
      confidence: 0.6,
      reasoning: `Rate ${(rate * 100).toFixed(4)}% is larger, possibly annual`
    };
  }
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

  // Log the rate period and conversion method being used for PD conversion
  const pdRatePeriod: RatePeriod = pdCurve.ratePeriod || 'quarterly';
  const pdConversionMethod: RateConversionMethod = pdCurve.conversionMethod || 'simple';

  if (!pdCurve.ratePeriod) {
    warnings.push(
      `PD rate period not specified - defaulting to "quarterly". ` +
      `If rates were extracted from monthly columns, set ratePeriod to "monthly" to avoid double-conversion.`
    );
  }

  // Informational: confirm what conversion method is being used
  if (pdRatePeriod === 'monthly') {
    warnings.push('PD rates are monthly - no conversion applied');
  } else {
    const methodDesc = pdConversionMethod === 'simple'
      ? `dividing by 12 (Excel/Abrigo method)`
      : `compound formula 1-(1-rate)^(1/n)`;
    warnings.push(`PD rates are ${pdRatePeriod} - converting to monthly by ${methodDesc}`);
  }

  // Normalize rates to ensure they are in decimal format
  // This handles cases where rates were extracted/entered as percentages (e.g., 3.5 instead of 0.035)
  const effectiveYieldNorm = normalizeRateToDecimal(loan.effectiveYield, 'Effective Yield');
  const interestRateNorm = normalizeRateToDecimal(loan.interestRate, 'Interest Rate');
  const cprNorm = normalizeRateToDecimal(loan.cpr || 0, 'CPR');
  const smmNorm = normalizeRateToDecimal(loan.smm || 0, 'SMM');
  const curtailmentNorm = normalizeRateToDecimal(loan.curtailmentRate || 0, 'Curtailment Rate');

  // Add warnings for any converted rates
  if (effectiveYieldNorm.warning) warnings.push(effectiveYieldNorm.warning);
  if (interestRateNorm.warning) warnings.push(interestRateNorm.warning);
  if (cprNorm.warning) warnings.push(cprNorm.warning);
  if (smmNorm.warning) warnings.push(smmNorm.warning);
  if (curtailmentNorm.warning) warnings.push(curtailmentNorm.warning);

  // Use normalized rates
  const effectiveYield = effectiveYieldNorm.value;
  const interestRate = interestRateNorm.value;
  const normalizedCpr = cprNorm.value;
  const normalizedSmm = smmNorm.value;
  const curtailmentRate = curtailmentNorm.value;

  // Generate schedule dates
  const calculationDate = new Date(loan.calculationDate);
  const scheduleDates = generateScheduleDates(calculationDate, loan.periods);

  // Get SMM rate (SMM preferred over CPR) - use normalized values
  const smm = normalizedSmm > 0
    ? normalizedSmm
    : normalizedCpr > 0
      ? 1 - Math.pow(1 - normalizedCpr, 1 / 12)
      : 0;

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

    // Get forecast rates for this period
    // These rates could be monthly, quarterly, or annual depending on the source
    const rawPdRate = getForecastRate(pdCurve, periodDate);
    const rawLgdRate = getForecastRate(lgdCurve, periodDate);

    // Normalize PD/LGD rates in case they were provided as percentages
    // This is critical - rates might be extracted as 1.5 for "1.5%" instead of 0.015
    const pdNorm = normalizeRateToDecimal(rawPdRate, 'PD Rate');
    const lgdNorm = normalizeRateToDecimal(rawLgdRate, 'LGD Rate');

    // Only add warnings once (first period) to avoid spam
    if (period === 1) {
      if (pdNorm.warning) warnings.push(pdNorm.warning);
      if (lgdNorm.warning) warnings.push(lgdNorm.warning);
    }

    const normalizedPdRate = pdNorm.value;
    const lgdRate = lgdNorm.value;

    // Convert PD to monthly based on the source period and conversion method
    // - 'monthly': No conversion needed (rate is already monthly)
    // - 'quarterly'/'annual' with 'simple' method: Divide by 12 (Excel/Abrigo approach)
    // - 'quarterly'/'annual' with 'compound' method: Use 1-(1-rate)^(1/n) formula
    //
    // NOTE: LGD is NOT converted - it's not a periodic rate, it's the loss
    // percentage applied at the time of default
    const pdRate = convertRateToMonthly(normalizedPdRate, pdRatePeriod, pdConversionMethod);

    // Calculate monthly interest rate (using normalized interest rate)
    const monthlyInterestRate = calculateMonthlyInterestRate(
      interestRate,
      daysInPeriod,
      loan.amortizationDays
    );

    // Calculate interest payment (with rounding per Excel)
    const interestPayment = roundTo2Decimals(calculateInterestPayment(balance, monthlyInterestRate));

    // Calculate scheduled principal (pass curtailmentRate for Interest Only loans)
    const scheduledPrincipal = calculateScheduledPrincipal(
      balance,
      interestPayment,
      loan.paymentAmount,
      loan.paymentType,
      remainingPeriods,
      curtailmentRate
    );

    // Calculate prepayment (rate depends on payment type per Excel template)
    const prepayment = calculatePrepayment(
      balance,
      scheduledPrincipal,
      smm,
      curtailmentRate,
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

    // Calculate discount factor (using normalized effective yield)
    const discountFactor = calculateDiscountFactor(
      effectiveYield,
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

  // Handle balloon payment at maturity (remaining balance after all scheduled payments)
  // This is critical for loans that don't fully amortize
  if (balance > 0.01 && cashFlows.length > 0) {
    const lastCashFlow = cashFlows[cashFlows.length - 1];
    // Add balloon to the last period's cash flow
    const balloonPV = balance * lastCashFlow.discountFactor;
    lastCashFlow.totalCashFlow += balance;
    lastCashFlow.presentValue += balloonPV;
    lastCashFlow.scheduledPrincipal += balance;
    lastCashFlow.endingBalance = 0;
    warnings.push(`Balloon payment of $${balance.toFixed(2)} added at maturity`);
  }

  // Capture any pending recoveries that extend beyond the loan term
  // These should still be discounted and included in NPV
  const lastPeriod = cashFlows.length > 0 ? cashFlows[cashFlows.length - 1].period : loan.periods;
  const remainingRecoveries = pendingRecoveries.filter(r => r.period > lastPeriod);

  if (remainingRecoveries.length > 0) {
    let totalRemainingRecovery = 0;
    for (const recovery of remainingRecoveries) {
      // Discount the recovery back to present value
      const recoveryDiscountFactor = calculateDiscountFactor(
        effectiveYield,
        recovery.period,
        recovery.period * 30, // Approximate days for discounting
        loan.amortizationDays
      );
      totalRemainingRecovery += recovery.amount * recoveryDiscountFactor;
    }

    if (totalRemainingRecovery > 0 && cashFlows.length > 0) {
      // Add to last period's present value
      const lastCF = cashFlows[cashFlows.length - 1];
      lastCF.presentValue += totalRemainingRecovery;
      lastCF.recoveryAmount += remainingRecoveries.reduce((sum, r) => sum + r.amount, 0);
      warnings.push(`Deferred recoveries of $${remainingRecoveries.reduce((sum, r) => sum + r.amount, 0).toFixed(2)} captured after loan term`);
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
