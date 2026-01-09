// ============================================================================
// API Route: /api/export
// Handles Excel and CSV export generation
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateExcelReport, generateCSVExport } from '@/lib/excel-export';
import { Segment, CalculationResult } from '@/types';
import { format } from 'date-fns';

export const maxDuration = 60;

interface ExportRequest {
  segment: Segment;
  results: CalculationResult[];
  format: 'xlsx' | 'csv';
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();

    if (!body.segment) {
      return NextResponse.json(
        { error: 'Segment data is required' },
        { status: 400 }
      );
    }

    if (!body.results || body.results.length === 0) {
      return NextResponse.json(
        { error: 'At least one calculation result is required' },
        { status: 400 }
      );
    }

    const exportFormat = body.format || 'xlsx';
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const segmentName = body.segment.name.replace(/[^a-zA-Z0-9]/g, '_');

    // Process dates in segment and results
    const segment: Segment = {
      ...body.segment,
      createdAt: new Date(body.segment.createdAt),
      updatedAt: new Date(body.segment.updatedAt),
      pdCurve: body.segment.pdCurve
        ? {
            ...body.segment.pdCurve,
            extractedAt: new Date(body.segment.pdCurve.extractedAt),
            periods: body.segment.pdCurve.periods.map((p) => ({
              ...p,
              startDate: new Date(p.startDate),
              endDate: new Date(p.endDate),
            })),
          }
        : null,
      lgdCurve: body.segment.lgdCurve
        ? {
            ...body.segment.lgdCurve,
            extractedAt: new Date(body.segment.lgdCurve.extractedAt),
            periods: body.segment.lgdCurve.periods.map((p) => ({
              ...p,
              startDate: new Date(p.startDate),
              endDate: new Date(p.endDate),
            })),
          }
        : null,
    };

    const results: CalculationResult[] = body.results.map((r) => ({
      ...r,
      calculatedAt: new Date(r.calculatedAt),
      loanInput: {
        ...r.loanInput,
        calculationDate: new Date(r.loanInput.calculationDate),
        maturityDate: new Date(r.loanInput.maturityDate),
        extractedAt: new Date(r.loanInput.extractedAt),
      },
      pdCurve: {
        ...r.pdCurve,
        extractedAt: new Date(r.pdCurve.extractedAt),
        periods: r.pdCurve.periods.map((p) => ({
          ...p,
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
        })),
      },
      lgdCurve: {
        ...r.lgdCurve,
        extractedAt: new Date(r.lgdCurve.extractedAt),
        periods: r.lgdCurve.periods.map((p) => ({
          ...p,
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
        })),
      },
      cashFlows: r.cashFlows.map((cf) => ({
        ...cf,
        date: new Date(cf.date),
      })),
    }));

    if (exportFormat === 'csv') {
      // Generate CSV
      const csvContent = generateCSVExport(results);
      const filename = `CECL_DCF_${segmentName}_${timestamp}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Generate Excel
    const excelBuffer = await generateExcelReport(segment, results);
    const filename = `CECL_DCF_${segmentName}_${timestamp}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
