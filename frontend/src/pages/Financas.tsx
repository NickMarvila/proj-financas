import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Save, X, Wallet } from 'lucide-react';
import { financeApi } from '../api/client';
import type { SalaryConfig, Expense, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES } from '../types';
import { formatCurrency } from '../utils/format';
import { BottomSheetModal, useFeedback } from '../components/FeedbackProvider';

export default function Financas() {
  const { toast, confirm } = useFeedback();

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
    try {
      const s = await financeApi.saveSalary(salaryForm);
      setSalary(s);
      setEditingSalary(false);
      toast.success('Configuração de salário salva!');
    } catch (err: any) {
      toast.error(`Erro ao salvar salário: ${err.response?.data?.message || err.message}`);
    }
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
    if (!expenseForm.name.trim()) {
      toast.error('Informe o nome da despesa.');
      return;
    }
    try {
      if (editingExpense?.id) {
        await financeApi.updateExpense(editingExpense.id, expenseForm);
        toast.success('Despesa atualizada!');
      } else {
        await financeApi.addExpense(expenseForm);
        toast.success('Despesa adicionada!');
      }
      await load();
      setShowExpenseModal(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar despesa: ${err.response?.data?.message || err.message}`);
    }
  };

  const deleteExpense = async (id: number, name: string) => {
    const ok = await confirm({
      title: 'Remover despesa',
      message: `Deseja remover a despesa "${name}"?`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;

    try {
      await financeApi.deleteExpense(id);
      toast.success('Despesa removida.');
      await load();
    } catch (err: any) {
      toast.error(`Erro ao remover despesa: ${err.response?.data?.message || err.message}`);
    }
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
          <div className="ponto-card-header">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <span className="dot" />Configuração de Salário
            </div>
            {!editingSalary ? (
              <button
                id="btn-edit-salary"
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingSalary(true)}
              >
                <Edit2 size={14} />Editar
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={saveSalary}>
                  <Save size={14} />Salvar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  onClick={() => setEditingSalary(false)}
                  aria-label="Cancelar edição de salário"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {!editingSalary ? (
            <div className="summary-list">
              {salary ? (
                <>
                  <Row label="Salário Base" value={formatCurrency(salary.baseSalary)} big />
                  <Row label="Adicional Hora Extra" value={`${(salary.overtimeRate * 100).toFixed(0)}%`} />
                  <Row label="Divisor Mensal (CLT)" value={`${salary.monthlyHoursDivisor}h`} />
                  <Row label="Horas diárias contratuais" value={`${salary.dailyContractHours}h`} />
                  <Row label="Horas sábado" value={`${salary.saturdayContractHours}h`} />
                  <div className="punches-status-banner compensated" style={{ marginTop: 6, marginBottom: 0 }}>
                    <div>
                      <div className="text-secondary" style={{ fontSize: 12 }}>Valor da hora extra</div>
                      <div className="text-green" style={{ fontSize: 20, fontWeight: 800 }}>
                        {formatCurrency((salary.baseSalary / salary.monthlyHoursDivisor) * (1 + salary.overtimeRate))}/h
                      </div>
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
                <input
                  id="input-salary"
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={salaryForm.baseSalary}
                  onChange={e => setSalaryForm(s => ({ ...s, baseSalary: +e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Adicional Hora Extra (ex: 0.50 = 50%)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={salaryForm.overtimeRate}
                  onChange={e => setSalaryForm(s => ({ ...s, overtimeRate: +e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Divisor Mensal de Horas (CLT 44h = 220)</label>
                <input
                  className="form-input"
                  type="number"
                  value={salaryForm.monthlyHoursDivisor}
                  onChange={e => setSalaryForm(s => ({ ...s, monthlyHoursDivisor: +e.target.value }))}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Horas/dia (seg–sex)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={salaryForm.dailyContractHours}
                    onChange={e => setSalaryForm(s => ({ ...s, dailyContractHours: +e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Horas/sábado</label>
                  <input
                    className="form-input"
                    type="number"
                    value={salaryForm.saturdayContractHours}
                    onChange={e => setSalaryForm(s => ({ ...s, saturdayContractHours: +e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Despesas */}
        <div className="card">
          <div className="ponto-card-header">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <span className="dot" />Despesas Fixas
            </div>
            <button
              id="btn-add-expense"
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openNewExpense}
            >
              <Plus size={14} />Adicionar
            </button>
          </div>
          <div className="punches-status-banner incomplete" style={{ marginBottom: 14 }}>
            <span className="text-secondary" style={{ fontSize: 13 }}>Total mensal</span>
            <span className="text-danger" style={{ fontSize: 18, fontWeight: 800 }}>
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          <div className="expense-list">
            {expenses.length === 0 && (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>Nenhuma despesa cadastrada</p>
              </div>
            )}
            {expenses.map(e => {
              const cat = EXPENSE_CATEGORIES.find(c => c.value === e.category);
              return (
                <div key={e.id} className="expense-item">
                  <span className="expense-emoji">{cat?.emoji ?? '💼'}</span>
                  <div className="expense-info">
                    <div className="expense-name">{e.name}</div>
                    <div className="expense-due">
                      {e.dueDay ? `Vence dia ${e.dueDay}` : 'Sem vencimento'} · {e.recurring ? 'Recorrente' : 'Pontual'}
                    </div>
                  </div>
                  <span className="expense-amount">{formatCurrency(e.amount)}</span>
                  <div className="expense-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => openEditExpense(e)}
                      title="Editar despesa"
                      aria-label={`Editar despesa ${e.name}`}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => deleteExpense(e.id!, e.name)}
                      title="Remover despesa"
                      aria-label={`Remover despesa ${e.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de despesa (Bottom Sheet no Celular) */}
      <BottomSheetModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        title={editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
        icon={<Wallet size={18} className="text-green" />}
        footer={
          <div className="modal-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowExpenseModal(false)}
            >
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={saveExpense}>
              Salvar
            </button>
          </div>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Nome</label>
          <input
            id="input-expense-name"
            className="form-input"
            value={expenseForm.name}
            onChange={e => setExpenseForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="form-row-2">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Valor (R$)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={expenseForm.amount}
              onChange={e => setExpenseForm(f => ({ ...f, amount: +e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Dia do vencimento</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="31"
              value={expenseForm.dueDay ?? 1}
              onChange={e => setExpenseForm(f => ({ ...f, dueDay: +e.target.value }))}
            />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Categoria</label>
          <select
            className="form-select"
            value={expenseForm.category}
            onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
          >
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Tipo</label>
          <select
            className="form-select"
            value={expenseForm.recurring ? 'true' : 'false'}
            onChange={e => setExpenseForm(f => ({ ...f, recurring: e.target.value === 'true' }))}
          >
            <option value="true">🔁 Recorrente (todo mês)</option>
            <option value="false">1️⃣ Pontual (mês específico)</option>
          </select>
        </div>
      </BottomSheetModal>
    </div>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="summary-row">
      <span className="summary-row-label">{label}</span>
      <span className={`summary-row-val${big ? ' big' : ''}`}>{value}</span>
    </div>
  );
}
