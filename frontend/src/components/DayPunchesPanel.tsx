import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Edit2, Trash2, Plus, Check, X, Sparkles } from 'lucide-react';
import type { WorkDay, TimeRecord } from '../types';
import { formatMinutes, formatCurrency, formatDate, formatTime } from '../utils/format';
import { timeRecordApi, holidayApi } from '../api/client';
import { useFeedback } from './FeedbackProvider';

export interface DayPunchesPanelProps {
  selectedDate: string; // YYYY-MM-DD
  workDay: WorkDay | null;
  records: TimeRecord[];
  isHoliday?: boolean;
  holidayName?: string;
  targetUserId?: number;
  hideHeaderTitle?: boolean;
  onToggleHoliday?: (date: string, isHoliday: boolean, name?: string) => Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export default function DayPunchesPanel({
  selectedDate,
  workDay,
  records,
  isHoliday = false,
  holidayName,
  targetUserId,
  hideHeaderTitle = false,
  onToggleHoliday,
  onRefresh,
}: DayPunchesPanelProps) {
  const { toast, confirm } = useFeedback();

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
    if (!editTime) {
      toast.error('Selecione um horário válido!');
      return;
    }
    setSavingEdit(true);
    try {
      const newTimestamp = `${selectedDate}T${editTime}:00`;
      await timeRecordApi.update(r.id, {
        timestamp: newTimestamp,
        punchType: editPunchType,
      });
      setEditingId(null);
      toast.success('Batida atualizada com sucesso!');
      await onRefresh();
    } catch (e: any) {
      toast.error(`Erro ao atualizar ponto: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (r: TimeRecord) => {
    const formatted = formatTime(r.timestamp);
    const ok = await confirm({
      title: 'Excluir batida de ponto',
      message: `Tem certeza que deseja excluir a batida das ${formatted}?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;

    try {
      await timeRecordApi.delete(r.id);
      toast.success('Batida excluída.');
      await onRefresh();
    } catch (e: any) {
      toast.error(`Erro ao excluir ponto: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime) {
      toast.error('Digite um horário para a batida!');
      return;
    }
    setAddingNew(true);
    try {
      const timestamp = `${selectedDate}T${newTime}:00`;
      await timeRecordApi.addManual(timestamp, targetUserId);
      setNewTime('');
      setShowAddForm(false);
      toast.success('Nova batida registrada!');
      await onRefresh();
    } catch (e: any) {
      toast.error(`Erro ao adicionar ponto: ${e.response?.data?.error || e.message}`);
    } finally {
      setAddingNew(false);
    }
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayInputName.trim()) {
      toast.error('Digite o nome do feriado!');
      return;
    }
    setSavingHoliday(true);
    try {
      if (onToggleHoliday) {
        await onToggleHoliday(selectedDate, true, holidayInputName.trim());
      } else {
        await holidayApi.create({ date: selectedDate, name: holidayInputName.trim() }, targetUserId);
        await onRefresh();
      }
      setShowHolidayForm(false);
      toast.success('Feriado registrado na data!');
    } catch (e: any) {
      toast.error(`Erro ao marcar feriado: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleRemoveHoliday = async () => {
    const ok = await confirm({
      title: 'Desmarcar feriado',
      message: `Deseja desmarcar o feriado desta data (${formatDate(selectedDate + 'T00:00:00')})?`,
      confirmLabel: 'Desmarcar',
      danger: true,
    });
    if (!ok) return;

    setSavingHoliday(true);
    try {
      if (onToggleHoliday) {
        await onToggleHoliday(selectedDate, false);
      } else {
        await holidayApi.deleteByDate(selectedDate, targetUserId);
        await onRefresh();
      }
      toast.info('Feriado removido da data.');
    } catch (e: any) {
      toast.error(`Erro ao remover feriado: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingHoliday(false);
    }
  };

  const isCompensated = workDay?.status === 'COMPENSATED';
  const isAbsent = !isHoliday && workDay?.status === 'ABSENT';
  const isIncomplete = workDay?.status === 'INCOMPLETE';

  return (
    <div>
      <div className="punches-header">
        {!hideHeaderTitle && (
          <div className="section-title" style={{ marginBottom: 0 }}>
            <span className="dot" />
            Batidas — {formatDate(selectedDate + 'T00:00:00')}
          </div>
        )}
        <div className="punches-header-actions">
          {!isHoliday && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowHolidayForm(!showHolidayForm)}
              title="Marcar este dia como feriado"
            >
              <Sparkles size={14} className="text-purple" />
              {showHolidayForm ? 'Cancelar' : 'Feriado'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={14} />
            {showAddForm ? 'Fechar' : 'Nova Batida'}
          </button>
        </div>
      </div>

      {/* Formulário para marcar feriado */}
      {showHolidayForm && (
        <form onSubmit={handleSaveHoliday} className="punches-inline-form holiday-form">
          <span className="text-purple" style={{ fontSize: 12, fontWeight: 600 }}>Nome do feriado:</span>
          <input
            type="text"
            className="form-input"
            placeholder="Ex: Nossa Senhora Aparecida"
            value={holidayInputName}
            onChange={e => setHolidayInputName(e.target.value)}
            required
          />
          <button
            type="submit"
            className="btn btn-purple btn-sm btn-responsive"
            disabled={savingHoliday || !holidayInputName.trim()}
          >
            {savingHoliday ? 'Salvando...' : 'Marcar Feriado'}
          </button>
        </form>
      )}

      {/* Banner de Feriado */}
      {isHoliday && (
        <div className="punches-status-banner holiday">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🎉</span>
            <div style={{ minWidth: 0 }}>
              <div className="text-purple" style={{ fontWeight: 700, fontSize: 13 }}>
                Feriado — {holidayName || 'Dia de Folga Remunerada'}
              </div>
              <div className="text-secondary" style={{ fontSize: 11, marginTop: 2 }}>
                Folga oficial remunerada. Não gera falta e não deduz horas extras.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={savingHoliday}
            onClick={handleRemoveHoliday}
          >
            {savingHoliday ? 'Removendo...' : 'Desmarcar Feriado'}
          </button>
        </div>
      )}

      {/* Formulário de adicionar nova batida neste dia */}
      {showAddForm && (
        <form onSubmit={handleAddNew} className="punches-inline-form">
          <span className="text-secondary" style={{ fontSize: 12, fontWeight: 600 }}>Adicionar horário:</span>
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
        <div className="punches-status-banner compensated">
          <div>
            <div className="text-green" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              <CheckCircle2 size={18} />
              <span>Sábado de Folga Compensada</span>
            </div>
            <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              A jornada deste sábado (4h) foi compensada pelos 30 min extras diários realizados de segunda a quinta.
            </p>
          </div>
        </div>
      )}

      {/* Alerta de Jornada Incompleta */}
      {isIncomplete && (
        <div className="punches-status-banner incomplete">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} className="text-danger" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#fca5a5' }}>
              Jornada incompleta: falta registrar batida de saída ou a carga horária não foi atingida.
            </span>
          </div>
        </div>
      )}

      {/* Sem batidas registradas nesta data */}
      {dayRecords.length === 0 ? (
        <div className={`punches-empty-box${isHoliday ? ' holiday' : isAbsent ? ' absent' : ''}`}>
          {isHoliday ? (
            <>
              <span style={{ fontSize: 24 }}>🎉</span>
              <strong className="text-purple">Feriado Oficial ({holidayName || 'Folga Remunerada'})</strong>
              <span className="text-secondary" style={{ fontSize: 12 }}>
                Nenhuma batida exigida para este dia. Aproveite o feriado!
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddForm(true)}
              >
                + Trabalhou no Feriado? Adicionar Ponto
              </button>
            </>
          ) : isAbsent ? (
            <>
              <XCircle size={22} className="text-danger" />
              <strong className="text-danger">Falta Registrada (−4h)</strong>
              <span className="text-secondary" style={{ fontSize: 12 }}>
                Nenhum ponto registrado para esta jornada obrigatória.
              </span>
            </>
          ) : (
            <>
              <Clock size={22} className="text-muted" />
              <span>Nenhuma batida registrada nesta data.</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddForm(true)}
              >
                + Adicionar Ponto Manual
              </button>
            </>
          )}
        </div>
      ) : (
        /* Lista de batidas com timeline e ações de Editar / Excluir */
        <div className="timeline">
          {dayRecords.map(r => {
            const isEditing = editingId === r.id;
            return (
              <div key={r.id} className="timeline-item">
                <div className={`timeline-dot ${r.punchType === 'IN' ? 'in' : 'out'}`} />
                <div className="timeline-item-body">
                  <div className="timeline-item-row">
                    <div>
                      <div className={`timeline-label ${r.punchType === 'IN' ? 'in' : 'out'}`}>
                        {r.punchType === 'IN' ? '▶ ENTRADA' : '⏹ SAÍDA'}
                      </div>
                      {!isEditing ? (
                        <div className="timeline-time">{formatTime(r.timestamp)}</div>
                      ) : (
                        /* Campo de edição inline de horário */
                        <div className="timeline-edit-row">
                          <input
                            type="time"
                            className="form-input input-compact"
                            value={editTime}
                            onChange={e => setEditTime(e.target.value)}
                            autoFocus
                          />
                          <select
                            className="form-select input-compact"
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
                      <div className="timeline-origin">
                        <span>{r.origin}</span>
                        {r.origin === 'MANUAL' && (
                          <span className="badge-tag amber">Manual</span>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação: Editar e Excluir */}
                    {!isEditing && (
                      <div className="timeline-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleStartEdit(r)}
                          title="Alterar ponto"
                          aria-label="Alterar ponto"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDelete(r)}
                          title="Excluir ponto"
                          aria-label="Excluir ponto"
                        >
                          <Trash2 size={15} />
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
        <div className="punches-day-summary">
          <div className="punches-day-summary-row">
            <span className="text-secondary">Total trabalhado no dia</span>
            <strong>{formatMinutes(workDay.workedMinutes)}</strong>
          </div>
          <div className="punches-day-summary-row">
            <span className="text-secondary">Hora extra do dia</span>
            <strong className={(workDay.overtimeMinutes ?? 0) > 0 ? 'text-amber' : 'text-muted'}>
              {formatMinutes(workDay.overtimeMinutes)} = {formatCurrency(workDay.overtimeValue ?? 0)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
