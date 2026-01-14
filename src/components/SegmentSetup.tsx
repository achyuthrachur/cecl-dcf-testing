'use client';

import { useState, useCallback } from 'react';
import { useAppStore, selectCanProceedToLoanProcessing } from '@/lib/store';
import { fileToBase64, formatDate, formatPercent, getConfidenceColor } from '@/lib/utils';
import { ForecastCurve, ForecastPeriod } from '@/types';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Dropzone,
  Badge,
  DataTable,
} from '@/components/ui';
import {
  ArrowRight,
  ChevronRight,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  Edit2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export function SegmentSetup() {
  const {
    currentSegment,
    createSegment,
    updateSegmentName,
    setPDCurve,
    setLGDCurve,
    updatePDCurvePeriod,
    updateLGDCurvePeriod,
    setPhase,
    isExtracting,
    setIsExtracting,
    error,
    setError,
  } = useAppStore();

  const canProceed = useAppStore(selectCanProceedToLoanProcessing);

  const [segmentName, setSegmentName] = useState(currentSegment?.name || '');
  const [editingPD, setEditingPD] = useState<number | null>(null);
  const [editingLGD, setEditingLGD] = useState<number | null>(null);
  const [pdEditValues, setPDEditValues] = useState<Partial<ForecastPeriod>>({});
  const [lgdEditValues, setLGDEditValues] = useState<Partial<ForecastPeriod>>({});

  const handleCreateSegment = useCallback(() => {
    if (segmentName.trim()) {
      createSegment(segmentName.trim());
    }
  }, [segmentName, createSegment]);

  const handleNameUpdate = useCallback(() => {
    if (segmentName.trim() && currentSegment) {
      updateSegmentName(segmentName.trim());
    }
  }, [segmentName, currentSegment, updateSegmentName]);

  const handleExtract = useCallback(
    async (file: File, type: 'PD' | 'LGD') => {
      setIsExtracting(true);
      setError(null);

      try {
        const base64 = await fileToBase64(file);

        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            forcedType: type,
            segmentId: currentSegment?.id,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.errors?.join(', ') || data.error || 'Extraction failed');
          return;
        }

        const curve: ForecastCurve = {
          ...data.data,
          extractedAt: new Date(),
          periods: data.data.periods.map((p: ForecastPeriod) => ({
            ...p,
            startDate: new Date(p.startDate),
            endDate: new Date(p.endDate),
          })),
        };

        if (type === 'PD') {
          setPDCurve(curve);
        } else {
          setLGDCurve(curve);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsExtracting(false);
      }
    },
    [currentSegment, setIsExtracting, setError, setPDCurve, setLGDCurve]
  );

  const handleProceed = useCallback(() => {
    if (canProceed) {
      setPhase('loan-processing');
    }
  }, [canProceed, setPhase]);

  const renderForecastTable = (
    curve: ForecastCurve | null,
    type: 'PD' | 'LGD',
    editing: number | null,
    setEditing: (idx: number | null) => void,
    editValues: Partial<ForecastPeriod>,
    setEditValues: (v: Partial<ForecastPeriod>) => void,
    updatePeriod: (idx: number, updates: Partial<ForecastPeriod>) => void
  ) => {
    if (!curve || !curve.periods?.length) {
      return (
        <div className="text-center py-8 text-slate-500">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No {type} forecast data</p>
          <p className="text-sm">Upload an image to extract forecast data</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {type === 'PD' ? (
              <TrendingDown className="w-4 h-4 text-danger-500" />
            ) : (
              <TrendingUp className="w-4 h-4 text-warning-500" />
            )}
            <span className="text-sm font-medium text-slate-700">
              {curve.periods.length} periods extracted
            </span>
          </div>
          <Badge
            variant={
              ((curve as ForecastCurve & { confidence?: number }).confidence ??
                0.9) >= 0.8
                ? 'success'
                : 'warning'
            }
            size="sm"
          >
            {formatPercent(
              (curve as ForecastCurve & { confidence?: number }).confidence ||
                0.9,
              0
            )}{' '}
            confidence
          </Badge>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                  Start Date
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                  End Date
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                  Rate
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                  Conf.
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-16">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {curve.periods.map((period, idx) => (
                <tr
                  key={idx}
                  className={
                    period.confidence < 0.8 ? 'bg-warning-50' : undefined
                  }
                >
                  {editing === idx ? (
                    <>
                      <td className="px-3 py-1.5">
                        <input
                          type="date"
                          className="w-full text-xs px-2 py-1 border rounded"
                          value={
                            editValues.startDate
                              ? new Date(editValues.startDate)
                                  .toISOString()
                                  .split('T')[0]
                              : new Date(period.startDate)
                                  .toISOString()
                                  .split('T')[0]
                          }
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              startDate: new Date(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="date"
                          className="w-full text-xs px-2 py-1 border rounded"
                          value={
                            editValues.endDate
                              ? new Date(editValues.endDate)
                                  .toISOString()
                                  .split('T')[0]
                              : new Date(period.endDate)
                                  .toISOString()
                                  .split('T')[0]
                          }
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              endDate: new Date(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          step="0.0001"
                          className="w-full text-xs px-2 py-1 border rounded text-right"
                          value={
                            (editValues.rateDecimal ?? period.rateDecimal) * 100
                          }
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              rateDecimal: parseFloat(e.target.value) / 100,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">-</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              updatePeriod(idx, {
                                ...editValues,
                                confidence: 1,
                              });
                              setEditing(null);
                              setEditValues({});
                            }}
                            className="p-1 text-accent-600 hover:bg-accent-50 rounded"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(null);
                              setEditValues({});
                            }}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-1.5 text-xs text-slate-900">
                        {formatDate(period.startDate)}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-900">
                        {formatDate(period.endDate)}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-900 text-right font-mono">
                        {formatPercent(period.rateDecimal, 4)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {period.confidence < 0.8 ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-warning-500 mx-auto" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-accent-500 mx-auto" />
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => {
                            setEditing(idx);
                            setEditValues({
                              startDate: period.startDate,
                              endDate: period.endDate,
                              rateDecimal: period.rateDecimal,
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded mx-auto block"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // If no segment exists yet, show creation form
  if (!currentSegment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 flex items-center justify-center p-4">
        <Card variant="elevated" className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8 text-primary-600" />
            </div>
            <CardTitle className="text-2xl">CECL DCF Testing</CardTitle>
            <CardDescription>
              Create a new segment to begin analyzing loans
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Segment Name"
              placeholder="e.g., Q4 2024 Commercial Loans"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSegment()}
            />
            <Button
              className="w-full"
              size="lg"
              onClick={handleCreateSegment}
              disabled={!segmentName.trim()}
              icon={<ArrowRight className="w-5 h-5" />}
            >
              Create Segment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Segment Setup</h1>
            <p className="text-slate-500 mt-1">
              Configure PD and LGD forecasts for your loan segment
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="info" size="md">
              Step 1 of 2
            </Badge>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-danger-800">Error</p>
              <p className="text-sm text-danger-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-danger-400 hover:text-danger-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Segment Name */}
        <Card variant="elevated">
          <CardContent className="p-6">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Input
                  label="Segment Name"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  onBlur={handleNameUpdate}
                />
              </div>
              <Button variant="secondary" onClick={handleNameUpdate}>
                Update
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Forecast Upload Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* PD Forecast */}
          <Card variant="elevated">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-danger-600" />
                </div>
                <div>
                  <CardTitle>PD Forecast</CardTitle>
                  <CardDescription>Probability of Default rates</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dropzone
                onFileAccepted={(file) => handleExtract(file, 'PD')}
                onFileRemoved={() => setPDCurve(null as never)}
                label="Upload PD Forecast Screenshot"
                hint="PNG, JPG up to 10MB"
                disabled={isExtracting}
              />
              {isExtracting && !currentSegment.pdCurve && (
                <div className="flex items-center justify-center py-4 text-primary-600">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Extracting PD data...
                </div>
              )}
              {renderForecastTable(
                currentSegment.pdCurve,
                'PD',
                editingPD,
                setEditingPD,
                pdEditValues,
                setPDEditValues,
                updatePDCurvePeriod
              )}
            </CardContent>
          </Card>

          {/* LGD Forecast */}
          <Card variant="elevated">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <CardTitle>LGD Forecast</CardTitle>
                  <CardDescription>Loss Given Default rates</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dropzone
                onFileAccepted={(file) => handleExtract(file, 'LGD')}
                onFileRemoved={() => setLGDCurve(null as never)}
                label="Upload LGD Forecast Screenshot"
                hint="PNG, JPG up to 10MB"
                disabled={isExtracting}
              />
              {isExtracting && !currentSegment.lgdCurve && (
                <div className="flex items-center justify-center py-4 text-primary-600">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Extracting LGD data...
                </div>
              )}
              {renderForecastTable(
                currentSegment.lgdCurve,
                'LGD',
                editingLGD,
                setEditingLGD,
                lgdEditValues,
                setLGDEditValues,
                updateLGDCurvePeriod
              )}
            </CardContent>
          </Card>
        </div>

        {/* Proceed Button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleProceed}
            disabled={!canProceed}
            icon={<ChevronRight className="w-5 h-5" />}
          >
            Continue to Loan Processing
          </Button>
        </div>

        {!canProceed && (
          <p className="text-sm text-slate-500 text-right">
            Please upload and verify both PD and LGD forecasts to continue
          </p>
        )}
      </div>
    </div>
  );
}
