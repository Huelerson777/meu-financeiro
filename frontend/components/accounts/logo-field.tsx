'use client';

import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { fileToLogoDataUrl, isImageIcon } from '@/utils/image-resize';

interface LogoFieldProps {
  name: string;
  color?: string | null;
  /** Logo salva atualmente (para mostrar na prévia enquanto nada mudou). */
  currentIcon?: string | null;
  /** undefined = sem mudança | string = nova imagem | null = remover */
  value: string | null | undefined;
  onChange: (next: string | null) => void;
}

/** Campo de logo (imagem) usado em contas e cartões: prévia, escolher/trocar e remover. */
export function LogoField({ name, color, currentIcon, value, onChange }: LogoFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const preview = value !== undefined ? value : currentIcon;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      onChange(await fileToLogoDataUrl(file));
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível usar essa imagem.');
    }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Logo (opcional)</label>
      <div className="flex items-center gap-3">
        <AccountAvatar name={name || 'Logo'} color={color} icon={preview} className="h-14 w-14" />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold transition-theme hover:bg-muted active:scale-[0.97]">
            <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
            {isImageIcon(preview) ? 'Trocar imagem' : 'Escolher imagem'}
            <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
          </label>
          {isImageIcon(preview) && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-theme hover:bg-muted hover:text-danger active:scale-[0.97]"
            >
              <X className="h-4 w-4" /> Remover
            </button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG, SVG ou WebP. A imagem é reduzida automaticamente.</p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
