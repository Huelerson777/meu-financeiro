export interface ParsedRow {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Com sinal: positivo = entrada, negativo = saída. */
  amount: number;
}

/** Lê o arquivo como texto; extratos antigos de banco costumam vir em Windows-1252, não em UTF-8. */
export async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** "1.234,56", "R$ 45,90", "-45,90", "(45,90)", "45.90", "45,90-" -> número com sinal. */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/R\$|\s/g, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // o separador que aparece por último é o decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot && !/\.\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, ''); // 1.234 = milhar
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** dd/mm/yyyy, dd/mm/yy, dd-mm-yyyy, yyyy-mm-dd, yyyymmdd[...] -> YYYY-MM-DD. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) return `${year}-${month}-${day}`;
  }
  return null;
}

/** OFX/QFX: lê cada <STMTTRN> (data, valor e descrição). Funciona com SGML sem tags de fechamento. */
export function parseOfx(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];
  const field = (block: string, tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';

  for (const block of blocks) {
    const date = parseDate(field(block, 'DTPOSTED'));
    const amount = parseNumber(field(block, 'TRNAMT'));
    const description = field(block, 'MEMO') || field(block, 'NAME') || field(block, 'CHECKNUM') || 'Lançamento';
    if (date && amount != null && amount !== 0) rows.push({ date, description, amount });
  }
  return rows;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

/** Divide uma linha de CSV respeitando aspas. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** CSV de banco: detecta o separador (; , ou tab) e a linha de cabeçalho (ignora títulos antes dela). */
export function parseCsv(text: string): CsvTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const count = (d: string) => (lines.slice(0, 10).join('\n').match(new RegExp(d === '\t' ? '\\t' : `\\${d}`, 'g')) ?? []).length;
  const delimiter = [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0];

  const table = lines.map((l) => splitLine(l, delimiter));
  // cabeçalho = primeira linha com 2+ colunas, todas preenchidas e em texto (títulos do banco costumam ter células vazias), seguida de linhas com data
  const headerIndex = table.findIndex((cols, i) => cols.length >= 2 && cols.every((c) => c !== '' && parseDate(c) === null && parseNumber(c) === null) && table.slice(i + 1, i + 4).some((r) => r.some((c) => parseDate(c))));
  const headers = headerIndex >= 0 ? table[headerIndex] : table[0].map((_, i) => `Coluna ${i + 1}`);
  const rows = table.slice(headerIndex >= 0 ? headerIndex + 1 : 0).filter((r) => r.length >= 2);
  return { headers, rows };
}

export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
}

/** Chuta quais colunas são data, descrição e valor pelo nome do cabeçalho e pelo conteúdo. */
export function guessColumns(table: CsvTable): ColumnMapping {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const find = (re: RegExp) => table.headers.findIndex((h) => re.test(norm(h)));

  let date = find(/^(data|date|dt)|data (do|da)? ?(lanc|mov|transa)/);
  let description = find(/descri|historico|lancamento|memo|estabelecimento|detalhe|nome/);
  let amount = find(/^(valor|value|amount|montante)|valor \(?r/);

  const sample = table.rows.slice(0, 20);
  const score = (col: number, test: (v: string) => boolean) => sample.filter((r) => r[col] && test(r[col])).length;
  if (date < 0) date = table.headers.map((_, i) => i).sort((a, b) => score(b, (v) => parseDate(v) !== null) - score(a, (v) => parseDate(v) !== null))[0] ?? 0;
  if (amount < 0) amount = table.headers.map((_, i) => i).filter((i) => i !== date).sort((a, b) => score(b, (v) => parseNumber(v) !== null) - score(a, (v) => parseNumber(v) !== null))[0] ?? 1;
  if (description < 0) description = table.headers.findIndex((_, i) => i !== date && i !== amount);
  return { date, description: Math.max(description, 0), amount };
}

export function csvToRows(table: CsvTable, mapping: ColumnMapping, invertSigns = false): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const r of table.rows) {
    const date = parseDate(r[mapping.date] ?? '');
    let amount = parseNumber(r[mapping.amount] ?? '');
    if (!date || amount == null || amount === 0) continue;
    if (invertSigns) amount = -amount;
    rows.push({ date, description: (r[mapping.description] ?? '').trim() || 'Lançamento', amount });
  }
  return rows;
}
