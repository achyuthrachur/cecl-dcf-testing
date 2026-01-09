// ============================================================================
// AI Extraction Pipeline using OpenAI Vision
// ============================================================================

import OpenAI from 'openai';
import {
  ForecastCurve,
  ForecastPeriod,
  LoanInput,
  PaymentType,
  PaymentFrequency,
  AmortizationDays,
} from '@/types';

// ----------------------------------------------------------------------------
// OpenAI Client
// ----------------------------------------------------------------------------

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

// ----------------------------------------------------------------------------
// Image Classification
// ----------------------------------------------------------------------------

export type ImageType = 'PD' | 'LGD' | 'Loan' | 'Unknown';

const CLASSIFICATION_PROMPT = `Analyze this image and classify it as one of the following types:
1. "PD" - A Probability of Default (PD) forecast table showing quarterly or annual PD rates by time period
2. "LGD" - A Loss Given Default (LGD) forecast table showing quarterly or annual LGD rates by time period
3. "Loan" - A loan summary or loan detail screen showing loan information like loan number, balance, interest rate, payment terms, etc.
4. "Unknown" - Cannot determine the type

Look for these indicators:
- PD forecasts typically have headers like "PD Forecasts", "Probability of Default", "Monthly PD", "Quarterly PD"
- LGD forecasts typically have headers like "LGD Forecasts", "Loss Given Default", "Loss Rate"
- Loan summaries have fields like "Loan Number", "Book Balance", "Interest Rate", "Maturity Date", "Payment Amount"

Respond with ONLY one word: PD, LGD, Loan, or Unknown`;

export async function classifyImage(imageBase64: string): Promise<ImageType> {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CLASSIFICATION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 10,
    });

    const result = response.choices[0]?.message?.content?.trim().toUpperCase();
    if (result === 'PD' || result === 'LGD' || result === 'LOAN') {
      return result === 'LOAN' ? 'Loan' : result as ImageType;
    }
    return 'Unknown';
  } catch (error) {
    console.error('Classification error:', error);
    return 'Unknown';
  }
}

// ----------------------------------------------------------------------------
// Forecast Extraction
// ----------------------------------------------------------------------------

const FORECAST_EXTRACTION_PROMPT = `Extract the forecast data from this image. This is a {type} forecast table.

Extract ALL rows from the table. For each row, extract:
1. The time period (start date and end date) - convert to ISO date format (YYYY-MM-DD)
2. The rate value - convert percentages to decimal format (e.g., 1.5% becomes 0.015)

Important:
- Quarterly periods should be extracted as date ranges (e.g., Q1 2024 = 2024-01-01 to 2024-03-31)
- Annual periods should be extracted as full year ranges
- Monthly periods should be extracted as month start and end dates
- Convert ALL percentage values to decimals
- Include a confidence score (0-1) for each row based on OCR clarity

Respond in this exact JSON format:
{
  "type": "{type}",
  "periods": [
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "rateDecimal": 0.0000,
      "confidence": 0.95
    }
  ],
  "rawText": "any text that couldn't be parsed",
  "overallConfidence": 0.90
}`;

interface ForecastExtractionResult {
  type: 'PD' | 'LGD';
  periods: Array<{
    startDate: string;
    endDate: string;
    rateDecimal: number;
    confidence: number;
  }>;
  rawText?: string;
  overallConfidence: number;
}

export async function extractForecast(
  imageBase64: string,
  type: 'PD' | 'LGD'
): Promise<{
  success: boolean;
  curve?: ForecastCurve;
  confidence: number;
  rawText?: string;
  errors?: string[];
}> {
  const client = getOpenAIClient();

  try {
    const prompt = FORECAST_EXTRACTION_PROMPT.replace(/{type}/g, type);

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        confidence: 0,
        errors: ['No response from AI model'],
      };
    }

    const parsed: ForecastExtractionResult = JSON.parse(content);

    // Convert to ForecastCurve
    const periods: ForecastPeriod[] = parsed.periods.map((p) => ({
      startDate: new Date(p.startDate),
      endDate: new Date(p.endDate),
      rateDecimal: p.rateDecimal,
      confidence: p.confidence,
    }));

    const curve: ForecastCurve = {
      id: `forecast-${type}-${Date.now()}`,
      type,
      periods,
      extractedAt: new Date(),
      rawText: parsed.rawText,
    };

    return {
      success: true,
      curve,
      confidence: parsed.overallConfidence,
      rawText: parsed.rawText,
    };
  } catch (error) {
    console.error('Forecast extraction error:', error);
    return {
      success: false,
      confidence: 0,
      errors: [error instanceof Error ? error.message : 'Unknown extraction error'],
    };
  }
}

// ----------------------------------------------------------------------------
// Loan Extraction
// ----------------------------------------------------------------------------

const LOAN_EXTRACTION_PROMPT = `Extract the loan information from this image. This is a loan summary or loan detail screen.

Extract all available fields. For each field, convert to the appropriate format:
- Loan Number: string
- Book Balance: number (remove $ and commas)
- Unamortized Amount: number (remove $ and commas)
- Calculation Date: ISO date format (YYYY-MM-DD)
- Interest Rate: decimal (convert 5.25% to 0.0525)
- Effective Yield: decimal (convert percentages to decimal)
- Amortization Days: one of "Actual 360", "30/360", "Actual 365"
- Payment Type: one of "Fixed Payment", "Fixed Principal", "Interest Only", "Line of Credit"
- Payment Amount: number
- Payment Frequency: one of "Monthly", "Quarterly", "Semi-Annual", "Annual"
- Maturity Date: ISO date format
- Periods: number (number of remaining periods)
- CPR: decimal (Conditional Prepayment Rate, convert percentage to decimal)
- Curtailment Rate: decimal
- SMM: decimal (Single Monthly Mortality)
- Recovery Delay: number (months)
- Present Value: number (actual present value from system)
- Reserve $: number (actual reserve amount from system)
- Reserve %: decimal (actual reserve percentage)

Also look for these alternative field names:
- "Amortized Cost Basis" may relate to Book Balance
- "Rate" or "Note Rate" may be Interest Rate
- "Discount Rate" or "Yield" may be Effective Yield
- "Term" or "Remaining Term" may relate to Periods

Respond in this exact JSON format:
{
  "loanNumber": "string or null",
  "bookBalance": number or null,
  "unamortizedAmount": number or null,
  "calculationDate": "YYYY-MM-DD or null",
  "interestRate": decimal or null,
  "effectiveYield": decimal or null,
  "amortizationDays": "string or null",
  "paymentType": "string or null",
  "paymentAmount": number or null,
  "paymentFrequency": "string or null",
  "maturityDate": "YYYY-MM-DD or null",
  "periods": number or null,
  "cpr": decimal or null,
  "curtailmentRate": decimal or null,
  "smm": decimal or null,
  "recoveryDelay": number or null,
  "actualPresentValue": number or null,
  "actualReserve": number or null,
  "actualReservePercent": decimal or null,
  "fieldConfidence": {
    "fieldName": 0.95
  },
  "overallConfidence": 0.90,
  "rawText": "any text that couldn't be parsed"
}`;

interface LoanExtractionResult {
  loanNumber: string | null;
  bookBalance: number | null;
  unamortizedAmount: number | null;
  calculationDate: string | null;
  interestRate: number | null;
  effectiveYield: number | null;
  amortizationDays: string | null;
  paymentType: string | null;
  paymentAmount: number | null;
  paymentFrequency: string | null;
  maturityDate: string | null;
  periods: number | null;
  cpr: number | null;
  curtailmentRate: number | null;
  smm: number | null;
  recoveryDelay: number | null;
  actualPresentValue: number | null;
  actualReserve: number | null;
  actualReservePercent: number | null;
  fieldConfidence: Record<string, number>;
  overallConfidence: number;
  rawText?: string;
}

export async function extractLoan(
  imageBase64: string,
  segmentId: string
): Promise<{
  success: boolean;
  loan?: Partial<LoanInput>;
  confidence: number;
  fieldConfidence: Record<string, number>;
  rawText?: string;
  errors?: string[];
}> {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: LOAN_EXTRACTION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        confidence: 0,
        fieldConfidence: {},
        errors: ['No response from AI model'],
      };
    }

    const parsed: LoanExtractionResult = JSON.parse(content);

    // Map payment type
    const paymentTypeMap: Record<string, PaymentType> = {
      'fixed payment': 'Fixed Payment',
      'fixed principal': 'Fixed Principal',
      'interest only': 'Interest Only',
      'line of credit': 'Line of Credit',
      'io': 'Interest Only',
      'loc': 'Line of Credit',
    };

    // Map payment frequency
    const paymentFreqMap: Record<string, PaymentFrequency> = {
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'semi-annual': 'Semi-Annual',
      'semiannual': 'Semi-Annual',
      'annual': 'Annual',
      'yearly': 'Annual',
    };

    // Map amortization days
    const amortDaysMap: Record<string, AmortizationDays> = {
      'actual 360': 'Actual 360',
      'actual/360': 'Actual 360',
      'act/360': 'Actual 360',
      '30/360': '30/360',
      'actual 365': 'Actual 365',
      'actual/365': 'Actual 365',
      'act/365': 'Actual 365',
    };

    const loan: Partial<LoanInput> = {
      id: `loan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      segmentId,
      loanNumber: parsed.loanNumber || undefined,
      bookBalance: parsed.bookBalance || undefined,
      unamortizedAmount: parsed.unamortizedAmount || 0,
      calculationDate: parsed.calculationDate
        ? new Date(parsed.calculationDate)
        : undefined,
      interestRate: parsed.interestRate || undefined,
      effectiveYield: parsed.effectiveYield || undefined,
      amortizationDays: parsed.amortizationDays
        ? amortDaysMap[parsed.amortizationDays.toLowerCase()] || 'Actual 360'
        : 'Actual 360',
      paymentType: parsed.paymentType
        ? paymentTypeMap[parsed.paymentType.toLowerCase()] || 'Fixed Payment'
        : 'Fixed Payment',
      paymentAmount: parsed.paymentAmount || 0,
      paymentFrequency: parsed.paymentFrequency
        ? paymentFreqMap[parsed.paymentFrequency.toLowerCase()] || 'Monthly'
        : 'Monthly',
      maturityDate: parsed.maturityDate
        ? new Date(parsed.maturityDate)
        : undefined,
      periods: parsed.periods || undefined,
      cpr: parsed.cpr || 0,
      curtailmentRate: parsed.curtailmentRate || 0,
      smm: parsed.smm || 0,
      recoveryDelay: parsed.recoveryDelay || 12,
      actualPresentValue: parsed.actualPresentValue || 0,
      actualReserve: parsed.actualReserve || 0,
      actualReservePercent: parsed.actualReservePercent || 0,
      extractedAt: new Date(),
      confidence: parsed.overallConfidence,
      corrected: false,
    };

    return {
      success: true,
      loan,
      confidence: parsed.overallConfidence,
      fieldConfidence: parsed.fieldConfidence || {},
      rawText: parsed.rawText,
    };
  } catch (error) {
    console.error('Loan extraction error:', error);
    return {
      success: false,
      confidence: 0,
      fieldConfidence: {},
      errors: [error instanceof Error ? error.message : 'Unknown extraction error'],
    };
  }
}

// ----------------------------------------------------------------------------
// Main Extraction Entry Point
// ----------------------------------------------------------------------------

export interface ExtractionResult {
  success: boolean;
  type: ImageType;
  data?: ForecastCurve | Partial<LoanInput>;
  confidence: number;
  fieldConfidence?: Record<string, number>;
  rawText?: string;
  errors?: string[];
}

export async function extractFromImage(
  imageBase64: string,
  forcedType?: ImageType,
  segmentId?: string
): Promise<ExtractionResult> {
  // Classify image if type not forced
  const imageType = forcedType || (await classifyImage(imageBase64));

  if (imageType === 'Unknown') {
    return {
      success: false,
      type: 'Unknown',
      confidence: 0,
      errors: ['Could not determine image type. Please specify the type manually.'],
    };
  }

  // Extract based on type
  if (imageType === 'PD' || imageType === 'LGD') {
    const result = await extractForecast(imageBase64, imageType);
    return {
      success: result.success,
      type: imageType,
      data: result.curve,
      confidence: result.confidence,
      rawText: result.rawText,
      errors: result.errors,
    };
  }

  if (imageType === 'Loan') {
    const result = await extractLoan(imageBase64, segmentId || 'default');
    return {
      success: result.success,
      type: imageType,
      data: result.loan,
      confidence: result.confidence,
      fieldConfidence: result.fieldConfidence,
      rawText: result.rawText,
      errors: result.errors,
    };
  }

  return {
    success: false,
    type: 'Unknown',
    confidence: 0,
    errors: ['Unexpected image type'],
  };
}

// ----------------------------------------------------------------------------
// Confidence Utilities
// ----------------------------------------------------------------------------

export function isLowConfidence(confidence: number): boolean {
  return confidence < 0.8;
}

export function getFieldsRequiringReview(
  fieldConfidence: Record<string, number>
): string[] {
  return Object.entries(fieldConfidence)
    .filter(([_, conf]) => conf < 0.8)
    .map(([field, _]) => field);
}
