'use client';

import { Menu, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { SearchBox } from './search-box';
import { NotificationBell } from './notification-bell';
import { FeedbackButton } from './feedback-button';
import { useMobileNavStore } from '@/stores/mobile-nav-store';
import { useValuesVisibilityStore } from '@/stores/values-visibility-store';

const iconButton =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-foreground/[0.05] hover:text-foreground';

export function Topbar() {
  const toggleMobileNav = useMobileNavStore((s) => s.toggle);
  const hidden = useValuesVisibilityStore((s) => s.hidden);
  const toggleHidden = useValuesVisibilityStore((s) => s.toggle);

  return (
    <header className="print:hidden sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 bg-background/85 px-4 backdrop-blur-md sm:h-16 sm:px-6 lg:px-8">
      <button onClick={toggleMobileNav} aria-label="Abrir menu" className={`lg:hidden ${iconButton}`}>
        <Menu className="h-5 w-5" />
      </button>

      <SearchBox />

      <div className="flex items-center gap-0.5">
        <button
          onClick={toggleHidden}
          title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
          aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
          className={iconButton}
        >
          {hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
        <div className="hidden sm:block"><FeedbackButton /></div>
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
