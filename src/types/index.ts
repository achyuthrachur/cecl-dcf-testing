// ============================================================================
// CECL DCF Testing - Core Type Definitions
// ============================================================================

// ----------------------------------------------------------------------------
// Forecast Types
// ----------------------------------------------------------------------------

/**
 * Rate period indicates what time period the extracted rates represent.
 * This is critical for proper conversion to monthly rates:
 * - 'monthly': Rates are already monthly - NO conversion needed
 * - 'quarterly': Rates are quarterly - convert using 1-(1-rate)^(1/3)
 * - 'annual': Rates are annual - convert using 1-(1-rate)^(1/12)
 *
 * NOTE: LGD rates are NOT converted regardless of period - they represent
 * the loss percentage at the time of default, not a periodic rate.
 */
export type RatePeriod = 'monthly' | 'quarterly' | 'annual';

export interface ForecastPeriod {
  startDate: Date;
  endDate: Date;
  rateDecimal: number; // Stored as decimal (e.g., 0.015 for 1.5%)
  confidence: number;  // 0-1 confidence score from extraction
}

export interface ForecastCurve {
  id: string;
  type: 'PD' | 'LGD';
  periods: ForecastPeriod[];
  extractedAt: Date;
  imageUrl?: string;
  rawText?: string;
  /**
   * The time period that the extracted rates represent.
   * Defaults to 'quarterly' for backwards compatibility with existing data.
   *
   * For PD curves: Controls how rates are converted to monthly
   * For LGD curves: Ignored (LGD is not a periodic rate)
   */
  ratePeriod?: RatePeriod;
}

// ----------------------------------------------------------------------------
// Loan Input Types
// ----------------------------------------------------------------------------

export type PaymentType =
  | 'Fixed Payment'
  | 'Fixed Principal'
  | 'Interest Only'
  | 'Line of Credit';

export type PaymentFrequency =
  | 'Monthly'
  | 'Quarterly'
  | 'Semi-Annual'
  | 'Annual';

export type AmortizationDays =
  | 'Actual 360'
  | '30/360'
  | 'Actual 365';

export interface LoanInput {
  id: string;
  segmentId: string;

  // Core identifiers
  loanNumber: string;
  calculationDate: Date;

  // Balance information
  bookBalance: number;        // Current book balance
  unamortizedAmount: number;  // Unamortized fees/costs

  // Rate information (stored as decimals)
  interestRate: number;       // Used for interest accrual
  effectiveYield: number;     // Used for discounting

  // Payment structure
  amortizationDays: AmortizationDays;
  paymentType: PaymentType;
  paymentAmount: number;      // For Fixed Payment types
  paymentFrequency: PaymentFrequency;

  // Term information
  maturityDate: Date;
  periods: number;            // Number of periods to calculate

  // Prepayment assumptions (stored as decimals)
  cpr: number;                // Conditional Prepayment Rate (annual)
  curtailmentRate: number;    // Additional curtailment rate
  smm: number;                // Single Monthly Mortality (takes precedence if present)

  // Recovery
  recoveryDelay: number;      // Months delay for recovery of defaults

  // Actual values from screenshot (for comparison)
  actualPresentValue: number;
  actualReserve: number;
  actualReservePercent: number;

  // Extraction metadata
  extractedAt: Date;
  confidence: number;
  imageUrl?: string;
  corrected: boolean;
}

// ----------------------------------------------------------------------------
// Calculation Result Types
// ----------------------------------------------------------------------------

export interface PeriodCashFlow {
  period: number;
  date: Date;
  daysInPeriod: number;

  // Balances
  beginningBalance: number;
  endingBalance: number;

  // Rates applied this period
  interestRateApplied: number;
  pdRate: number;
  lgdRate: number;
  smmRate: number;

  // Cash flow components
  interestPayment: number;
  scheduledPrincipal: number;
  prepayment: number;
  defaultAmount: number;
  lossAmount: number;
  recoveryAmount: number;

  // Total cash flow and PV
  totalCashFlow: number;
  discountFactor: number;
  presentValue: number;

  // Running totals
  cumulativeDefault: number;
  cumulativeLoss: number;
  cumulativeRecovery: number;
}

export interface CalculationResult {
  id: string;
  loanId: string;
  segmentId: string;
  calculatedAt: Date;

  // Input snapshot
  loanInput: LoanInput;
  pdCurve: ForecastCurve;
  lgdCurve: ForecastCurve;

  // Cash flow schedule
  cashFlows: PeriodCashFlow[];

  // Summary metrics
  totalInterest: number;
  totalPrincipal: number;
  totalPrepayment: number;
  totalDefault: number;
  totalLoss: number;
  totalRecovery: number;

  // Final values
  netPresentValue: number;
  calculatedReserve: number;

  // Variance analysis
  actualReserve: number;
  varianceDollar: number;
  variancePercent: number;

  // Validation status
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// ----------------------------------------------------------------------------
// Segment Types
// ----------------------------------------------------------------------------

export interface Segment {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  // Forecast curves
  pdCurve: ForecastCurve | null;
  lgdCurve: ForecastCurve | null;

  // Loans in this segment
  loans: LoanInput[];
  results: CalculationResult[];

  // Status
  status: 'setup' | 'processing' | 'complete' | 'exported';
}

// ----------------------------------------------------------------------------
// Export Types
// ----------------------------------------------------------------------------

export interface ExportRow {
  loanNumber: string;
  calculationDate: string;
  bookBalance: number;
  unamortizedAmount: number;
  effectiveYield: number;
  interestRate: number;
  periods: number;
  paymentType: string;
  actualReserve: number;
  calculatedReserve: number;
  varianceDollar: number;
  variancePercent: number;
  extractionConfidence: number;
}

export interface ExportMetadata {
  segmentName: string;
  exportedAt: Date;
  totalLoans: number;
  pdCurveVersion: string;
  lgdCurveVersion: string;
  averageVariance: number;
}

// ----------------------------------------------------------------------------
// API Types
// ----------------------------------------------------------------------------

export interface ExtractionRequest {
  imageBase64: string;
  imageType: 'PD' | 'LGD' | 'Loan' | 'Auto';
}

export interface ExtractionResponse {
  success: boolean;
  type: 'PD' | 'LGD' | 'Loan';
  data: Partial<ForecastCurve> | Partial<LoanInput>;
  confidence: number;
  rawText?: string;
  errors?: string[];
}

export interface CalculationRequest {
  loan: LoanInput;
  pdCurve: ForecastCurve;
  lgdCurve: ForecastCurve;
}

export interface CalculationResponse {
  success: boolean;
  result?: CalculationResult;
  errors?: string[];
}

// ----------------------------------------------------------------------------
// UI State Types
// ----------------------------------------------------------------------------

export type AppPhase = 'segment-setup' | 'loan-processing';

export interface AppState {
  phase: AppPhase;
  currentSegment: Segment | null;
  isExtracting: boolean;
  isCalculating: boolean;
  error: string | null;
}

// ----------------------------------------------------------------------------
// Validation Types
// ----------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}
