import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Edit2, Trash2, Plus, Check, X, Sparkles } from 'lucide-react';
import type { WorkDay, TimeRecord } from '../types';
import { formatMinutes, formatCurrency, formatDate, formatTime } from '../utils/format';
import { timeRecordApi, holidayApi } from '../api/client';

export interface DayPunchesPanelProps {
  selectedDate: string; // YYYY-MM-DD
  workDay: WorkDay | null;
  records: TimeRecord[];
  isHoliday?: boolean;
  holidayName?: string;
  onToggleHoliday?: (date: string, isHoliday: boolean, name?: string) => Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export default function DayPunchesPanel({
  selectedDate,
  workDay,
  records,
  isHoliday = false,
  holidayName,
  onToggleHoliday,
  onRefresh,
}: DayPunchesPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTime, setEditTime] = useState<string>('');
  const [editPunchType, setEditPunchType] = useState<'IN' | 'OUT'>('IN');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Formulário para adicionar nova batida
  const [newTime, setNewTime] = useState<string>('');
  const [addingNew, setAddingNew] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Formulário para marcar feriado
  const [showHolidayForm, setShowHolidayForm] = useState<boolean>(false);
  const [holidayInputName, setHolidayInputName] = useState<string>('Feriado');
  const [savingHoliday, setSavingHoliday] = useState<boolean>(false);

  const dayRecords = records
    .filter(r => r.timestamp.startsWith(selectedDate))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const handleStartEdit = (r: TimeRecord) => {
    setEditingId(r.id);
    const dateObj = new Date(r.timestamp);
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    setEditTime(`${hours}:${minutes}`);
    setEditPunchType(r.punchType);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTime('');
  };

  const handleSaveEdit = async (r: TimeRecord) => {
    if (!editTime) return alert('Selecione um horário válido!');
    setSavingEdit(true);
    try {
      const newTimestamp = `${selectedDate}T${editTime}:00`;
      await timeRecordApi.update(r.id, {
        timestamp: newTimestamp,
        punchType: editPunchType,
      });
      setEditingId(null);
      await onRefresh();
    } catch (e: any) {
      alert(`Erro ao atualizar ponto: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (r: TimeRecord) => {
    const formatted = formatTime(r.timestamp);
    if (!window.confirm(`Tem certeza que deseja excluir a batida das ${formatted}?`)) {
      return;
    }
    try {
      await timeRecordApi.delete(r.id);
      await onRefresh();
    } catch (e: any) {
      alert(`Erro ao excluir ponto: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime) return alert('Digite um horário para a batida!');
    setAddingNew(true);
    try {
      const timestamp = `${selectedDate}T${newTime}:00`;
      await timeRecordApi.addManual(timestamp);
      setNewTime('');
      setShowAddForm(false);
      await onRefresh();
    } catch (e: any) {
      alert(`Erro ao adicionar ponto: ${e.response?.data?.error || e.message}`);
    } finally {
      setAddingNew(false);
    }
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayInputName.trim()) return alert('Digite o nome do feriado!');
    setSavingHoliday(true);
    try {
      if (onToggleHoliday) {
        await onToggleHoliday(selectedDate, true, holidayInputName.trim());
      } else {
        await holidayApi.create({ date: selectedDate, name: holidayInputName.trim() });
        await onRefresh();
      }
      setShowHolidayForm(false);
    } catch (e: any) {
      alert(`Erro ao marcar feriado: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleRemoveHoliday = async () => {
    if (!window.confirm(`Deseja desmarcar o feriado desta data (${selectedDate})?`)) return;
    setSavingHoliday(true);
    try {
      if (onToggleHoliday) {
        await onToggleHoliday(selectedDate, false);
      } else {
        await holidayApi.deleteByDate(selectedDate);
        await onRefresh();
      }
    } catch (e: any) {
      alert(`Erro ao remover feriado: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingHoliday(false);
    }
  };

  const isCompensated = workDay?.status === 'COMPENSATED';
  const isAbsent = !isHoliday && workDay?.status === 'ABSENT';
  const isIncomplete = workDay?.status === 'INCOMPLETE';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          <span className="dot" />
          Batidas — {formatDate(selectedDate + 'T00:00:00')}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!isHoliday && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowHolidayForm(!showHolidayForm)}
              style={{ fontSize: 12, padding: '4px 9px' }}
              title="Marcar este dia como feriado"
            >
              <Sparkles size={13} style={{ color: '#a78bfa', marginRight: 4 }} />
              {showHolidayForm ? 'Cancelar' : 'Feriado'}
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ fontSize: 12, padding: '4px 9px' }}
          >
            <Plus size={13} />
            {showAddForm ? 'Fechar' : 'Nova Batida'}
          </button>
        </div>
      </div>

      {/* Formulário para marcar feriado */}
      {showHolidayForm && (
        <form onSubmit={handleSaveHoliday} style={{
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 12, color: '#c4b5fd' }}>Nome do feriado:</span>
          <input
            type="text"
            className="form-input input-compact"
            placeholder="Ex: Nossa Senhora Aparecida"
            value={holidayInputName}
            onChange={e => setHolidayInputName(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={savingHoliday || !holidayInputName.trim()}
            style={{ background: '#8b5cf6', borderColor: '#7c3aed' }}
          >
            {savingHoliday ? 'Salvando...' : 'Marcar Feriado'}
          </button>
        </form>
      )}

      {/* Banner de Feriado */}
      {isHoliday && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🎉</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13 }}>
                Feriado — {holidayName || 'Dia de Folga Remunerada'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Folga oficial remunerada. Não gera falta e não deduz horas extras.
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11, color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
            disabled={savingHoliday}
            onClick={handleRemoveHoliday}
          >
            {savingHoliday ? 'Removendo...' : 'Desmarcar Feriado'}
          </button>
        </div>
      )}

      {/* Formulário de adicionar nova batida neste dia */}
      {showAddForm && (
        <form onSubmit={handleAddNew} style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Adicionar horário:</span>
          <input
            type="time"
            className="form-input input-compact"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={addingNew || !newTime}
          >
            {addingNew ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>
      )}

      {/* Sábado de Folga Compensada */}
      {isCompensated && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            <CheckCircle2 size={18} />
            <span>Sábado de Folga Compensada</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            A jornada deste sábado (4h) foi compensada pelos 30 min extras diários realizados de segunda a quinta.
          </p>
        </div>
      )}

      {/* Alerta de Jornada Incompleta */}
      {isIncomplete && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#fca5a5' }}>
            Jornada incompleta: falta registrar batida de saída ou a carga horária não foi atingida.
          </span>
        </div>
      )}

      {/* Sem batidas registradas nesta data */}
      {dayRecords.length === 0 ? (
        <div style={{
          background: isHoliday ? 'rgba(139, 92, 246, 0.06)' : isAbsent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          border: `1px solid ${isHoliday ? 'rgba(139, 92, 246, 0.25)' : isAbsent ? 'rgba(239, 68, 68, 0.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          {isHoliday ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#a78bfa' }}>
              <span style={{ fontSize: 24 }}>🎉</span>
              <strong>Feriado Oficial ({holidayName || 'Folga Remunerada'})</strong>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Nenhuma batida exigida para este dia. Aproveite o feriado!
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddForm(true)}
                style={{ marginTop: 8, fontSize: 12 }}
              >
                + Trabalhou no Feriado? Adicionar Ponto
              </button>
            </div>
          ) : isAbsent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--accent-red)' }}>
              <XCircle size={22} />
              <strong>Falta Registrada (−4h)</strong>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Nenhum ponto registrado para esta jornada obrigatória.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Clock size={22} style={{ color: 'var(--text-muted)' }} />
              <span>Nenhuma batida registrada nesta data.</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddForm(true)}
                style={{ marginTop: 8, fontSize: 12 }}
              >
                + Adicionar Ponto Manual
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Lista de batidas com timeline e ações de Editar / Excluir */
        <div className="timeline">
          {dayRecords.map(r => {
            const isEditing = editingId === r.id;
            return (
              <div key={r.id} className="timeline-item" style={{ position: 'relative' }}>
                <div className={`timeline-dot ${r.punchType === 'IN' ? 'in' : 'out'}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div className={`timeline-label ${r.punchType === 'IN' ? 'in' : 'out'}`}>
                        {r.punchType === 'IN' ? '▶ ENTRADA' : '⏹ SAÍDA'}
                      </div>
                      {!isEditing ? (
                        <div className="timeline-time">{formatTime(r.timestamp)}</div>
                      ) : (
                        /* Campo de edição inline de horário */
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          <input
                            type="time"
                            className="form-input input-compact"
                            value={editTime}
                            onChange={e => setEditTime(e.target.value)}
                            autoFocus
                          />
                          <select
                            className="form-input input-compact"
                            value={editPunchType}
                            onChange={e => setEditPunchType(e.target.value as 'IN' | 'OUT')}
                          >
                            <option value="IN">Entrada</option>
                            <option value="OUT">Saída</option>
                          </select>
                          <button
                            type="button"
                            className="icon-btn primary"
                            onClick={() => handleSaveEdit(r)}
                            disabled={savingEdit}
                            title="Salvar alteração"
                            aria-label="Salvar alteração"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={handleCancelEdit}
                            title="Cancelar"
                            aria-label="Cancelar edição"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      <div className="timeline-origin" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{r.origin}</span>
                        {r.origin === 'MANUAL' && (
                          <span style={{ fontSize: 9, padding: '1px 4px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: 3, fontWeight: 600 }}>
                            Manual
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação: Editar e Excluir */}
                    {!isEditing && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleStartEdit(r)}
                          title="Alterar ponto"
                          aria-label="Alterar ponto"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDelete(r)}
                          title="Excluir ponto"
                          aria-label="Excluir ponto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumo de horas do dia */}
      {workDay && (workDay.workedMinutes > 0 || (workDay.overtimeMinutes ?? 0) !== 0) && (
        <div style={{ marginTop: 20, padding: '14px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total trabalhado no dia</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatMinutes(workDay.workedMinutes)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Hora extra do dia</span>
            <span style={{ fontWeight: 700, color: (workDay.overtimeMinutes ?? 0) > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
              {formatMinutes(workDay.overtimeMinutes)} = {formatCurrency(workDay.overtimeValue ?? 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
