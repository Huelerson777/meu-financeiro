import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Estado vazio padrão: ícone em placa suave, título direto, uma ação. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <p className="font-display mt-4 text-lg font-bold tracking-tight">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
