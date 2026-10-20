import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, Sparkles, Trash2, X, Plus } from 'lucide-react';
import { workDayApi, timeRecordApi, holidayApi } from '../api/client';
import type { WorkDay, TimeRecord, Holiday } from '../types';
import { formatMinutes, formatDate, MONTH_NAMES } from '../utils/format';
import MonthCalendar from '../components/MonthCalendar';
import DayPunchesPanel from '../components/DayPunchesPanel';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  NORMAL: { label: 'Normal', cls: 'badge-green' },
  OVERTIME: { label: 'Hora Extra', cls: 'badge-amber' },
  INCOMPLETE: { label: 'Incompleto', cls: 'badge-red' },
  COMPENSATED: { label: 'Folga Comp.', cls: 'badge-green' },
  HOLIDAY: { label: 'Feriado', cls: 'badge-purple' },
  DAY_OFF: { label: 'Folga', cls: 'badge-muted' },
  ABSENT: { label: 'Falta', cls: 'badge-red' },
};

export default function Ponto() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
  const [selectedDay, setSelectedDay] = useState<WorkDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Modal de Feriados
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [newHolDate, setNewHolDate] = useState('');
  const [newHolName, setNewHolName] = useState('');
  const [savingNewHol, setSavingNewHol] = useState(false);
  const [populatingHols, setPopulatingHols] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wds, recs, hols] = await Promise.all([
        workDayApi.getByMonth(year, month),
        timeRecordApi.getByMonth(year, month),
        holidayApi.getAll(year).catch(() => [] as Holiday[]),
      ]);
      setHolidays(hols);

      // Injetar sábados e feriados — seguem o MÊS CALENDÁRIO
      const calMonthStart = new Date(year, month - 1, 1);
      const calMonthEnd = new Date(year, month, 0); // último dia do mês
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fullHistory = [...wds];
      const historyDates = new Set(wds.map((w: any) => w.date));
      const holidayDates = new Set(hols.map(h => h.date));

      // Injetar feriados do mês que ainda não possuem registro de workDay
      hols.forEach(h => {
        if (!historyDates.has(h.date)) {
          const hDate = new Date(h.date + 'T00:00:00');
          if (hDate >= calMonthStart && hDate <= calMonthEnd) {
            fullHistory.push({
              id: -hDate.getTime() - 1000,
              date: h.date,
              workedMinutes: 0,
              contractMinutes: 0,
              overtimeMinutes: 0,
              overtimeValue: 0,
              isSaturday: hDate.getDay() === 6,
              overtimeNotified: false,
              status: 'HOLIDAY',
              holidayName: h.name,
            } as WorkDay);
          }
        }
      });

      // Coletar sábados decorridos que não tiveram batida registrada e NÃO são feriados
      const unworkedSaturdays: Date[] = [];
      for (let d = new Date(calMonthStart); d <= calMonthEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6 && d <= today) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!historyDates.has(dateStr) && !holidayDates.has(dateStr)) {
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

  const handleToggleHoliday = async (date: string, isHoliday: boolean, name?: string) => {
    try {
      if (isHoliday) {
        await holidayApi.create({ date, name: name || 'Feriado' });
      } else {
        await holidayApi.deleteByDate(date);
      }
      await loadData();
    } catch (e: any) {
      alert(`Erro: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolDate || !newHolName.trim()) return alert('Preencha data e nome do feriado!');
    setSavingNewHol(true);
    try {
      await holidayApi.create({ date: newHolDate, name: newHolName.trim() });
      setNewHolDate('');
      setNewHolName('');
      await loadData();
    } catch (e: any) {
      alert(`Erro ao adicionar feriado: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingNewHol(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!window.confirm('Excluir este feriado?')) return;
    try {
      await holidayApi.delete(id);
      await loadData();
    } catch (e: any) {
      alert(`Erro ao excluir: ${e.response?.data?.error || e.message}`);
    }
  };

  const handlePopulateNational = async () => {
    if (!window.confirm(`Deseja importar e sincronizar os feriados nacionais de ${year}?`)) return;
    setPopulatingHols(true);
    try {
      await holidayApi.populateNational(year);
      await loadData();
    } catch (e: any) {
      alert(`Erro ao importar: ${e.response?.data?.error || e.message}`);
    } finally {
      setPopulatingHols(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Horas extras reais trabalhadas além da jornada contratual diária
  const grossOvertime = workDays
    .filter(w => w.status !== 'COMPENSATED')
    .reduce((a, w) => a + Math.max(0, w.overtimeMinutes ?? 0), 0);

  const missingSaturdaysCount = workDays.filter(w => w.status === 'ABSENT' && w.isSaturday).length;
  const missingMinutes = missingSaturdaysCount * 240;

  // As folgas compensadas já estão quitadas na escala. Apenas faltas reais são deduzidas:
  const netOvertime = Math.max(0, grossOvertime - missingMinutes);
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

      {/* Resumo do mês em ribbon de 3 colunas perfeitamente equilibrado */}
      <div className="dash-metrics-strip" style={{ marginBottom: 16 }}>
        <div className="dash-metric-card purple">
          <div className="metric-head">
            <span>⏱ Trabalhado</span>
          </div>
          <div className="metric-val">{formatMinutes(totalWorked)}</div>
          <div className="metric-foot">Carga do ciclo</div>
        </div>

        <div className="dash-metric-card amber">
          <div className="metric-head">
            <span>⚡ Extras Líquidas</span>
          </div>
          <div className="metric-val">{formatMinutes(netOvertime)}</div>
          <div className="metric-foot amber">Brutas: +{formatMinutes(grossOvertime)}</div>
        </div>

        <div className="dash-metric-card green">
          <div className="metric-head">
            <span>📅 Dias Fechados</span>
          </div>
          <div className="metric-val">{workDays.length}</div>
          <div className="metric-foot green">{overtimeDays} com extra</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Painel Esquerdo: Calendário Mensal ou Lista */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <span className="dot" />Dias do mês
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowHolidaysModal(true)}
                style={{ padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                title="Visualizar e gerenciar feriados"
              >
                <Sparkles size={13} style={{ color: '#a78bfa' }} />
                Feriados ({holidays.length})
              </button>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 3, borderRadius: 8 }}>
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
          </div>

          {loading ? (
            <div className="loading-page" style={{ minHeight: 280 }}><div className="loading-spinner" /></div>
          ) : viewMode === 'calendar' ? (
            <MonthCalendar
              year={year}
              month={month}
              workDays={workDays}
              holidays={holidays}
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
                  const isHolidayDay = w.status === 'HOLIDAY';
                  const isSelected = selectedDate === w.date;
                  return (
                    <div
                      key={w.id}
                      onClick={() => handleSelectDate(w.date, w)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: isSelected ? 'rgba(16,185,129,0.08)' : isHolidayDay ? 'rgba(139,92,246,0.06)' : isCompensated ? 'rgba(16,185,129,0.04)' : w.isSaturday ? 'rgba(251,191,36,0.03)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? 'rgba(16,185,129,0.4)' : isHolidayDay ? 'rgba(139,92,246,0.3)' : isCompensated ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
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
                          <div style={{ fontSize: 14, fontWeight: 600, color: isHolidayDay ? '#a78bfa' : w.isSaturday ? '#fbbf24' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {formatDate(w.date)}
                            {w.isSaturday && (
                              <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 5px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: 3, fontWeight: 700, verticalAlign: 'middle' }}>
                                SÁB
                              </span>
                            )}
                            {isHolidayDay && (
                              <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 5px', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', borderRadius: 3, fontWeight: 700, verticalAlign: 'middle' }}>
                                FERIADO
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {isHolidayDay ? `Feriado oficial: ${w.holidayName || 'Folga remunerada'}` : isCompensated ? 'Folga compensada pela jornada semanal' : `${formatMinutes(w.workedMinutes)} trabalhadas`}
                          </div>
                        </div>
                      </div>

                      {/* Direita: Extra + Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: (w.overtimeMinutes ?? 0) > 0 ? 'var(--accent-amber)' : w.status === 'ABSENT' ? 'var(--accent-red)' : isHolidayDay ? '#a78bfa' : 'var(--text-muted)'
                        }}>
                          {(w.overtimeMinutes ?? 0) > 0 ? `+${formatMinutes(w.overtimeMinutes)}` : w.status === 'ABSENT' ? '-4h' : isHolidayDay ? 'Feriado' : isCompensated ? 'Comp.' : '--'}
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
          {(() => {
            const curHol = holidays.find(h => h.date === selectedDate);
            const isHol = !!curHol || selectedDay?.status === 'HOLIDAY';
            const holName = selectedDay?.holidayName || curHol?.name;
            return (
              <DayPunchesPanel
                selectedDate={selectedDate}
                workDay={selectedDay}
                records={records}
                isHoliday={isHol}
                holidayName={holName}
                onToggleHoliday={handleToggleHoliday}
                onRefresh={loadData}
              />
            );
          })()}
        </div>
      </div>

      {/* Modal de Gestão de Feriados */}
      {showHolidaysModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card, #111827)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg, 12px)',
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🎉</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Feriados ({year})</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowHolidaysModal(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Botão de Auto-Importar Feriados Nacionais */}
              <div style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>Feriados Nacionais Brasileiros</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Preenche automaticamente todas as datas oficiais do ano</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: '#8b5cf6', borderColor: '#7c3aed', fontSize: 11 }}
                  onClick={handlePopulateNational}
                  disabled={populatingHols}
                >
                  <Sparkles size={13} style={{ marginRight: 4 }} />
                  {populatingHols ? 'Importando...' : 'Sincronizar Nacionais'}
                </button>
              </div>

              {/* Formulário para Adicionar Novo Feriado */}
              <form onSubmit={handleAddCustomHoliday} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>+ Adicionar Feriado Personalizado</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    className="form-input input-compact"
                    value={newHolDate}
                    onChange={e => setNewHolDate(e.target.value)}
                    required
                    style={{ flex: 1, minWidth: 130 }}
                  />
                  <input
                    type="text"
                    className="form-input input-compact"
                    placeholder="Nome (ex: Feriado Municipal)"
                    value={newHolName}
                    onChange={e => setNewHolName(e.target.value)}
                    required
                    style={{ flex: 2, minWidth: 160 }}
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary btn-sm"
                    disabled={savingNewHol || !newHolDate || !newHolName.trim()}
                    style={{ fontSize: 12 }}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} />
                    {savingNewHol ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>
              </form>

              {/* Lista de Feriados Cadastrados */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  Feriados cadastrados em {year}:
                </span>
                {holidays.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 12 }}>
                    Nenhum feriado cadastrado para este ano.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                    {holidays.map(h => (
                      <div
                        key={h.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: '#a78bfa' }}>
                            {formatDate(h.date + 'T00:00:00')}
                          </span>
                          <span style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                          {h.isNational && (
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                              Nacional
                            </span>
                          )}
                        </div>
                        <button
                          className="icon-btn danger"
                          onClick={() => handleDeleteHoliday(h.id)}
                          title="Excluir feriado"
                          style={{ width: 28, height: 28 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowHolidaysModal(false)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
