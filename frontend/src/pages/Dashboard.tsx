import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Wallet, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { dashboardApi, gmailApi } from '../api/client';
import type { Dashboard as DashboardData, GmailStatus } from '../types';
import { formatCurrency, formatMinutes, formatDate, MONTH_NAMES } from '../utils/format';
import { workDayApi, timeRecordApi } from '../api/client';
import type { WorkDay } from '../types';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<WorkDay[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [d, g] = await Promise.all([
        dashboardApi.get(currentMonth.year, currentMonth.month),
        gmailApi.getStatus().catch(() => null)
      ]);
      setData(d);
      setGmailStatus(g);
      
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

  const { monthSummary: s, todayRecords, todayWorkDay } = data;
  const overtimeToday = todayWorkDay?.overtimeMinutes ?? 0;
  const totalOvertime = s?.totalOvertimeMinutes ?? 0;

  const getCycleDatesStr = () => {
    const prev = new Date(currentMonth.year, currentMonth.month - 2, 21);
    const curr = new Date(currentMonth.year, currentMonth.month - 1, 20);
    const fd = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${fd(prev)} a ${fd(curr)}`;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => setCurrentMonth(prev => prev.month === 1 ? { year: prev.year - 1, month: 12 } : { ...prev, month: prev.month - 1 })}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ minWidth: '120px', textAlign: 'center', fontWeight: 600 }}>
                {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                ({getCycleDatesStr()})
              </span>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} onClick={() => setCurrentMonth(prev => prev.month === 12 ? { year: prev.year + 1, month: 1 } : { ...prev, month: prev.month + 1 })}>
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
          <div style={{ backgroundColor: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={20} />
              <strong>{gmailStatus.status === 'EXPIRED' ? 'Token do Gmail expirado' : 'Gmail desconectado'}</strong>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, textDecoration: 'underline' }}>Reconectar agora</span>
          </div>
        </a>
      )}

      {/* Carry Over Banner */}
      {s?.carriedOver > 0 && (
        <div className="carry-over-banner">
          <span className="cob-icon">🎉</span>
          <div className="cob-text">
            <div className="cob-label">Sobra do mês anterior</div>
            <div className="cob-value">+{formatCurrency(s.carriedOver)}</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>já incluído no saldo</span>
        </div>
      )}

      {/* Stats */}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
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
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ color: 'var(--accent-amber)' }}>
              Compensação: <strong>−{formatMinutes(s?.compensatedMinutes ?? 480)}</strong>
            </span>
            <span style={{ color: 'var(--accent-green)' }}>
              Extras Líquidas a Pagar: <strong>+{formatMinutes(totalOvertime)}</strong> ({formatCurrency(s?.overtimePay ?? 0)})
            </span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Ponto de hoje */}
        <div className="card">
          <div className="section-title"><span className="dot" />Ponto em {formatDate(data.today)}</div>
          {todayRecords.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <div className="empty-icon">🕐</div>
              <p>Nenhuma batida registrada hoje</p>
            </div>
          ) : (
            <div className="timeline">
              {todayRecords.map(r => (
                <div key={r.id} className="timeline-item">
                  <div className={`timeline-dot ${r.punchType === 'IN' ? 'in' : 'out'}`} />
                  <div>
                    <div className={`timeline-label ${r.punchType === 'IN' ? 'in' : 'out'}`}>
                      {r.punchType === 'IN' ? '▶ ENTRADA' : '⏹ SAÍDA'}
                    </div>
                    <div className="timeline-time">{new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="timeline-origin">{r.origin}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

            {(s?.carriedOver ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sobra Anterior</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-amber)' }}>+{formatCurrency(s?.carriedOver ?? 0)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Saldo Final Projetado</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(s?.finalBalance ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '20px' }}>
        {/* Lançamento Manual */}
        <div className="card">
          <div className="section-title"><span className="dot" />Lançamento Manual (Home Office)</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 15 }}>
            Registre entradas ou saídas que não foram contabilizadas no sistema oficial (ex: pausa para o almoço aos sábados).
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

        {/* Histórico do Mês */}
        <div className="card">
          <div className="section-title"><span className="dot" />Histórico do Mês ({history.length} dias)</div>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhum registro encontrado neste mês.</p>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Data</th>
                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)', textAlign: 'right' }}>Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => {
                    const isCompensated = h.status === 'COMPENSATED';
                    const isAbsentSaturday = h.isSaturday && (h.status === 'ABSENT');
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: isCompensated ? 'rgba(16,185,129,0.03)' : h.isSaturday ? 'rgba(251,191,36,0.03)' : 'transparent' }}>
                        <td style={{ padding: '10px 0', fontWeight: 500, paddingLeft: '5px' }}>
                          <span style={{ color: h.isSaturday ? '#fbbf24' : 'inherit' }}>{formatDate(h.date)}</span>
                          {h.isSaturday && <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: 4, fontWeight: 700 }}>SÁB</span>}
                        </td>
                        <td style={{ padding: '10px 0' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            backgroundColor: isCompensated ? 'rgba(16,185,129,0.15)' : h.status === 'OVERTIME' ? 'rgba(139,92,246,0.1)' : h.status === 'NORMAL' ? 'rgba(16,185,129,0.1)' : isAbsentSaturday ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                            color: isCompensated ? 'var(--accent-green)' : h.status === 'OVERTIME' ? 'var(--accent-purple)' : h.status === 'NORMAL' ? 'var(--accent-green)' : isAbsentSaturday ? 'var(--accent-red)' : 'var(--text-secondary)'
                          }}>
                            {isCompensated ? 'FOLGA COMP.' : h.status === 'OVERTIME' ? 'HORA EXTRA' : h.status === 'NORMAL' ? 'COMPLETO' : isAbsentSaturday ? 'FALTA' : 'INCOMPLETO'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: h.overtimeMinutes > 0 ? 'var(--accent-purple)' : isCompensated ? 'var(--accent-green)' : isAbsentSaturday ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                          {h.overtimeMinutes > 0 ? `+${formatMinutes(h.overtimeMinutes)}` : isCompensated ? 'Comp.' : isAbsentSaturday ? '-4h' : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
