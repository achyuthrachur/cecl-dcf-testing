'use client';

import { ThemeToggle } from '@/components/ui';
import { FileSpreadsheet, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onShowWelcome?: () => void;
  showHomeButton?: boolean;
  className?: string;
}

export function Header({ onShowWelcome, showHomeButton = false, className }: HeaderProps) {
  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-40',
      'bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg',
      'border-b border-slate-200/50 dark:border-slate-700/50',
      className
    )}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md shadow-primary-500/20">
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900 dark:text-white hidden sm:block">
            CECL DCF Testing
          </span>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {showHomeButton && onShowWelcome && (
            <button
              onClick={onShowWelcome}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                'dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800',
                'transition-colors'
              )}
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
