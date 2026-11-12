import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm transition-theme placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15',
          error && 'border-danger focus-visible:ring-danger',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  ),
);
Input.displayName = 'Input';
