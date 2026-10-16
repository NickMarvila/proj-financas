import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Edit2, Trash2, Plus, Check, X } from 'lucide-react';
import type { WorkDay, TimeRecord } from '../types';
import { formatMinutes, formatCurrency, formatDate, formatTime } from '../utils/format';
import { timeRecordApi } from '../api/client';

export interface DayPunchesPanelProps {
  selectedDate: string; // YYYY-MM-DD
  workDay: WorkDay | null;
  records: TimeRecord[];
  onRefresh: () => void | Promise<void>;
}

export default function DayPunchesPanel({
  selectedDate,
  workDay,
  records,
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

  const isCompensated = workDay?.status === 'COMPENSATED';
  const isAbsent = workDay?.status === 'ABSENT';
  const isIncomplete = workDay?.status === 'INCOMPLETE';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          <span className="dot" />
          Batidas — {formatDate(selectedDate + 'T00:00:00')}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Plus size={14} />
          {showAddForm ? 'Fechar' : 'Nova Batida'}
        </button>
      </div>

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
            className="form-input"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            style={{ width: 120, padding: '4px 8px', fontSize: 13 }}
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={addingNew || !newTime}
            style={{ padding: '4px 12px', fontSize: 12 }}
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
          background: isAbsent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          border: `1px solid ${isAbsent ? 'rgba(239, 68, 68, 0.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          {isAbsent ? (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <input
                            type="time"
                            className="form-input"
                            value={editTime}
                            onChange={e => setEditTime(e.target.value)}
                            style={{ padding: '2px 6px', fontSize: 13, width: 100 }}
                            autoFocus
                          />
                          <select
                            className="form-input"
                            value={editPunchType}
                            onChange={e => setEditPunchType(e.target.value as 'IN' | 'OUT')}
                            style={{ padding: '2px 6px', fontSize: 11, width: 90 }}
                          >
                            <option value="IN">Entrada</option>
                            <option value="OUT">Saída</option>
                          </select>
                          <button
                            className="btn btn-primary btn-icon"
                            onClick={() => handleSaveEdit(r)}
                            disabled={savingEdit}
                            title="Salvar alteração"
                            style={{ padding: 4, width: 26, height: 26 }}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={handleCancelEdit}
                            title="Cancelar"
                            style={{ padding: 4, width: 26, height: 26 }}
                          >
                            <X size={14} />
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
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => handleStartEdit(r)}
                          title="Alterar ponto"
                          style={{ padding: '3px 6px', height: 26, width: 26, color: 'var(--text-secondary)' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => handleDelete(r)}
                          title="Excluir ponto"
                          style={{ padding: '3px 6px', height: 26, width: 26, color: 'var(--accent-red)' }}
                        >
                          <Trash2 size={12} />
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
