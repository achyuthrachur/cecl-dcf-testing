'use client';

import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-5 w-5" />;
    }
    if (resolvedTheme === 'dark') {
      return <Moon className="h-5 w-5" />;
    }
    return <Sun className="h-5 w-5" />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    if (theme === 'dark') return 'Dark';
    return 'Light';
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg p-2',
        'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
        'dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800',
        'transition-all duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        'dark:focus:ring-offset-slate-900',
        className
      )}
      title={`Current theme: ${getLabel()}. Click to cycle.`}
      aria-label={`Toggle theme. Current: ${getLabel()}`}
    >
      <div className="relative h-5 w-5">
        <div
          className={cn(
            'absolute inset-0 transform transition-all duration-300',
            resolvedTheme === 'light' && theme !== 'system'
              ? 'rotate-0 scale-100 opacity-100'
              : 'rotate-90 scale-0 opacity-0'
          )}
        >
          <Sun className="h-5 w-5 text-amber-500" />
        </div>
        <div
          className={cn(
            'absolute inset-0 transform transition-all duration-300',
            resolvedTheme === 'dark' && theme !== 'system'
              ? 'rotate-0 scale-100 opacity-100'
              : '-rotate-90 scale-0 opacity-0'
          )}
        >
          <Moon className="h-5 w-5 text-blue-400" />
        </div>
        <div
          className={cn(
            'absolute inset-0 transform transition-all duration-300',
            theme === 'system'
              ? 'rotate-0 scale-100 opacity-100'
              : 'rotate-180 scale-0 opacity-0'
          )}
        >
          <Monitor className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </div>
      </div>
      {showLabel && (
        <span className="ml-2 text-sm font-medium">{getLabel()}</span>
      )}
    </button>
  );
}
