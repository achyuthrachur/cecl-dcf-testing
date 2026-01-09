// ============================================================================
// API Route: /api/calculate
// Handles DCF calculation for loans
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  calculateDCF,
  validateLoanInput,
  validateForecastCurve,
} from '@/lib/calculation-engine';
import { LoanInput, ForecastCurve } from '@/types';

export const maxDuration = 30;

interface CalculateRequest {
  loan: LoanInput;
  pdCurve: ForecastCurve;
  lgdCurve: ForecastCurve;
}

export async function POST(request: NextRequest) {
  try {
    const body: CalculateRequest = await request.json();

    // Validate required inputs
    if (!body.loan) {
      return NextResponse.json(
        { error: 'Loan data is required' },
        { status: 400 }
      );
    }

    if (!body.pdCurve) {
      return NextResponse.json(
        { error: 'PD forecast curve is required' },
        { status: 400 }
      );
    }

    if (!body.lgdCurve) {
      return NextResponse.json(
        { error: 'LGD forecast curve is required' },
        { status: 400 }
      );
    }

    // Validate loan input
    const loanValidation = validateLoanInput(body.loan);
    if (!loanValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: loanValidation.errors,
          warnings: loanValidation.warnings,
        },
        { status: 422 }
      );
    }

    // Validate PD curve
    const pdValidation = validateForecastCurve(body.pdCurve);
    if (!pdValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: pdValidation.errors.map((e) => `PD: ${e}`),
          warnings: pdValidation.warnings.map((w) => `PD: ${w}`),
        },
        { status: 422 }
      );
    }

    // Validate LGD curve
    const lgdValidation = validateForecastCurve(body.lgdCurve);
    if (!lgdValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: lgdValidation.errors.map((e) => `LGD: ${e}`),
          warnings: lgdValidation.warnings.map((w) => `LGD: ${w}`),
        },
        { status: 422 }
      );
    }

    // Ensure dates are proper Date objects
    const loan: LoanInput = {
      ...body.loan,
      calculationDate: new Date(body.loan.calculationDate),
      maturityDate: new Date(body.loan.maturityDate),
      extractedAt: new Date(body.loan.extractedAt),
    };

    const pdCurve: ForecastCurve = {
      ...body.pdCurve,
      extractedAt: new Date(body.pdCurve.extractedAt),
      periods: body.pdCurve.periods.map((p) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      })),
    };

    const lgdCurve: ForecastCurve = {
      ...body.lgdCurve,
      extractedAt: new Date(body.lgdCurve.extractedAt),
      periods: body.lgdCurve.periods.map((p) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      })),
    };

    // Run calculation
    const result = calculateDCF(loan, pdCurve, lgdCurve);

    // Combine all warnings
    const allWarnings = [
      ...loanValidation.warnings,
      ...pdValidation.warnings,
      ...lgdValidation.warnings,
      ...result.warnings,
    ];

    return NextResponse.json({
      success: true,
      result: {
        ...result,
        warnings: allWarnings,
      },
    });
  } catch (error) {
    console.error('Calculation API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Batch calculation endpoint
// ============================================================================

interface BatchCalculateRequest {
  loans: LoanInput[];
  pdCurve: ForecastCurve;
  lgdCurve: ForecastCurve;
}

export async function PUT(request: NextRequest) {
  try {
    const body: BatchCalculateRequest = await request.json();

    if (!body.loans || body.loans.length === 0) {
      return NextResponse.json(
        { error: 'At least one loan is required' },
        { status: 400 }
      );
    }

    if (!body.pdCurve || !body.lgdCurve) {
      return NextResponse.json(
        { error: 'PD and LGD forecast curves are required' },
        { status: 400 }
      );
    }

    // Process dates for curves
    const pdCurve: ForecastCurve = {
      ...body.pdCurve,
      extractedAt: new Date(body.pdCurve.extractedAt),
      periods: body.pdCurve.periods.map((p) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      })),
    };

    const lgdCurve: ForecastCurve = {
      ...body.lgdCurve,
      extractedAt: new Date(body.lgdCurve.extractedAt),
      periods: body.lgdCurve.periods.map((p) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      })),
    };

    // Calculate for each loan
    const results = body.loans.map((loanInput) => {
      const loan: LoanInput = {
        ...loanInput,
        calculationDate: new Date(loanInput.calculationDate),
        maturityDate: new Date(loanInput.maturityDate),
        extractedAt: new Date(loanInput.extractedAt),
      };

      return calculateDCF(loan, pdCurve, lgdCurve);
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Batch calculation API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
