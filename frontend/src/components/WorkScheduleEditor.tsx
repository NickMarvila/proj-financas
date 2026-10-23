import React, { useState, useMemo } from 'react';
import { Clock, Plus, Trash2, Copy, Sparkles, Sun, Sunset, ChevronDown } from 'lucide-react';
import { AndroidTimePickerModal } from './AndroidTimePickerModal';

export interface TimeInterval {
  start: string; // "08:00"
  end: string;   // "12:00"
}

export interface DayData {
  key: string;
  name: string;
  short: string;
  isOff: boolean;
  intervals: TimeInterval[];
}

interface WorkScheduleEditorProps {
  values: {
    workMonday?: string;
    workTuesday?: string;
    workWednesday?: string;
    workThursday?: string;
    workFriday?: string;
    workSaturday?: string;
    workSunday?: string;
  };
  monthlyHoursGoal?: number;
  onChange: (updated: {
    workMonday?: string;
    workTuesday?: string;
    workWednesday?: string;
    workThursday?: string;
    workFriday?: string;
    workSaturday?: string;
    workSunday?: string;
  }) => void;
}

const DAY_DEFS = [
  { key: 'workMonday', name: 'Segunda-feira', short: 'Seg' },
  { key: 'workTuesday', name: 'Terça-feira', short: 'Ter' },
  { key: 'workWednesday', name: 'Quarta-feira', short: 'Qua' },
  { key: 'workThursday', name: 'Quinta-feira', short: 'Qui' },
  { key: 'workFriday', name: 'Sexta-feira', short: 'Sex' },
  { key: 'workSaturday', name: 'Sábado', short: 'Sáb' },
  { key: 'workSunday', name: 'Domingo', short: 'Dom' },
];

export function parseScheduleString(str: string | undefined): { isOff: boolean; intervals: TimeInterval[] } {
  if (!str) return { isOff: true, intervals: [] };
  const lower = str.toLowerCase().trim();
  if (
    lower === '' ||
    lower.includes('não') ||
    lower.includes('nao') ||
    lower.includes('folga') ||
    lower.includes('descan')
  ) {
    return { isOff: true, intervals: [] };
  }

  const timeRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
  const matches = [...str.matchAll(timeRegex)].map((m) => {
    const hh = m[1].padStart(2, '0');
    const mm = m[2];
    return `${hh}:${mm}`;
  });

  if (matches.length < 2) {
    return { isOff: true, intervals: [] };
  }

  const intervals: TimeInterval[] = [];
  for (let i = 0; i + 1 < matches.length; i += 2) {
    intervals.push({ start: matches[i], end: matches[i + 1] });
  }

  return { isOff: false, intervals };
}

export function formatScheduleString(isOff: boolean, intervals: TimeInterval[]): string {
  if (isOff || intervals.length === 0) {
    return 'não trabalha';
  }
  return intervals.map((inv) => `${inv.start} as ${inv.end}`).join(' - ');
}

export function calculateIntervalMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatMinutesHuman(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export const WorkScheduleEditor: React.FC<WorkScheduleEditorProps> = ({
  values,
  monthlyHoursGoal = 220,
  onChange,
}) => {
  // Acordeão: Segunda-feira inicia expandida como exemplo, os demais dias iniciam compactos
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({
    workMonday: true,
  });

  const [picker, setPicker] = useState<{
    isOpen: boolean;
    dayKey: string;
    dayName: string;
    shiftIndex: number;
    field: 'start' | 'end';
    initialTime: string;
  }>({
    isOpen: false,
    dayKey: 'workMonday',
    dayName: 'Segunda-feira',
    shiftIndex: 0,
    field: 'start',
    initialTime: '08:00',
  });

  const daysData: DayData[] = useMemo(() => {
    return DAY_DEFS.map((def) => {
      const raw = (values as any)[def.key];
      const parsed = parseScheduleString(raw);
      return {
        key: def.key,
        name: def.name,
        short: def.short,
        isOff: parsed.isOff,
        intervals:
          parsed.intervals.length > 0
            ? parsed.intervals
            : [
                { start: '08:00', end: '12:00' },
                { start: '13:30', end: '18:00' },
              ],
      };
    });
  }, [values]);

  const weeklyMinutes = useMemo(() => {
    let sum = 0;
    daysData.forEach((d) => {
      if (!d.isOff) {
        d.intervals.forEach((inv) => {
          sum += calculateIntervalMinutes(inv.start, inv.end);
        });
      }
    });
    return sum;
  }, [daysData]);

  const toggleExpandDay = (dayKey: string) => {
    setExpandedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  const updateDay = (dayKey: string, isOff: boolean, intervals: TimeInterval[]) => {
    const formatted = formatScheduleString(isOff, intervals);
    onChange({
      ...values,
      [dayKey]: formatted,
    });
    if (!isOff) {
      setExpandedDays((prev) => ({ ...prev, [dayKey]: true }));
    }
  };

  const copyMondayToWeekdays = () => {
    const mon = daysData.find((d) => d.key === 'workMonday');
    if (!mon) return;

    const formatted = formatScheduleString(mon.isOff, mon.intervals);
    onChange({
      ...values,
      workTuesday: formatted,
      workWednesday: formatted,
      workThursday: formatted,
      workFriday: formatted,
    });
  };

  const applyPresetCommercial = () => {
    onChange({
      ...values,
      workMonday: '08:00 as 12:00 - 13:30 as 18:00',
      workTuesday: '08:00 as 12:00 - 13:30 as 18:00',
      workWednesday: '08:00 as 12:00 - 13:30 as 18:00',
      workThursday: '08:00 as 12:00 - 13:30 as 18:00',
      workFriday: '08:00 as 12:00 - 13:30 as 17:30',
      workSaturday: '08:00 as 12:00',
      workSunday: 'não trabalha',
    });
  };

  const applyPreset40h = () => {
    onChange({
      ...values,
      workMonday: '08:00 as 12:00 - 13:00 as 17:00',
      workTuesday: '08:00 as 12:00 - 13:00 as 17:00',
      workWednesday: '08:00 as 12:00 - 13:00 as 17:00',
      workThursday: '08:00 as 12:00 - 13:00 as 17:00',
      workFriday: '08:00 as 12:00 - 13:00 as 17:00',
      workSaturday: 'não trabalha',
      workSunday: 'não trabalha',
    });
  };

  const openTimePicker = (
    dayKey: string,
    dayName: string,
    shiftIndex: number,
    field: 'start' | 'end',
    currentTime: string
  ) => {
    setPicker({
      isOpen: true,
      dayKey,
      dayName,
      shiftIndex,
      field,
      initialTime: currentTime,
    });
  };

  const handleTimeConfirm = (newTime: string) => {
    const day = daysData.find((d) => d.key === picker.dayKey);
    if (!day) return;

    const newIntervals = [...day.intervals];
    if (!newIntervals[picker.shiftIndex]) {
      newIntervals[picker.shiftIndex] = { start: '08:00', end: '12:00' };
    }

    newIntervals[picker.shiftIndex] = {
      ...newIntervals[picker.shiftIndex],
      [picker.field]: newTime,
    };

    updateDay(picker.dayKey, false, newIntervals);
    setPicker((p) => ({ ...p, isOpen: false }));
  };

  return (
    <div className="schedule-editor">
      {/* Top Banner: Resumo Semanal + Ações Rápidas */}
      <div className="schedule-summary-banner">
        <div className="schedule-summary-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span className="text-secondary" style={{ fontSize: 13, fontWeight: 600 }}>
                Carga Semanal Calculada:
              </span>
              <span className="schedule-weekly-pill">
                {formatMinutesHuman(weeklyMinutes)} / semana
              </span>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Média de ~{Math.round((weeklyMinutes * 4.33) / 60)}h mensais (meta configurada: {monthlyHoursGoal}h)
            </p>
          </div>
        </div>

        <div className="schedule-presets-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyMondayToWeekdays}
            title="Aplica o horário de Segunda-feira para Terça, Quarta, Quinta e Sexta"
          >
            <Copy size={14} className="text-green" />
            Replicar Seg p/ Ter–Sex
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={applyPresetCommercial}
          >
            <Sparkles size={14} className="text-amber" />
            Escala 6×1 Compensada
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={applyPreset40h}
          >
            <Sparkles size={14} className="text-purple" />
            Predefinir 40h (Seg–Sex)
          </button>
        </div>

        <div className="schedule-callout">
          <Sparkles size={16} className="text-green" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Acordo de Compensação 6×1:</strong> Os +30 min diários de Seg–Qui (8h/mês) compensam 2 sábados de folga. Toque em um dia abaixo para expandir e editar os turnos.
          </span>
        </div>
      </div>

      {/* Lista de Dias em Acordeão Compacto */}
      <div className="schedule-days-list">
        {daysData.map((day) => {
          let dayMinutes = 0;
          if (!day.isOff) {
            day.intervals.forEach((inv) => {
              dayMinutes += calculateIntervalMinutes(inv.start, inv.end);
            });
          }

          const isExpanded = !day.isOff && !!expandedDays[day.key];
          const shiftsSummary = day.isOff
            ? 'Dia de descanso'
            : day.intervals.map((inv) => `${inv.start}–${inv.end}`).join(' • ');

          return (
            <div
              key={day.key}
              className={`schedule-day-card${day.isOff ? ' is-off' : ''}`}
            >
              <div className="schedule-day-header">
                <button
                  type="button"
                  className="schedule-day-trigger"
                  onClick={() => {
                    if (day.isOff) {
                      updateDay(day.key, false, day.intervals);
                    } else {
                      toggleExpandDay(day.key);
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  <div className="schedule-day-badge">{day.short}</div>
                  <div className="schedule-day-info">
                    <div className="schedule-day-title-row">
                      <span className="schedule-day-name">{day.name}</span>
                      {!day.isOff && (
                        <span className="schedule-day-hours-badge">
                          {formatMinutesHuman(dayMinutes)}
                        </span>
                      )}
                    </div>
                    <span className="schedule-day-summary-text">{shiftsSummary}</span>
                  </div>
                  {!day.isOff && (
                    <ChevronDown
                      size={18}
                      className={`chevron-arrow${isExpanded ? ' open' : ''}`}
                    />
                  )}
                </button>

                <div className="schedule-day-controls">
                  <button
                    type="button"
                    onClick={() => updateDay(day.key, false, day.intervals)}
                    className={`schedule-status-btn${!day.isOff ? ' active-work' : ''}`}
                  >
                    Trabalha
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDay(day.key, true, day.intervals)}
                    className={`schedule-status-btn${day.isOff ? ' active-off' : ''}`}
                  >
                    Folga
                  </button>
                </div>
              </div>

              {!day.isOff && isExpanded && (
                <div className="schedule-day-body">
                  {day.intervals.map((inv, idx) => {
                    const shiftMinutes = calculateIntervalMinutes(inv.start, inv.end);
                    const isMorning = idx === 0;

                    return (
                      <div key={idx} className="schedule-shift-row">
                        <div className="schedule-shift-label">
                          {isMorning ? (
                            <Sun size={15} className="text-amber" />
                          ) : (
                            <Sunset size={15} className="text-purple" />
                          )}
                          <span>{isMorning ? '1º Turno (Manhã)' : '2º Turno (Tarde)'}</span>
                        </div>

                        <div className="schedule-shift-pickers">
                          <div className="schedule-time-field">
                            <span className="schedule-time-field-label">Entrada</span>
                            <button
                              type="button"
                              className="schedule-time-btn"
                              onClick={() =>
                                openTimePicker(
                                  day.key,
                                  `${day.name} • ${isMorning ? '1º Turno' : '2º Turno'}`,
                                  idx,
                                  'start',
                                  inv.start
                                )
                              }
                            >
                              <Clock size={14} className="text-green" />
                              {inv.start}
                            </button>
                          </div>

                          <span className="text-muted" style={{ fontSize: 13, marginTop: 16 }}>
                            até
                          </span>

                          <div className="schedule-time-field">
                            <span className="schedule-time-field-label">Saída</span>
                            <button
                              type="button"
                              className="schedule-time-btn"
                              onClick={() =>
                                openTimePicker(
                                  day.key,
                                  `${day.name} • ${isMorning ? '1º Turno' : '2º Turno'}`,
                                  idx,
                                  'end',
                                  inv.end
                                )
                              }
                            >
                              <Clock size={14} className="text-green" />
                              {inv.end}
                            </button>
                          </div>
                        </div>

                        <div className="schedule-shift-meta">
                          <span className="schedule-shift-duration">
                            ({formatMinutesHuman(shiftMinutes)})
                          </span>

                          {idx > 0 && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => {
                                const newInvs = day.intervals.filter((_, i) => i !== idx);
                                updateDay(day.key, false, newInvs);
                              }}
                              title="Remover este turno"
                              aria-label="Remover este turno"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {day.intervals.length === 1 && (
                    <button
                      type="button"
                      className="schedule-add-shift-btn"
                      onClick={() => {
                        const newInvs = [
                          ...day.intervals,
                          { start: '13:30', end: '18:00' },
                        ];
                        updateDay(day.key, false, newInvs);
                      }}
                    >
                      <Plus size={15} />
                      Adicionar 2º Turno (Pós-Almoço / Tarde)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AndroidTimePickerModal
        isOpen={picker.isOpen}
        initialTime={picker.initialTime}
        title="Definir Horário"
        subtitle={picker.dayName}
        onConfirm={handleTimeConfirm}
        onClose={() => setPicker((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
};
