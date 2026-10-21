import React from 'react';
import type { WorkDay, Holiday } from '../types';
import { formatMinutes } from '../utils/format';
import { getCycleRange, formatDateIso } from '../utils/cycle';

export interface MonthCalendarProps {
  year: number;
  month: number;
  cutDay?: number;
  workDays: WorkDay[];
  holidays?: Holiday[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string, workDay: WorkDay | null) => void;
}

export default function MonthCalendar({
  year,
  month,
  cutDay = 21,
  workDays,
  holidays = [],
  selectedDate,
  onSelectDate,
}: MonthCalendarProps) {
  const { startDate, endDate } = getCycleRange(year, month, cutDay);

  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const todayStr = formatDateIso(todayObj);

  const workDaysByDate = new Map<string, WorkDay>();
  workDays.forEach(w => workDaysByDate.set(w.date, w));

  const holidaysByDate = new Map<string, Holiday>();
  holidays.forEach(h => holidaysByDate.set(h.date, h));

  const calendarSlots: Array<{
    day: number;
    monthAbbr: string;
    isMonthBoundary: boolean;
    dateStr: string;
    dayOfWeek: number;
    isToday: boolean;
    isFuture: boolean;
    isSunday: boolean;
    workDay?: WorkDay;
  } | null> = [];

  // Espaços vazios antes do dia de início do ciclo (alinhando com DOM, SEG, ...)
  const firstDayOfWeek = startDate.getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarSlots.push(null);
  }

  const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Percorrer exatamente os dias do ciclo financeiro (ex: 21 de um mês até 20 do mês seguinte)
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const dateStr = formatDateIso(cur);
    const day = cur.getDate();
    const dayOfWeek = cur.getDay();
    const isToday = dateStr === todayStr;
    const isFuture = cur > todayObj;
    const isSunday = dayOfWeek === 0;
    const isMonthBoundary = (cur.getTime() === startDate.getTime()) || (day === 1);
    const monthAbbr = MONTH_SHORT[cur.getMonth()];
    const workDay = workDaysByDate.get(dateStr);

    calendarSlots.push({
      day,
      monthAbbr,
      isMonthBoundary,
      dateStr,
      dayOfWeek,
      isToday,
      isFuture,
      isSunday,
      workDay,
    });

    cur.setDate(cur.getDate() + 1);
  }

  // Preencher espaços vazios até fechar a linha da última semana
  const lastDayOfWeek = endDate.getDay();
  for (let i = lastDayOfWeek + 1; i <= 6; i++) {
    calendarSlots.push(null);
  }

  return (
    <div>
      {/* Cabeçalho dos dias da semana */}
      <div className="cal-weekdays">
        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, idx) => (
          <div key={d} className={`cal-wd${idx === 0 ? ' sun' : idx === 6 ? ' sat' : ''}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Grade de dias do calendário baseada no ciclo */}
      <div className="cal-grid">
        {calendarSlots.map((slot, idx) => {
          if (!slot) {
            return <div key={`empty-${idx}`} className="cal-cell empty" aria-hidden="true" />;
          }

          const { day, monthAbbr, isMonthBoundary, dateStr, dayOfWeek, isToday, isFuture, isSunday, workDay } = slot;
          const isSelected = selectedDate === dateStr;

          const toShortHours = (mins: number) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            if (h === 0) return `${m}m`;
            if (m === 0) return `${h}h`;
            return `${h}h${String(m).padStart(2, '0')}`;
          };

          let tone = '';
          let subText = '--';
          let badgeText = '';
          let badgeColor: string | undefined;

          const holiday = holidaysByDate.get(dateStr);
          const isHoliday = workDay?.status === 'HOLIDAY' || !!holiday;
          const holidayName = workDay?.holidayName || holiday?.name || 'Feriado';

          if (isFuture) {
            tone = 'future';
            subText = '';
          } else if (isHoliday) {
            if (workDay && (workDay.workedMinutes ?? 0) > 0) {
              tone = 'green';
              subText = toShortHours(workDay.workedMinutes);
              badgeText = workDay.overtimeMinutes > 0 ? `+${toShortHours(workDay.overtimeMinutes)}` : 'OK';
              badgeColor = workDay.overtimeMinutes > 0 ? 'var(--accent-amber)' : '#34d399';
            } else {
              tone = 'holiday';
              subText = holidayName.length > 9 ? holidayName.substring(0, 9) + '…' : holidayName;
              badgeText = 'Feriado';
              badgeColor = '#a78bfa';
            }
          } else if (isSunday) {
            tone = 'sunday';
            subText = 'DSR';
          } else if (workDay?.status === 'COMPENSATED') {
            tone = 'green';
            subText = '-4h';
            badgeText = 'Comp.';
            badgeColor = '#34d399';
          } else if (workDay?.status === 'INCOMPLETE') {
            tone = 'red';
            subText = toShortHours(workDay.workedMinutes);
            badgeText = 'Incomp.';
            badgeColor = '#f87171';
          } else if (workDay?.status === 'ABSENT') {
            tone = 'red';
            subText = 'Falta';
            badgeText = '-4h';
            badgeColor = '#f87171';
          } else if (workDay && (workDay.workedMinutes ?? 0) > 0) {
            const contract = workDay.contractMinutes || (dayOfWeek === 6 ? 240 : 480);
            const isFullyWorked = workDay.workedMinutes >= contract;

            if (isFullyWorked) {
              tone = 'green';
              subText = toShortHours(workDay.workedMinutes);
              badgeText = workDay.overtimeMinutes > 0 ? `+${toShortHours(workDay.overtimeMinutes)}` : 'OK';
              badgeColor = workDay.overtimeMinutes > 0 ? 'var(--accent-amber)' : '#34d399';
            } else {
              tone = 'red';
              subText = toShortHours(workDay.workedMinutes);
              badgeText = 'Falta';
              badgeColor = '#f87171';
            }
          } else {
            tone = 'red soft';
            subText = '--';
            badgeText = 'Falta';
            badgeColor = '#f87171';
          }

          const label = `Dia ${day} de ${monthAbbr}${subText ? `, ${subText}` : ''}${badgeText ? `, ${badgeText}` : ''}`;

          return (
            <button
              type="button"
              key={dateStr}
              onClick={() => onSelectDate(dateStr, workDay ?? null)}
              className={`cal-cell ${tone}${isSelected ? ' selected' : ''}`}
              aria-label={label}
              aria-pressed={isSelected}
            >
              {/* Linha superior: Dia + identificador do mês na transição */}
              <div className="cal-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span className={`cal-day${isToday ? ' today' : ''}${dayOfWeek === 6 ? ' sat' : ''}`}>
                  {day}
                </span>
                {isMonthBoundary && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: isToday ? '#10b981' : 'var(--text-secondary)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    padding: '1px 5px',
                    borderRadius: 3,
                  }}>
                    {monthAbbr}
                  </span>
                )}
              </div>

              {/* Linha intermediária: Horas ou status */}
              <div className="cal-sub">{subText}</div>

              {/* Linha inferior: Mini tag de status/extra */}
              {badgeText && (
                <div className="cal-badge" style={{ color: badgeColor }}>
                  {badgeText}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda do Calendário */}
      <div className="cal-legend">
        <div className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: '#10b981' }} />
          <span>Trabalhado / −4h Compensado</span>
        </div>
        <div className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: '#8b5cf6' }} />
          <span>Feriado</span>
        </div>
        <div className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: '#ef4444' }} />
          <span>Incompleto / Faltando Horas</span>
        </div>
        <div className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <span>DSR / Futuro</span>
        </div>
      </div>
    </div>
  );
}
