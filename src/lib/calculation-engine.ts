// ============================================================================
// CECL DCF Calculation Engine
// Replicates Excel Template.xlsm calculation logic
// ============================================================================

import {
  LoanInput,
  ForecastCurve,
  PeriodCashFlow,
  CalculationResult,
  AmortizationDays,
  RatePeriod,
  RateConversionMethod,
  ScheduleDebugInfo,
} from '@/types';
import { endOfMonth, differenceInDays, differenceInCalendarMonths } from 'date-fns';

// ----------------------------------------------------------------------------
// UTC Date Helpers
// ----------------------------------------------------------------------------

/**
 * Get end of month in UTC to avoid timezone issues.
 * The date-fns endOfMonth function uses local timezone which causes
 * off-by-one errors when displayed in UTC.
 */
function endOfMonthUTC(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  // Get the last day of the month by going to the 0th day of next month
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return lastDay;
}

/**
 * Add months to a date in UTC
 */
function addMonthsUTC(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return new Date(Date.UTC(year, month + months, day));
}

/**
 * Calculate difference in days between two dates (UTC-based)
 */
function differenceInDaysUTC(dateLeft: Date, dateRight: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const utcLeft = Date.UTC(dateLeft.getUTCFullYear(), dateLeft.getUTCMonth(), dateLeft.getUTCDate());
  const utcRight = Date.UTC(dateRight.getUTCFullYear(), dateRight.getUTCMonth(), dateRight.getUTCDate());
  return Math.floor((utcLeft - utcRight) / MS_PER_DAY);
}

// ----------------------------------------------------------------------------
// Date Utilities
// ----------------------------------------------------------------------------

/**
 * Generate end-of-month dates for the loan schedule
 * Uses UTC-based date handling to avoid timezone issues
 */
export function generateScheduleDates(
  calculationDate: Date,
  periods: number
): Date[] {
  const dates: Date[] = [];
  for (let i = 1; i <= periods; i++) {
    // Use UTC functions to avoid timezone issues
    const futureDate = addMonthsUTC(calculationDate, i);
    const date = endOfMonthUTC(futureDate);
    dates.push(date);
  }
  return dates;
}

/**
 * Calculate the number of months (periods) from calculation date to maturity date.
 * This is used to determine when the loan contractually matures, independent of loan.periods.
 *
 * Excel uses end-of-month alignment for both dates.
 *
 * @param calculationDate - The as-of date for the calculation
 * @param maturityDate - The loan's contractual maturity date
 * @returns Number of months between calculation date and maturity date (minimum 1)
 */
export function getMaturityPeriod(calculationDate: Date, maturityDate: Date): number {
  // Align both dates to end of month for consistent comparison
  const calcEOM = endOfMonth(new Date(calculationDate));
  const maturityEOM = endOfMonth(new Date(maturityDate));

  // Calculate the difference in calendar months
  const monthsDiff = differenceInCalendarMonths(maturityEOM, calcEOM);

  // Ensure minimum of 1 period
  return Math.max(1, monthsDiff);
}

/**
 * Get the number of days in a period for Actual/360 calculation
 * Uses UTC-based calculation to avoid timezone issues
 */
export function getDaysInPeriod(
  periodStart: Date,
  periodEnd: Date,
  amortizationDays: AmortizationDays
): number {
  if (amortizationDays === 'Actual 360' || amortizationDays === 'Actual 365') {
    return differenceInDaysUTC(periodEnd, periodStart);
  }
  // 30/360 convention
  return 30;
}

/**
 * Get cumulative days from calculation date for discounting
 * Uses UTC-based calculation to avoid timezone issues
 *
 * NOTE: The addDiscountOffset parameter was previously used to add ~30 days
 * to match an observed Excel "Running Total" behavior. However, testing shows
 * this offset causes over-discounting for most loans. It is now disabled by
 * default (false). Set to true only if you're matching a specific Excel model
 * that uses this offset.
 */
export function getCumulativeDays(
  calculationDate: Date,
  periodDate: Date,
  addDiscountOffset: boolean = false  // Changed default to false
): number {
  const baseDays = differenceInDaysUTC(periodDate, calculationDate);

  // Add one month offset only if explicitly requested
  // Most Excel models do NOT use this offset
  if (addDiscountOffset) {
    // Get days in the previous month for accurate offset
    const prevMonth = addMonthsUTC(calculationDate, -1);
    const daysOffset = differenceInDaysUTC(calculationDate, endOfMonthUTC(prevMonth));
    return baseDays + daysOffset;
  }

  return baseDays;
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
  _remainingPeriods: number,  // Kept for API compatibility
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
// Reamortization Calculation
// ----------------------------------------------------------------------------

/**
 * Infer amortization term (in months) from loan parameters when not explicitly provided.
 *
 * Uses a binary search to find the number of periods n such that:
 * PMT(P, r, n) ≈ loan.paymentAmount
 *
 * This matches Excel's "Inferred Am Thru / Amortization Term" concept.
 *
 * @param loan - The loan input containing bookBalance and paymentAmount
 * @param monthlyRateForPMT - Monthly interest rate for PMT calculation
 * @returns The inferred amortization term in months, or null if inference fails
 */
export function getAmortizationTermMonths(
  loan: LoanInput,
  monthlyRateForPMT: number
): { term: number | null; warning?: string } {
  // If amortization term is explicitly provided and valid, use it
  if (loan.amortizationTerm && loan.amortizationTerm > 0) {
    return { term: loan.amortizationTerm };
  }

  // Only attempt inference if reamortize is true
  if (!loan.reamortize) {
    return { term: null };
  }

  // Need valid payment amount and balance to infer
  if (!loan.paymentAmount || loan.paymentAmount <= 0 || !loan.bookBalance || loan.bookBalance <= 0) {
    return {
      term: null,
      warning: 'Cannot infer amortization term: payment amount or book balance is missing/invalid'
    };
  }

  const P = loan.bookBalance;
  const r = monthlyRateForPMT;
  const targetPMT = loan.paymentAmount;

  // Handle zero interest rate case
  if (r <= 0) {
    // For zero rate: PMT = P / n, so n = P / PMT
    const inferredTerm = Math.round(P / targetPMT);
    if (inferredTerm > 0 && inferredTerm <= 1200) {
      return { term: inferredTerm };
    }
    return {
      term: null,
      warning: `Cannot infer amortization term with zero interest rate: inferred ${inferredTerm} months`
    };
  }

  // Check if payment covers at least the monthly interest
  const monthlyInterest = P * r;
  if (targetPMT <= monthlyInterest) {
    return {
      term: null,
      warning: `Cannot infer amortization term: payment ($${targetPMT.toFixed(2)}) is less than or equal to monthly interest ($${monthlyInterest.toFixed(2)})`
    };
  }

  // Binary search for n such that PMT(P, r, n) ≈ targetPMT
  // PMT = P × (r(1+r)^n) / ((1+r)^n - 1)
  // We search for n in range [1, 1200] (up to 100 years)
  let low = 1;
  let high = 1200;
  let bestN = 0;
  let bestDiff = Infinity;

  // Helper to calculate PMT for a given n
  const calcPMT = (n: number): number => {
    const onePlusR = 1 + r;
    const onePlusRPowN = Math.pow(onePlusR, n);
    return P * (r * onePlusRPowN) / (onePlusRPowN - 1);
  };

  // Binary search
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const pmt = calcPMT(mid);
    const diff = Math.abs(pmt - targetPMT);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestN = mid;
    }

    // Higher n means lower payment
    if (pmt > targetPMT) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Accept if within 1% tolerance
  const tolerance = targetPMT * 0.01;
  if (bestDiff <= tolerance && bestN > 0) {
    return { term: bestN };
  }

  // If not close enough, return best guess with warning
  if (bestN > 0 && bestN <= 1200) {
    return {
      term: bestN,
      warning: `Amortization term inferred as ${bestN} months (PMT difference: $${bestDiff.toFixed(2)} from target $${targetPMT.toFixed(2)})`
    };
  }

  return {
    term: null,
    warning: `Could not infer amortization term: best guess ${bestN} months with PMT difference $${bestDiff.toFixed(2)}`
  };
}

/**
 * Calculate the reamortized payment amount for a given period.
 *
 * Excel's reamortization recalculates the payment each period based on:
 * - Current balance (after previous period's principal, prepay, default reductions)
 * - Remaining amortization term (original term minus elapsed periods)
 * - Monthly interest rate
 *
 * Formula: PMT = Balance × (r × (1+r)^n) / ((1+r)^n - 1)
 * where:
 *   r = monthly interest rate
 *   n = remaining amortization periods
 *
 * @param balance - Current beginning balance for the period
 * @param monthlyRate - Monthly interest rate (e.g., 0.002875 for 3.45%/12)
 * @param remainingAmortPeriods - Remaining periods in the amortization schedule
 * @returns The calculated payment amount
 */
export function calculateReamortizedPayment(
  balance: number,
  monthlyRate: number,
  remainingAmortPeriods: number
): number {
  if (balance <= 0 || remainingAmortPeriods <= 0) {
    return 0;
  }

  // Handle zero interest rate edge case
  if (monthlyRate <= 0) {
    return roundTo2Decimals(balance / remainingAmortPeriods);
  }

  // Standard amortization formula: PMT = P × (r(1+r)^n) / ((1+r)^n - 1)
  const onePlusR = 1 + monthlyRate;
  const onePlusRPowN = Math.pow(onePlusR, remainingAmortPeriods);
  const payment = balance * (monthlyRate * onePlusRPowN) / (onePlusRPowN - 1);

  return roundTo2Decimals(payment);
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
 *
 * Key behaviors matching Excel:
 * 1. Contractual cash flows stop at maturity (balloon payoff at maturity month)
 * 2. Recovery tail continues after maturity for recoveryDelay months
 * 3. Post-maturity periods have zero balance activity (only delayed recoveries)
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

  // ============================================================================
  // PERIOD DERIVATION FROM MATURITY DATE (Key fix for Excel matching)
  // ============================================================================
  const calculationDate = new Date(loan.calculationDate);
  const maturityDate = new Date(loan.maturityDate);

  // Derive the contractual maturity period from maturityDate
  // This is the period when the balloon payment occurs (if any)
  const contractualPeriods = getMaturityPeriod(calculationDate, maturityDate);

  // Total periods = contractual periods + recovery delay tail
  // The tail allows delayed recoveries to be released after maturity
  // recoveryDelay - 1 because the first recovery can occur in the last contractual period
  const totalPeriods = contractualPeriods + Math.max(0, loan.recoveryDelay - 1);

  // Check if loan.periods differs from derived values and warn
  const periodsOverridden = loan.periods !== contractualPeriods;
  if (periodsOverridden) {
    const expectedWithTail = contractualPeriods + Math.max(0, loan.recoveryDelay - 1);
    if (Math.abs(loan.periods - expectedWithTail) > 1) {
      warnings.push(
        `Input periods (${loan.periods}) differs from derived value. ` +
        `Maturity-based contractual periods: ${contractualPeriods}, ` +
        `total with recovery tail: ${totalPeriods}. Using derived values.`
      );
    }
  }

  // Generate schedule dates for the full schedule (including recovery tail)
  const scheduleDates = generateScheduleDates(calculationDate, totalPeriods);

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

  // Track balloon for debug info
  let balloonApplied = false;
  let balloonAmount = 0;
  let balloonPeriod = 0;

  // ============================================================================
  // REAMORTIZATION SETUP (Pre-loop calculation)
  // ============================================================================
  // Calculate the monthly rate for PMT that matches Excel's approach
  // Excel treats the amort multiplier (365/360) as part of the effective rate
  const amortMultiplier = getAmortizationMultiplier(loan.amortizationDays);
  const monthlyRateForPMT = (interestRate * amortMultiplier) / 12;

  // Get or infer amortization term (only computed once, before the loop)
  const amortTermResult = getAmortizationTermMonths(loan, monthlyRateForPMT);
  const effectiveAmortTerm = amortTermResult.term;

  // Add warning if term was inferred or couldn't be determined
  if (amortTermResult.warning) {
    warnings.push(amortTermResult.warning);
  }

  // Track reamortization for debug info
  let reamortizationApplied = false;
  let reamortPaymentUsed = 0;
  let remainingAmortPeriodsUsed = 0;

  // Calculate each period
  let previousDate = calculationDate;

  for (let i = 0; i < totalPeriods; i++) {
    const period = i + 1;
    const periodDate = scheduleDates[i];
    const isPreMaturity = period <= contractualPeriods;
    const isMaturityPeriod = period === contractualPeriods;
    const isPostMaturity = period > contractualPeriods;

    // Get days in period
    const daysInPeriod = getDaysInPeriod(
      previousDate,
      periodDate,
      loan.amortizationDays
    );

    // Get cumulative days for discounting
    const cumulativeDays = getCumulativeDays(calculationDate, periodDate);

    // ========================================================================
    // PRE-MATURITY PERIODS: Full calculation (interest, principal, prepay, default)
    // ========================================================================
    let interestPayment = 0;
    let scheduledPrincipal = 0;
    let prepayment = 0;
    let defaultAmount = 0;
    let lossAmount = 0;
    let recoveryAtDefault = 0;
    let pdRate = 0;
    let lgdRate = 0;
    let monthlyInterestRate = 0;

    if (isPreMaturity) {
      // Get forecast rates for this period
      const rawPdRate = getForecastRate(pdCurve, periodDate);
      const rawLgdRate = getForecastRate(lgdCurve, periodDate);

      // Normalize PD/LGD rates
      const pdNorm = normalizeRateToDecimal(rawPdRate, 'PD Rate');
      const lgdNorm = normalizeRateToDecimal(rawLgdRate, 'LGD Rate');

      // Only add warnings once (first period) to avoid spam
      if (period === 1) {
        if (pdNorm.warning) warnings.push(pdNorm.warning);
        if (lgdNorm.warning) warnings.push(lgdNorm.warning);
      }

      const normalizedPdRate = pdNorm.value;
      lgdRate = lgdNorm.value;

      // Convert PD to monthly
      pdRate = convertRateToMonthly(normalizedPdRate, pdRatePeriod, pdConversionMethod);

      // Calculate monthly interest rate
      monthlyInterestRate = calculateMonthlyInterestRate(
        interestRate,
        daysInPeriod,
        loan.amortizationDays
      );

      // Calculate interest payment
      interestPayment = roundTo2Decimals(calculateInterestPayment(balance, monthlyInterestRate));

      // Calculate payment amount - either fixed or reamortized
      let paymentAmountForPeriod = loan.paymentAmount;

      // Reamortization: recalculate payment based on current balance and remaining amort term
      // Only apply if reamortize flag is true AND we have a valid amortization term
      if (loan.reamortize && effectiveAmortTerm && effectiveAmortTerm > 0) {
        // For monthly schedule periods, decrement by 1 each period
        // (The schedule is monthly-period-based with EOM dates)
        const decrementPerPeriod = 1;
        const remainingAmortPeriods = effectiveAmortTerm - decrementPerPeriod * (period - 1);

        if (remainingAmortPeriods > 0) {
          // Use monthlyRateForPMT which includes the amortization multiplier
          // This matches Excel's treatment of Actual/360 instruments
          paymentAmountForPeriod = calculateReamortizedPayment(
            balance,
            monthlyRateForPMT,
            remainingAmortPeriods
          );

          // Track for debug info
          reamortizationApplied = true;
          reamortPaymentUsed = paymentAmountForPeriod;
          remainingAmortPeriodsUsed = remainingAmortPeriods;
        }
      }

      // ======================================================================
      // MATURITY PERIOD: Payoff-first ordering (Excel-style)
      // At maturity, the loan is contractually paid off before any prepay/default
      // ======================================================================
      if (isMaturityPeriod) {
        // At maturity: full payoff of remaining balance
        scheduledPrincipal = roundTo2Decimals(balance);

        // Force these to zero - no prepay/default at maturity (Excel behavior)
        prepayment = 0;
        defaultAmount = 0;
        lossAmount = 0;
        recoveryAtDefault = 0;
        // Note: Don't push any new pendingRecoveries at maturity

        // Track balloon for debug info
        balloonAmount = scheduledPrincipal;
        balloonApplied = true;
        balloonPeriod = period;

        if (balance > 0.01) {
          warnings.push(`Maturity payoff of $${scheduledPrincipal.toFixed(2)} applied at period ${period}`);
        }
      }
      // ======================================================================
      // NON-MATURITY PRE-MATURITY PERIODS: Normal calculation
      // ======================================================================
      else {
        // Calculate remaining periods for principal calculation
        const remainingPeriods = contractualPeriods - i;

        // Calculate scheduled principal
        scheduledPrincipal = calculateScheduledPrincipal(
          balance,
          interestPayment,
          paymentAmountForPeriod,
          loan.paymentType,
          remainingPeriods,
          curtailmentRate
        );

        // Calculate prepayment
        prepayment = calculatePrepayment(
          balance,
          scheduledPrincipal,
          smm,
          curtailmentRate,
          loan.paymentType
        );

        // Calculate default
        defaultAmount = calculateDefault(
          balance,
          scheduledPrincipal,
          prepayment,
          pdRate
        );

        // Calculate loss
        lossAmount = calculateLoss(defaultAmount, lgdRate);

        // Calculate recovery (will be delayed)
        recoveryAtDefault = calculateRecovery(defaultAmount, lossAmount);

        // Store recovery for delayed release
        if (recoveryAtDefault > 0) {
          pendingRecoveries.push({
            period: period + loan.recoveryDelay,
            amount: recoveryAtDefault,
          });
        }
      }
    }
    // ========================================================================
    // POST-MATURITY PERIODS: Zero balance activity, only delayed recoveries
    // ========================================================================
    // isPostMaturity means we're in the recovery tail
    // All balance-related values are already 0 from initialization

    // Get actual recovery for this period (from delayed recoveries)
    const recoveryAmount = pendingRecoveries
      .filter((r) => r.period === period)
      .reduce((sum, r) => sum + r.amount, 0);

    // Update cumulative totals
    cumulativeDefault += defaultAmount;
    cumulativeLoss += lossAmount;
    cumulativeRecovery += recoveryAmount;

    // Calculate total cash flow for the period
    const totalCashFlow =
      interestPayment +
      scheduledPrincipal +
      prepayment +
      recoveryAmount;

    // Calculate discount factor
    const discountFactor = calculateDiscountFactor(
      effectiveYield,
      period,
      cumulativeDays,
      loan.amortizationDays
    );

    // Calculate present value
    const presentValue = totalCashFlow * discountFactor;

    // Calculate ending balance
    let endingBalance: number;
    if (isMaturityPeriod) {
      // At maturity, balance goes to zero (balloon paid off)
      endingBalance = 0;
    } else if (isPostMaturity) {
      // Post-maturity, balance is already zero
      endingBalance = 0;
    } else {
      // Pre-maturity, calculate normally
      endingBalance = Math.max(
        0,
        balance - scheduledPrincipal - prepayment - defaultAmount
      );
    }

    // Store period cash flow
    cashFlows.push({
      period,
      date: periodDate,
      daysInPeriod,
      beginningBalance: isPostMaturity ? 0 : balance,
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

    // ========================================================================
    // EARLY EXIT: Only after maturity AND no pending recoveries
    // ========================================================================
    if (period >= contractualPeriods) {
      const hasFutureRecoveries = pendingRecoveries.some(r => r.period > period);
      if (!hasFutureRecoveries && balance <= 0.01) {
        // No more cash flows expected, safe to exit
        break;
      }
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

  // Build debug info for diagnostics
  const pendingRecoveriesAtMaturity = pendingRecoveries.filter(r => r.period > contractualPeriods).length;
  const pendingRecoveriesAtFinal = pendingRecoveries.filter(r => r.period > totalPeriods).length;
  const totalRecoveriesInTail = cashFlows
    .filter(cf => cf.period > contractualPeriods)
    .reduce((sum, cf) => sum + cf.recoveryAmount, 0);

  const debugInfo: ScheduleDebugInfo = {
    inputPeriods: loan.periods,
    derivedMaturityPeriod: contractualPeriods,
    totalPeriods: totalPeriods,
    periodsOverridden,
    calculationDate,
    maturityDate,
    maturityPeriodDate: scheduleDates[contractualPeriods - 1] || maturityDate,
    finalPeriodDate: scheduleDates[scheduleDates.length - 1] || maturityDate,
    balloonApplied,
    balloonAmount,
    balloonPeriod,
    recoveryDelay: loan.recoveryDelay,
    pendingRecoveriesAtMaturity,
    pendingRecoveriesAtFinal,
    totalRecoveriesInTail,
    // Reamortization tracking
    reamortizationApplied,
    effectiveAmortTerm,
    monthlyRateForPMT,
    reamortPaymentUsed,
    remainingAmortPeriodsUsed,
  };

  return {
    id: `calc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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
    debugInfo,
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

  // Periods is now optional - derived from maturityDate internally
  // But warn if not provided or if it seems inconsistent
  if (!loan.periods || loan.periods <= 0) {
    warnings.push(
      'Number of periods not provided or invalid - will be derived from maturityDate'
    );
  } else if (loan.maturityDate && loan.calculationDate) {
    // Check if provided periods roughly matches maturity date
    const derivedPeriods = getMaturityPeriod(
      new Date(loan.calculationDate),
      new Date(loan.maturityDate)
    );
    if (Math.abs(loan.periods - derivedPeriods) > 3) {
      warnings.push(
        `Provided periods (${loan.periods}) differs significantly from maturity-derived periods (${derivedPeriods}). ` +
        `Engine will use maturity-derived value.`
      );
    }
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
