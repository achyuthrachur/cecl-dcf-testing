// ============================================================================
// Zustand State Management Store
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  AppPhase,
  Segment,
  ForecastCurve,
  LoanInput,
  CalculationResult,
} from '@/types';

// ----------------------------------------------------------------------------
// Store Interface
// ----------------------------------------------------------------------------

interface AppStore {
  // Current phase
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;

  // Current segment
  currentSegment: Segment | null;
  createSegment: (name: string) => void;
  updateSegmentName: (name: string) => void;
  resetSegment: () => void;

  // Forecast curves
  setPDCurve: (curve: ForecastCurve) => void;
  setLGDCurve: (curve: ForecastCurve) => void;
  updatePDCurvePeriod: (index: number, updates: Partial<ForecastCurve['periods'][0]>) => void;
  updateLGDCurvePeriod: (index: number, updates: Partial<ForecastCurve['periods'][0]>) => void;

  // Loans
  addLoan: (loan: LoanInput) => void;
  updateLoan: (loanId: string, updates: Partial<LoanInput>) => void;
  removeLoan: (loanId: string) => void;
  clearLoans: () => void;

  // Calculation results
  addResult: (result: CalculationResult) => void;
  updateResult: (resultId: string, updates: Partial<CalculationResult>) => void;
  removeResult: (loanId: string) => void;
  clearResults: () => void;

  // UI state
  isExtracting: boolean;
  setIsExtracting: (value: boolean) => void;
  isCalculating: boolean;
  setIsCalculating: (value: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Export and reset
  markExported: () => void;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createNewSegment(name: string): Segment {
  return {
    id: `segment-${generateId()}`,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    pdCurve: null,
    lgdCurve: null,
    loans: [],
    results: [],
    status: 'setup',
  };
}

// ----------------------------------------------------------------------------
// Store Implementation
// ----------------------------------------------------------------------------

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Phase
      phase: 'segment-setup',
      setPhase: (phase) => set({ phase }),

      // Segment
      currentSegment: null,
      createSegment: (name) =>
        set({
          currentSegment: createNewSegment(name),
          phase: 'segment-setup',
        }),
      updateSegmentName: (name) =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? { ...state.currentSegment, name, updatedAt: new Date() }
            : null,
        })),
      resetSegment: () =>
        set({
          currentSegment: null,
          phase: 'segment-setup',
          error: null,
        }),

      // PD Curve
      setPDCurve: (curve) =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? {
                ...state.currentSegment,
                pdCurve: curve,
                updatedAt: new Date(),
              }
            : null,
        })),
      updatePDCurvePeriod: (index, updates) =>
        set((state) => {
          if (!state.currentSegment?.pdCurve) return state;
          const newPeriods = [...state.currentSegment.pdCurve.periods];
          newPeriods[index] = { ...newPeriods[index], ...updates };
          return {
            currentSegment: {
              ...state.currentSegment,
              pdCurve: {
                ...state.currentSegment.pdCurve,
                periods: newPeriods,
              },
              updatedAt: new Date(),
            },
          };
        }),

      // LGD Curve
      setLGDCurve: (curve) =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? {
                ...state.currentSegment,
                lgdCurve: curve,
                updatedAt: new Date(),
              }
            : null,
        })),
      updateLGDCurvePeriod: (index, updates) =>
        set((state) => {
          if (!state.currentSegment?.lgdCurve) return state;
          const newPeriods = [...state.currentSegment.lgdCurve.periods];
          newPeriods[index] = { ...newPeriods[index], ...updates };
          return {
            currentSegment: {
              ...state.currentSegment,
              lgdCurve: {
                ...state.currentSegment.lgdCurve,
                periods: newPeriods,
              },
              updatedAt: new Date(),
            },
          };
        }),

      // Loans
      addLoan: (loan) =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? {
                ...state.currentSegment,
                loans: [...state.currentSegment.loans, loan],
                updatedAt: new Date(),
              }
            : null,
        })),
      updateLoan: (loanId, updates) =>
        set((state) => {
          if (!state.currentSegment) return state;
          const newLoans = state.currentSegment.loans.map((l) =>
            l.id === loanId ? { ...l, ...updates } : l
          );
          return {
            currentSegment: {
              ...state.currentSegment,
              loans: newLoans,
              updatedAt: new Date(),
            },
          };
        }),
      removeLoan: (loanId) =>
        set((state) => {
          if (!state.currentSegment) return state;
          return {
            currentSegment: {
              ...state.currentSegment,
              loans: state.currentSegment.loans.filter((l) => l.id !== loanId),
              results: state.currentSegment.results.filter(
                (r) => r.loanId !== loanId
              ),
              updatedAt: new Date(),
            },
          };
        }),
      clearLoans: () =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? {
                ...state.currentSegment,
                loans: [],
                results: [],
                updatedAt: new Date(),
              }
            : null,
        })),

      // Results
      addResult: (result) =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? {
                ...state.currentSegment,
                results: [...state.currentSegment.results, result],
                updatedAt: new Date(),
              }
            : null,
        })),
      updateResult: (resultId, updates) =>
        set((state) => {
          if (!state.currentSegment) return state;
          const newResults = state.currentSegment.results.map((r) =>
            r.id === resultId ? { ...r, ...updates } : r
          );
          return {
            currentSegment: {
              ...state.currentSegment,
              results: newResults,
              updatedAt: new Date(),
            },
          };
        }),
      removeResult: (loanId) =>
        set((state) => {
          if (!state.currentSegment) return state;
          return {
            currentSegment: {
              ...state.currentSegment,
              results: state.currentSegment.results.filter(
                (r) => r.loanId !== loanId
              ),
              updatedAt: new Date(),
            },
          };
        }),
      clearResults: () =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? {
                ...state.currentSegment,
                results: [],
                updatedAt: new Date(),
              }
            : null,
        })),

      // UI State
      isExtracting: false,
      setIsExtracting: (value) => set({ isExtracting: value }),
      isCalculating: false,
      setIsCalculating: (value) => set({ isCalculating: value }),
      error: null,
      setError: (error) => set({ error }),

      // Export
      markExported: () =>
        set((state) => ({
          currentSegment: state.currentSegment
            ? {
                ...state.currentSegment,
                status: 'exported',
                updatedAt: new Date(),
              }
            : null,
        })),
    }),
    {
      name: 'cecl-dcf-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentSegment: state.currentSegment,
        phase: state.phase,
      }),
    }
  )
);

// ----------------------------------------------------------------------------
// Selectors
// ----------------------------------------------------------------------------

export const selectCanProceedToLoanProcessing = (state: AppStore): boolean => {
  const segment = state.currentSegment;
  return !!(
    segment &&
    segment.name &&
    segment.pdCurve &&
    segment.pdCurve.periods.length > 0 &&
    segment.lgdCurve &&
    segment.lgdCurve.periods.length > 0
  );
};

export const selectLoanCount = (state: AppStore): number => {
  return state.currentSegment?.loans.length || 0;
};

export const selectResultCount = (state: AppStore): number => {
  return state.currentSegment?.results.length || 0;
};

export const selectTotalVariance = (state: AppStore): number => {
  if (!state.currentSegment) return 0;
  return state.currentSegment.results.reduce(
    (sum, r) => sum + r.varianceDollar,
    0
  );
};

export const selectAverageConfidence = (state: AppStore): number => {
  if (!state.currentSegment || state.currentSegment.loans.length === 0) return 0;
  const total = state.currentSegment.loans.reduce(
    (sum, l) => sum + l.confidence,
    0
  );
  return total / state.currentSegment.loans.length;
};
