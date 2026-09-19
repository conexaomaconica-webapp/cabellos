'use client';

import * as React from 'react';
import { maskCurrencyBRL, unmaskCurrencyBRL, cn } from '@/lib/utils';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChangeValue: (numericValue: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChangeValue, ...props }, ref) => {
    const displayValue = React.useMemo(() => {
      return maskCurrencyBRL(value);
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const rawText = e.target.value;
      const numeric = unmaskCurrencyBRL(rawText);
      onChangeValue(numeric);
    }

    return (
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-offset-slate-950 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
