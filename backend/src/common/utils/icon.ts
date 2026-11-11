/**
 * Teto do campo `icon` de contas e cartões. Ele guarda o nome de um ícone ou
 * uma logo pequena em data URL: o frontend já reduz a imagem pra no máximo
 * ~90 mil caracteres (ver frontend/utils/image-resize.ts). Sem teto no
 * servidor, daria pra gravar megabytes por conta, devolvidos em toda listagem.
 */
export const MAX_ICON_LENGTH = 120_000;
