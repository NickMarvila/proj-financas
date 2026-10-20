import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Send, CheckCircle, XCircle, ExternalLink, Copy, Check, Key, Lock, Eye, EyeOff, X } from 'lucide-react';
import { gmailApi, whatsAppApi, authApi } from '../api/client';
import type { GmailStatus, UserSummary } from '../types';

export default function Configuracoes() {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [waStatus, setWaStatus] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [testMsg, setTestMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [historyDate, setHistoryDate] = useState('2026-07-01');
  const [sending, setSending] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<boolean | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
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
  const [advLogs, setAdvLogs] = useState<{date: string, msg: string, status: string}[]>([]);
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
    } catch(e) {}

    const [g, w] = await Promise.all([
      gmailApi.getStatus().catch(() => null),
      whatsAppApi.getStatus().catch(() => '{}'),
    ]);
    setGmailStatus(g);
    setWaStatus(w);
  };

  const loadUsers = async () => {
    try {
      const u = await authApi.getUsers();
      setUsers(u);
    } catch(e) {}
  };

  useEffect(() => { loadStatus(); loadUsers(); }, []);

  const handleOpenPwdModal = (u: UserSummary) => {
    setPwdModalUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPwdMessage(null);
  };

  const handleSaveUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setPwdMessage({ type: 'success', text: res.message || 'Senha alterada com sucesso!' });
      setTimeout(() => {
        setPwdModalUser(null);
        setNewPassword('');
        setConfirmPassword('');
        setPwdMessage(null);
      }, 1200);
    } catch (err: any) {
      setPwdMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Erro ao alterar senha.'
      });
    } finally {
      setPwdLoading(false);
    }
  };



  const createWaInstance = async () => {
    setGeneratingQr(true);
    setQrCode('');
    try {
      await whatsAppApi.createInstance();
      // Tenta buscar o QR Code a cada 2s por até 20s (Evolution API v2)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const qr = await whatsAppApi.getQrCode();
        if (extractQr(qr)) {
          setQrCode(qr);
          break;
        }
      }
    } finally {
      setGeneratingQr(false);
      loadStatus();
    }
  };

  const sendTest = async () => {
    setSending(true);
    await whatsAppApi.sendTest(testMsg || undefined).catch(() => {});
    setSending(false);
    alert('Mensagem enviada!');
  };

  const runAdvancedSync = async () => {
    if (!advStartDate || !advEndDate) return alert("Selecione data inicial e final");
    if (!advUserId) return alert("Selecione um usuário alvo para sincronizar");
    const userId = parseInt(advUserId);

    setAdvSyncing(true);
    setAdvLogs([]);
    cancelSyncRef.current = false;
    
    // Assegura que o timezone não mude a data selecionada
    const current = new Date(advStartDate + 'T12:00:00');
    const end = new Date(advEndDate + 'T12:00:00');

    while (current <= end) {
      if (cancelSyncRef.current) {
        setAdvLogs(prev => [...prev, { date: 'Aviso', msg: 'Sincronização interrompida pelo usuário', status: 'error' }]);
        break;
      }

      const dateStr = current.toISOString().split('T')[0];

      setAdvLogs(prev => [...prev, { date: dateStr, msg: 'Buscando...', status: 'pending' }]);
      try {
        // Envia startDate e endDate iguais para consultar com exatidão as 24h deste dia específico
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

        setAdvLogs(prev => prev.map(l => l.date === dateStr ? { ...l, msg, status } : l));
      } catch (e: any) {
        const errMsg = e.response?.data?.message || 'Erro';
        setAdvLogs(prev => prev.map(l => l.date === dateStr ? { ...l, msg: errMsg, status: 'error' } : l));
        
        // Se houver rate limit da API do Google, aguarda 4 segundos antes do próximo dia
        if (errMsg.includes('rateLimitExceeded') || e.response?.status === 429) {
          await new Promise(r => setTimeout(r, 4000));
        }
      }

      // Intervalo de 600ms entre as requisições diárias para respeitar a cota da API do Google
      await new Promise(r => setTimeout(r, 600));
      current.setDate(current.getDate() + 1);
    }
    setAdvSyncing(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Opções e Integrações</p>
      </div>

      {!isAdmin ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '40px 0' }}>
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
                <StatusRow label="credentials.json" ok={gmailStatus?.hasCredentials ?? false}
                  okText="Encontrado" failText="Não encontrado" />

                {/* Box de Acesso Rápido ao Painel do Google Cloud */}
                {(() => {
                  const googleUrl = `https://console.cloud.google.com/apis/credentials/consent?project=${gmailStatus?.projectId || 'financasponto'}`;
                  return (
                    <div style={{
                      padding: 16,
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ExternalLink size={18} color="#60a5fa" />
                          <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                            Liberar E-mails de Teste no Google
                          </strong>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              navigator.clipboard.writeText(googleUrl);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            title="Copiar link direto para abrir em outro navegador"
                            style={{ fontSize: 12, padding: '7px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          >
                            {copiedLink ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
                            {copiedLink ? 'Copiado!' : 'Copiar Link'}
                          </button>
                          <a
                            href={googleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, textDecoration: 'none', padding: '7px 14px' }}
                          >
                            <ExternalLink size={15} />
                            Abrir Painel Google Cloud
                          </a>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        Como o app OAuth ainda está em modo de teste no Google Cloud, <strong>novos e-mails só conseguem conectar após serem liberados na lista de "Usuários de teste"</strong> para evitar erro 403 / "App não verificado".
                      </p>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: 6, lineHeight: 1.6 }}>
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
                
                <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Conexão individual por usuário:</strong><br />
                  Cada colaborador deve acessar <strong>Meu Perfil</strong> para conectar sua respectiva conta Gmail e sincronizar os comprovantes da pmovel.
                </div>
              </div>
            </div>


        {/* WhatsApp */}
        <div className="card">
          <div className="section-title"><span className="dot" />WhatsApp (Evolution API)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Setup WhatsApp:</strong><br />
              1. Clique em "Criar Instância"<br />
              2. Escaneie o QR Code com seu WhatsApp<br />
              3. Pronto! Notificações ativadas para <strong style={{ color: 'var(--accent-green)' }}>+55 24 99985-6230</strong>
            </div>

            {qrCode && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Escaneie o QR Code:</div>
                <div className="qr-container">
                  <img src={`data:image/png;base64,${extractQr(qrCode)}`} alt="QR Code WhatsApp" />
                </div>
              </div>
            )}

            <button id="btn-create-wa-instance" className="btn btn-primary" onClick={createWaInstance} disabled={generatingQr}>
              📱 {generatingQr ? 'Gerando QR Code (aguarde...)' : 'Criar Instância / Ver QR Code'}
            </button>

            <hr className="divider" />

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mensagem de teste</label>
              <input
                className="form-input"
                placeholder="Deixe vazio para mensagem padrão"
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
              />
            </div>
            <button id="btn-send-test-wa" className="btn btn-secondary" onClick={sendTest} disabled={sending}>
              <Send size={15} />
              {sending ? 'Enviando...' : 'Enviar Teste'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="section-title"><span className="dot" />Cadastrar Novo Usuário (Admin)</div>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={async (e) => {
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
              alert('Usuário criado com sucesso!');
              form.reset();
              await loadUsers();
            } catch (err: any) {
              alert('Erro ao criar usuário: ' + (err.response?.data || err.message));
            }
          }}>
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
              <select name="role" className="form-input" defaultValue="USER">
                <option value="USER">Funcionário (Apenas vê seus próprios dados)</option>
                <option value="ADMIN">Administrador (Pode ver configurações)</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
              Criar Usuário
            </button>
          </form>
        </div>

        {/* Gerenciamento de Usuários e Troca de Senha */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <span className="dot" />Usuários & Troca de Senha ({users.length})
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadUsers}
              title="Atualizar lista"
              style={{ padding: '4px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Como administrador, você pode redefinir a senha de qualquer usuário diretamente.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
            {users.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                Nenhum usuário cadastrado.
              </div>
            ) : (
              users.map((u) => {
                const isAdminUser = u.role === 'ADMIN';
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md, 8px)',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: isAdminUser ? 'rgba(139, 92, 246, 0.18)' : 'rgba(16, 185, 129, 0.15)',
                          color: isAdminUser ? '#a78bfa' : '#34d399',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                            {u.username}
                          </span>
                          <span
                            className={isAdminUser ? 'badge-purple' : 'badge-green'}
                            style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4 }}
                          >
                            {isAdminUser ? 'Admin' : 'Funcionário'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.employeeName || 'Sem nome vinculado'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenPwdModal(u)}
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <Key size={13} />
                      <span>Trocar Senha</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Busca Avançada de Histórico (Range e Usuário) */}
      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="section-title"><span className="dot" />Sincronização Avançada (Lote)</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Busca comprovantes em lote, dia por dia, para evitar os limites do Gmail.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Usuário Específico (Opcional)</label>
              <select className="form-input" value={advUserId} onChange={e => setAdvUserId(e.target.value)}>
                <option value="">-- Todos os Usuários --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.employeeName || u.username}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 140px' }}>
                <label className="form-label">Data Inicial</label>
                <input type="date" className="form-input" value={advStartDate} onChange={e => setAdvStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 140px' }}>
                <label className="form-label">Data Final</label>
                <input type="date" className="form-input" value={advEndDate} onChange={e => setAdvEndDate(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
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
                  onClick={() => { cancelSyncRef.current = true; }}
                  style={{ minWidth: 90 }}
                >
                  Parar
                </button>
              )}
            </div>
            
            {advLogs.length > 0 && (
              <div
                ref={logContainerRef}
                style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', maxHeight: 220, overflowY: 'auto' }}
              >
                {advLogs.map(l => (
                  <div key={l.date} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l.date}</span>
                    <span style={{ 
                      color: l.status === 'success' ? 'var(--accent-green)' : 
                             l.status === 'existing' ? '#60a5fa' :
                             l.status === 'pending' ? 'var(--accent-amber)' :
                             l.status === 'empty' ? 'var(--text-muted)' :
                             l.status === 'error' ? 'var(--accent-red)' : 'var(--text-primary)',
                      fontWeight: l.status === 'success' || l.status === 'existing' ? 500 : 400
                    }}>
                      {l.status === 'success' ? '✅ ' :
                       l.status === 'existing' ? 'ℹ️ ' :
                       l.status === 'empty' ? '⚪ ' :
                       l.status === 'error' ? '🔴 ' : ''}
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

      {/* Modal de Troca de Senha de Usuário (Admin) */}
      {pwdModalUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pwdLoading) setPwdModalUser(null);
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #111827)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg, 12px)',
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={18} color="var(--accent-primary, #3b82f6)" />
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  Redefinir Senha
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => !pwdLoading && setPwdModalUser(null)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveUserPassword} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
                <div>Usuário: <strong style={{ color: 'var(--text-primary)' }}>@{pwdModalUser.username}</strong></div>
                {pwdModalUser.employeeName && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
                    Colaborador: {pwdModalUser.employeeName}
                  </div>
                )}
              </div>

              {pwdMessage && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: pwdMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${pwdMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    color: pwdMessage.type === 'success' ? '#34d399' : '#f87171',
                  }}
                >
                  {pwdMessage.text}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nova Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 3 caracteres"
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    title={showPassword ? 'Ocultar' : 'Exibir'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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

              <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pwdLoading}
                  onClick={() => setPwdModalUser(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={pwdLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Lock size={15} />
                  {pwdLoading ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, ok, okText, failText }: { label: string; ok: boolean; okText: string; failText: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
        {ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
        {ok ? okText : failText}
      </span>
    </div>
  );
}

function extractQr(raw: any): string {
  try {
    if (typeof raw === 'string') {
      const obj = JSON.parse(raw);
      return obj?.qrcode?.base64 ?? obj?.base64 ?? '';
    }
    return raw?.qrcode?.base64 ?? raw?.base64 ?? '';
  } catch {
    return '';
  }
}
