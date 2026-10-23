import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertTriangle, XCircle, LogOut, Calendar, User, Key, Clock, ExternalLink, Copy, Check } from 'lucide-react';
import { gmailApi, profileApi } from '../api/client';
import { GmailStatus } from '../types';
import { WorkScheduleEditor } from '../components/WorkScheduleEditor';
import { useFeedback } from '../components/FeedbackProvider';

export default function Perfil() {
  const { toast, confirm } = useFeedback();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });

  const [profile, setProfile] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    employeeName: '', cpf: '', whatsappPhone: '',
    workMonday: '', workTuesday: '', workWednesday: '', workThursday: '',
    workFriday: '', workSaturday: '', workSunday: '',
    monthlyHoursGoal: 220, firstDayOfWeek: 'MONDAY', firstDayOfMonth: 21
  });

  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });

  const gmailResult = searchParams.get('gmail');
  const gmailError = searchParams.get('motivo');

  const loadStatus = async () => {
    try {
      const p = await profileApi.get();
      setProfile(p);
      setProfileForm({
        employeeName: p.employeeName || '',
        cpf: p.cpf || '',
        whatsappPhone: p.whatsappPhone || '',
        workMonday: p.workMonday || '',
        workTuesday: p.workTuesday || '',
        workWednesday: p.workWednesday || '',
        workThursday: p.workThursday || '',
        workFriday: p.workFriday || '',
        workSaturday: p.workSaturday || '',
        workSunday: p.workSunday || '',
        monthlyHoursGoal: p.monthlyHoursGoal || 220,
        firstDayOfWeek: p.firstDayOfWeek || 'MONDAY',
        firstDayOfMonth: p.firstDayOfMonth || 21
      });
    } catch (e) {}
    gmailApi.getStatus().then(setStatus).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await profileApi.update(profileForm);
      toast.success('Perfil atualizado com sucesso!');
      await loadStatus();
    } catch (e: any) {
      toast.error(`Erro: ${e.response?.data?.message || 'Falha ao atualizar perfil'}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword) {
      toast.error('Preencha a senha atual e a nova senha.');
      return;
    }
    setSavingPwd(true);
    try {
      await profileApi.updatePassword(pwdForm);
      toast.success('Senha atualizada com sucesso!');
      setPwdForm({ currentPassword: '', newPassword: '' });
    } catch (e: any) {
      toast.error(`Erro: ${e.response?.data?.message || 'Falha ao atualizar senha'}`);
    } finally {
      setSavingPwd(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { authUrl } = await gmailApi.connect(syncFromDate);
      window.location.href = authUrl;
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao obter URL de autenticação');
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Desconectar Gmail',
      message: 'Tem certeza que deseja desconectar o Gmail? O sistema não lerá mais seus comprovantes de ponto automaticamente.',
      confirmLabel: 'Desconectar',
      danger: true,
    });
    if (!ok) return;

    try {
      await gmailApi.disconnect();
      toast.info('Gmail desconectado.');
      loadStatus();
    } catch (e) {
      toast.error('Erro ao desconectar o Gmail.');
    }
  };

  const [syncing, setSyncing] = useState(false);
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await gmailApi.sync();
      toast.success(`${res.processed} batida(s) processada(s).`);
      loadStatus();
    } catch (e: any) {
      toast.error(`Erro: ${e.response?.data?.message || 'Falha ao sincronizar'}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="perfil-container fade-in">
      <div className="page-header">
        <h1 className="page-title">Meu Perfil</h1>
        <p className="page-subtitle">
          Gerencie sua conexão com o Gmail, jornada e dados pessoais.
        </p>
      </div>

      {gmailResult === 'ok' && (
        <div className="punches-status-banner compensated" style={{ marginBottom: 18 }}>
          <div className="text-green" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={22} />
            <strong>Gmail conectado com sucesso!</strong>
          </div>
        </div>
      )}
      {gmailResult === 'erro' && (
        <div className="punches-status-banner incomplete" style={{ marginBottom: 18, flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="text-danger" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <XCircle size={22} />
            <div>
              <strong>Erro ao conectar Gmail:</strong> {gmailError}
            </div>
          </div>
          <div className="text-secondary" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Se o Google bloqueou dizendo <em>"Acesso bloqueado: o app não concluiu a verificação"</em> ou <em>"access_denied"</em>, é necessário incluir o e-mail na lista de <strong>Usuários de Teste</strong> no painel do Google Cloud.
            <div style={{ marginTop: 10 }}>
              <a
                href={`https://console.cloud.google.com/apis/credentials/consent?project=${status?.projectId || 'financasponto'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm btn-responsive"
              >
                <ExternalLink size={14} /> Abrir Google Cloud para Liberar este E-mail
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="card glass-card" style={{ marginBottom: 18 }}>
        {profile && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div style={{ background: 'var(--accent-blue-dim)', padding: 10, borderRadius: '50%', color: 'var(--accent-blue)', flexShrink: 0 }}>
                <User size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Dados Pessoais</h2>
                <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
                  Atualize suas informações de identificação no sistema.
                </p>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Usuário de Login</label>
                <input className="form-input" value={profile.username} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Nome Completo (Conforme comprovante)</label>
                <input className="form-input" value={profileForm.employeeName} onChange={e => setProfileForm({ ...profileForm, employeeName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">CPF ou PIS (Apenas números)</label>
                <input className="form-input" value={profileForm.cpf} onChange={e => setProfileForm({ ...profileForm, cpf: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp (Ex: 5521999999999)</label>
                <input className="form-input" value={profileForm.whatsappPhone} onChange={e => setProfileForm({ ...profileForm, whatsappPhone: e.target.value })} />
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-responsive" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar Dados Pessoais'}
            </button>
          </div>
        )}
      </div>

      <div className="card glass-card" style={{ marginBottom: 18 }}>
        {profile && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div style={{ background: 'var(--accent-green-dim)', padding: 10, borderRadius: '50%', color: 'var(--accent-green)', flexShrink: 0 }}>
                <Clock size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Jornada de Trabalho</h2>
                <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
                  Configure seu expediente e metas para cálculo de horas.
                </p>
              </div>
            </div>

            <WorkScheduleEditor
              values={profileForm}
              monthlyHoursGoal={profileForm.monthlyHoursGoal}
              onChange={(updated) => setProfileForm((prev) => ({ ...prev, ...updated }))}
            />

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <h3 className="text-secondary" style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                Parâmetros Gerais de Ponto e Folha
              </h3>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Meta Mensal (horas)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={profileForm.monthlyHoursGoal}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        monthlyHoursGoal: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Primeiro dia da Semana</label>
                  <select
                    className="form-select"
                    value={profileForm.firstDayOfWeek}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, firstDayOfWeek: e.target.value })
                    }
                  >
                    <option value="MONDAY">Segunda-feira</option>
                    <option value="SUNDAY">Domingo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Primeiro dia do Mês (Corte)</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    max={31}
                    value={profileForm.firstDayOfMonth}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        firstDayOfMonth: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-primary btn-responsive" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? 'Salvando...' : 'Salvar Jornada'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card glass-card" style={{ marginBottom: 18 }}>
        {profile && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div style={{ background: 'var(--accent-amber-dim)', padding: 10, borderRadius: '50%', color: 'var(--accent-amber)', flexShrink: 0 }}>
                <Key size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Trocar Senha</h2>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Senha Atual</label>
                <input type="password" className="form-input" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Nova Senha</label>
                <input type="password" className="form-input" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} />
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-responsive" onClick={handleSavePassword} disabled={savingPwd}>
              {savingPwd ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </div>
        )}
      </div>

      <div className="card glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div style={{ background: 'var(--accent-purple-dim)', padding: 10, borderRadius: '50%', color: 'var(--accent-purple)', flexShrink: 0 }}>
            <Mail size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Sincronização do Gmail</h2>
            <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
              Conecte sua conta para que o sistema leia os comprovantes da pmovel.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-secondary">Carregando...</p>
        ) : (
          <div>
            {!status?.hasCredentials && (
              <div className="punches-status-banner" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>
                <AlertTriangle size={20} />
                <p style={{ fontSize: 14 }}>O administrador não configurou as credenciais do Google. A conexão não está disponível.</p>
              </div>
            )}

            {status?.hasCredentials && status.status === 'DESCONECTADO' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <XCircle size={20} className="text-danger" />
                  <strong>Desconectado</strong>
                </div>

                <div className="form-group" style={{ maxWidth: 320, marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> Sincronizar e-mails a partir de
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={syncFromDate}
                    onChange={e => setSyncFromDate(e.target.value)}
                  />
                  <p className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                    Ao conectar, o sistema lerá apenas e-mails recebidos após essa data.
                  </p>
                </div>

                <button type="button" className="btn btn-primary btn-responsive" onClick={handleConnect}>
                  Conectar Gmail
                </button>
              </div>
            )}

            {status?.hasCredentials && (status.status === 'CONECTADO' || status.status === 'EXPIRED') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {status.status === 'CONECTADO' ? (
                    <CheckCircle size={20} className="text-green" />
                  ) : (
                    <AlertTriangle size={20} className="text-amber" />
                  )}
                  <strong>
                    {status.status === 'CONECTADO' ? 'Conectado' : 'Token Expirado (Reconecte)'}
                  </strong>
                </div>

                <div className="kv-grid">
                  <span className="text-secondary">E-mail:</span>
                  <strong>{status.email}</strong>

                  <span className="text-secondary">Sincronizando desde:</span>
                  <span>{status.syncFrom?.split('-').reverse().join('/') || 'Não configurado'}</span>

                  <span className="text-secondary">Último sync:</span>
                  <span>
                    {status.lastSync ? new Date(status.lastSync).toLocaleString('pt-BR') : 'Nunca'}
                  </span>
                </div>

                {status.status === 'CONECTADO' && (
                  <button type="button" className="btn btn-secondary btn-responsive" onClick={handleSyncNow} disabled={syncing}>
                    {syncing ? 'Sincronizando...' : '🔄 Sincronizar Novos E-mails Agora'}
                  </button>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {status.status === 'EXPIRED' && (
                    <button type="button" className="btn btn-primary btn-responsive" onClick={handleConnect}>
                      Reconectar Gmail
                    </button>
                  )}
                  <button type="button" className="btn btn-danger btn-responsive" onClick={handleDisconnect}>
                    <LogOut size={16} /> Desconectar
                  </button>
                </div>

                {(() => {
                  const googleUrl = `https://console.cloud.google.com/apis/credentials/consent?project=${status?.projectId || 'financasponto'}`;
                  return (
                    <div className="holiday-import-box" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ExternalLink size={16} className="text-blue" />
                          <strong style={{ fontSize: 13 }}>
                            Painel Google Cloud (Adicionar E-mails de Teste)
                          </strong>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(googleUrl);
                              setCopiedLink(true);
                              toast.info('Link copiado para a área de transferência!');
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            title="Copiar link"
                          >
                            {copiedLink ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                            {copiedLink ? 'Copiado!' : 'Copiar Link'}
                          </button>
                          <a
                            href={googleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            <ExternalLink size={14} /> Abrir no Google Cloud
                          </a>
                        </div>
                      </div>
                      <p className="text-secondary" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
                        Para autorizar novos e-mails a sincronizarem sem erro 403, cadastre-os na seção <strong>Usuários de teste (Test users)</strong> do Google Cloud Console.
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
