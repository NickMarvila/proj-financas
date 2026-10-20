import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Wallet, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { dashboardApi, gmailApi, workDayApi, timeRecordApi, holidayApi } from '../api/client';
import type { Dashboard as DashboardData, GmailStatus, WorkDay, TimeRecord, Holiday } from '../types';
import { formatCurrency, formatMinutes, formatDate, MONTH_NAMES } from '../utils/format';
import MonthCalendar from '../components/MonthCalendar';
import DayPunchesPanel from '../components/DayPunchesPanel';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<WorkDay[]>([]);
  const [monthRecords, setMonthRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);

  const todayIso = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedDay, setSelectedDay] = useState<WorkDay | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  
  const [manualDate, setManualDate] = useState(todayIso);
  const [manualTime, setManualTime] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [d, g, recs, hols] = await Promise.all([
        dashboardApi.get(currentMonth.year, currentMonth.month),
        gmailApi.getStatus().catch(() => null),
        timeRecordApi.getByMonth(currentMonth.year, currentMonth.month),
        holidayApi.getAll(currentMonth.year).catch(() => [] as Holiday[]),
      ]);
      setData(d);
      setGmailStatus(g);
      setMonthRecords(recs);
      setHolidays(hols);
      
      const year = d.monthSummary?.year ?? currentMonth.year;
      const month = d.monthSummary?.month ?? currentMonth.month;
      const h = await workDayApi.getByMonth(year, month);
      
      // Injetar sábados — Sábados seguem o MÊS CALENDÁRIO
      const calMonthStart = new Date(year, month - 1, 1);
      const calMonthEnd = new Date(year, month, 0); // último dia do mês
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fullHistory = [...h];
      const historyDates = new Set(h.map((w: any) => w.date));
      const holidayDates = new Set(hols.map(hol => hol.date));

      const unworkedSaturdays: Date[] = [];
      for (let d = new Date(calMonthStart); d <= calMonthEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6 && d <= today) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!historyDates.has(dateStr) && !holidayDates.has(dateStr)) {
            unworkedSaturdays.push(new Date(d));
          }
        }
      }

      unworkedSaturdays.sort((a, b) => a.getTime() - b.getTime());

      unworkedSaturdays.forEach((d, index) => {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isCompensated = index < 2;
        fullHistory.push({
          id: -d.getTime(),
          date: dateStr,
          workedMinutes: 0,
          contractMinutes: 240,
          overtimeMinutes: isCompensated ? 0 : -240,
          overtimeValue: 0,
          isSaturday: true,
          overtimeNotified: false,
          status: isCompensated ? 'COMPENSATED' : 'ABSENT'
        } as WorkDay);
      });

      // Sort history descending by date
      fullHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(fullHistory);

      // Atualizar dia selecionado
      const curSelected = fullHistory.find(w => w.date === selectedDate);
      if (curSelected) {
        setSelectedDay(curSelected);
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentMonth]);

  const handleSync = async () => {
    if (gmailStatus?.status !== 'CONECTADO') {
      return alert('Conecte o Gmail no seu Perfil antes de sincronizar.');
    }
    setSyncing(true);
    try {
      const r = await gmailApi.sync();
      if (r.processed > 0) await load();
      alert(`Sincronizados ${r.processed} e-mail(s).`);
    } catch (e: any) {
      alert(`Erro: ${e.response?.data?.message || e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualPunch = async () => {
    if (!manualTime) return alert('Selecione um horário!');
    setSavingManual(true);
    try {
      const timestamp = `${manualDate}T${manualTime}:00`;
      await timeRecordApi.addManual(timestamp);
      alert('Ponto registrado com sucesso!');
      await load();
      setManualTime('');
    } catch (e: any) {
      alert(`Erro: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingManual(false);
    }
  };

  if (loading) return (
    <div className="loading-page">
      <div className="loading-spinner" />
      <span>Carregando...</span>
    </div>
  );
  if (!data) return <div className="loading-page"><AlertCircle /> Erro ao carregar.</div>;

  const { monthSummary: s, todayWorkDay } = data;
  const overtimeToday = todayWorkDay?.overtimeMinutes ?? 0;
  const totalOvertime = s?.totalOvertimeMinutes ?? 0;

  const getCycleDatesStr = () => {
    const prev = new Date(currentMonth.year, currentMonth.month - 2, 21);
    const curr = new Date(currentMonth.year, currentMonth.month - 1, 20);
    const fd = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${fd(prev)} a ${fd(curr)}`;
  };

  const handleSelectCalendarDate = (dateStr: string, workDay: WorkDay | null) => {
    setSelectedDate(dateStr);
    setSelectedDay(workDay);
  };

  return (
    <div>
      {/* Cabeçalho do Dashboard */}
      <div className="dash-header">
        <div className="dash-header-title-row">
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <span className="dash-subtitle">{getCycleDatesStr()}</span>
          </div>
          <button id="btn-sync-gmail" className="btn btn-secondary btn-sm btn-sync-pill" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={13} className={syncing ? 'spin' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>

        <div className="dash-month-selector">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Mês anterior" onClick={() => setCurrentMonth(prev => prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 })}>
            <ChevronLeft size={16} />
          </button>
          <div className="dash-month-label">
            <span className="month-name">{MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}</span>
            <small>Ciclo Financeiro</small>
          </div>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Próximo mês" onClick={() => setCurrentMonth(prev => prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 })}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Gmail Banner */}
      {gmailStatus && (gmailStatus.status === 'DESCONECTADO' || gmailStatus.status === 'EXPIRED') && (
        <a href="/perfil" style={{ textDecoration: 'none' }}>
          <div style={{ backgroundColor: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} />
              <strong style={{ fontSize: 13 }}>{gmailStatus.status === 'EXPIRED' ? 'Token do Gmail expirado' : 'Gmail desconectado'}</strong>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, textDecoration: 'underline' }}>Reconectar agora</span>
          </div>
        </a>
      )}

      {/* Hero Card: Saldo Projetado */}
      <div className="hero-balance-card">
        <div className="hero-balance-top">
          <span className="hero-balance-tag">Saldo Projetado</span>
          <span className="hero-month-tag">{MONTH_NAMES[currentMonth.month - 1]}</span>
        </div>
        <div className="hero-balance-amount">{formatCurrency(s?.finalBalance ?? 0)}</div>
        <div className="hero-balance-calc">
          <span className="calc-item">Salário <strong>{formatCurrency(s?.baseSalary ?? 0)}</strong></span>
          <span className="calc-sep">+</span>
          <span className="calc-item green">Extras <strong>+{formatCurrency(s?.overtimePay ?? 0)}</strong></span>
          <span className="calc-sep">−</span>
          <span className="calc-item red">Despesas <strong>−{formatCurrency(s?.totalExpenses ?? 0)}</strong></span>
        </div>
      </div>

      {/* Ribbon de Métricas Secundárias (3 colunas compactas) */}
      <div className="dash-metrics-strip">
        <div className="dash-metric-card purple">
          <div className="metric-head">
            <Clock size={13} />
            <span>Extras (Mês)</span>
          </div>
          <div className="metric-val">{formatMinutes(totalOvertime)}</div>
          <div className="metric-foot green">+{formatCurrency(s?.overtimePay ?? 0)}</div>
        </div>

        <div className="dash-metric-card blue">
          <div className="metric-head">
            <TrendingUp size={13} />
            <span>Extras Hoje</span>
          </div>
          <div className="metric-val">{formatMinutes(overtimeToday)}</div>
          <div className="metric-foot">{formatCurrency(todayWorkDay?.overtimeValue ?? 0)}</div>
        </div>

        <div className="dash-metric-card amber">
          <div className="metric-head">
            <Wallet size={13} />
            <span>Despesas</span>
          </div>
          <div className="metric-val">{formatCurrency(s?.totalExpenses ?? 0)}</div>
          <div className="metric-foot red">{s?.missingSaturdays ? `-${s.missingSaturdays} sáb` : 'Fixo mensal'}</div>
        </div>
      </div>

      {/* Card Retrátil de Horários & Compensação de Sábados (Escala 6x1) */}
      <div className="schedule-collapsible">
        <button
          type="button"
          className="schedule-collapsible-btn"
          onClick={() => setShowScheduleDetails(!showScheduleDetails)}
          aria-expanded={showScheduleDetails}
        >
          <div className="schedule-btn-left">
            <div className="schedule-mini-icon">⚖️</div>
            <div className="schedule-btn-texts">
              <div className="schedule-btn-title">
                Escala 6×1: {s?.workedSaturdays ?? 0} de {s?.requiredSaturdays ?? 2} sábados
              </div>
              <div className="schedule-btn-sub">
                Seg–Qui compensam 2 sábados de folga
              </div>
            </div>
          </div>
          <div className="schedule-btn-right">
            <span className="badge badge-green schedule-badge">Comp. −{formatMinutes(s?.compensatedMinutes ?? 480)}</span>
            <ChevronDown size={16} className={`chevron-arrow ${showScheduleDetails ? 'open' : ''}`} />
          </div>
        </button>

        {showScheduleDetails && (
          <div className="schedule-expanded-body">
            <div className="schedule-blocks-grid">
              {/* Seg-Qui */}
              <div className="schedule-block">
                <div className="schedule-block-head">
                  <strong>Segunda a Quinta</strong>
                  <span className="badge-tag amber">+30m compensatórios</span>
                </div>
                <div className="schedule-block-time">08:00 às 12:00 — 13:30 às 18:00</div>
                <div className="schedule-block-desc">8h30 trabalhadas (17:30 às 18:00 compensa sábado de folga)</div>
              </div>

              {/* Sexta */}
              <div className="schedule-block">
                <div className="schedule-block-head">
                  <strong>Sexta-feira</strong>
                  <span className="badge-tag muted">Normal</span>
                </div>
                <div className="schedule-block-time">08:00 às 12:00 — 13:30 às 17:30</div>
                <div className="schedule-block-desc">8h00 trabalhadas (saída 17:30, sem acréscimo)</div>
              </div>

              {/* Sábado */}
              <div className="schedule-block">
                <div className="schedule-block-head">
                  <strong style={{ color: '#fbbf24' }}>Sábado (4h)</strong>
                  <span className="badge-tag green">Trabalho / Folga</span>
                </div>
                <div className="schedule-block-time">08:00 às 12:00</div>
                <div className="schedule-block-desc">2 obrigatórios trabalhados e 2 folgas compensadas</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO PRINCIPAL: Calendário do Mês + Painel de Batidas (com Edição de Pontos) */}
      <div className="grid-2">
        {/* Painel Esquerdo: Calendário Mensal com status verde e vermelho */}
        <div className="card">
          <div className="section-title">
            <span className="dot" />Calendário de Ponto — {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
          </div>
          <MonthCalendar
            year={currentMonth.year}
            month={currentMonth.month}
            workDays={history}
            holidays={holidays}
            selectedDate={selectedDate}
            onSelectDate={handleSelectCalendarDate}
          />
        </div>

        {/* Painel Direito: Batidas do Dia Selecionado com Edição, Exclusão e Nova Batida */}
        <div className="card">
          {(() => {
            const curHol = holidays.find(h => h.date === selectedDate);
            const isHol = !!curHol || selectedDay?.status === 'HOLIDAY';
            const holName = selectedDay?.holidayName || curHol?.name;
            return (
              <DayPunchesPanel
                selectedDate={selectedDate}
                workDay={selectedDay}
                records={monthRecords}
                isHoliday={isHol}
                holidayName={holName}
                onToggleHoliday={async (date, isHoliday, name) => {
                  if (isHoliday) {
                    await holidayApi.create({ date, name: name || 'Feriado' });
                  } else {
                    await holidayApi.deleteByDate(date);
                  }
                  await load();
                }}
                onRefresh={load}
              />
            );
          })()}
        </div>
      </div>

      {/* SEÇÃO INFERIOR: Resumo Financeiro + Lançamento Manual Rápido */}
      <div className="grid-2" style={{ marginTop: 24 }}>
        {/* Resumo financeiro */}
        <div className="card">
          <div className="section-title"><span className="dot" />Resumo do Mês</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Salário Base</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(s?.baseSalary ?? 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 6 }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Horas Extras do Mês</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Horas além da escala contratual diária</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-green)' }}>
                +{formatMinutes(totalOvertime)} ({formatCurrency(s?.overtimePay ?? 0)})
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', background: 'rgba(16, 185, 129, 0.04)', borderRadius: 4, margin: '0 -4px', paddingLeft: 6, paddingRight: 6, flexWrap: 'wrap', gap: 6 }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--accent-green)' }}>Compensação Sábados de Folga</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>2 sábados de folga compensados na jornada de Seg–Qui</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>
                Quitado (Escala)
              </span>
            </div>

            {s?.requiredSaturdays != null && s.requiredSaturdays > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sábados Cumpridos</span>
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: (s?.missingSaturdays ?? 0) === 0 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                  {s.workedSaturdays ?? 0}/{s.requiredSaturdays} obrigatórios ({s.totalSaturdays ?? 4} no mês)
                </span>
              </div>
            )}

            {(s?.missingSaturdays ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: 4, margin: '0 -4px', paddingLeft: 6, paddingRight: 6, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Faltas (Sábados)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>
                  −{(s?.missingSaturdays ?? 0)} sábado(s) = −{(s?.missingSaturdays ?? 0) * 4}h
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Despesas Fixas</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-red)' }}>−{formatCurrency(s?.totalExpenses ?? 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Saldo Final Projetado</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(s?.finalBalance ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Lançamento Manual Avulso */}
        <div className="card">
          <div className="section-title"><span className="dot" />Lançamento Manual Rápido</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 15 }}>
            Registre entradas ou saídas manuais diretamente em qualquer data. Você também pode clicar no dia desejado no calendário acima para editar ou excluir batidas existentes.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 120px', minWidth: 0 }}>
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={manualDate} onChange={e => setManualDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 100px', minWidth: 0 }}>
              <label className="form-label">Horário</label>
              <input type="time" className="form-input" value={manualTime} onChange={e => setManualTime(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ flex: '1 1 100%' }} onClick={handleManualPunch} disabled={savingManual || !manualTime || !manualDate}>
              {savingManual ? 'Salvando...' : 'Registrar Ponto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
