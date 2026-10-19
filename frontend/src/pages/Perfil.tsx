import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle, AlertTriangle, XCircle, LogOut, Calendar, User, Key, Clock, ExternalLink, Copy, Check } from 'lucide-react';
import { gmailApi, profileApi } from '../api/client';
import { GmailStatus } from '../types';
import { WorkScheduleEditor } from '../components/WorkScheduleEditor';

export default function Perfil() {
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
    } catch(e) {}
    gmailApi.getStatus().then(setStatus).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await profileApi.update(profileForm);
      alert('Perfil atualizado com sucesso!');
      await loadStatus();
    } catch (e: any) {
      alert(`Erro: ${e.response?.data?.message || 'Falha ao atualizar perfil'}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword) return alert('Preencha as senhas');
    setSavingPwd(true);
    try {
      await profileApi.updatePassword(pwdForm);
      alert('Senha atualizada com sucesso!');
      setPwdForm({ currentPassword: '', newPassword: '' });
    } catch (e: any) {
      alert(`Erro: ${e.response?.data?.message || 'Falha ao atualizar senha'}`);
    } finally {
      setSavingPwd(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { authUrl } = await gmailApi.connect(syncFromDate);
      window.location.href = authUrl;
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao obter URL de autenticação');
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('Tem certeza que deseja desconectar o Gmail? O sistema não lerá mais seus comprovantes de ponto automaticamente.')) {
      try {
        await gmailApi.disconnect();
        loadStatus();
      } catch (e) {
        alert('Erro ao desconectar');
      }
    }
  };

  const [syncing, setSyncing] = useState(false);
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await gmailApi.sync();
      alert(`${res.processed} batidas processadas.`);
      loadStatus();
    } catch (e: any) {
      alert(`Erro: ${e.response?.data?.message || 'Falha ao sincronizar'}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="perfil-container fade-in">
      <h1 className="page-title">Meu Perfil</h1>
      <p className="page-subtitle" style={{ marginBottom: 32 }}>
        Gerencie sua conexão com o Gmail e dados pessoais.
      </p>

      {gmailResult === 'ok' && (
        <div className="alert" style={{ backgroundColor: 'var(--accent-green-dim)', color: 'var(--accent-green)', padding: 16, borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle size={24} />
          <strong>Gmail conectado com sucesso!</strong>
        </div>
      )}
      {gmailResult === 'erro' && (
        <div className="alert" style={{ backgroundColor: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: 16, borderRadius: 8, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <XCircle size={24} />
            <div>
              <strong>Erro ao conectar Gmail:</strong> {gmailError}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 36 }}>
            Se o Google bloqueou dizendo <em>"Acesso bloqueado: o app não concluiu a verificação"</em> ou <em>"access_denied"</em>, é necessário incluir o e-mail na lista de <strong>Usuários de Teste</strong> no painel do Google Cloud.
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={`https://console.cloud.google.com/apis/credentials/consent?project=${status?.projectId || 'financasponto'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> Abrir Google Cloud para Liberar este E-mail
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="card glass-card" style={{ marginBottom: 24 }}>
        {profile && (
          <div style={{ padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
              <div style={{ background: 'var(--accent-blue-dim)', padding: 12, borderRadius: '50%', color: 'var(--accent-blue)' }}>
                <User size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Dados Pessoais</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
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
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar Dados Pessoais'}
            </button>
          </div>
        )}
      </div>

      <div className="card glass-card" style={{ marginBottom: 24 }}>
        {profile && (
          <div style={{ padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
              <div style={{ background: 'var(--accent-green-dim)', padding: 12, borderRadius: '50%', color: 'var(--accent-green)' }}>
                <Clock size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Jornada de Trabalho</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Configure seu expediente e metas para cálculo de horas.
                </p>
              </div>
            </div>

            <WorkScheduleEditor
              values={profileForm}
              monthlyHoursGoal={profileForm.monthlyHoursGoal}
              onChange={(updated) => setProfileForm((prev) => ({ ...prev, ...updated }))}
            />

            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Parâmetros Gerais de Ponto e Folha
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
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
                    className="form-input"
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

            <div style={{ marginTop: 24 }}>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? 'Salvando...' : 'Salvar Jornada'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card glass-card" style={{ marginBottom: 24 }}>
        {profile && (
          <div style={{ padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
              <div style={{ background: 'var(--accent-amber-dim)', padding: 12, borderRadius: '50%', color: 'var(--accent-amber)' }}>
                <Key size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Trocar Senha</h2>
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
            <button className="btn btn-secondary" onClick={handleSavePassword} disabled={savingPwd}>
              {savingPwd ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </div>
        )}
      </div>

      <div className="card glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ background: 'var(--accent-purple-dim)', padding: 12, borderRadius: '50%', color: 'var(--accent-purple)' }}>
            <Mail size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Sincronização do Gmail</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Conecte sua conta para que o sistema leia os comprovantes da pmovel.
            </p>
          </div>
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <div style={{ padding: 8 }}>
            {!status?.hasCredentials && (
              <div style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)', padding: 16, borderRadius: 8, display: 'flex', gap: 12 }}>
                <AlertTriangle size={20} />
                <p style={{ fontSize: 14 }}>O administrador não configurou as credenciais do Google. A conexão não está disponível.</p>
              </div>
            )}

            {status?.hasCredentials && status.status === 'DESCONECTADO' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <XCircle size={20} color="var(--accent-red)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Desconectado</span>
                </div>
                
                <div className="form-group" style={{ maxWidth: 300, marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} /> Sincronizar e-mails a partir de
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={syncFromDate}
                    onChange={e => setSyncFromDate(e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Ao conectar, o sistema lerá apenas e-mails recebidos após essa data.
                  </p>
                </div>

                <button className="btn btn-primary" onClick={handleConnect} style={{ width: 'fit-content' }}>
                  Conectar Gmail
                </button>
              </div>
            )}

            {status?.hasCredentials && (status.status === 'CONECTADO' || status.status === 'EXPIRED') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {status.status === 'CONECTADO' ? (
                    <CheckCircle size={20} color="var(--accent-green)" />
                  ) : (
                    <AlertTriangle size={20} color="var(--accent-amber)" />
                  )}
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {status.status === 'CONECTADO' ? 'Conectado' : 'Token Expirado (Reconecte)'}
                  </span>
                </div>

                <div className="kv-grid">
                  <span style={{ color: 'var(--text-secondary)' }}>E-mail:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{status.email}</strong>

                  <span style={{ color: 'var(--text-secondary)' }}>Sincronizando desde:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{status.syncFrom?.split('-').reverse().join('/') || 'Não configurado'}</span>

                  <span style={{ color: 'var(--text-secondary)' }}>Último sync:</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {status.lastSync ? new Date(status.lastSync).toLocaleString('pt-BR') : 'Nunca'}
                  </span>
                </div>

                {status.status === 'CONECTADO' && (
                  <button className="btn btn-secondary" onClick={handleSyncNow} disabled={syncing} style={{ width: 'fit-content', marginTop: 8 }}>
                    {syncing ? 'Sincronizando...' : '🔄 Sincronizar Novos E-mails Agora'}
                  </button>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                  {status.status === 'EXPIRED' && (
                    <button className="btn btn-primary" onClick={handleConnect}>
                      Reconectar Gmail
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={handleDisconnect} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LogOut size={16} /> Desconectar
                  </button>
                </div>

                {/* Box de Ajuda / Acesso ao Google Cloud */}
                {(() => {
                  const googleUrl = `https://console.cloud.google.com/apis/credentials/consent?project=${status?.projectId || 'financasponto'}`;
                  return (
                    <div style={{
                      marginTop: 20,
                      padding: '14px 16px',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ExternalLink size={16} color="#60a5fa" />
                          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            Painel Google Cloud (Adicionar E-mails de Teste)
                          </strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              navigator.clipboard.writeText(googleUrl);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            title="Copiar link"
                            style={{ fontSize: 11, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            {copiedLink ? <Check size={13} color="var(--accent-green)" /> : <Copy size={13} />}
                            {copiedLink ? 'Copiado!' : 'Copiar Link'}
                          </button>
                          <a
                            href={googleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                          >
                            <ExternalLink size={13} /> Abrir no Google Cloud
                          </a>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
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
