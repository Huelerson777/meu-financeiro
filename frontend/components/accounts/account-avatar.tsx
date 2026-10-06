import { isImageIcon } from '@/utils/image-resize';
import { cn } from '@/utils/cn';

interface AccountAvatarProps {
  name: string;
  color?: string | null;
  icon?: string | null;
  className?: string;
}

/** Logo da conta quando existir; senão a inicial sobre a cor da conta. */
export function AccountAvatar({ name, color, icon, className }: AccountAvatarProps) {
  const tint = color || '#64748B';

  if (isImageIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt={`Logo ${name}`}
        className={cn('h-10 w-10 shrink-0 rounded-xl border border-border/60 bg-white object-contain p-0.5', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold', className)}
      style={{ backgroundColor: `${tint}1f`, color: tint }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
