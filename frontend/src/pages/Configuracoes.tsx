import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Send, CheckCircle, XCircle, ExternalLink, Copy, Check, Key, Lock, Eye, EyeOff } from 'lucide-react';
import { gmailApi, whatsAppApi, authApi } from '../api/client';
import type { WhatsAppStatus } from '../api/client';
import type { GmailStatus, UserSummary } from '../types';
import { BottomSheetModal, useFeedback } from '../components/FeedbackProvider';

export default function Configuracoes() {
  const { toast, confirm } = useFeedback();

  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [testMsg, setTestMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [disconnectingWa, setDisconnectingWa] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [pwdModalUser, setPwdModalUser] = useState<UserSummary | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [advStartDate, setAdvStartDate] = useState('');
  const [advEndDate, setAdvEndDate] = useState('');
  const [advUserId, setAdvUserId] = useState<string>('');
  const [advLogs, setAdvLogs] = useState<{ date: string; msg: string; status: string }[]>([]);
  const [advSyncing, setAdvSyncing] = useState(false);
  const cancelSyncRef = useRef(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [advLogs]);

  const loadStatus = async () => {
    try {
      const u = await authApi.me();
      setIsAdmin(u.role === 'ADMIN');
    } catch (e) {}

    const [g, w] = await Promise.all([
      gmailApi.getStatus().catch(() => null),
      whatsAppApi.getStatus().catch(() => null),
    ]);
    setGmailStatus(g);
    if (w) {
      setWaStatus(w);
      if (w.connected) {
        setQrCode('');
      }
    }
  };

  // Enquanto o QR Code estiver aberto, verifica a cada 3s se o celular já escaneou e conectou
  useEffect(() => {
    if (!qrCode || waStatus?.connected) return;
    const timer = window.setInterval(async () => {
      try {
        const w = await whatsAppApi.getStatus();
        setWaStatus(w);
        if (w.connected) {
          setQrCode('');
          toast.success('WhatsApp conectado com sucesso!');
        }
      } catch {}
    }, 3000);
    return () => window.clearInterval(timer);
  }, [qrCode, waStatus?.connected, toast]);

  const loadUsers = async () => {
    try {
      const u = await authApi.getUsers();
      setUsers(u);
    } catch (e) {}
  };

  useEffect(() => {
    loadStatus();
    loadUsers();
  }, []);

  const handleOpenPwdModal = (u: UserSummary) => {
    setPwdModalUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPwdMessage(null);
  };

  const handleSaveUserPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pwdModalUser) return;
    if (!newPassword || newPassword.trim().length < 3) {
      setPwdMessage({ type: 'error', text: 'A nova senha deve ter no mínimo 3 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: 'error', text: 'As senhas não coincidem. Digite novamente.' });
      return;
    }
    setPwdLoading(true);
    setPwdMessage(null);
    try {
      const res = await authApi.changeUserPassword(pwdModalUser.id, newPassword.trim());
      toast.success(res.message || 'Senha alterada com sucesso!');
      setPwdModalUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setPwdMessage(null);
    } catch (err: any) {
      setPwdMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Erro ao alterar senha.',
      });
    } finally {
      setPwdLoading(false);
    }
  };

  const [roleLoadingId, setRoleLoadingId] = useState<number | null>(null);

  const handleRoleChange = async (u: UserSummary, newRole: 'ADMIN' | 'USER') => {
    if (u.role === newRole) return;
    const roleName = newRole === 'ADMIN' ? 'Administrador' : 'Funcionário';
    const confirmMsg =
      newRole === 'ADMIN'
        ? `Promover @${u.username} a Administrador?\n\nEle terá acesso total às configurações do sistema, integrações e gestão de usuários.`
        : `Transformar @${u.username} em Funcionário?\n\nEle perderá o acesso às configurações administrativas e visualizará apenas os próprios dados.`;

    const ok = await confirm({
      title: 'Alterar Nível de Acesso',
      message: confirmMsg,
      confirmLabel: 'Confirmar',
    });
    if (!ok) return;

    setRoleLoadingId(u.id);
    try {
      const res = await authApi.changeUserRole(u.id, newRole);
      toast.success(res.message || `Nível de acesso alterado para ${roleName}!`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Erro ao alterar nível de acesso.');
    } finally {
      setRoleLoadingId(null);
    }
  };

  const createWaInstance = async (reset = false) => {
    setGeneratingQr(true);
    setQrCode('');
    try {
      const res = await whatsAppApi.createInstance(reset);
      setWaStatus(res);
      if (res.connected) {
        toast.success('WhatsApp já está conectado!');
        return;
      }
      const initialQr = extractQr(res);
      if (initialQr) {
        setQrCode(initialQr);
        return;
      }
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const qrRes = await whatsAppApi.getQrCode();
        setWaStatus(qrRes);
        if (qrRes.connected) {
          toast.success('WhatsApp conectado com sucesso!');
          return;
        }
        const extracted = extractQr(qrRes);
        if (extracted) {
          setQrCode(extracted);
          return;
        }
      }
      toast.error('Não foi possível obter o QR Code. Tente clicar em Reiniciar Sessão.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Erro ao gerar QR Code do WhatsApp.');
    } finally {
      setGeneratingQr(false);
      loadStatus();
    }
  };

  const handleDisconnectWa = async () => {
    const ok = await confirm({
      title: 'Desconectar / Reiniciar WhatsApp',
      message: 'Deseja desconectar a instância atual do WhatsApp para conectar outro aparelho ou gerar um novo QR Code?',
      confirmLabel: 'Desconectar',
      danger: true,
    });
    if (!ok) return;

    setDisconnectingWa(true);
    try {
      const res = await whatsAppApi.disconnect();
      setWaStatus(res);
      setQrCode('');
      toast.info('Instância do WhatsApp desconectada.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Erro ao desconectar WhatsApp.');
    } finally {
      setDisconnectingWa(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await whatsAppApi.sendTest(testMsg || undefined);
      toast.success(`Mensagem de teste enviada para ${res.phone || 'seu WhatsApp'}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Falha ao enviar mensagem de teste.');
    } finally {
      setSending(false);
    }
  };

  const runAdvancedSync = async () => {
    if (!advStartDate || !advEndDate) {
      toast.error('Selecione data inicial e final.');
      return;
    }
    if (!advUserId) {
      toast.error('Selecione um usuário alvo para sincronizar.');
      return;
    }
    const userId = parseInt(advUserId);

    setAdvSyncing(true);
    setAdvLogs([]);
    cancelSyncRef.current = false;

    const current = new Date(advStartDate + 'T12:00:00');
    const end = new Date(advEndDate + 'T12:00:00');

    while (current <= end) {
      if (cancelSyncRef.current) {
        setAdvLogs((prev) => [
          ...prev,
          { date: 'Aviso', msg: 'Sincronização interrompida pelo usuário', status: 'error' },
        ]);
        break;
      }

      const dateStr = current.toISOString().split('T')[0];

      setAdvLogs((prev) => [...prev, { date: dateStr, msg: 'Buscando...', status: 'pending' }]);
      try {
        const r = await gmailApi.syncAdvanced({ startDate: dateStr, endDate: dateStr, userId });
        const existingCount = Math.max(r.alreadyExisting || 0, r.dbCount || 0);
        let msg = '';
        let status = 'success';

        if (r.processed > 0 && existingCount > 0) {
          msg = `${r.processed} nova(s) (+${existingCount} já salvas)`;
        } else if (r.processed > 0) {
          msg = `${r.processed} nova(s) batida(s) importada(s)`;
        } else if (existingCount > 0) {
          msg = `${existingCount} batida(s) já salvas anteriormente`;
          status = 'existing';
        } else {
          msg = '0 batidas (sem registros / folga)';
          status = 'empty';
        }

        setAdvLogs((prev) => prev.map((l) => (l.date === dateStr ? { ...l, msg, status } : l)));
      } catch (e: any) {
        const errMsg = e.response?.data?.message || 'Erro';
        setAdvLogs((prev) =>
          prev.map((l) => (l.date === dateStr ? { ...l, msg: errMsg, status: 'error' } : l))
        );

        if (errMsg.includes('rateLimitExceeded') || e.response?.status === 429) {
          await new Promise((r) => setTimeout(r, 4000));
        }
      }

      await new Promise((r) => setTimeout(r, 600));
      current.setDate(current.getDate() + 1);
    }
    setAdvSyncing(false);
    toast.info('Sincronização em lote finalizada.');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Opções e Integrações</p>
      </div>

      {!isAdmin ? (
        <div className="card">
          <div className="empty-state">
            <p>Seu perfil não possui acesso de Administrador para realizar integrações.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid-2">
            {/* Gmail */}
            <div className="card">
              <div className="section-title"><span className="dot" />Gmail Integration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StatusRow
                  label="credentials.json"
                  ok={gmailStatus?.hasCredentials ?? false}
                  okText="Encontrado"
                  failText="Não encontrado"
                />

                {(() => {
                  const googleUrl = `https://console.cloud.google.com/apis/credentials/consent?project=${gmailStatus?.projectId || 'financasponto'}`;
                  return (
                    <div
                      className="holiday-import-box"
                      style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        borderColor: 'rgba(59, 130, 246, 0.25)',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ExternalLink size={18} className="text-blue" />
                          <strong style={{ fontSize: 14 }}>
                            Liberar E-mails de Teste no Google
                          </strong>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(googleUrl);
                              setCopiedLink(true);
                              toast.info('Link copiado!');
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            title="Copiar link direto para abrir em outro navegador"
                          >
                            {copiedLink ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                            {copiedLink ? 'Copiado!' : 'Copiar Link'}
                          </button>
                          <a
                            href={googleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                          >
                            <ExternalLink size={15} />
                            Abrir Painel Google Cloud
                          </a>
                        </div>
                      </div>

                      <p className="text-secondary" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                        Como o app OAuth ainda está em modo de teste no Google Cloud, <strong>novos e-mails só conseguem conectar após serem liberados na lista de "Usuários de teste"</strong> para evitar erro 403 / "App não verificado".
                      </p>

                      <div className="text-secondary" style={{ fontSize: 12, background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: 6, lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                          📋 Passo a passo para liberar novo e-mail:
                        </div>
                        1. Clique em <strong>Abrir Painel Google Cloud</strong> acima.<br />
                        2. Na tela que abrir, role até a seção <strong>Usuários de teste</strong> (Test users).<br />
                        3. Clique em <strong>+ ADD USERS</strong> (ou <em>Adicionar usuários</em>).<br />
                        4. Digite o e-mail Google que deseja autorizar e clique em <strong>Salvar</strong>.<br />
                        5. Pronto! O colaborador já poderá conectar o Gmail na página <strong>Meu Perfil</strong>.
                      </div>
                    </div>
                  );
                })()}

                <div className="text-secondary" style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Conexão individual por usuário:</strong><br />
                  Cada colaborador deve acessar <strong>Meu Perfil</strong> para conectar sua respectiva conta Gmail e sincronizar os comprovantes da pmovel.
                </div>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="card">
              <div className="ponto-card-header" style={{ marginBottom: 14 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>
                  <span className="dot" />WhatsApp (Evolution API)
                </div>
                <span
                  className={`badge ${
                    waStatus?.connected
                      ? 'badge-green'
                      : waStatus?.state === 'connecting'
                      ? 'badge-amber'
                      : 'badge-red'
                  }`}
                >
                  {waStatus?.connected
                    ? '● Conectado'
                    : waStatus?.state === 'connecting'
                    ? '◐ Aguardando QR'
                    : '○ Desconectado'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="text-secondary" style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.6 }}>
                  {waStatus?.connected ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <strong className="text-green">✅ Sessão Ativa na Evolution API</strong>
                          <div style={{ marginTop: 4 }}>
                            Aparelho conectado: <strong>{waStatus.profileName || 'WhatsApp'}</strong>{' '}
                            {waStatus.ownerJid && <span className="text-green">({waStatus.ownerJid})</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        Cada colaborador com telefone cadastrado no <strong>Meu Perfil</strong> receberá avisos de batida do dia, alerta de hora extra e resumos às 12h e 21h.
                        {waStatus.targetPhone && (
                          <> Seu destino de teste atual: <strong className="text-green">+{waStatus.targetPhone}</strong></>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <strong style={{ color: 'var(--text-primary)' }}>Como conectar o WhatsApp central:</strong><br />
                      1. Toque em <strong>Gerar QR Code / Conectar</strong> abaixo<br />
                      2. No seu celular, abra o WhatsApp → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong><br />
                      3. Escaneie o QR Code na tela (o status mudará para <strong className="text-green">Conectado</strong> automaticamente)
                    </>
                  )}
                </div>

                {qrCode && !waStatus?.connected && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      Escaneie o QR Code abaixo com seu WhatsApp:
                    </div>
                    <div className="qr-container">
                      <img src={qrCode} alt="QR Code WhatsApp" />
                    </div>
                    <p className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      Aguardando leitura no celular... A tela atualizará sozinha assim que conectar.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {!waStatus?.connected && (
                    <button
                      id="btn-create-wa-instance"
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: '1 1 200px' }}
                      onClick={() => createWaInstance(false)}
                      disabled={generatingQr || disconnectingWa}
                    >
                      📱 {generatingQr ? 'Gerando QR Code...' : qrCode ? 'Atualizar QR Code' : 'Gerar QR Code / Conectar'}
                    </button>
                  )}

                  {!waStatus?.connected && waStatus?.exists && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: '1 1 160px' }}
                      onClick={() => createWaInstance(true)}
                      disabled={generatingQr || disconnectingWa}
                      title="Apaga a sessão travada e cria um novo QR Code limpo"
                    >
                      <RefreshCw size={14} className={generatingQr ? 'spin' : ''} />
                      Reiniciar Sessão
                    </button>
                  )}

                  {waStatus?.exists && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ flex: '1 1 140px' }}
                      onClick={handleDisconnectWa}
                      disabled={disconnectingWa || generatingQr}
                    >
                      {disconnectingWa ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  )}
                </div>

                <hr className="divider" />

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mensagem de teste</label>
                  <input
                    className="form-input"
                    placeholder="Deixe vazio para mensagem padrão"
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                  />
                </div>
                <button
                  id="btn-send-test-wa"
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={sendTest}
                  disabled={sending}
                >
                  <Send size={15} />
                  {sending ? 'Enviando...' : 'Enviar Teste'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title"><span className="dot" />Cadastrar Novo Usuário (Admin)</div>
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const data = {
                    username: (form.elements.namedItem('username') as HTMLInputElement).value,
                    password: (form.elements.namedItem('password') as HTMLInputElement).value,
                    employeeName: (form.elements.namedItem('employeeName') as HTMLInputElement).value,
                    cpf: (form.elements.namedItem('cpf') as HTMLInputElement).value,
                    whatsappPhone: (form.elements.namedItem('whatsappPhone') as HTMLInputElement).value,
                    role: (form.elements.namedItem('role') as HTMLSelectElement).value,
                  };
                  try {
                    await authApi.register(data);
                    toast.success('Usuário criado com sucesso!');
                    form.reset();
                    await loadUsers();
                  } catch (err: any) {
                    toast.error('Erro ao criar usuário: ' + (err.response?.data || err.message));
                  }
                }}
              >
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Usuário de Acesso (Login)</label>
                  <input name="username" required className="form-input" placeholder="ex: joao.silva" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Senha</label>
                  <input name="password" type="password" required className="form-input" placeholder="***" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nome Completo (Conforme no comprovante - Opcional)</label>
                  <input name="employeeName" className="form-input" placeholder="JOAO DA SILVA" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">CPF ou PIS (Apenas números - Obrigatório para ponto autom.)</label>
                  <input name="cpf" className="form-input" placeholder="ex: 19553186700" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">WhatsApp (Opcional, com DDD)</label>
                  <input name="whatsappPhone" className="form-input" placeholder="ex: +5511999999999" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nível de Acesso</label>
                  <select name="role" className="form-select" defaultValue="USER">
                    <option value="USER">Funcionário (Apenas vê seus próprios dados)</option>
                    <option value="ADMIN">Administrador (Pode ver configurações)</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 6 }}>
                  Criar Usuário
                </button>
              </form>
            </div>

            {/* Gerenciamento de Usuários e Troca de Senha */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="ponto-card-header">
                <div className="section-title" style={{ marginBottom: 0 }}>
                  <span className="dot" />Usuários, Acessos & Senhas ({users.length})
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={loadUsers}
                  title="Atualizar lista"
                >
                  <RefreshCw size={14} /> Atualizar
                </button>
              </div>
              <p className="text-secondary" style={{ fontSize: 13, marginBottom: 14 }}>
                Como administrador, você pode alterar o nível de acesso (Admin ou Funcionário) e redefinir a senha de qualquer usuário.
              </p>

              <div className="user-mgmt-list">
                {users.length === 0 ? (
                  <div className="text-secondary" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>
                    Nenhum usuário cadastrado.
                  </div>
                ) : (
                  users.map((u) => {
                    const isAdminUser = u.role === 'ADMIN';
                    return (
                      <div key={u.id} className="user-mgmt-item">
                        <div className="user-mgmt-info">
                          <div className={`user-avatar ${isAdminUser ? 'admin' : 'user'}`}>
                            {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: 14 }}>{u.username}</strong>
                              <span className={`badge ${isAdminUser ? 'badge-purple' : 'badge-green'}`}>
                                {isAdminUser ? 'Admin' : 'Funcionário'}
                              </span>
                            </div>
                            <div
                              className="text-secondary"
                              style={{
                                fontSize: 12,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {u.employeeName || 'Sem nome vinculado'}
                            </div>
                          </div>
                        </div>

                        <div className="user-mgmt-actions">
                          <select
                            className={`form-select user-role-select ${isAdminUser ? 'admin' : 'user'}`}
                            value={u.role || 'USER'}
                            onChange={(e) => handleRoleChange(u, e.target.value as 'ADMIN' | 'USER')}
                            disabled={roleLoadingId === u.id}
                            aria-label={`Nível de acesso de ${u.username}`}
                          >
                            <option value="USER">Funcionário</option>
                            <option value="ADMIN">Admin</option>
                          </select>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPwdModal(u)}
                            title="Redefinir senha"
                          >
                            <Key size={14} />
                            <span>Senha</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Busca Avançada de Histórico (Range e Usuário) */}
          <div className="grid-2" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="section-title"><span className="dot" />Sincronização Avançada (Lote)</div>
              <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
                Busca comprovantes em lote, dia por dia, para evitar os limites do Gmail.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Usuário Específico</label>
                  <select className="form-select" value={advUserId} onChange={(e) => setAdvUserId(e.target.value)}>
                    <option value="">-- Selecione um Usuário --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.employeeName || u.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Data Inicial</label>
                    <input
                      type="date"
                      className="form-input"
                      value={advStartDate}
                      onChange={(e) => setAdvStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Data Final</label>
                    <input
                      type="date"
                      className="form-input"
                      value={advEndDate}
                      onChange={(e) => setAdvEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={runAdvancedSync}
                    disabled={advSyncing}
                    style={{ flex: 1 }}
                  >
                    {advSyncing ? 'Sincronizando lote...' : 'Iniciar Sincronização'}
                  </button>
                  {advSyncing && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        cancelSyncRef.current = true;
                      }}
                    >
                      Parar
                    </button>
                  )}
                </div>

                {advLogs.length > 0 && (
                  <div
                    ref={logContainerRef}
                    style={{
                      marginTop: 8,
                      padding: 10,
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: 'var(--radius-sm)',
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}
                  >
                    {advLogs.map((l) => (
                      <div
                        key={l.date}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '2px 12px',
                          fontSize: 12,
                          padding: '6px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <span className="text-secondary">{l.date}</span>
                        <span
                          className={
                            l.status === 'success'
                              ? 'text-green'
                              : l.status === 'existing'
                              ? 'text-blue'
                              : l.status === 'pending'
                              ? 'text-amber'
                              : l.status === 'empty'
                              ? 'text-muted'
                              : l.status === 'error'
                              ? 'text-danger'
                              : ''
                          }
                          style={{ fontWeight: l.status === 'success' || l.status === 'existing' ? 600 : 400 }}
                        >
                          {l.status === 'success'
                            ? '✅ '
                            : l.status === 'existing'
                            ? 'ℹ️ '
                            : l.status === 'empty'
                            ? '⚪ '
                            : l.status === 'error'
                            ? '🔴 '
                            : ''}
                          {l.msg}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de Troca de Senha de Usuário (Bottom Sheet no Celular) */}
      <BottomSheetModal
        isOpen={!!pwdModalUser}
        onClose={() => !pwdLoading && setPwdModalUser(null)}
        title="Redefinir Senha"
        icon={<Key size={18} className="text-blue" />}
        maxWidth={440}
        footer={
          <div className="modal-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pwdLoading}
              onClick={() => setPwdModalUser(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pwdLoading}
              onClick={() => handleSaveUserPassword()}
            >
              <Lock size={15} />
              {pwdLoading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        }
      >
        {pwdModalUser && (
          <form onSubmit={handleSaveUserPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.22)', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
              <div>Usuário: <strong>@{pwdModalUser.username}</strong></div>
              {pwdModalUser.employeeName && (
                <div className="text-secondary" style={{ fontSize: 12, marginTop: 2 }}>
                  Colaborador: {pwdModalUser.employeeName}
                </div>
              )}
            </div>

            {pwdMessage && (
              <div
                className={pwdMessage.type === 'success' ? 'punches-status-banner compensated' : 'punches-status-banner incomplete'}
                style={{ marginBottom: 0, padding: '10px 12px', fontSize: 13 }}
              >
                {pwdMessage.text}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nova Senha</label>
              <div className="pwd-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 3 caracteres"
                />
                <button
                  type="button"
                  className="pwd-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Confirmar Nova Senha</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
          </form>
        )}
      </BottomSheetModal>
    </div>
  );
}

function StatusRow({ label, ok, okText, failText }: { label: string; ok: boolean; okText: string; failText: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span className="text-secondary" style={{ fontSize: 14 }}>{label}</span>
      <span className={ok ? 'text-green' : 'text-danger'} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
        {ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
        {ok ? okText : failText}
      </span>
    </div>
  );
}

function extractQr(raw: any): string {
  try {
    let val = '';
    if (typeof raw === 'string') {
      if (raw.startsWith('data:image')) return raw;
      const obj = JSON.parse(raw);
      val = obj?.qrcode?.base64 ?? obj?.base64 ?? '';
    } else {
      val = raw?.qrcode?.base64 ?? raw?.base64 ?? '';
    }
    if (!val) return '';
    return val.startsWith('data:image') ? val : `data:image/png;base64,${val}`;
  } catch {
    return '';
  }
}
