import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { financeApi } from '../api/client';
import type { SalaryConfig, Expense, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES } from '../types';
import { formatCurrency } from '../utils/format';

export default function Financas() {
  const [salary, setSalary] = useState<SalaryConfig | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingSalary, setEditingSalary] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [salaryForm, setSalaryForm] = useState<SalaryConfig>({
    baseSalary: 0, overtimeRate: 0.5, monthlyHoursDivisor: 220,
    dailyContractHours: 8, saturdayContractHours: 4
  });
  const [expenseForm, setExpenseForm] = useState<Expense>({
    name: '', amount: 0, category: 'OUTROS', dueDay: 1, recurring: true
  });

  const load = async () => {
    const [s, e] = await Promise.all([financeApi.getSalary(), financeApi.getExpenses()]);
    if (s) { setSalary(s); setSalaryForm(s); }
    setExpenses(e);
  };

  useEffect(() => { load(); }, []);

  const saveSalary = async () => {
    const s = await financeApi.saveSalary(salaryForm);
    setSalary(s); setEditingSalary(false);
  };

  const openNewExpense = () => {
    setEditingExpense(null);
    setExpenseForm({ name: '', amount: 0, category: 'OUTROS', dueDay: 1, recurring: true });
    setShowExpenseModal(true);
  };
  const openEditExpense = (e: Expense) => {
    setEditingExpense(e);
    setExpenseForm({ ...e });
    setShowExpenseModal(true);
  };
  const saveExpense = async () => {
    if (editingExpense?.id) await financeApi.updateExpense(editingExpense.id, expenseForm);
    else await financeApi.addExpense(expenseForm);
    await load(); setShowExpenseModal(false);
  };
  const deleteExpense = async (id: number) => {
    if (!confirm('Remover esta despesa?')) return;
    await financeApi.deleteExpense(id); await load();
  };

  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Finanças</h1>
        <p className="page-subtitle">Configure seu salário e despesas fixas mensais</p>
      </div>

      <div className="grid-2">
        {/* Salário */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="section-title" style={{ marginBottom: 0 }}><span className="dot" />Configuração de Salário</div>
            {!editingSalary
              ? <button id="btn-edit-salary" className="btn btn-secondary btn-sm" onClick={() => setEditingSalary(true)}><Edit2 size={14} />Editar</button>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveSalary}><Save size={14} />Salvar</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingSalary(false)}><X size={14} /></button>
                </div>
            }
          </div>

          {!editingSalary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {salary ? (
                <>
                  <Row label="Salário Base" value={formatCurrency(salary.baseSalary)} big />
                  <Row label="Adicional Hora Extra" value={`${(salary.overtimeRate * 100).toFixed(0)}%`} />
                  <Row label="Divisor Mensal (CLT)" value={`${salary.monthlyHoursDivisor}h`} />
                  <Row label="Horas diárias contratuais" value={`${salary.dailyContractHours}h`} />
                  <Row label="Horas sábado" value={`${salary.saturdayContractHours}h`} />
                  <div style={{ padding: '14px', background: 'var(--accent-green-dim)', borderRadius: 'var(--radius-md)', marginTop: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Valor da hora extra</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-green)' }}>
                      {formatCurrency(salary.baseSalary / salary.monthlyHoursDivisor * (1 + salary.overtimeRate))}/h
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state"><div className="empty-icon">💼</div><p>Configure seu salário</p></div>
              )}
            </div>
          ) : (
            <div>
              <div className="form-group">
                <label className="form-label">Salário Base (R$)</label>
                <input id="input-salary" className="form-input" type="number" step="0.01" value={salaryForm.baseSalary}
                  onChange={e => setSalaryForm(s => ({ ...s, baseSalary: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Adicional Hora Extra (ex: 0.50 = 50%)</label>
                <input className="form-input" type="number" step="0.01" value={salaryForm.overtimeRate}
                  onChange={e => setSalaryForm(s => ({ ...s, overtimeRate: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Divisor Mensal de Horas (CLT 44h = 220)</label>
                <input className="form-input" type="number" value={salaryForm.monthlyHoursDivisor}
                  onChange={e => setSalaryForm(s => ({ ...s, monthlyHoursDivisor: +e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Horas/dia (seg-sex)</label>
                  <input className="form-input" type="number" value={salaryForm.dailyContractHours}
                    onChange={e => setSalaryForm(s => ({ ...s, dailyContractHours: +e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Horas/sábado</label>
                  <input className="form-input" type="number" value={salaryForm.saturdayContractHours}
                    onChange={e => setSalaryForm(s => ({ ...s, saturdayContractHours: +e.target.value }))} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Despesas */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="section-title" style={{ marginBottom: 0 }}><span className="dot" />Despesas Fixas</div>
            <button id="btn-add-expense" className="btn btn-primary btn-sm" onClick={openNewExpense}><Plus size={14} />Adicionar</button>
          </div>
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--accent-red-dim)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total mensal</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent-red)' }}>{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="expense-list">
            {expenses.length === 0 && <div className="empty-state" style={{ padding: '24px 0' }}><p>Nenhuma despesa cadastrada</p></div>}
            {expenses.map(e => {
              const cat = EXPENSE_CATEGORIES.find(c => c.value === e.category);
              return (
                <div key={e.id} className="expense-item">
                  <span style={{ fontSize: 20 }}>{cat?.emoji ?? '💼'}</span>
                  <div style={{ flex: 1 }}>
                    <div className="expense-name">{e.name}</div>
                    <div className="expense-due">{e.dueDay ? `Vence dia ${e.dueDay}` : 'Sem vencimento'} · {e.recurring ? 'Recorrente' : 'Pontual'}</div>
                  </div>
                  <span className="expense-amount">{formatCurrency(e.amount)}</span>
                  <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEditExpense(e)}><Edit2 size={13} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteExpense(e.id!)}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de despesa */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</div>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input id="input-expense-name" className="form-input" value={expenseForm.name}
                onChange={e => setExpenseForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Valor (R$)</label>
                <input className="form-input" type="number" step="0.01" value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: +e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Dia do vencimento</label>
                <input className="form-input" type="number" min="1" max="31" value={expenseForm.dueDay ?? 1}
                  onChange={e => setExpenseForm(f => ({ ...f, dueDay: +e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={expenseForm.category}
                onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={expenseForm.recurring ? 'true' : 'false'}
                onChange={e => setExpenseForm(f => ({ ...f, recurring: e.target.value === 'true' }))}>
                <option value="true">🔁 Recorrente (todo mês)</option>
                <option value="false">1️⃣ Pontual (mês específico)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveExpense}>Salvar</button>
              <button className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: big ? 20 : 15, fontWeight: big ? 800 : 600, color: big ? 'var(--accent-green)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
