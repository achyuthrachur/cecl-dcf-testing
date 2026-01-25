'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { SegmentSetup } from '@/components/SegmentSetup';
import { LoanProcessing } from '@/components/LoanProcessing';
import { StartupDialog } from '@/components/StartupDialog';
import { WelcomePage } from '@/components/WelcomePage';
import { Header } from '@/components/Header';

const WELCOME_SEEN_KEY = 'cecl-dcf-welcome-seen';

export default function Home() {
  const phase = useAppStore((state) => state.phase);
  const currentSegment = useAppStore((state) => state.currentSegment);
  const resetSegment = useAppStore((state) => state.resetSegment);

  // Track if user has seen welcome page
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);

  // Track if user has made their startup choice
  const [showStartupDialog, setShowStartupDialog] = useState(false);
  const [startupChoiceMade, setStartupChoiceMade] = useState(false);

  // Check for welcome page on mount
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(WELCOME_SEEN_KEY);
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
    setWelcomeChecked(true);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    // Only check after welcome is handled
    if (!welcomeChecked || showWelcome) return;

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
  }, [currentSegment, startupChoiceMade, welcomeChecked, showWelcome]);

  const handleGetStarted = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    setShowWelcome(false);
  };

  const handleShowWelcome = () => {
    setShowWelcome(true);
  };

  const handleContinue = () => {
    setShowStartupDialog(false);
    setStartupChoiceMade(true);
  };

  const handleStartFresh = () => {
    resetSegment();
    setShowStartupDialog(false);
    setStartupChoiceMade(true);
  };

  // Don't render until we've checked localStorage
  if (!welcomeChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />
    );
  }

  // Show welcome page for new users
  if (showWelcome) {
    return <WelcomePage onGetStarted={handleGetStarted} />;
  }

  // Show startup dialog if needed
  if (showStartupDialog && currentSegment) {
    return (
      <>
        <Header showHomeButton onShowWelcome={handleShowWelcome} />
        <StartupDialog
          open={true}
          segment={currentSegment}
          onContinue={handleContinue}
          onStartFresh={handleStartFresh}
        />
      </>
    );
  }

  // If in loan processing phase and segment exists with forecasts, show loan processing
  if (
    phase === 'loan-processing' &&
    currentSegment?.pdCurve &&
    currentSegment?.lgdCurve
  ) {
    return (
      <>
        <Header showHomeButton onShowWelcome={handleShowWelcome} />
        <div className="pt-14">
          <LoanProcessing />
        </div>
      </>
    );
  }

  // Otherwise show segment setup
  return (
    <>
      <Header showHomeButton onShowWelcome={handleShowWelcome} />
      <div className="pt-14">
        <SegmentSetup />
      </div>
    </>
  );
}
