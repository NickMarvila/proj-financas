import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { workDayApi, timeRecordApi } from '../api/client';
import type { WorkDay, TimeRecord } from '../types';
import { formatMinutes, formatCurrency, formatDate, formatTime, MONTH_NAMES } from '../utils/format';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  NORMAL: { label: 'Normal', cls: 'badge-green' },
  OVERTIME: { label: 'Hora Extra', cls: 'badge-amber' },
  INCOMPLETE: { label: 'Incompleto', cls: 'badge-red' },
  DAY_OFF: { label: 'Sáb Livre', cls: 'badge-muted' },
  ABSENT: { label: 'Falta', cls: 'badge-red' },
};

export default function Ponto() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState<WorkDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      workDayApi.getByMonth(year, month),
      timeRecordApi.getByMonth(year, month),
    ]).then(([wds, recs]) => {
      // Inject missing Saturdays — Sábados seguem o MÊS CALENDÁRIO, não o ciclo 21-20
      const calMonthStart = new Date(year, month - 1, 1);
      const calMonthEnd = new Date(year, month, 0); // último dia do mês
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fullHistory = [...wds];
      const historyDates = new Set(wds.map((w: any) => w.date));

      for (let d = new Date(calMonthStart); d <= calMonthEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6 && d <= today) { // Saturday and past/present
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!historyDates.has(dateStr)) {
            fullHistory.push({
              id: -d.getTime(), // temp negative id
              date: dateStr,
              workedMinutes: 0,
              contractMinutes: 240,
              overtimeMinutes: 0,
              overtimeValue: 0,
              isSaturday: true,
              overtimeNotified: false,
              status: 'ABSENT'
            } as WorkDay);
          }
        }
      }

      fullHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setWorkDays(fullHistory);
      setRecords(recs);
    }).finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const dayRecords = (date: string) => records.filter(r => r.timestamp.startsWith(date));

  const totalOvertime = workDays.reduce((a, w) => {
    const isUnworkedSaturday = w.isSaturday && (w.workedMinutes === 0 || w.status === 'ABSENT' || w.status === 'DAY_OFF');
    return a + (isUnworkedSaturday ? -240 : (w.overtimeMinutes ?? 0));
  }, 0);
  const totalWorked = workDays.reduce((a, w) => a + (w.workedMinutes ?? 0), 0);
  const overtimeDays = workDays.filter(w => (w.overtimeMinutes ?? 0) > 0).length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Registros de Ponto</h1>
          <p className="page-subtitle">Histórico de batidas e horas trabalhadas</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, minWidth: 130, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button className="btn btn-secondary btn-icon" onClick={nextMonth}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Resumo do mês */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card purple">
          <div className="stat-icon" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple-light)' }}>⏱</div>
          <div className="stat-label">Total Trabalhado</div>
          <div className="stat-value purple">{formatMinutes(totalWorked)}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>⚡</div>
          <div className="stat-label">Horas Extras</div>
          <div className="stat-value amber">{formatMinutes(totalOvertime)}</div>
          <div className="stat-sub">{overtimeDays} dia(s) com extra</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><span>📅</span></div>
          <div className="stat-label">Dias Registrados</div>
          <div className="stat-value green">{workDays.length}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Lista de dias */}
        <div className="card">
          <div className="section-title"><span className="dot" />Dias do mês</div>
          {loading ? <div className="loading-page" style={{ minHeight: 200 }}><div className="loading-spinner" /></div> : (
            workDays.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🗓️</div><p>Nenhum registro neste mês</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {workDays.map(w => {
                  const s = STATUS_MAP[w.status] ?? STATUS_MAP.NORMAL;
                  const isUnworkedSaturday = w.isSaturday && (w.workedMinutes === 0 || w.status === 'ABSENT' || w.status === 'DAY_OFF');
                  const isSelected = selectedDay?.id === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedDay(w)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: isSelected ? 'rgba(16,185,129,0.08)' : w.isSaturday ? 'rgba(251,191,36,0.03)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Left: Date + Status badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: w.isSaturday ? '#fbbf24' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {formatDate(w.date)}
                            {w.isSaturday && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 5px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: 3, fontWeight: 700, verticalAlign: 'middle' }}>SÁB</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {formatMinutes(w.workedMinutes)} trabalhadas
                          </div>
                        </div>
                      </div>
                      {/* Right: Extra + Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: (w.overtimeMinutes ?? 0) > 0 ? 'var(--accent-amber)' : isUnworkedSaturday ? 'var(--accent-red)' : 'var(--text-muted)'
                        }}>
                          {(w.overtimeMinutes ?? 0) > 0 ? `+${formatMinutes(w.overtimeMinutes)}` : isUnworkedSaturday ? '-4h' : '--'}
                        </span>
                        <span className={`badge ${isUnworkedSaturday ? 'badge-red' : s.cls}`} style={{ fontSize: 10 }}>
                          {isUnworkedSaturday ? 'Falta' : s.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Batidas do dia selecionado */}
        <div className="card">
          <div className="section-title">
            <span className="dot" />
            {selectedDay ? `Batidas — ${formatDate(selectedDay.date + 'T00:00:00')}` : 'Selecione um dia'}
          </div>
          {!selectedDay ? (
            <div className="empty-state"><div className="empty-icon">👆</div><p>Clique em um dia para ver as batidas</p></div>
          ) : (
            <>
              <div className="timeline">
                {dayRecords(selectedDay.date).map(r => (
                  <div key={r.id} className="timeline-item">
                    <div className={`timeline-dot ${r.punchType === 'IN' ? 'in' : 'out'}`} />
                    <div>
                      <div className={`timeline-label ${r.punchType === 'IN' ? 'in' : 'out'}`}>
                        {r.punchType === 'IN' ? '▶ ENTRADA' : '⏹ SAÍDA'}
                      </div>
                      <div className="timeline-time">{formatTime(r.timestamp)}</div>
                      <div className="timeline-origin">{r.origin}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20, padding: '14px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Hora extra do dia</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {formatMinutes(selectedDay.overtimeMinutes)} = {formatCurrency(selectedDay.overtimeValue)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
