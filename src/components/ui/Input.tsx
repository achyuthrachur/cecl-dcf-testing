'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Check } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  showValidation?: boolean;
  isValid?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      prefix,
      suffix,
      showValidation = false,
      isValid,
      type = 'text',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-500 text-sm">{prefix}</span>
            </div>
          )}
          <input
            ref={ref}
            type={type}
            id={inputId}
            className={cn(
              'block w-full rounded-lg border transition-all duration-200',
              'text-slate-900 placeholder-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              error
                ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-200'
                : 'border-slate-300 focus:border-primary-500 focus:ring-primary-200',
              prefix ? 'pl-8' : 'pl-3',
              suffix || showValidation ? 'pr-10' : 'pr-3',
              'py-2 text-sm',
              props.disabled && 'bg-slate-50 cursor-not-allowed',
              className
            )}
            {...props}
          />
          {(suffix || showValidation) && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {showValidation ? (
                isValid ? (
                  <Check className="h-4 w-4 text-accent-500" />
                ) : error ? (
                  <AlertCircle className="h-4 w-4 text-danger-500" />
                ) : null
              ) : (
                <span className="text-slate-500 text-sm">{suffix}</span>
              )}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-danger-600 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
