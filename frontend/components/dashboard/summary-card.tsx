import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

interface SummaryCardProps {
  label: string;
  value?: number;
  icon: LucideIcon;
  isLoading?: boolean;
  tone?: 'default' | 'success' | 'danger';
  onClick?: () => void;
}

export function SummaryCard({ label, value, icon: Icon, isLoading, tone = 'default', onClick }: SummaryCardProps) {
  return (
    <Card
      className={cn('transition-theme hover:shadow-md', onClick && 'cursor-pointer hover:border-primary/40')}
      onClick={onClick}
    >
      <CardContent className="flex items-start justify-between p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          {isLoading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <span
              className={cn(
                'text-2xl font-semibold tracking-tight',
                tone === 'success' && 'text-success',
                tone === 'danger' && 'text-danger',
              )}
            >
              {formatCurrency(value ?? 0)}
            </span>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}