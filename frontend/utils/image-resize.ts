const MAX_DATA_URL_LENGTH = 90_000; // ~65 KB de imagem — logo de conta não precisa de mais que isso

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler essa imagem.'));
    };
    img.src = url;
  });
}

/**
 * Converte um arquivo de imagem em uma logo quadrada pequena (data URL).
 * Mantém a proporção (a logo inteira aparece, com margem), preserva transparência e
 * reduz o tamanho até caber no limite — assim cabe no campo `icon` da conta sem storage externo.
 */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (PNG, JPG, SVG ou WebP).');
  if (file.size > 8 * 1024 * 1024) throw new Error('Imagem muito grande — o limite é 8MB.');

  const img = await loadImage(file);
  const naturalW = img.naturalWidth || 128;
  const naturalH = img.naturalHeight || 128;

  for (const size of [128, 96, 64]) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.');

    const pad = Math.round(size * 0.08);
    const scale = Math.min((size - pad * 2) / naturalW, (size - pad * 2) / naturalH);
    const w = naturalW * scale;
    const h = naturalH * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    const webp = canvas.toDataURL('image/webp', 0.9);
    const out = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
    if (out.length <= MAX_DATA_URL_LENGTH) return out;
  }
  throw new Error('Não consegui reduzir essa imagem o bastante. Tente um arquivo mais simples.');
}

/** `icon` da conta pode ser uma imagem (data URL) ou, em contas antigas, um nome de ícone. */
export function isImageIcon(icon?: string | null): icon is string {
  return !!icon && icon.startsWith('data:image/');
}
