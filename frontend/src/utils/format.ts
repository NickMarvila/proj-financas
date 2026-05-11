export function formatCurrency(val: number | undefined | null): string {
  if (val == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function formatMinutes(mins: number | undefined | null): string {
  if (!mins) return '0h 00min';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

export function formatDate(iso: string): string {
  if (iso.length === 10 && iso.indexOf('-') === 4) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function monthName(m: number): string {
  return MONTH_NAMES[m - 1] ?? '';
}
