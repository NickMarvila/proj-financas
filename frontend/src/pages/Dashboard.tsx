import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Wallet, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { dashboardApi, gmailApi } from '../api/client';
import type { Dashboard as DashboardData } from '../types';
import { formatCurrency, formatMinutes, formatDate, MONTH_NAMES } from '../utils/format';
import { workDayApi, timeRecordApi } from '../api/client';
import type { WorkDay } from '../types';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
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
      const d = await dashboardApi.get(currentMonth.year, currentMonth.month);
      setData(d);
      
      const year = d.monthSummary?.year ?? currentMonth.year;
      const month = d.monthSummary?.month ?? currentMonth.month;
      const h = await workDayApi.getByMonth(year, month);
      
      // Inject missing Saturdays — Sábados seguem o MÊS CALENDÁRIO, não o ciclo 21-20
      const calMonthStart = new Date(year, month - 1, 1);
      const calMonthEnd = new Date(year, month, 0); // último dia do mês
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fullHistory = [...h];
      const historyDates = new Set(h.map((w: any) => w.date));

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
    setSyncing(true);
    try {
      const r = await gmailApi.sync();
      if (r.processed > 0) await load();
      alert(`Sincronizados ${r.processed} e-mail(s).`);
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
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
          <div className="stat-label">Horas Extras (mês)</div>
          <div className="stat-value purple" style={{ fontSize: (s?.missingSaturdays ?? 0) > 0 ? 18 : undefined }}>
            {formatMinutes(totalOvertime)}
          </div>
          <div className="stat-sub">
            {(s?.missingSaturdays ?? 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Ganhas: +{formatMinutes(totalOvertime + (s?.missingSaturdays ?? 0) * 240)}</span>
                <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>Faltas: −{formatMinutes((s?.missingSaturdays ?? 0) * 240)}</span>
                <span style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '2px', color: 'var(--text-secondary)' }}>Valor: {formatCurrency(s?.overtimePay ?? 0)}</span>
              </div>
            ) : (
              `Valor: ${formatCurrency(s?.overtimePay ?? 0)}`
            )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Salário Base', value: formatCurrency(s?.baseSalary ?? 0), color: 'var(--text-primary)' },
              { label: 'Horas Extras', value: '+' + formatCurrency(s?.overtimePay ?? 0), color: 'var(--accent-green)' },
              { label: 'Despesas', value: '−' + formatCurrency(s?.totalExpenses ?? 0), color: 'var(--accent-red)' },
              { label: 'Sobra Anterior', value: '+' + formatCurrency(s?.carriedOver ?? 0), color: 'var(--accent-amber)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{row.value}</span>
              </div>
            ))}
            {(s?.missingSaturdays ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', paddingLeft: '8px' }}>Faltas (Sábados)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-red)', paddingRight: '8px' }}>
                  −{(s?.missingSaturdays ?? 0)} sábado(s) = −{(s?.missingSaturdays ?? 0) * 4}h
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Saldo Final</span>
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
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={manualDate} onChange={e => setManualDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">Horário</label>
              <input type="time" className="form-input" value={manualTime} onChange={e => setManualTime(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleManualPunch} disabled={savingManual || !manualTime || !manualDate}>
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
                    const isUnworkedSaturday = h.isSaturday && (h.workedMinutes === 0 || h.status === 'ABSENT' || h.status === 'DAY_OFF');
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: h.isSaturday ? 'rgba(251,191,36,0.03)' : 'transparent' }}>
                        <td style={{ padding: '10px 0', fontWeight: 500, paddingLeft: '5px' }}>
                          <span style={{ color: h.isSaturday ? '#fbbf24' : 'inherit' }}>{formatDate(h.date)}</span>
                          {h.isSaturday && <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: 4, fontWeight: 700 }}>SÁB</span>}
                        </td>
                        <td style={{ padding: '10px 0' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            backgroundColor: h.status === 'OVERTIME' ? 'rgba(139,92,246,0.1)' : h.status === 'NORMAL' ? 'rgba(16,185,129,0.1)' : isUnworkedSaturday ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                            color: h.status === 'OVERTIME' ? 'var(--accent-purple)' : h.status === 'NORMAL' ? 'var(--accent-green)' : isUnworkedSaturday ? 'var(--accent-red)' : 'var(--text-secondary)'
                          }}>
                            {h.status === 'OVERTIME' ? 'HORA EXTRA' : h.status === 'NORMAL' ? 'COMPLETO' : isUnworkedSaturday ? 'FALTA' : 'INCOMPLETO'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: h.overtimeMinutes > 0 ? 'var(--accent-purple)' : isUnworkedSaturday ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                          {h.overtimeMinutes > 0 ? `+${formatMinutes(h.overtimeMinutes)}` : isUnworkedSaturday ? '-4h' : '--'}
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
