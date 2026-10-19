import React, { useState, useMemo } from 'react';
import { Clock, Plus, Trash2, Copy, Sparkles, Check, Coffee, Sun, Sunset, AlertCircle } from 'lucide-react';
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

/** Parses string from database/form into structured intervals */
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

/** Formats structured intervals back into the canonical system string */
export function formatScheduleString(isOff: boolean, intervals: TimeInterval[]): string {
  if (isOff || intervals.length === 0) {
    return 'não trabalha';
  }
  return intervals.map((inv) => `${inv.start} as ${inv.end}`).join(' - ');
}

/** Calculates total minutes between two HH:MM strings */
export function calculateIntervalMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // handles overnight if applicable
  return diff;
}

/** Formats minutes into "8h 30m" */
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
  // Picker modal state
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

  // Parse days from incoming values
  const daysData: DayData[] = useMemo(() => {
    return DAY_DEFS.map((def) => {
      const raw = (values as any)[def.key];
      const parsed = parseScheduleString(raw);
      return {
        key: def.key,
        name: def.name,
        short: def.short,
        isOff: parsed.isOff,
        intervals: parsed.intervals.length > 0 ? parsed.intervals : [
          { start: '08:00', end: '12:00' },
          { start: '13:30', end: '18:00' }
        ],
      };
    });
  }, [values]);

  // Compute daily and weekly totals
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

  // Update a single day's schedule
  const updateDay = (dayKey: string, isOff: boolean, intervals: TimeInterval[]) => {
    const formatted = formatScheduleString(isOff, intervals);
    onChange({
      ...values,
      [dayKey]: formatted,
    });
  };

  // Replicate Monday's schedule to Tuesday through Friday
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

  // Preset: Standard Commercial (Seg-Qui 08-12 / 13:30-18:00, Sex 08-12 / 13:30-17:30, Sab 08-12, Dom Folga)
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

  // Preset: 40h (Seg-Sex 08-12 / 13:00-17:00, Sab/Dom Folga)
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

  // Open the Android time picker
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

  // Handle confirmation from picker
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Banner: Quick Desktop Actions & Weekly Summary */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Carga Horária Semanal Calculada:
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--accent-green-light)',
                background: 'var(--accent-green-dim)',
                padding: '4px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              {formatMinutesHuman(weeklyMinutes)} / semana
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Média de ~{Math.round((weeklyMinutes * 4.33) / 60)}h mensais (meta configurada: {monthlyHoursGoal}h)
          </p>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyMondayToWeekdays}
            title="Aplica o horário de Segunda-feira para Terça, Quarta, Quinta e Sexta"
            style={{
              fontSize: 12,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Copy size={14} style={{ color: 'var(--accent-green)' }} />
            Replicar Seg p/ Ter-Sex
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={applyPresetCommercial}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-amber)' }} />
            Escala 6x1 Compensada
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={applyPreset40h}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-purple)' }} />
            Predefinir 40h (Seg-Sex)
          </button>
        </div>

        {/* 6x1 Compensation Explanation Callout */}
        <div
          style={{
            width: '100%',
            marginTop: 8,
            padding: '10px 14px',
            background: 'rgba(16, 185, 129, 0.08)',
            borderRadius: '10px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Sparkles size={16} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            <strong>Acordo de Compensação 6x1:</strong> Os +30 min diários de Seg-Qui (8h/mês) compensam 2 sábados de folga. Você precisa cumprir 2 sábados no mês (ou 3 em meses com 5 sábados). Se trabalhar sábados adicionais, as horas extras da semana vêm diretamente no pagamento.
          </span>
        </div>
      </div>

      {/* Days List Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {daysData.map((day) => {
          let dayMinutes = 0;
          if (!day.isOff) {
            day.intervals.forEach((inv) => {
              dayMinutes += calculateIntervalMinutes(inv.start, inv.end);
            });
          }

          return (
            <div
              key={day.key}
              style={{
                background: day.isOff ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.035)',
                border: day.isOff ? '1px solid var(--border)' : '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '16px',
                padding: '16px 20px',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Day Header Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: day.isOff ? 0 : 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Badge for Day of Week */}
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '12px',
                      background: day.isOff ? 'rgba(255, 255, 255, 0.04)' : 'var(--accent-green-dim)',
                      color: day.isOff ? 'var(--text-muted)' : 'var(--accent-green-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      border: day.isOff ? '1px solid var(--border)' : '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {day.short}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {day.name}
                      </span>
                      {!day.isOff && (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--accent-green-light)',
                            background: 'rgba(16, 185, 129, 0.12)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {formatMinutesHuman(dayMinutes)}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {day.isOff ? 'Dia de descanso' : `${day.intervals.length} período(s) de expediente`}
                    </span>
                  </div>
                </div>

                {/* Day Status Toggle (Trabalha vs Folga) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => updateDay(day.key, false, day.intervals)}
                    style={{
                      background: !day.isOff ? 'var(--accent-green)' : 'rgba(255, 255, 255, 0.05)',
                      color: !day.isOff ? '#ffffff' : 'var(--text-secondary)',
                      border: !day.isOff ? '1px solid var(--accent-green)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Trabalha
                  </button>

                  <button
                    type="button"
                    onClick={() => updateDay(day.key, true, day.intervals)}
                    style={{
                      background: day.isOff ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: day.isOff ? '#fca5a5' : 'var(--text-secondary)',
                      border: day.isOff ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Folga
                  </button>
                </div>
              </div>

              {/* Day Body: Shifts / Intervals (Only if working) */}
              {!day.isOff && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  {day.intervals.map((inv, idx) => {
                    const shiftMinutes = calculateIntervalMinutes(inv.start, inv.end);
                    const isMorning = idx === 0;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {/* Shift label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: '120px' }}>
                          {isMorning ? (
                            <Sun size={15} style={{ color: 'var(--accent-amber)' }} />
                          ) : (
                            <Sunset size={15} style={{ color: 'var(--accent-purple)' }} />
                          )}
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {isMorning ? '1º Turno (Manhã)' : '2º Turno (Tarde)'}
                          </span>
                        </div>

                        {/* Android Time Pickers (Entrada -> Saída) */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          {/* Entrada Button */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Entrada
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                openTimePicker(
                                  day.key,
                                  `${day.name} • ${isMorning ? '1º Turno' : '2º Turno'}`,
                                  idx,
                                  'start',
                                  inv.start
                                )
                              }
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: '10px',
                                padding: '6px 12px',
                                color: 'var(--text-primary)',
                                fontSize: 15,
                                fontWeight: 600,
                                fontFamily: 'monospace, sans-serif',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent-green)';
                                e.currentTarget.style.background = 'var(--accent-green-dim)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              }}
                            >
                              <Clock size={14} style={{ color: 'var(--accent-green)' }} />
                              {inv.start}
                            </button>
                          </div>

                          <span style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 14 }}>
                            até
                          </span>

                          {/* Saída Button */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Saída
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                openTimePicker(
                                  day.key,
                                  `${day.name} • ${isMorning ? '1º Turno' : '2º Turno'}`,
                                  idx,
                                  'end',
                                  inv.end
                                )
                              }
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: '10px',
                                padding: '6px 12px',
                                color: 'var(--text-primary)',
                                fontSize: 15,
                                fontWeight: 600,
                                fontFamily: 'monospace, sans-serif',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent-green)';
                                e.currentTarget.style.background = 'var(--accent-green-dim)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              }}
                            >
                              <Clock size={14} style={{ color: 'var(--accent-green)' }} />
                              {inv.end}
                            </button>
                          </div>
                        </div>

                        {/* Shift Duration & Remove Action */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ({formatMinutesHuman(shiftMinutes)})
                          </span>

                          {/* Delete shift button (only if 2nd shift) */}
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newInvs = day.intervals.filter((_, i) => i !== idx);
                                updateDay(day.key, false, newInvs);
                              }}
                              title="Remover este turno"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 6,
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add second shift button if only 1 exists */}
                  {day.intervals.length === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newInvs = [
                          ...day.intervals,
                          { start: '13:30', end: '18:00' },
                        ];
                        updateDay(day.key, false, newInvs);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px dashed var(--border)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        color: 'var(--text-secondary)',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-green)';
                        e.currentTarget.style.color = 'var(--accent-green-light)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <Plus size={14} />
                      Adicionar 2º Turno (Pós-Almoço / Tarde)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Android Clock Picker Modal Dialog */}
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
