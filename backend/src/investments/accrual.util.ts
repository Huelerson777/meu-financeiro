import { Indexer } from '@prisma/client';
import { BacenDataPoint } from './rate-sources/bacen.service';

interface AccrualInput {
  indexer: Indexer;
  /** Taxa contratada — % do indexador em CDI/SELIC, spread a.a. em IPCA_PLUS, taxa a.a. fixa em PREFIXADO. */
  rate: number;
  principal: number;
  startDate: Date;
  today: Date;
  /** Série diária do BC (CDI ou SELIC), só necessária pra esses dois indexadores. */
  dailySeries?: BacenDataPoint[];
  /** Série mensal do IPCA, só necessária pro indexador IPCA_PLUS. */
  monthlySeries?: BacenDataPoint[];
}

/**
 * Calcula o valor corrigido de uma posição de renda fixa a partir do
 * principal aportado, do indexador contratado e da série histórica do
 * Banco Central já buscada (ver rate-sources/bacen.service.ts).
 *
 * Convenções assumidas (aproximação — não substitui o extrato oficial):
 * - CDI/SELIC: capitalização diária, usando só os dias em que o BC
 *   publicou taxa (dias úteis, naturalmente — o BC não publica em fins de
 *   semana/feriado). O rendimento começa a contar em D+1 do aporte.
 * - IPCA_PLUS: IPCA acumulado dos meses fechados no período × juros reais
 *   compostos (rate % a.a.) pro-rata em dias corridos/365.
 * - PREFIXADO: juros compostos simples com a taxa a.a. contratada sobre
 *   dias corridos/365 (aproximação por dias corridos — não usa o
 *   calendário de dias úteis/252 do mercado).
 */
export function calculateAccruedValue(input: AccrualInput): number {
  const { indexer, rate, principal, startDate, today } = input;

  switch (indexer) {
    case 'CDI':
    case 'SELIC': {
      const factor = accumulateFactor(input.dailySeries ?? [], startDate, today);
      return round2(principal * Math.pow(factor, rate / 100));
    }
    case 'IPCA_PLUS': {
      const ipcaFactor = accumulateFactor(input.monthlySeries ?? [], startDate, today);
      const spreadFactor = annualCompoundFactor(rate, startDate, today);
      return round2(principal * ipcaFactor * spreadFactor);
    }
    case 'PREFIXADO': {
      return round2(principal * annualCompoundFactor(rate, startDate, today));
    }
    default:
      return round2(principal);
  }
}

function accumulateFactor(series: BacenDataPoint[], startDate: Date, today: Date): number {
  return series
    .filter((p) => p.date > startDate && p.date <= today)
    .reduce((factor, p) => factor * (1 + p.value / 100), 1);
}

function annualCompoundFactor(annualRatePct: number, startDate: Date, today: Date): number {
  const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  return Math.pow(1 + annualRatePct / 100, daysElapsed / 365);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
