// ============================================================================
// API Route: /api/extract
// Handles AI-powered image extraction for PD, LGD, and Loan screenshots
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  extractFromImage,
  classifyImage,
  type ImageType,
} from '@/lib/extraction-pipeline';

export const maxDuration = 60; // Maximum 60 seconds for extraction

interface ExtractRequest {
  imageBase64: string;
  forcedType?: ImageType;
  segmentId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: ExtractRequest = await request.json();

    if (!body.imageBase64) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Validate base64 string
    if (body.imageBase64.length < 100) {
      return NextResponse.json(
        { error: 'Invalid image data' },
        { status: 400 }
      );
    }

    // Extract data from image
    const result = await extractFromImage(
      body.imageBase64,
      body.forcedType,
      body.segmentId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          errors: result.errors || ['Extraction failed'],
          type: result.type,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      type: result.type,
      data: result.data,
      confidence: result.confidence,
      fieldConfidence: result.fieldConfidence,
      rawText: result.rawText,
    });
  } catch (error) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// API Route: /api/extract/classify
// Classifies an image without full extraction
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.imageBase64) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    const imageType = await classifyImage(body.imageBase64);

    return NextResponse.json({
      success: true,
      type: imageType,
    });
  } catch (error) {
    console.error('Classification API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
