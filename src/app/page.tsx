'use client';

import { useAppStore } from '@/lib/store';
import { SegmentSetup } from '@/components/SegmentSetup';
import { LoanProcessing } from '@/components/LoanProcessing';

export default function Home() {
  const phase = useAppStore((state) => state.phase);
  const currentSegment = useAppStore((state) => state.currentSegment);

  // If in loan processing phase and segment exists with forecasts, show loan processing
  if (
    phase === 'loan-processing' &&
    currentSegment?.pdCurve &&
    currentSegment?.lgdCurve
  ) {
    return <LoanProcessing />;
  }

  // Otherwise show segment setup
  return <SegmentSetup />;
}
