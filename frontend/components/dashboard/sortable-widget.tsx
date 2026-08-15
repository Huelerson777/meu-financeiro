'use client';

import { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SortableWidgetProps {
  id: string;
  span?: string;
  children: ReactNode;
}

/**
 * Envolve um card do Dashboard pra torná-lo arrastável. A "pegada" de
 * arrastar fica só no ícone de grip (canto superior direito, aparece no
 * hover) — assim cliques dentro do card (botões, links, gráficos) não
 * disparam o drag por engano.
 */
export function SortableWidget({ id, span, children }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group relative', span, isDragging && 'z-10 opacity-70')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
        title="Arrastar para reordenar"
        className="absolute -right-2 -top-2 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}
