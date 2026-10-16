import React from 'react';
import type { WorkDay } from '../types';
import { formatMinutes } from '../utils/format';

export interface MonthCalendarProps {
  year: number;
  month: number;
  workDays: WorkDay[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string, workDay: WorkDay | null) => void;
}

export default function MonthCalendar({
  year,
  month,
  workDays,
  selectedDate,
  onSelectDate,
}: MonthCalendarProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Dom, 1 = Seg, ...
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const workDaysByDate = new Map<string, WorkDay>();
  workDays.forEach(w => workDaysByDate.set(w.date, w));

  const calendarSlots: Array<{
    day: number;
    dateStr: string;
    dayOfWeek: number;
    isToday: boolean;
    isFuture: boolean;
    isSunday: boolean;
    workDay?: WorkDay;
  } | null> = [];

  // Espaços vazios antes do dia 1
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarSlots.push(null);
  }

  // Dias do mês
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const isToday = dateStr === todayStr;
    const isFuture = dateObj > todayObj;
    const isSunday = dayOfWeek === 0;
    const workDay = workDaysByDate.get(dateStr);

    calendarSlots.push({
      day,
      dateStr,
      dayOfWeek,
      isToday,
      isFuture,
      isSunday,
      workDay,
    });
  }

  return (
    <div>
      {/* Cabeçalho dos dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8, textAlign: 'center' }}>
        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, idx) => (
          <div
            key={d}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: idx === 0 ? 'var(--text-muted)' : idx === 6 ? '#fbbf24' : 'var(--text-secondary)',
              padding: '4px 0',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grade de dias do calendário */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {calendarSlots.map((slot, idx) => {
          if (!slot) {
            return <div key={`empty-${idx}`} style={{ minHeight: 64, opacity: 0.15 }} />;
          }

          const { day, dateStr, dayOfWeek, isToday, isFuture, isSunday, workDay } = slot;
          const isSelected = selectedDate === dateStr;

          // Lógica de cores:
          // Verdinho: dias cumpridos corretamente / folgas compensadas
          // Vermelho: incompleto / faltando horas / faltas
          // Neutro: DSR e dias futuros
          let bg = 'rgba(255, 255, 255, 0.02)';
          let borderColor = 'var(--border)';
          let numColor = 'var(--text-primary)';
          let subText = '--';
          let badgeText = '';
          let badgeColor = 'var(--text-muted)';
          let isGreen = false;
          let isRed = false;

          if (isFuture) {
            borderColor = 'rgba(255, 255, 255, 0.06)';
            numColor = 'var(--text-muted)';
            subText = '';
          } else if (isSunday) {
            borderColor = 'rgba(255, 255, 255, 0.06)';
            numColor = 'var(--text-muted)';
            subText = 'DSR';
          } else if (workDay?.status === 'COMPENSATED') {
            // SÁBADO DE FOLGA COMPENSADA -> VERDINHO!
            isGreen = true;
            bg = 'rgba(16, 185, 129, 0.12)';
            borderColor = 'rgba(16, 185, 129, 0.4)';
            numColor = '#34d399';
            subText = 'Compensado';
            badgeText = 'Folga Comp.';
            badgeColor = '#34d399';
          } else if (workDay?.status === 'INCOMPLETE') {
            // JORNADA INCOMPLETA -> VERMELHO!
            isRed = true;
            bg = 'rgba(239, 68, 68, 0.12)';
            borderColor = 'rgba(239, 68, 68, 0.45)';
            numColor = '#f87171';
            subText = formatMinutes(workDay.workedMinutes);
            badgeText = 'Incompleto';
            badgeColor = '#f87171';
          } else if (workDay?.status === 'ABSENT') {
            // FALTA REAL -> VERMELHO!
            isRed = true;
            bg = 'rgba(239, 68, 68, 0.12)';
            borderColor = 'rgba(239, 68, 68, 0.45)';
            numColor = '#f87171';
            subText = 'Falta';
            badgeText = '-4h';
            badgeColor = '#f87171';
          } else if (workDay && (workDay.workedMinutes ?? 0) > 0) {
            const contract = workDay.contractMinutes || (dayOfWeek === 6 ? 240 : 480);
            const isFullyWorked = workDay.workedMinutes >= contract;

            if (isFullyWorked) {
              // CONCLUÍDO CORRETAMENTE -> VERDINHO!
              isGreen = true;
              bg = 'rgba(16, 185, 129, 0.12)';
              borderColor = 'rgba(16, 185, 129, 0.35)';
              numColor = '#34d399';
              subText = formatMinutes(workDay.workedMinutes);
              badgeText = workDay.overtimeMinutes > 0 ? `+${formatMinutes(workDay.overtimeMinutes)}` : 'OK';
              badgeColor = workDay.overtimeMinutes > 0 ? 'var(--accent-amber)' : '#34d399';
            } else {
              // FALTANDO HORAS -> VERMELHO!
              isRed = true;
              bg = 'rgba(239, 68, 68, 0.12)';
              borderColor = 'rgba(239, 68, 68, 0.45)';
              numColor = '#f87171';
              subText = formatMinutes(workDay.workedMinutes);
              badgeText = 'Faltando';
              badgeColor = '#f87171';
            }
          } else if (!isFuture && !isSunday) {
            // DIA ÚTIL PASSADO SEM BATIDA -> VERMELHO!
            isRed = true;
            bg = 'rgba(239, 68, 68, 0.08)';
            borderColor = 'rgba(239, 68, 68, 0.3)';
            numColor = '#f87171';
            subText = 'Sem batida';
            badgeText = 'Falta';
            badgeColor = '#f87171';
          }

          return (
            <div
              key={dateStr}
              onClick={() => onSelectDate(dateStr, workDay ?? null)}
              style={{
                minHeight: 64,
                padding: '6px 7px',
                background: isSelected
                  ? (isGreen ? 'rgba(16,185,129,0.22)' : isRed ? 'rgba(239,68,68,0.22)' : 'rgba(59,130,246,0.2)')
                  : bg,
                border: `1.5px solid ${isSelected ? (isGreen ? '#10b981' : isRed ? '#ef4444' : '#3b82f6') : borderColor}`,
                boxShadow: isSelected
                  ? `0 0 10px ${isGreen ? 'rgba(16,185,129,0.3)' : isRed ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`
                  : 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              {/* Linha superior: Dia + Indicador Hoje / Sáb */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: numColor }}>
                  {String(day).padStart(2, '0')}
                </span>
                {isToday ? (
                  <span style={{ fontSize: 9, padding: '1px 4px', background: '#3b82f6', color: '#fff', borderRadius: 3, fontWeight: 700 }}>
                    HOJE
                  </span>
                ) : dayOfWeek === 6 ? (
                  <span style={{ fontSize: 8, padding: '1px 3px', background: 'rgba(251,191,36,0.2)', color: '#fbbf24', borderRadius: 3, fontWeight: 700 }}>
                    SÁB
                  </span>
                ) : null}
              </div>

              {/* Linha intermediária: Horas ou status */}
              <div style={{ fontSize: 10, color: isGreen ? '#a7f3d0' : isRed ? '#fca5a5' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                {subText}
              </div>

              {/* Linha inferior: Mini tag de status/extra */}
              {badgeText && (
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: badgeColor,
                  background: isGreen ? 'rgba(16,185,129,0.15)' : isRed ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                  borderRadius: 3,
                  padding: '1px 3px',
                  textAlign: 'center',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {badgeText}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda do Calendário */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, marginTop: 14, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Trabalhado / Folga Compensada</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Incompleto / Faltando Horas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)' }}>DSR / Futuro</span>
        </div>
      </div>
    </div>
  );
}
