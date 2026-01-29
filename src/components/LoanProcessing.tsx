'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAppStore, selectLoanCount, selectResultCount, selectTotalVariance } from '@/lib/store';
import { fileToBase64, formatCurrency, formatPercent, formatDate, getVarianceColor, downloadBuffer } from '@/lib/utils';
import { LoanInput, CalculationResult } from '@/types';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Dropzone,
  Badge,
} from '@/components/ui';
import {
  ArrowLeft,
  Save,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  FileSpreadsheet,
  Calculator,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
} from 'lucide-react';

export function LoanProcessing() {
  const {
    currentSegment,
    addLoan,
    updateLoan,
    removeLoan,
    addResult,
    removeResult,
    setPhase,
    resetSegment,
    isExtracting,
    setIsExtracting,
    isCalculating,
    setIsCalculating,
    error,
    setError,
  } = useAppStore();

  const loanCount = useAppStore(selectLoanCount);
  const resultCount = useAppStore(selectResultCount);
  const totalVariance = useAppStore(selectTotalVariance);

  const [currentLoan, setCurrentLoan] = useState<Partial<LoanInput> | null>(null);
  const [currentResult, setCurrentResult] = useState<CalculationResult | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Group results by loan for display
  const loanResults = useMemo(() => {
    if (!currentSegment) return [];
    return currentSegment.results;
  }, [currentSegment]);

  const handleExtractLoan = useCallback(
    async (file: File) => {
      if (!currentSegment) return;

      setIsExtracting(true);
      setError(null);
      setCurrentLoan(null);
      setCurrentResult(null);

      try {
        const base64 = await fileToBase64(file);

        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            forcedType: 'Loan',
            segmentId: currentSegment.id,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.errors?.join(', ') || data.error || 'Extraction failed');
          return;
        }

        setCurrentLoan({
          ...data.data,
          segmentId: currentSegment.id,
          extractedAt: new Date(),
          confidence: data.confidence,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsExtracting(false);
      }
    },
    [currentSegment, setIsExtracting, setError]
  );

  const handleCalculate = useCallback(async () => {
    if (!currentSegment || !currentLoan || !currentSegment.pdCurve || !currentSegment.lgdCurve) {
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan: currentLoan,
          pdCurve: currentSegment.pdCurve,
          lgdCurve: currentSegment.lgdCurve,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.errors?.join(', ') || data.error || 'Calculation failed');
        return;
      }

      setCurrentResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsCalculating(false);
    }
  }, [currentSegment, currentLoan, setIsCalculating, setError]);

  const handleStoreAndNext = useCallback(() => {
    if (!currentLoan || !currentResult) return;

    // Add loan and result to segment
    addLoan(currentLoan as LoanInput);
    addResult(currentResult);

    // Reset for next loan
    setCurrentLoan(null);
    setCurrentResult(null);
  }, [currentLoan, currentResult, addLoan, addResult]);

  const handleExportAndReset = useCallback(async () => {
    if (!currentSegment || currentSegment.results.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment: currentSegment,
          results: currentSegment.results,
          format: 'xlsx',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Export failed');
        return;
      }

      const buffer = await response.arrayBuffer();
      const filename = response.headers
        .get('Content-Disposition')
        ?.match(/filename="(.+)"/)?.[1] || 'CECL_DCF_Report.xlsx';

      downloadBuffer(
        buffer,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      // Reset segment after successful export
      resetSegment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsExporting(false);
    }
  }, [currentSegment, resetSegment, setError]);

  const handleDeleteLoan = useCallback(
    (loanId: string) => {
      removeLoan(loanId);
      removeResult(loanId);
    },
    [removeLoan, removeResult]
  );

  const handleUpdateField = useCallback(
    (field: string, value: unknown) => {
      if (!currentLoan) return;
      setCurrentLoan({
        ...currentLoan,
        [field]: value,
        corrected: true,
      });
    },
    [currentLoan]
  );

  const renderLoanInputForm = () => {
    if (!currentLoan) return null;

    const fields = [
      { key: 'loanNumber', label: 'Loan Number', type: 'text' },
      { key: 'bookBalance', label: 'Book Balance', type: 'currency' },
      { key: 'unamortizedAmount', label: 'Unamortized Amount', type: 'currency' },
      { key: 'calculationDate', label: 'Calculation Date', type: 'date' },
      { key: 'interestRate', label: 'Interest Rate', type: 'percent' },
      { key: 'effectiveYield', label: 'Effective Yield', type: 'percent' },
      { key: 'paymentType', label: 'Payment Type', type: 'select', options: ['Fixed Payment', 'Fixed Principal', 'Interest Only', 'Line of Credit'] },
      { key: 'paymentAmount', label: 'Payment Amount', type: 'currency' },
      { key: 'maturityDate', label: 'Maturity Date', type: 'date' },
      { key: 'periods', label: 'Periods', type: 'number' },
      { key: 'cpr', label: 'CPR', type: 'percent' },
      { key: 'smm', label: 'SMM', type: 'percent' },
      { key: 'recoveryDelay', label: 'Recovery Delay (months)', type: 'number' },
      { key: 'actualReserve', label: 'Actual Reserve', type: 'currency' },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {fields.map((field) => {
          const value = currentLoan[field.key as keyof typeof currentLoan];
          const isEditing = editingField === field.key;

          return (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {field.label}
              </label>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  {field.type === 'select' ? (
                    <select
                      className="flex-1 text-sm px-2 py-1.5 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      value={String(value || '')}
                      onChange={(e) => handleUpdateField(field.key, e.target.value)}
                      autoFocus
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' || field.type === 'percent' ? 'number' : 'text'}
                      step={field.type === 'percent' ? '0.0001' : field.type === 'currency' ? '0.01' : undefined}
                      className="flex-1 text-sm px-2 py-1.5 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                      value={
                        field.type === 'date' && value
                          ? new Date(value as Date).toISOString().split('T')[0]
                          : field.type === 'percent' && value
                            ? Number(((value as number) * 100).toFixed(6))
                            : String(value ?? '')
                      }
                      onChange={(e) => {
                        let newValue: unknown = e.target.value;
                        if (field.type === 'number') newValue = parseInt(e.target.value) || 0;
                        if (field.type === 'currency') newValue = parseFloat(e.target.value) || 0;
                        if (field.type === 'percent') newValue = Number((parseFloat(e.target.value) / 100).toFixed(6)) || 0;
                        if (field.type === 'date') newValue = new Date(e.target.value);
                        handleUpdateField(field.key, newValue);
                      }}
                      autoFocus
                    />
                  )}
                  <button
                    onClick={() => setEditingField(null)}
                    className="p-1 text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/30 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center justify-between text-sm text-slate-900 dark:text-slate-100 px-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 group"
                  onClick={() => setEditingField(field.key)}
                >
                  <span className="font-mono">
                    {field.type === 'currency' && value !== undefined
                      ? formatCurrency(value as number)
                      : field.type === 'percent' && value !== undefined
                        ? formatPercent(value as number, 4)
                        : field.type === 'date' && value
                          ? formatDate(value as Date)
                          : String(value ?? '-')}
                  </span>
                  <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderResultSummary = () => {
    if (!currentResult) return null;

    const varianceColor = getVarianceColor(currentResult.varianceDollar);

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="outlined" padding="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">NPV</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(currentResult.netPresentValue)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card variant="outlined" padding="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Calculated Reserve</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(currentResult.calculatedReserve)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card variant="outlined" padding="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Actual Reserve</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(currentResult.actualReserve)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card variant="outlined" padding="sm">
          <CardContent className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                currentResult.varianceDollar >= 0 ? 'bg-accent-100 dark:bg-accent-900/50' : 'bg-danger-100 dark:bg-danger-900/50'
              }`}
            >
              {currentResult.varianceDollar >= 0 ? (
                <TrendingUp className="w-5 h-5 text-accent-600 dark:text-accent-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-danger-600 dark:text-danger-400" />
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Variance</p>
              <p className={`text-lg font-semibold ${varianceColor}`}>
                {formatCurrency(currentResult.varianceDollar)}
                <span className="text-sm ml-1">
                  ({formatPercent(currentResult.variancePercent / 100, 2)})
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (!currentSegment) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setPhase('segment-setup')}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {currentSegment.name}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                {loanCount} loan{loanCount !== 1 ? 's' : ''} processed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="info" size="md">
              Step 2 of 2
            </Badge>
            {resultCount > 0 && (
              <Badge
                variant={totalVariance >= 0 ? 'success' : 'danger'}
                size="md"
              >
                Total Variance: {formatCurrency(totalVariance)}
              </Badge>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-danger-50 dark:bg-danger-950/50 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-danger-800 dark:text-danger-200">Error</p>
              <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-danger-400 hover:text-danger-600 dark:hover:text-danger-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Processing Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Card */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Upload Loan Screenshot</CardTitle>
                <CardDescription>
                  Upload a screenshot of the loan details to extract and calculate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dropzone
                  onFileAccepted={handleExtractLoan}
                  onFileRemoved={() => {
                    setCurrentLoan(null);
                    setCurrentResult(null);
                  }}
                  label="Drop loan screenshot here"
                  hint="PNG, JPG up to 10MB"
                  disabled={isExtracting}
                />

                {isExtracting && (
                  <div className="flex items-center justify-center py-8 text-primary-600 dark:text-primary-400">
                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mr-3" />
                    Extracting loan data...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Extracted Data Card */}
            {currentLoan && (
              <Card variant="elevated" className="animate-slide-up">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/50 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <CardTitle>
                          Loan: {currentLoan.loanNumber || 'Unknown'}
                        </CardTitle>
                        <CardDescription>
                          Review and correct extracted values
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        (currentLoan.confidence || 0) >= 0.8
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {formatPercent(currentLoan.confidence || 0, 0)} confidence
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>{renderLoanInputForm()}</CardContent>
                <CardFooter className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  <Button
                    onClick={handleCalculate}
                    loading={isCalculating}
                    icon={<Calculator className="w-4 h-4" />}
                    disabled={!currentLoan.loanNumber || !currentLoan.bookBalance}
                  >
                    Calculate Reserve
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Results Card */}
            {currentResult && (
              <Card variant="elevated" className="animate-slide-up">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Calculation Results</CardTitle>
                    {currentResult.warnings.length > 0 && (
                      <Badge variant="warning">
                        {currentResult.warnings.length} warning
                        {currentResult.warnings.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderResultSummary()}

                  {currentResult.warnings.length > 0 && (
                    <div className="bg-warning-50 dark:bg-warning-950/50 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
                      <p className="text-sm font-medium text-warning-800 dark:text-warning-200 mb-2">
                        Warnings:
                      </p>
                      <ul className="text-sm text-warning-700 dark:text-warning-300 space-y-1">
                        {currentResult.warnings.map((w, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t border-slate-100 dark:border-slate-700 pt-4 flex justify-between">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCurrentLoan(null);
                      setCurrentResult(null);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    onClick={handleStoreAndNext}
                    icon={<Save className="w-4 h-4" />}
                  >
                    Store and Next Loan
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>

          {/* Sidebar - Stored Loans & Actions */}
          <div className="space-y-6">
            {/* Actions Card */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setCurrentLoan(null);
                    setCurrentResult(null);
                  }}
                >
                  New Loan
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="primary"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportAndReset}
                  disabled={resultCount === 0}
                  loading={isExporting}
                >
                  Export Report & New Segment
                </Button>
              </CardContent>
            </Card>

            {/* Stored Loans Card */}
            <Card variant="elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Stored Loans</CardTitle>
                  <Badge variant="default">{loanCount}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loanResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p>No loans stored yet</p>
                    <p className="text-sm">Upload and process loans above</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {loanResults.map((result) => {
                      const isExpanded = expandedLoan === result.loanId;
                      const varianceColor = getVarianceColor(result.varianceDollar);

                      return (
                        <div
                          key={result.id}
                          className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                        >
                          <div
                            className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                            onClick={() =>
                              setExpandedLoan(isExpanded ? null : result.loanId)
                            }
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                                {result.loanInput.loanNumber}
                              </span>
                              <span className={`text-xs font-medium ${varianceColor}`}>
                                {result.varianceDollar >= 0 ? '+' : ''}
                                {formatCurrency(result.varianceDollar)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLoan(result.loanId);
                                }}
                                className="p-1 text-slate-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-3 py-2 text-xs space-y-1 bg-white dark:bg-slate-800/50">
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Book Balance:</span>
                                <span className="font-mono dark:text-slate-200">
                                  {formatCurrency(result.loanInput.bookBalance)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Calc Reserve:</span>
                                <span className="font-mono dark:text-slate-200">
                                  {formatCurrency(result.calculatedReserve)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Actual Reserve:</span>
                                <span className="font-mono dark:text-slate-200">
                                  {formatCurrency(result.actualReserve)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Variance %:</span>
                                <span className={`font-mono ${varianceColor}`}>
                                  {formatPercent(result.variancePercent / 100, 2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Stats */}
            {resultCount > 0 && (
              <Card variant="outlined" padding="sm">
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Total Loans:</span>
                    <span className="font-medium dark:text-slate-200">{resultCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Total Book Balance:</span>
                    <span className="font-medium font-mono dark:text-slate-200">
                      {formatCurrency(
                        loanResults.reduce(
                          (sum, r) => sum + r.loanInput.bookBalance,
                          0
                        )
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Total Calc Reserve:</span>
                    <span className="font-medium font-mono dark:text-slate-200">
                      {formatCurrency(
                        loanResults.reduce(
                          (sum, r) => sum + r.calculatedReserve,
                          0
                        )
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Total Variance:</span>
                    <span className={`font-medium font-mono ${getVarianceColor(totalVariance)}`}>
                      {formatCurrency(totalVariance)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
