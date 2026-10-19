import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon } from 'lucide-react';
import { workDayApi, timeRecordApi } from '../api/client';
import type { WorkDay, TimeRecord } from '../types';
import { formatMinutes, formatDate, MONTH_NAMES } from '../utils/format';
import MonthCalendar from '../components/MonthCalendar';
import DayPunchesPanel from '../components/DayPunchesPanel';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  NORMAL: { label: 'Normal', cls: 'badge-green' },
  OVERTIME: { label: 'Hora Extra', cls: 'badge-amber' },
  INCOMPLETE: { label: 'Incompleto', cls: 'badge-red' },
  COMPENSATED: { label: 'Folga Comp.', cls: 'badge-green' },
  DAY_OFF: { label: 'Folga', cls: 'badge-muted' },
  ABSENT: { label: 'Falta', cls: 'badge-red' },
};

export default function Ponto() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
  const [selectedDay, setSelectedDay] = useState<WorkDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const loadData = async () => {
    setLoading(true);
    try {
      const [wds, recs] = await Promise.all([
        workDayApi.getByMonth(year, month),
        timeRecordApi.getByMonth(year, month),
      ]);

      // Injetar sábados — Sábados seguem o MÊS CALENDÁRIO
      const calMonthStart = new Date(year, month - 1, 1);
      const calMonthEnd = new Date(year, month, 0); // último dia do mês
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fullHistory = [...wds];
      const historyDates = new Set(wds.map((w: any) => w.date));

      // Coletar sábados decorridos que não tiveram batida registrada
      const unworkedSaturdays: Date[] = [];
      for (let d = new Date(calMonthStart); d <= calMonthEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6 && d <= today) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!historyDates.has(dateStr)) {
            unworkedSaturdays.push(new Date(d));
          }
        }
      }

      // Ordenar cronologicamente: os 2 primeiros sábados não trabalhados são folgas compensadas!
      unworkedSaturdays.sort((a, b) => a.getTime() - b.getTime());

      unworkedSaturdays.forEach((d, index) => {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isCompensated = index < 2; // primeiras 2 folgas de sábado são compensadas pelo +30min seg-qui
        fullHistory.push({
          id: -d.getTime(),
          date: dateStr,
          workedMinutes: 0,
          contractMinutes: 240,
          overtimeMinutes: isCompensated ? 0 : -240,
          overtimeValue: 0,
          isSaturday: true,
          overtimeNotified: false,
          status: isCompensated ? 'COMPENSATED' : 'ABSENT',
        } as WorkDay);
      });

      fullHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setWorkDays(fullHistory);
      setRecords(recs);

      // Atualizar dia selecionado
      const currentSelected = fullHistory.find(w => w.date === selectedDate);
      if (currentSelected) {
        setSelectedDay(currentSelected);
      } else {
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const foundToday = fullHistory.find(w => w.date === todayStr);
        if (foundToday) {
          setSelectedDate(todayStr);
          setSelectedDay(foundToday);
        } else if (fullHistory.length > 0) {
          setSelectedDate(fullHistory[0].date);
          setSelectedDay(fullHistory[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Cálculo das horas extras transparentes:
  const grossOvertime = workDays
    .filter(w => w.status !== 'COMPENSATED')
    .reduce((a, w) => a + Math.max(0, w.overtimeMinutes ?? 0), 0);

  const compensatedSaturdaysCount = workDays.filter(w => w.status === 'COMPENSATED').length;
  const compensatedMinutes = compensatedSaturdaysCount * 240;

  const missingSaturdaysCount = workDays.filter(w => w.status === 'ABSENT' && w.isSaturday).length;
  const missingMinutes = missingSaturdaysCount * 240;

  const netOvertime = Math.max(0, grossOvertime - compensatedMinutes - missingMinutes);
  const totalWorked = workDays.reduce((a, w) => a + (w.workedMinutes ?? 0), 0);
  const overtimeDays = workDays.filter(w => (w.overtimeMinutes ?? 0) > 0).length;

  const handleSelectDate = (dateStr: string, workDay: WorkDay | null) => {
    setSelectedDate(dateStr);
    setSelectedDay(workDay);
  };

  return (
    <div>
      <div className="page-header page-header-row">
        <div>
          <h1 className="page-title">Registros de Ponto</h1>
          <p className="page-subtitle">Histórico de batidas e horas trabalhadas</p>
        </div>
        <div className="month-nav">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Mês anterior" onClick={prevMonth}><ChevronLeft size={16} /></button>
          <span className="month-nav-label">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Próximo mês" onClick={nextMonth}><ChevronRight size={16} /></button>
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
          <div className="stat-label">Horas Extras Líquidas</div>
          <div className="stat-value amber">{formatMinutes(netOvertime)}</div>
          <div className="stat-sub">
            Brutas: +{formatMinutes(grossOvertime)} | Comp: −{formatMinutes(compensatedMinutes)}
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon"><span>📅</span></div>
          <div className="stat-label">Dias Registrados</div>
          <div className="stat-value green">{workDays.length}</div>
          <div className="stat-sub">{overtimeDays} dia(s) com horas extras</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Painel Esquerdo: Calendário Mensal ou Lista */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <span className="dot" />Dias do mês
            </div>
            <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', padding: 3, borderRadius: 8 }}>
              <button
                className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: 12, border: 'none' }}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarIcon size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Calendário
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: 12, border: 'none' }}
                onClick={() => setViewMode('list')}
              >
                <ListIcon size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Lista
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-page" style={{ minHeight: 280 }}><div className="loading-spinner" /></div>
          ) : viewMode === 'calendar' ? (
            <MonthCalendar
              year={year}
              month={month}
              workDays={workDays}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          ) : (
            /* Visualização em Lista */
            workDays.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🗓️</div><p>Nenhum registro neste mês</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                {workDays.map(w => {
                  const s = STATUS_MAP[w.status] ?? STATUS_MAP.NORMAL;
                  const isCompensated = w.status === 'COMPENSATED';
                  const isSelected = selectedDate === w.date;
                  return (
                    <div
                      key={w.id}
                      onClick={() => handleSelectDate(w.date, w)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: isSelected ? 'rgba(16,185,129,0.08)' : isCompensated ? 'rgba(16,185,129,0.04)' : w.isSaturday ? 'rgba(251,191,36,0.03)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? 'rgba(16,185,129,0.4)' : isCompensated ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Esquerda: Data + Tipo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: w.isSaturday ? '#fbbf24' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {formatDate(w.date)}
                            {w.isSaturday && (
                              <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 5px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: 3, fontWeight: 700, verticalAlign: 'middle' }}>
                                SÁB
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {isCompensated ? 'Folga compensada pela jornada semanal' : `${formatMinutes(w.workedMinutes)} trabalhadas`}
                          </div>
                        </div>
                      </div>

                      {/* Direita: Extra + Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: (w.overtimeMinutes ?? 0) > 0 ? 'var(--accent-amber)' : w.status === 'ABSENT' ? 'var(--accent-red)' : 'var(--text-muted)'
                        }}>
                          {(w.overtimeMinutes ?? 0) > 0 ? `+${formatMinutes(w.overtimeMinutes)}` : w.status === 'ABSENT' ? '-4h' : isCompensated ? 'Comp.' : '--'}
                        </span>
                        <span className={`badge ${s.cls}`} style={{ fontSize: 10 }}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Painel Direito: Batidas do Dia com Edição, Exclusão e Nova Batida */}
        <div className="card">
          <DayPunchesPanel
            selectedDate={selectedDate}
            workDay={selectedDay}
            records={records}
            onRefresh={loadData}
          />
        </div>
      </div>
    </div>
  );
}
