const DIACRITICS_REGEX = new RegExp(String.fromCharCode(91, 0x0300, 0x2d, 0x036f, 93), 'g');

/** Minúsculas, sem acento, sem espaços nas pontas — pra comparar descrições. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .trim();
}

/**
 * Fallback de sugestão de categoria pra quando o usuário ainda não tem
 * histórico suficiente (ver TransactionsService.suggestCategory). Cada
 * palavra-chave é comparada contra a descrição normalizada (sem acento,
 * minúscula) e aponta pro nome de uma categoria padrão (ver
 * CategoriesService.DEFAULT_CATEGORIES) — só é usada se o usuário tiver uma
 * categoria com esse nome exato.
 */
export const CATEGORY_KEYWORDS: Record<string, string> = {
  // Mercado/Alimentação
  mercado: 'Mercado/Alimentação',
  supermercado: 'Mercado/Alimentação',
  ifood: 'Mercado/Alimentação',
  'uber eats': 'Mercado/Alimentação',
  restaurante: 'Mercado/Alimentação',
  lanchonete: 'Mercado/Alimentação',
  padaria: 'Mercado/Alimentação',
  acougue: 'Mercado/Alimentação',
  hortifruti: 'Mercado/Alimentação',
  feira: 'Mercado/Alimentação',

  // Moradia
  aluguel: 'Moradia',
  condominio: 'Moradia',
  iptu: 'Moradia',
  energia: 'Moradia',
  'conta de luz': 'Moradia',
  luz: 'Moradia',
  agua: 'Moradia',
  saneamento: 'Moradia',
  gas: 'Moradia',
  enel: 'Moradia',
  cemig: 'Moradia',
  cpfl: 'Moradia',
  light: 'Moradia',
  sabesp: 'Moradia',

  // Telefone
  tim: 'Telefone',
  vivo: 'Telefone',
  claro: 'Telefone',
  celular: 'Telefone',
  'conta de telefone': 'Telefone',

  // Internet
  internet: 'Internet',
  fibra: 'Internet',
  wifi: 'Internet',
  'banda larga': 'Internet',

  // Carro
  uber: 'Carro',
  '99': 'Carro',
  posto: 'Carro',
  combustivel: 'Carro',
  gasolina: 'Carro',
  etanol: 'Carro',
  estacionamento: 'Carro',
  pedagio: 'Carro',
  ipva: 'Carro',
  oficina: 'Carro',
  mecanico: 'Carro',

  // Lazer
  netflix: 'Lazer',
  spotify: 'Lazer',
  disney: 'Lazer',
  hbo: 'Lazer',
  'amazon prime': 'Lazer',
  cinema: 'Lazer',
  ingresso: 'Lazer',
  show: 'Lazer',
  viagem: 'Lazer',
  bar: 'Lazer',

  // Farmácia
  farmacia: 'Farmácia',
  drogaria: 'Farmácia',
  remedio: 'Farmácia',

  // Salão/Barbearia
  salao: 'Salão/Barbearia',
  barbearia: 'Salão/Barbearia',
  cabeleireiro: 'Salão/Barbearia',
  manicure: 'Salão/Barbearia',

  // Roupas
  roupa: 'Roupas',
  calcado: 'Roupas',
  tenis: 'Roupas',

  // Presentes
  presente: 'Presentes',

  // Cartão (fatura genérica)
  fatura: 'Cartão',
};
