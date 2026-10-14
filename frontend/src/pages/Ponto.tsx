import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { workDayApi, timeRecordApi } from '../api/client';
import type { WorkDay, TimeRecord } from '../types';
import { formatMinutes, formatCurrency, formatDate, formatTime, MONTH_NAMES } from '../utils/format';

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
  const [selectedDay, setSelectedDay] = useState<WorkDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      workDayApi.getByMonth(year, month),
      timeRecordApi.getByMonth(year, month),
    ]).then(([wds, recs]) => {
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

      // Auto-selecionar o dia de hoje ou o dia mais recente
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const foundToday = fullHistory.find(w => w.date === todayStr);
      if (foundToday) {
        setSelectedDay(foundToday);
      } else if (fullHistory.length > 0) {
        setSelectedDay(fullHistory[0]);
      }
    }).finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const dayRecords = (date: string) => records.filter(r => r.timestamp.startsWith(date));

  // Cálculo das horas extras transparentes:
  // Horas extras brutas (ganhas durante a semana)
  const grossOvertime = workDays
    .filter(w => w.status !== 'COMPENSATED')
    .reduce((a, w) => a + Math.max(0, w.overtimeMinutes ?? 0), 0);

  // Compensação dos 2 sábados de folga (2 x 4h = 8h = 480 min)
  const compensatedSaturdaysCount = workDays.filter(w => w.status === 'COMPENSATED').length;
  const compensatedMinutes = compensatedSaturdaysCount * 240;

  // Faltas (sábados não compensados ou faltas normais)
  const missingSaturdaysCount = workDays.filter(w => w.status === 'ABSENT' && w.isSaturday).length;
  const missingMinutes = missingSaturdaysCount * 240;

  // Saldo líquido de horas extras
  const netOvertime = Math.max(0, grossOvertime - compensatedMinutes - missingMinutes);
  const totalWorked = workDays.reduce((a, w) => a + (w.workedMinutes ?? 0), 0);
  const overtimeDays = workDays.filter(w => (w.overtimeMinutes ?? 0) > 0).length;

  // Preparação da grade do calendário mensal
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
        {/* Painel Esquerdo: Calendário ou Lista */}
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
            /* VISUALIZAÇÃO EM CALENDÁRIO */
            <div>
              {/* Cabeçalho dos dias da semana */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8, textAlign: 'center' }}>
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, idx) => (
                  <div key={d} style={{ fontSize: 11, fontWeight: 700, color: idx === 0 ? 'var(--text-muted)' : idx === 6 ? '#fbbf24' : 'var(--text-secondary)', padding: '4px 0' }}>
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
                  const isSelected = selectedDay?.date === dateStr;

                  // Lógica de status visual: Verdinho para dias OK/concluídos e folgas compensadas, Vermelho para incompleto/faltas
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
                    // JORNADA INCOMPLETA / FALTANDO HORAS -> VERMELHO!
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
                      // TRABALHADO E CONCLUÍDO CORRETAMENTE -> VERDINHO!
                      isGreen = true;
                      bg = 'rgba(16, 185, 129, 0.12)';
                      borderColor = 'rgba(16, 185, 129, 0.35)';
                      numColor = '#34d399';
                      subText = formatMinutes(workDay.workedMinutes);
                      badgeText = workDay.overtimeMinutes > 0 ? `+${formatMinutes(workDay.overtimeMinutes)}` : 'OK';
                      badgeColor = workDay.overtimeMinutes > 0 ? 'var(--accent-amber)' : '#34d399';
                    } else {
                      // JORNADA COM HORAS A MENOS -> VERMELHO!
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

                  const handleSelect = () => {
                    if (workDay) {
                      setSelectedDay(workDay);
                    } else {
                      setSelectedDay({
                        id: -slot.day,
                        date: dateStr,
                        workedMinutes: 0,
                        contractMinutes: dayOfWeek === 6 ? 240 : isSunday ? 0 : 480,
                        overtimeMinutes: 0,
                        overtimeValue: 0,
                        isSaturday: dayOfWeek === 6,
                        overtimeNotified: false,
                        status: isSunday ? 'DAY_OFF' : 'ABSENT',
                      } as WorkDay);
                    }
                  };

                  return (
                    <div
                      key={dateStr}
                      onClick={handleSelect}
                      style={{
                        minHeight: 64,
                        padding: '6px 7px',
                        background: isSelected ? (isGreen ? 'rgba(16,185,129,0.22)' : isRed ? 'rgba(239,68,68,0.22)' : 'rgba(59,130,246,0.18)') : bg,
                        border: `1.5px solid ${isSelected ? (isGreen ? '#10b981' : isRed ? '#ef4444' : '#3b82f6') : borderColor}`,
                        boxShadow: isSelected ? `0 0 10px ${isGreen ? 'rgba(16,185,129,0.3)' : isRed ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.25)'}` : 'none',
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
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, marginTop: 16, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
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
          ) : (
            /* VISUALIZAÇÃO EM LISTA */
            workDays.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🗓️</div><p>Nenhum registro neste mês</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                {workDays.map(w => {
                  const s = STATUS_MAP[w.status] ?? STATUS_MAP.NORMAL;
                  const isCompensated = w.status === 'COMPENSATED';
                  const isSelected = selectedDay?.id === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedDay(w)}
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

        {/* Painel Direito: Batidas do dia selecionado */}
        <div className="card">
          <div className="section-title">
            <span className="dot" />
            {selectedDay ? `Batidas — ${formatDate(selectedDay.date + 'T00:00:00')}` : 'Selecione um dia'}
          </div>
          {!selectedDay ? (
            <div className="empty-state"><div className="empty-icon">👆</div><p>Clique em um dia no calendário para ver os detalhes</p></div>
          ) : selectedDay.status === 'COMPENSATED' ? (
            /* Detalhe de Sábado de Folga Compensada */
            <div style={{ padding: '20px 0' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '18px',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-green)', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                  <CheckCircle2 size={20} />
                  <span>Sábado de Folga Compensada</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  A jornada deste sábado (08:00 às 12:00, 4h) foi compensada pelos 30 minutos adicionais trabalhados de segunda a quinta-feira durante o mês.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status da Jornada</span>
                  <span className="badge badge-green">Folga Compensada</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Carga Horária Compensada</span>
                  <span style={{ fontWeight: 600 }}>4h 00min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Desconto de Horas</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>R$ 0,00 (0 falta)</span>
                </div>
              </div>
            </div>
          ) : dayRecords(selectedDay.date).length === 0 ? (
            /* Sem batidas registradas nesta data */
            <div style={{ padding: '20px 0' }}>
              <div style={{
                background: selectedDay.status === 'ABSENT' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${selectedDay.status === 'ABSENT' ? 'rgba(239, 68, 68, 0.25)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: selectedDay.status === 'ABSENT' ? 'var(--accent-red)' : 'var(--text-secondary)', fontWeight: 600, fontSize: 14 }}>
                  {selectedDay.status === 'ABSENT' ? <XCircle size={18} /> : <Clock size={18} />}
                  <span>{selectedDay.status === 'ABSENT' ? 'Falta Registrada' : 'Nenhuma Batida'}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 }}>
                  {selectedDay.status === 'ABSENT'
                    ? 'Não foram encontradas batidas para esta jornada obrigatória.'
                    : 'Não há registros de ponto para este dia (DSR ou dia futuro).'}
                </p>
              </div>
            </div>
          ) : (
            /* Batidas normais / horas extras / incompleto */
            <>
              {selectedDay.status === 'INCOMPLETE' && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <AlertTriangle size={18} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#fca5a5' }}>
                    Jornada incompleta: falta registrar batida de saída ou a carga horária não foi atingida.
                  </span>
                </div>
              )}

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

              <div style={{ marginTop: 20, padding: '14px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total trabalhado no dia</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatMinutes(selectedDay.workedMinutes)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Hora extra do dia</span>
                  <span style={{ fontWeight: 700, color: selectedDay.overtimeMinutes > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                    {formatMinutes(selectedDay.overtimeMinutes)} = {formatCurrency(selectedDay.overtimeValue)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
