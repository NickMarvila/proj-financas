import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Wallet, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { authApi, dashboardApi, gmailApi, workDayApi, timeRecordApi, holidayApi } from '../api/client';
import type { Dashboard as DashboardData, GmailStatus, WorkDay, TimeRecord, Holiday, UserSummary } from '../types';
import { formatCurrency, formatMinutes, formatDate, MONTH_NAMES } from '../utils/format';
import { getCurrentCycle, getCyclePeriodStr, getCycleRange, formatDateIso } from '../utils/cycle';
import MonthCalendar from '../components/MonthCalendar';
import DayPunchesPanel from '../components/DayPunchesPanel';
import { BottomSheetModal, useFeedback } from '../components/FeedbackProvider';

export default function Dashboard() {
  const { toast } = useFeedback();

  const [data, setData] = useState<DashboardData | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<WorkDay[]>([]);
  const [monthRecords, setMonthRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);

  const todayIso = formatDateIso(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedDay, setSelectedDay] = useState<WorkDay | null>(null);
  const [mobilePunchesOpen, setMobilePunchesOpen] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => getCurrentCycle());

  const [manualDate, setManualDate] = useState(todayIso);
  const [manualTime, setManualTime] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Colaborador ativo (para admin selecionar funcionário)
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);

  useEffect(() => {
    authApi.me().then(async (me) => {
      setCurrentUser(me);
      if (me.role === 'ADMIN') {
        try {
          const list = await authApi.getUsers();
          setUsers(list);
        } catch (e) {
          console.error('Failed to load users', e);
        }
      }
    }).catch(() => {});
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const uid = selectedUserId;
      const [d, g, recs, hols] = await Promise.all([
        dashboardApi.get(currentMonth.year, currentMonth.month, uid),
        gmailApi.getStatus().catch(() => null),
        timeRecordApi.getByMonth(currentMonth.year, currentMonth.month, uid),
        holidayApi.getAll(currentMonth.year, uid).catch(() => [] as Holiday[]),
      ]);
      setData(d);
      setGmailStatus(g);
      setMonthRecords(recs);
      setHolidays(hols);

      const year = d.monthSummary?.year ?? currentMonth.year;
      const month = d.monthSummary?.month ?? currentMonth.month;
      const h = await workDayApi.getByMonth(year, month, uid);

      // Ciclo financeiro do dia 21 ao dia 20 do mês seguinte
      const { startDate: cycleStart, endDate: cycleEnd } = getCycleRange(year, month, 21);
      const cycleStartStr = formatDateIso(cycleStart);
      const cycleEndStr = formatDateIso(cycleEnd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fullHistory = h.filter(w => w.date >= cycleStartStr && w.date <= cycleEndStr);
      const historyDates = new Set(fullHistory.map((w: any) => w.date));
      const holidayDates = new Set(hols.map(hol => hol.date));

      const unworkedSaturdays: Date[] = [];
      for (let d = new Date(cycleStart); d <= cycleEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6 && d <= today) {
          const dateStr = formatDateIso(d);
          if (!historyDates.has(dateStr) && !holidayDates.has(dateStr)) {
            unworkedSaturdays.push(new Date(d));
          }
        }
      }

      unworkedSaturdays.sort((a, b) => a.getTime() - b.getTime());

      unworkedSaturdays.forEach((d, index) => {
        const dateStr = formatDateIso(d);
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
        const todayStr = formatDateIso(today);
        const foundToday = fullHistory.find(w => w.date === todayStr);
        if (foundToday) {
          setSelectedDate(todayStr);
          setSelectedDay(foundToday);
        } else if (todayStr >= cycleStartStr && todayStr <= cycleEndStr) {
          setSelectedDate(todayStr);
          setSelectedDay(null);
        } else if (fullHistory.length > 0) {
          setSelectedDate(fullHistory[0].date);
          setSelectedDay(fullHistory[0]);
        } else {
          setSelectedDate(cycleStartStr);
          setSelectedDay(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentMonth, selectedUserId]);

  const handleSync = async () => {
    if (gmailStatus?.status !== 'CONECTADO') {
      toast.info('Conecte o Gmail no seu Perfil antes de sincronizar.');
      return;
    }
    setSyncing(true);
    try {
      const r = await gmailApi.sync();
      if (r.processed > 0) await load();
      toast.success(`Sincronizados ${r.processed} e-mail(s).`);
    } catch (e: any) {
      toast.error(`Erro: ${e.response?.data?.message || e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualPunch = async () => {
    if (!manualTime) {
      toast.error('Selecione um horário!');
      return;
    }
    setSavingManual(true);
    try {
      const timestamp = `${manualDate}T${manualTime}:00`;
      await timeRecordApi.addManual(timestamp, selectedUserId ?? currentUser?.id);
      toast.success('Ponto registrado com sucesso!');
      await load();
      setManualTime('');
    } catch (e: any) {
      toast.error(`Erro: ${e.response?.data?.error || e.message}`);
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
    if (window.innerWidth < 1100) {
      setMobilePunchesOpen(true);
    }
  };

  const curHol = holidays.find(h => h.date === selectedDate);
  const isHol = !!curHol || selectedDay?.status === 'HOLIDAY';
  const holName = selectedDay?.holidayName || curHol?.name;
  const uid = selectedUserId ?? currentUser?.id;

  const handleToggleDayHoliday = async (date: string, isHoliday: boolean, name?: string) => {
    if (isHoliday) {
      await holidayApi.create({ date, name: name || 'Feriado' }, uid);
    } else {
      await holidayApi.deleteByDate(date, uid);
    }
    await load();
  };

  return (
    <div>
      {/* Cabeçalho do Dashboard */}
      <div className="dash-header">
        <div className="dash-header-title-row">
          <div className="dash-header-title-box">
            <h1 className="dash-title">Dashboard</h1>
            <span className="dash-subtitle">{getCycleDatesStr()}</span>
          </div>
          <button id="btn-sync-gmail" className="btn btn-secondary btn-sm btn-sync-pill" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>

        {currentUser?.role === 'ADMIN' && users.length > 0 && (
          <div className="admin-collaborator-bar">
            <label htmlFor="select-employee-dashboard" className="admin-collab-label">
              👤 Colaborador:
            </label>
            <select
              id="select-employee-dashboard"
              value={selectedUserId ?? currentUser.id ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                setSelectedUserId(val);
              }}
              className="admin-collab-select"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.employeeName || u.username} ({u.username}) {u.role === 'ADMIN' ? '★ Admin' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="dash-month-selector">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Ciclo anterior" onClick={() => setCurrentMonth(prev => prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 })}>
            <ChevronLeft size={18} />
          </button>
          <div className="dash-month-label">
            <span className="month-name">{MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}</span>
            <small>Ciclo: {getCyclePeriodStr(currentMonth.year, currentMonth.month, 21)}</small>
          </div>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Próximo ciclo" onClick={() => setCurrentMonth(prev => prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 })}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Gmail Banner */}
      {gmailStatus && (gmailStatus.status === 'DESCONECTADO' || gmailStatus.status === 'EXPIRED') && (
        <a href="/perfil" className="gmail-alert-link">
          <div className="gmail-alert-banner">
            <div className="gmail-alert-left">
              <AlertCircle size={18} />
              <span>{gmailStatus.status === 'EXPIRED' ? 'Token do Gmail expirado' : 'Gmail desconectado'}</span>
            </div>
            <span className="gmail-alert-cta">Reconectar agora</span>
          </div>
        </a>
      )}

      {/* Hero Card: Saldo Projetado */}
      <div className="hero-balance-card">
        <div className="hero-balance-top">
          <span className="hero-balance-tag">Saldo Projetado</span>
          <span className="hero-month-tag">Ciclo: {getCyclePeriodStr(currentMonth.year, currentMonth.month, 21)}</span>
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

      {/* Ribbon de Métricas Secundárias (2+1 no celular, 3 colunas em 480px+) */}
      <div className="dash-metrics-strip">
        <div className="dash-metric-card purple">
          <div className="metric-head">
            <Clock size={14} />
            <span>Extras (Mês)</span>
          </div>
          <div className="metric-val">{formatMinutes(totalOvertime)}</div>
          <div className="metric-foot green">+{formatCurrency(s?.overtimePay ?? 0)}</div>
        </div>

        <div className="dash-metric-card blue">
          <div className="metric-head">
            <TrendingUp size={14} />
            <span>Extras Hoje</span>
          </div>
          <div className="metric-val">{formatMinutes(overtimeToday)}</div>
          <div className="metric-foot">{formatCurrency(todayWorkDay?.overtimeValue ?? 0)}</div>
        </div>

        <div className="dash-metric-card amber">
          <div className="metric-head">
            <Wallet size={14} />
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
                  <strong className="text-amber">Sábado (4h)</strong>
                  <span className="badge-tag green">Trabalho / Folga</span>
                </div>
                <div className="schedule-block-time">08:00 às 12:00</div>
                <div className="schedule-block-desc">2 obrigatórios trabalhados e 2 folgas compensadas</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO PRINCIPAL: Calendário do Mês + Painel de Batidas (Lateral no Desktop, Bottom Sheet abaixo de 1100px) */}
      <div className="grid-2">
        <div className="card">
          <div className="section-title">
            <span className="dot" />Calendário — Ciclo {getCyclePeriodStr(currentMonth.year, currentMonth.month, 21)}
          </div>
          <MonthCalendar
            year={currentMonth.year}
            month={currentMonth.month}
            cutDay={21}
            workDays={history}
            holidays={holidays}
            selectedDate={selectedDate}
            onSelectDate={handleSelectCalendarDate}
          />
          <div className="mobile-calendar-hint">
            <span>Toque em um dia para ver ou editar batidas</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setMobilePunchesOpen(true)}
            >
              Ver {formatDate(selectedDate + 'T00:00:00')}
            </button>
          </div>
        </div>

        {/* Painel Direito (Desktop >= 1100px) */}
        <div className="card desktop-punches-card">
          <DayPunchesPanel
            selectedDate={selectedDate}
            workDay={selectedDay}
            records={monthRecords}
            isHoliday={isHol}
            holidayName={holName}
            targetUserId={uid}
            onToggleHoliday={handleToggleDayHoliday}
            onRefresh={load}
          />
        </div>
      </div>

      {/* Bottom Sheet de Batidas do Dia (Celular e Tablet < 1100px) */}
      <BottomSheetModal
        isOpen={mobilePunchesOpen}
        onClose={() => setMobilePunchesOpen(false)}
        title={`Batidas — ${formatDate(selectedDate + 'T00:00:00')}`}
        icon={<Clock size={18} className="text-green" />}
        overlayClassName="sheet-below-1100"
      >
        <DayPunchesPanel
          selectedDate={selectedDate}
          workDay={selectedDay}
          records={monthRecords}
          isHoliday={isHol}
          holidayName={holName}
          targetUserId={uid}
          hideHeaderTitle
          onToggleHoliday={handleToggleDayHoliday}
          onRefresh={load}
        />
      </BottomSheetModal>

      {/* SEÇÃO INFERIOR: Resumo Financeiro + Lançamento Manual Rápido */}
      <div className="grid-2" style={{ marginTop: 18 }}>
        {/* Resumo financeiro */}
        <div className="card">
          <div className="section-title"><span className="dot" />Resumo do Mês</div>
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-row-label">Salário Base</span>
              <span className="summary-row-val">{formatCurrency(s?.baseSalary ?? 0)}</span>
            </div>

            <div className="summary-row">
              <div>
                <div className="summary-row-label">Horas Extras do Mês</div>
                <div className="summary-row-sub">Horas além da escala contratual diária</div>
              </div>
              <span className="summary-row-val text-green">
                +{formatMinutes(totalOvertime)} ({formatCurrency(s?.overtimePay ?? 0)})
              </span>
            </div>

            <div className="summary-row highlight-green">
              <div>
                <div className="summary-row-label text-green">Compensação Sábados de Folga</div>
                <div className="summary-row-sub">2 sábados de folga compensados na jornada de Seg–Qui</div>
              </div>
              <span className="summary-row-val text-green" style={{ fontSize: 13 }}>
                Quitado (Escala)
              </span>
            </div>

            {s?.requiredSaturdays != null && s.requiredSaturdays > 0 && (
              <div className="summary-row">
                <span className="summary-row-label">Sábados Cumpridos</span>
                <span className={`summary-row-val ${(s?.missingSaturdays ?? 0) === 0 ? 'text-green' : 'text-amber'}`} style={{ fontSize: 13 }}>
                  {s.workedSaturdays ?? 0}/{s.requiredSaturdays} obrigatórios ({s.totalSaturdays ?? 4} no mês)
                </span>
              </div>
            )}

            {(s?.missingSaturdays ?? 0) > 0 && (
              <div className="summary-row highlight-red">
                <span className="summary-row-label">Faltas (Sábados)</span>
                <span className="summary-row-val text-danger" style={{ fontSize: 13 }}>
                  −{(s?.missingSaturdays ?? 0)} sábado(s) = −{(s?.missingSaturdays ?? 0) * 4}h
                </span>
              </div>
            )}

            <div className="summary-row">
              <span className="summary-row-label">Despesas Fixas</span>
              <span className="summary-row-val text-danger">−{formatCurrency(s?.totalExpenses ?? 0)}</span>
            </div>

            <div className="summary-row">
              <strong style={{ fontSize: 15 }}>Saldo Final Projetado</strong>
              <span className="summary-row-val big">{formatCurrency(s?.finalBalance ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Lançamento Manual Avulso */}
        <div className="card">
          <div className="section-title"><span className="dot" />Lançamento Manual Rápido</div>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 14 }}>
            Registre entradas ou saídas manuais diretamente em qualquer data, ou toque em um dia no calendário acima para editar batidas existentes.
          </p>
          <div className="form-row-2" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={manualDate} onChange={e => setManualDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Horário</label>
              <input type="time" className="form-input" value={manualTime} onChange={e => setManualTime(e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleManualPunch}
            disabled={savingManual || !manualTime || !manualDate}
          >
            {savingManual ? 'Salvando...' : 'Registrar Ponto'}
          </button>
        </div>
      </div>
    </div>
  );
}
