import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import type { MonthlySummary } from '../types';
import { formatCurrency, formatMinutes, MONTH_NAMES } from '../utils/format';

export default function Historico() {
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    financeApi.getSummaries().then(s => setSummaries(s)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Histórico Mensal</h1>
        <p className="page-subtitle">Balanço financeiro de todos os meses</p>
      </div>

      {summaries.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>Nenhum histórico ainda</h3>
            <p>Os resumos aparecem automaticamente conforme os meses passam</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {summaries.map(s => {
            const isPositive = (s.finalBalance ?? 0) >= 0;
            return (
              <div key={s.id} className="card" style={{
                borderLeft: `4px solid ${isPositive ? 'var(--accent-green)' : 'var(--accent-red)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      {MONTH_NAMES[s.month - 1]} {s.year}
                    </div>
                    {(s.carriedOver ?? 0) > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--accent-amber)', marginTop: 2 }}>
                        🎁 +{formatCurrency(s.carriedOver)} sobra do mês anterior
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Cell label="Salário" value={formatCurrency(s.baseSalary)} />
                    <Cell label="Extras" value={`${formatMinutes(s.totalOvertimeMinutes)}`}
                      sub={formatCurrency(s.overtimePay)} color="var(--accent-purple-light)" />
                    <Cell label="Despesas" value={formatCurrency(s.totalExpenses)} color="var(--accent-red)" />
                    <Cell label="Saldo Final" value={formatCurrency(s.finalBalance)}
                      color={isPositive ? 'var(--accent-green)' : 'var(--accent-red)'} big />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, sub, color, big }: {
  label: string; value: string; sub?: string; color?: string; big?: boolean;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: big ? 20 : 15, fontWeight: big ? 800 : 700, color: color ?? 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}
