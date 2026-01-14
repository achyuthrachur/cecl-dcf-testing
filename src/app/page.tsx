'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { SegmentSetup } from '@/components/SegmentSetup';
import { LoanProcessing } from '@/components/LoanProcessing';
import { StartupDialog } from '@/components/StartupDialog';

export default function Home() {
  const phase = useAppStore((state) => state.phase);
  const currentSegment = useAppStore((state) => state.currentSegment);
  const resetSegment = useAppStore((state) => state.resetSegment);

  // Track if user has made their startup choice
  const [showStartupDialog, setShowStartupDialog] = useState(false);
  const [startupChoiceMade, setStartupChoiceMade] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    // Only show dialog if there's existing data and no choice has been made yet
    if (currentSegment && !startupChoiceMade) {
      // Check if there's meaningful data to preserve
      const hasData =
        currentSegment.pdCurve ||
        currentSegment.lgdCurve ||
        currentSegment.loans.length > 0 ||
        currentSegment.results.length > 0;

      if (hasData) {
        setShowStartupDialog(true);
      } else {
        // No meaningful data, skip the dialog
        setStartupChoiceMade(true);
      }
    }
  }, [currentSegment, startupChoiceMade]);

  const handleContinue = () => {
    setShowStartupDialog(false);
    setStartupChoiceMade(true);
  };

  const handleStartFresh = () => {
    resetSegment();
    setShowStartupDialog(false);
    setStartupChoiceMade(true);
  };

  // Show startup dialog if needed
  if (showStartupDialog && currentSegment) {
    return (
      <StartupDialog
        open={true}
        segment={currentSegment}
        onContinue={handleContinue}
        onStartFresh={handleStartFresh}
      />
    );
  }

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
