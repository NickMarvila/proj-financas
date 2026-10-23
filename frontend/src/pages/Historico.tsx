import { useEffect, useState } from 'react';
import { financeApi } from '../api/client';
import type { MonthlySummary } from '../types';
import { formatCurrency, formatMinutes, MONTH_NAMES } from '../utils/format';
import { getCyclePeriodStr } from '../utils/cycle';

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {summaries.map(s => {
            const isPositive = (s.finalBalance ?? 0) >= 0;
            return (
              <div
                key={s.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${isPositive ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                }}
              >
                <div className="hist-card-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      {MONTH_NAMES[s.month - 1]} {s.year}
                    </div>
                    <div className="text-secondary" style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                      Ciclo: {getCyclePeriodStr(s.year, s.month, 21)}
                    </div>
                  </div>
                  <div className="hist-cells">
                    <Cell label="Salário" value={formatCurrency(s.baseSalary)} />
                    <Cell
                      label="Extras"
                      value={`${formatMinutes(s.totalOvertimeMinutes)}`}
                      sub={formatCurrency(s.overtimePay)}
                      toneClass="text-purple"
                    />
                    <Cell
                      label="Despesas"
                      value={formatCurrency(s.totalExpenses)}
                      toneClass="text-danger"
                    />
                    <Cell
                      label="Saldo Final"
                      value={formatCurrency(s.finalBalance)}
                      toneClass={isPositive ? 'text-green' : 'text-danger'}
                      big
                    />
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

function Cell({
  label,
  value,
  sub,
  toneClass,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  toneClass?: string;
  big?: boolean;
}) {
  return (
    <div className="hist-cell">
      <div className="hist-cell-label">{label}</div>
      <div className={`hist-cell-val${big ? ' big' : ''}${toneClass ? ` ${toneClass}` : ''}`}>
        {value}
      </div>
      {sub && <div className="hist-cell-sub">{sub}</div>}
    </div>
  );
}
