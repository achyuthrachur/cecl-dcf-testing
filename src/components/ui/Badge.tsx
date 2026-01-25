'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
      success: 'bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-400',
      warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-400',
      danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/50 dark:text-danger-400',
      info: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
