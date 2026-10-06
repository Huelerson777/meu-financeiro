import { describe, expect, it } from 'vitest';
import { csvToRows, guessColumns, parseCsv, parseDate, parseNumber, parseOfx } from './statement-parser';

describe('parseNumber', () => {
  it.each([
    ['R$ 1.234,56', 1234.56],
    ['-45,90', -45.9],
    ['(45,90)', -45.9],
    ['45,90-', -45.9],
    ['1,234.56', 1234.56],
    ['1.234', 1234],
    ['45.90', 45.9],
    ['+12,5', 12.5],
  ])('%s -> %s', (raw, expected) => expect(parseNumber(raw)).toBe(expected));

  it('devolve null para texto', () => expect(parseNumber('abc')).toBeNull());
});

describe('parseDate', () => {
  it.each([
    ['05/10/2026', '2026-10-05'],
    ['5/1/26', '2026-01-05'],
    ['2026-10-05', '2026-10-05'],
    ['20261005120000[-3:BRT]', '2026-10-05'],
  ])('%s -> %s', (raw, expected) => expect(parseDate(raw)).toBe(expected));

  it('rejeita datas impossíveis', () => expect(parseDate('32/13/2026')).toBeNull());
});

describe('parseOfx', () => {
  it('lê OFX em SGML sem tags de fechamento e ignora valor zero', () => {
    const ofx = `OFXHEADER:100\n<OFX><BANKTRANLIST>
<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20261003120000[-3:BRT]\n<TRNAMT>-48.90\n<FITID>1\n<MEMO>IFOOD *PEDIDO
</STMTTRN>
<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20261004\n<TRNAMT>6500.00\n<FITID>2\n<NAME>SALARIO EMPRESA
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005<TRNAMT>-0.00<MEMO>ZERO</STMTTRN>
</BANKTRANLIST>`;
    expect(parseOfx(ofx)).toEqual([
      { date: '2026-10-03', description: 'IFOOD *PEDIDO', amount: -48.9 },
      { date: '2026-10-04', description: 'SALARIO EMPRESA', amount: 6500 },
    ]);
  });
});

describe('CSV', () => {
  it('acha o cabeçalho depois de linhas de título, respeita aspas e ; dentro do texto', () => {
    const csv = `Extrato Conta Corrente;;\nPeríodo: 01/10/2026 a 06/10/2026;;\nData;Histórico;Valor\n03/10/2026;"PIX ENVIADO; JOAO";-120,00\n04/10/2026;SALARIO;"6.500,00"\n`;
    const table = parseCsv(csv);
    expect(table.headers).toEqual(['Data', 'Histórico', 'Valor']);
    const mapping = guessColumns(table);
    expect(mapping).toEqual({ date: 0, description: 1, amount: 2 });
    expect(csvToRows(table, mapping)).toEqual([
      { date: '2026-10-03', description: 'PIX ENVIADO; JOAO', amount: -120 },
      { date: '2026-10-04', description: 'SALARIO', amount: 6500 },
    ]);
  });

  it('inverte entradas e saídas quando o banco manda gastos positivos', () => {
    const table = parseCsv('Data;Descrição;Valor\n03/10/2026;Mercado;85,50\n');
    const rows = csvToRows(table, guessColumns(table), true);
    expect(rows[0].amount).toBe(-85.5);
  });

  it('funciona com vírgula como separador e datas ISO', () => {
    const table = parseCsv('date,description,amount\n2026-10-03,Mercado,-85.5\n2026-10-04,Pix recebido,200\n');
    expect(csvToRows(table, guessColumns(table)).map((r) => r.amount)).toEqual([-85.5, 200]);
  });
});
