'use client';

import { format } from 'date-fns';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Button,
} from '@/components/ui';
import { Segment } from '@/types';
import { RefreshCw, PlayCircle, FileSpreadsheet, TrendingUp, TrendingDown } from 'lucide-react';

interface StartupDialogProps {
  open: boolean;
  segment: Segment;
  onContinue: () => void;
  onStartFresh: () => void;
}

export function StartupDialog({
  open,
  segment,
  onContinue,
  onStartFresh,
}: StartupDialogProps) {
  const loanCount = segment.loans?.length || 0;
  const resultCount = segment.results?.length || 0;
  const hasPD = !!segment.pdCurve;
  const hasLGD = !!segment.lgdCurve;

  return (
    <Dialog open={open}>
      <DialogHeader>
        <DialogTitle>Welcome Back</DialogTitle>
        <DialogDescription>
          You have an existing session. Would you like to continue or start fresh?
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        {/* Existing Session Summary */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-medium">
            <FileSpreadsheet className="h-4 w-4 text-primary-600" />
            <span>Segment: {segment.name || 'Unnamed'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* PD Curve Status */}
            <div className="flex items-center gap-2">
              <TrendingDown className={`h-4 w-4 ${hasPD ? 'text-success-600' : 'text-slate-400'}`} />
              <span className="text-slate-600">
                PD Curve: {hasPD ? `${segment.pdCurve!.periods.length} periods` : 'Not set'}
              </span>
            </div>

            {/* LGD Curve Status */}
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${hasLGD ? 'text-success-600' : 'text-slate-400'}`} />
              <span className="text-slate-600">
                LGD Curve: {hasLGD ? `${segment.lgdCurve!.periods.length} periods` : 'Not set'}
              </span>
            </div>

            {/* Loan Count */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600">
                Loans: {loanCount}
              </span>
            </div>

            {/* Results Count */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600">
                Results: {resultCount}
              </span>
            </div>
          </div>

          {segment.updatedAt && (
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
              Last updated: {format(new Date(segment.updatedAt), 'MMM d, yyyy h:mm a')}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onStartFresh}
          icon={<RefreshCw className="h-4 w-4" />}
        >
          Start Fresh
        </Button>
        <Button
          variant="primary"
          onClick={onContinue}
          icon={<PlayCircle className="h-4 w-4" />}
        >
          Continue
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
