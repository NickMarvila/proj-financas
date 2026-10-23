import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon, Sparkles, Trash2, Plus, Clock } from 'lucide-react';
import { authApi, workDayApi, timeRecordApi, holidayApi } from '../api/client';
import type { WorkDay, TimeRecord, Holiday, UserSummary } from '../types';
import { formatMinutes, formatDate, MONTH_NAMES } from '../utils/format';
import { getCurrentCycle, getCyclePeriodStr, getCycleRange, formatDateIso } from '../utils/cycle';
import MonthCalendar from '../components/MonthCalendar';
import DayPunchesPanel from '../components/DayPunchesPanel';
import { BottomSheetModal, useFeedback } from '../components/FeedbackProvider';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  NORMAL: { label: 'Normal', cls: 'badge-green' },
  OVERTIME: { label: 'Hora Extra', cls: 'badge-amber' },
  INCOMPLETE: { label: 'Incompleto', cls: 'badge-red' },
  COMPENSATED: { label: 'Folga Comp.', cls: 'badge-green' },
  HOLIDAY: { label: 'Feriado', cls: 'badge-purple' },
  DAY_OFF: { label: 'Folga', cls: 'badge-muted' },
  ABSENT: { label: 'Falta', cls: 'badge-red' },
};

export default function Ponto() {
  const { toast, confirm } = useFeedback();

  const initialCycle = getCurrentCycle();
  const [year, setYear] = useState(initialCycle.year);
  const [month, setMonth] = useState(initialCycle.month);
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const todayIso = formatDateIso(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedDay, setSelectedDay] = useState<WorkDay | null>(null);
  const [mobilePunchesOpen, setMobilePunchesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Modal de Feriados
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [newHolDate, setNewHolDate] = useState('');
  const [newHolName, setNewHolName] = useState('');
  const [savingNewHol, setSavingNewHol] = useState(false);
  const [populatingHols, setPopulatingHols] = useState(false);

  // Colaborador ativo (para admin selecionar funcionário)
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);

  useEffect(() => {
    authApi.me().then(async (me) => {
      setCurrentUser(me);
      if (me.role === 'ADMIN') {
        try {
          const list = await authApi.getUsers();
          setUsers(list);
        } catch (e) {
          console.error('Failed to load users list', e);
        }
      }
    }).catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const uid = selectedUserId;
      const [wds, recs, hols] = await Promise.all([
        workDayApi.getByMonth(year, month, uid),
        timeRecordApi.getByMonth(year, month, uid),
        holidayApi.getAll(year, uid).catch(() => [] as Holiday[]),
      ]);
      setHolidays(hols);

      // Ciclo financeiro do dia 21 ao dia 20 do mês seguinte
      const { startDate: cycleStart, endDate: cycleEnd } = getCycleRange(year, month, 21);
      const cycleStartStr = formatDateIso(cycleStart);
      const cycleEndStr = formatDateIso(cycleEnd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filtrar registros que caem dentro do ciclo financeiro
      const fullHistory = wds.filter(w => w.date >= cycleStartStr && w.date <= cycleEndStr);
      const historyDates = new Set(fullHistory.map((w: any) => w.date));
      const holidayDates = new Set(hols.map(h => h.date));

      // Injetar feriados do ciclo que ainda não possuem registro de workDay
      hols.forEach(h => {
        if (h.date >= cycleStartStr && h.date <= cycleEndStr && !historyDates.has(h.date)) {
          const hDate = new Date(h.date + 'T00:00:00');
          fullHistory.push({
            id: -hDate.getTime() - 1000,
            date: h.date,
            workedMinutes: 0,
            contractMinutes: 0,
            overtimeMinutes: 0,
            overtimeValue: 0,
            isSaturday: hDate.getDay() === 6,
            overtimeNotified: false,
            status: 'HOLIDAY',
            holidayName: h.name,
          } as WorkDay);
        }
      });

      // Coletar sábados decorridos do ciclo que não tiveram batida registrada e NÃO são feriados
      const unworkedSaturdays: Date[] = [];
      for (let d = new Date(cycleStart); d <= cycleEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6 && d <= today) {
          const dateStr = formatDateIso(d);
          if (!historyDates.has(dateStr) && !holidayDates.has(dateStr)) {
            unworkedSaturdays.push(new Date(d));
          }
        }
      }

      // Ordenar cronologicamente: os 2 primeiros sábados não trabalhados são folgas compensadas!
      unworkedSaturdays.sort((a, b) => a.getTime() - b.getTime());

      unworkedSaturdays.forEach((d, index) => {
        const dateStr = formatDateIso(d);
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
          status: isCompensated ? 'COMPENSATED' : 'ABSENT',
        } as WorkDay);
      });

      fullHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setWorkDays(fullHistory);
      setRecords(recs.filter(r => {
        const d = r.timestamp.slice(0, 10);
        return d >= cycleStartStr && d <= cycleEndStr;
      }));

      // Atualizar dia selecionado
      const currentSelected = fullHistory.find(w => w.date === selectedDate);
      if (currentSelected) {
        setSelectedDay(currentSelected);
      } else {
        const todayStr = formatDateIso(today);
        const foundToday = fullHistory.find(w => w.date === todayStr);
        if (foundToday) {
          setSelectedDate(todayStr);
          setSelectedDay(foundToday);
        } else if (todayStr >= cycleStartStr && todayStr <= cycleEndStr) {
          setSelectedDate(todayStr);
          setSelectedDay(null);
        } else if (fullHistory.length > 0) {
          setSelectedDate(fullHistory[0].date);
          setSelectedDay(fullHistory[0]);
        } else {
          setSelectedDate(cycleStartStr);
          setSelectedDay(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHoliday = async (date: string, isHoliday: boolean, name?: string) => {
    try {
      const uid = selectedUserId ?? currentUser?.id;
      if (isHoliday) {
        await holidayApi.create({ date, name: name || 'Feriado' }, uid);
      } else {
        await holidayApi.deleteByDate(date, uid);
      }
      await loadData();
    } catch (e: any) {
      toast.error(`Erro: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolDate || !newHolName.trim()) {
      toast.error('Preencha data e nome do feriado!');
      return;
    }
    setSavingNewHol(true);
    try {
      const uid = selectedUserId ?? currentUser?.id;
      await holidayApi.create({ date: newHolDate, name: newHolName.trim() }, uid);
      setNewHolDate('');
      setNewHolName('');
      toast.success('Feriado adicionado com sucesso!');
      await loadData();
    } catch (e: any) {
      toast.error(`Erro ao adicionar feriado: ${e.response?.data?.error || e.message}`);
    } finally {
      setSavingNewHol(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    const ok = await confirm({
      title: 'Excluir feriado',
      message: 'Deseja realmente excluir este feriado do calendário?',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;

    try {
      await holidayApi.delete(id);
      toast.success('Feriado excluído.');
      await loadData();
    } catch (e: any) {
      toast.error(`Erro ao excluir: ${e.response?.data?.error || e.message}`);
    }
  };

  const handlePopulateNational = async () => {
    const ok = await confirm({
      title: 'Sincronizar Feriados Nacionais',
      message: `Deseja importar e sincronizar todos os feriados nacionais de ${year}?`,
      confirmLabel: 'Sincronizar',
    });
    if (!ok) return;

    setPopulatingHols(true);
    try {
      const uid = selectedUserId ?? currentUser?.id;
      await holidayApi.populateNational(year, uid);
      toast.success(`Feriados nacionais de ${year} sincronizados!`);
      await loadData();
    } catch (e: any) {
      toast.error(`Erro ao importar: ${e.response?.data?.error || e.message}`);
    } finally {
      setPopulatingHols(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, month, selectedUserId]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Horas extras reais trabalhadas além da jornada contratual diária
  const grossOvertime = workDays
    .filter(w => w.status !== 'COMPENSATED')
    .reduce((a, w) => a + Math.max(0, w.overtimeMinutes ?? 0), 0);

  const missingSaturdaysCount = workDays.filter(w => w.status === 'ABSENT' && w.isSaturday).length;
  const missingMinutes = missingSaturdaysCount * 240;

  const netOvertime = Math.max(0, grossOvertime - missingMinutes);
  const totalWorked = workDays.reduce((a, w) => a + (w.workedMinutes ?? 0), 0);
  const overtimeDays = workDays.filter(w => (w.overtimeMinutes ?? 0) > 0).length;

  const handleSelectDate = (dateStr: string, workDay: WorkDay | null) => {
    setSelectedDate(dateStr);
    setSelectedDay(workDay);
    if (window.innerWidth < 1100) {
      setMobilePunchesOpen(true);
    }
  };

  const curHol = holidays.find(h => h.date === selectedDate);
  const isHol = !!curHol || selectedDay?.status === 'HOLIDAY';
  const holName = selectedDay?.holidayName || curHol?.name;

  return (
    <div>
      <div className="page-header page-header-ponto">
        <div className="page-header-title-box">
          <h1 className="page-title">Registros de Ponto</h1>
          <p className="page-subtitle">Histórico de batidas e horas trabalhadas</p>
        </div>

        <div className="page-header-actions">
          {currentUser?.role === 'ADMIN' && users.length > 0 && (
            <div className="admin-collaborator-bar">
              <label htmlFor="select-employee-ponto" className="admin-collab-label">
                👤 Colaborador:
              </label>
              <select
                id="select-employee-ponto"
                value={selectedUserId ?? currentUser.id ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedUserId(val);
                }}
                className="admin-collab-select"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.employeeName || u.username} ({u.username}) {u.role === 'ADMIN' ? '★ Admin' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="month-nav">
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Ciclo anterior" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <div className="month-nav-center">
              <span className="month-nav-title">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <span className="month-nav-sub">
                {getCyclePeriodStr(year, month, 21)}
              </span>
            </div>
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Próximo ciclo" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      {/* Resumo do mês em ribbon 2+1 no celular e 3 colunas em 480px+ */}
      <div className="dash-metrics-strip">
        <div className="dash-metric-card purple">
          <div className="metric-head">
            <span>⏱ Trabalhado</span>
          </div>
          <div className="metric-val">{formatMinutes(totalWorked)}</div>
          <div className="metric-foot">Carga do ciclo</div>
        </div>

        <div className="dash-metric-card amber">
          <div className="metric-head">
            <span>⚡ Extras Líquidas</span>
          </div>
          <div className="metric-val">{formatMinutes(netOvertime)}</div>
          <div className="metric-foot amber">Brutas: +{formatMinutes(grossOvertime)}</div>
        </div>

        <div className="dash-metric-card green">
          <div className="metric-head">
            <span>📅 Dias Fechados</span>
          </div>
          <div className="metric-val">{workDays.length}</div>
          <div className="metric-foot green">{overtimeDays} com extra</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Painel Esquerdo: Calendário Mensal ou Lista */}
        <div className="card">
          <div className="ponto-card-header">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <span className="dot" />Ciclo {getCyclePeriodStr(year, month, 21)}
            </div>
            <div className="ponto-header-controls">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setShowHolidaysModal(true)}
                title="Visualizar e gerenciar feriados"
              >
                <Sparkles size={14} className="text-purple" />
                Feriados ({holidays.length})
              </button>
              <div className="view-toggle-group">
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('calendar')}
                >
                  <CalendarIcon size={14} />
                  Calendário
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon size={14} />
                  Lista
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-page" style={{ minHeight: 280 }}><div className="loading-spinner" /></div>
          ) : viewMode === 'calendar' ? (
            <>
              <MonthCalendar
                year={year}
                month={month}
                cutDay={21}
                workDays={workDays}
                holidays={holidays}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
              />
              <div className="mobile-calendar-hint">
                <span>Toque em um dia para ver ou editar batidas</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setMobilePunchesOpen(true)}
                >
                  Ver {formatDate(selectedDate + 'T00:00:00')}
                </button>
              </div>
            </>
          ) : (
            /* Visualização em Lista */
            workDays.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🗓️</div><p>Nenhum registro neste mês</p></div>
            ) : (
              <div className="ponto-list-container">
                {workDays.map(w => {
                  const s = STATUS_MAP[w.status] ?? STATUS_MAP.NORMAL;
                  const isCompensated = w.status === 'COMPENSATED';
                  const isHolidayDay = w.status === 'HOLIDAY';
                  const isSelected = selectedDate === w.date;
                  return (
                    <button
                      type="button"
                      key={w.id}
                      onClick={() => handleSelectDate(w.date, w)}
                      className={`ponto-list-item${isSelected ? ' selected' : isHolidayDay ? ' holiday' : isCompensated ? ' compensated' : w.isSaturday ? ' saturday' : ''}`}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }} className={isHolidayDay ? 'text-purple' : w.isSaturday ? 'text-amber' : ''}>
                            {formatDate(w.date)}
                          </span>
                          {w.isSaturday && (
                            <span className="badge-tag amber">SÁB</span>
                          )}
                          {isHolidayDay && (
                            <span className="badge-tag purple">FERIADO</span>
                          )}
                        </div>
                        <div className="text-secondary" style={{ fontSize: 12, marginTop: 2 }}>
                          {isHolidayDay ? `Feriado oficial: ${w.holidayName || 'Folga remunerada'}` : isCompensated ? 'Folga compensada pela jornada semanal' : `${formatMinutes(w.workedMinutes)} trabalhadas`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span
                          style={{ fontSize: 13, fontWeight: 700 }}
                          className={(w.overtimeMinutes ?? 0) > 0 ? 'text-amber' : w.status === 'ABSENT' ? 'text-danger' : isHolidayDay ? 'text-purple' : 'text-muted'}
                        >
                          {(w.overtimeMinutes ?? 0) > 0 ? `+${formatMinutes(w.overtimeMinutes)}` : w.status === 'ABSENT' ? '-4h' : isHolidayDay ? 'Feriado' : isCompensated ? 'Comp.' : '--'}
                        </span>
                        <span className={`badge ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Painel Direito (Desktop >= 1100px) */}
        <div className="card desktop-punches-card">
          <DayPunchesPanel
            selectedDate={selectedDate}
            workDay={selectedDay}
            records={records}
            isHoliday={isHol}
            holidayName={holName}
            targetUserId={selectedUserId ?? currentUser?.id}
            onToggleHoliday={handleToggleHoliday}
            onRefresh={loadData}
          />
        </div>
      </div>

      {/* Bottom Sheet de Batidas do Dia (Celular e Tablet < 1100px) */}
      <BottomSheetModal
        isOpen={mobilePunchesOpen}
        onClose={() => setMobilePunchesOpen(false)}
        title={`Batidas — ${formatDate(selectedDate + 'T00:00:00')}`}
        icon={<Clock size={18} className="text-green" />}
        overlayClassName="sheet-below-1100"
      >
        <DayPunchesPanel
          selectedDate={selectedDate}
          workDay={selectedDay}
          records={records}
          isHoliday={isHol}
          holidayName={holName}
          targetUserId={selectedUserId ?? currentUser?.id}
          hideHeaderTitle
          onToggleHoliday={handleToggleHoliday}
          onRefresh={loadData}
        />
      </BottomSheetModal>

      {/* Modal de Gestão de Feriados (Bottom Sheet no Celular) */}
      <BottomSheetModal
        isOpen={showHolidaysModal}
        onClose={() => setShowHolidaysModal(false)}
        title={`Feriados (${year})`}
        icon={<span>🎉</span>}
        footer={
          <div className="modal-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowHolidaysModal(false)}
            >
              Concluir
            </button>
          </div>
        }
      >
        {/* Botão de Auto-Importar Feriados Nacionais */}
        <div className="holiday-import-box">
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <div className="text-purple" style={{ fontSize: 13, fontWeight: 700 }}>Feriados Nacionais Brasileiros</div>
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 2 }}>Preenche automaticamente todas as datas oficiais do ano</div>
          </div>
          <button
            type="button"
            className="btn btn-purple btn-sm btn-responsive"
            onClick={handlePopulateNational}
            disabled={populatingHols}
          >
            <Sparkles size={14} />
            {populatingHols ? 'Importando...' : 'Sincronizar Nacionais'}
          </button>
        </div>

        {/* Formulário para Adicionar Novo Feriado */}
        <form onSubmit={handleAddCustomHoliday} className="punches-inline-form">
          <span style={{ fontSize: 13, fontWeight: 600, width: '100%' }}>+ Adicionar Feriado Personalizado</span>
          <div className="form-row-2" style={{ width: '100%' }}>
            <input
              type="date"
              className="form-input"
              value={newHolDate}
              onChange={e => setNewHolDate(e.target.value)}
              required
            />
            <input
              type="text"
              className="form-input"
              placeholder="Nome (ex: Feriado Municipal)"
              value={newHolName}
              onChange={e => setNewHolName(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary btn-sm btn-block"
            disabled={savingNewHol || !newHolDate || !newHolName.trim()}
          >
            <Plus size={15} />
            {savingNewHol ? 'Salvando...' : 'Adicionar Feriado'}
          </button>
        </form>

        {/* Lista de Feriados Cadastrados */}
        <div>
          <span className="text-secondary" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Feriados cadastrados em {year}:
          </span>
          {holidays.length === 0 ? (
            <div className="text-muted" style={{ textAlign: 'center', padding: 16, fontSize: 13 }}>
              Nenhum feriado cadastrado para este ano.
            </div>
          ) : (
            <div className="holiday-list">
              {holidays.map(h => (
                <div key={h.id} className="holiday-list-item">
                  <div className="holiday-list-info">
                    <strong className="text-purple">
                      {formatDate(h.date + 'T00:00:00')}
                    </strong>
                    <span>{h.name}</span>
                    {h.isNational && (
                      <span className="badge-tag purple">Nacional</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => handleDeleteHoliday(h.id)}
                    title="Excluir feriado"
                    aria-label={`Excluir feriado ${h.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheetModal>
    </div>
  );
}
