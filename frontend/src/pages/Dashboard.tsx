import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Wallet, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { dashboardApi, gmailApi, workDayApi, timeRecordApi } from '../api/client';
import type { Dashboard as DashboardData, GmailStatus, WorkDay, TimeRecord } from '../types';
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
      const [d, g, recs] = await Promise.all([
        dashboardApi.get(currentMonth.year, currentMonth.month),
        gmailApi.getStatus().catch(() => null),
        timeRecordApi.getByMonth(currentMonth.year, currentMonth.month),
      ]);
      setData(d);
      setGmailStatus(g);
      setMonthRecords(recs);
      
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

      const unworkedSaturdays: Date[] = [];
      for (let d = new Date(calMonthStart); d <= calMonthEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6 && d <= today) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!historyDates.has(dateStr)) {
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
      <div className="page-header page-header-row">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle month-nav">
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Mês anterior" onClick={() => setCurrentMonth(prev => prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 })}>
              <ChevronLeft size={16} />
            </button>
            <div className="month-nav-label">
              <span>{MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}</span>
              <small>({getCycleDatesStr()})</small>
            </div>
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Próximo mês" onClick={() => setCurrentMonth(prev => prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 })}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button id="btn-sync-gmail" className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Gmail'}
        </button>
      </div>

      {/* Gmail Banner */}
      {gmailStatus && (gmailStatus.status === 'DESCONECTADO' || gmailStatus.status === 'EXPIRED') && (
        <a href="/perfil" style={{ textDecoration: 'none' }}>
          <div style={{ backgroundColor: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={20} />
              <strong>{gmailStatus.status === 'EXPIRED' ? 'Token do Gmail expirado' : 'Gmail desconectado'}</strong>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, textDecoration: 'underline' }}>Reconectar agora</span>
          </div>
        </a>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-icon"><TrendingUp size={20} /></div>
          <div className="stat-label">Saldo Projetado</div>
          <div className="stat-value green">{formatCurrency(s?.finalBalance ?? 0)}</div>
          <div className="stat-sub">salário + extras − despesas</div>
        </div>

        <div className="stat-card purple">
          <div className="stat-icon"><Clock size={20} /></div>
          <div className="stat-label">Horas Extras Líquidas (mês)</div>
          <div className="stat-value purple">
            {formatMinutes(totalOvertime)}
          </div>
          <div className="stat-sub">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                Brutas: +{formatMinutes(s?.grossOvertimeMinutes ?? (totalOvertime + (s?.compensatedMinutes ?? 480)))}
              </span>
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                Compensadas: −{formatMinutes(s?.compensatedMinutes ?? 480)}
              </span>
              {(s?.missingSaturdays ?? 0) > 0 && (
                <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
                  Faltas Sábados: −{formatMinutes((s?.missingSaturdays ?? 0) * 240)}
                </span>
              )}
              <span style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4, marginTop: 2, color: 'var(--text-secondary)' }}>
                Valor Líquido: {formatCurrency(s?.overtimePay ?? 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card amber">
          <div className="stat-icon"><Wallet size={20} /></div>
          <div className="stat-label">Despesas Fixas</div>
          <div className="stat-value amber">{formatCurrency(s?.totalExpenses ?? 0)}</div>
          <div className="stat-sub">total do mês</div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
            <TrendingUp size={20} />
          </div>
          <div className="stat-label">Extras Hoje</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{formatMinutes(overtimeToday)}</div>
          <div className="stat-sub">{formatCurrency(todayWorkDay?.overtimeValue ?? 0)}</div>
        </div>
      </div>

      {/* Card Informativo de Horários Compensados (Escala 6x1) */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 20px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Horários de Trabalho & Compensação de Sábados (Escala 6x1)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Regra: +30min diários (Seg–Qui) acumulam 8h/mês para compensar 2 sábados de folga
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-green" style={{ fontSize: 11, padding: '4px 8px' }}>
              2 Folgas Compensadas / Mês
            </span>
          </div>
        </div>

        {/* Grade de 3 blocos de horários */}
        <div className="schedule-blocks-grid">
          {/* Seg-Qui */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Segunda a Quinta</span>
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', borderRadius: 4, fontWeight: 700 }}>
                +30 min compensatórios
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
              08:00 às 12:00 — 13:30 às 18:00
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              8h30 trabalhadas (17:30 às 18:00 vai para compensar o sábado de folga)
            </div>
          </div>

          {/* Sexta */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Sexta-feira</span>
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', borderRadius: 4, fontWeight: 600 }}>
                Horário Normal
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
              08:00 às 12:00 — 13:30 às 17:30
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              8h00 trabalhadas (saída normal às 17:30, sem acréscimo compensatório)
            </div>
          </div>

          {/* Sábado */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Sábado (4h)</span>
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)', borderRadius: 4, fontWeight: 700 }}>
                Folga / Trabalho
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
              08:00 às 12:00
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Trabalha {s?.requiredSaturdays ?? 2} sábados no mês. As 2 folgas são cobertas pelas 8h de seg-qui.
            </div>
          </div>
        </div>

        {/* Resumo matemático da compensação neste mês */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            Status da escala em {MONTH_NAMES[currentMonth.month - 1]}:
            <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
              {s?.workedSaturdays ?? 0} de {s?.requiredSaturdays ?? 2} obrigatórios trabalhados
            </strong> ({s?.totalSaturdays ?? 4} no mês)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            <span style={{ color: 'var(--accent-amber)' }}>
              Compensação: <strong>−{formatMinutes(s?.compensatedMinutes ?? 480)}</strong>
            </span>
            <span style={{ color: 'var(--accent-green)' }}>
              Extras Líquidas a Pagar: <strong>+{formatMinutes(totalOvertime)}</strong> ({formatCurrency(s?.overtimePay ?? 0)})
            </span>
          </div>
        </div>
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
            selectedDate={selectedDate}
            onSelectDate={handleSelectCalendarDate}
          />
        </div>

        {/* Painel Direito: Batidas do Dia Selecionado com Edição, Exclusão e Nova Batida */}
        <div className="card">
          <DayPunchesPanel
            selectedDate={selectedDate}
            workDay={selectedDay}
            records={monthRecords}
            onRefresh={load}
          />
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Horas Extras Brutas</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Segunda a Quinta (+30m/dia) + batidas extras</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)' }}>
                +{formatMinutes(s?.grossOvertimeMinutes ?? (totalOvertime + (s?.compensatedMinutes ?? 480)))}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', background: 'rgba(251, 191, 36, 0.04)', borderRadius: 4, margin: '0 -4px', paddingLeft: 6, paddingRight: 6 }}>
              <div>
                <div style={{ fontSize: 14, color: '#fbbf24' }}>Compensação Sábados de Folga</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>2 sábados de folga compensados na semana</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>
                −{formatMinutes(s?.compensatedMinutes ?? 480)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Horas Extras Líquidas a Pagar</div>
                <div style={{ fontSize: 11, color: 'var(--accent-green)' }}>+{formatMinutes(totalOvertime)}</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-green)' }}>
                +{formatCurrency(s?.overtimePay ?? 0)}
              </span>
            </div>

            {s?.requiredSaturdays != null && s.requiredSaturdays > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sábados Cumpridos</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: (s?.missingSaturdays ?? 0) === 0 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                  {s.workedSaturdays ?? 0} de {s.requiredSaturdays} obrigatórios ({s.totalSaturdays ?? 4} no mês)
                </span>
              </div>
            )}

            {(s?.missingSaturdays ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: 4, margin: '0 -4px', paddingLeft: 6, paddingRight: 6 }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Faltas (Sábados Obrigatórios)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)' }}>
                  −{(s?.missingSaturdays ?? 0)} sábado(s) = −{(s?.missingSaturdays ?? 0) * 4}h
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Despesas Fixas</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-red)' }}>−{formatCurrency(s?.totalExpenses ?? 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
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
