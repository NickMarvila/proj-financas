/**
 * Utilitários para gestão de ciclos financeiros de ponto.
 * Padrão da empresa: do dia 21 de um mês até o dia 20 do mês seguinte (cutDay = 21).
 */

export interface CycleRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Retorna o intervalo exato de datas para um ciclo de referência (ano/mês).
 * Ex: ano 2026, mês 11 (Novembro), cutDay 21 -> Início: 21/10/2026, Fim: 20/11/2026.
 */
export function getCycleRange(year: number, month: number, cutDay: number = 21): CycleRange {
  if (cutDay === 1) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return { startDate, endDate };
  }
  const startDate = new Date(year, month - 2, cutDay);
  const endDate = new Date(year, month - 1, cutDay - 1);
  return { startDate, endDate };
}

/**
 * Determina qual é o ciclo de referência atual para uma data.
 * Se dia >= 21, já está no ciclo do próximo mês.
 * Ex: 21 de Outubro pertence ao ciclo de Novembro (21/10 a 20/11).
 */
export function getCurrentCycle(date: Date = new Date(), cutDay: number = 21): { year: number; month: number } {
  if (cutDay === 1) {
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }
  const day = date.getDate();
  if (day >= cutDay) {
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { year: next.getFullYear(), month: next.getMonth() + 1 };
  } else {
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }
}

/**
 * Formata um objeto Date para string no formato YYYY-MM-DD
 */
export function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna string descritiva do período do ciclo. Ex: "21/10 a 20/11"
 */
export function getCyclePeriodStr(year: number, month: number, cutDay: number = 21): string {
  const { startDate, endDate } = getCycleRange(year, month, cutDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dStart = `${pad(startDate.getDate())}/${pad(startDate.getMonth() + 1)}`;
  const dEnd = `${pad(endDate.getDate())}/${pad(endDate.getMonth() + 1)}`;
  return `${dStart} a ${dEnd}`;
}
