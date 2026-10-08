import { useEffect, useState } from 'react';
import { RefreshCw, Send, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { gmailApi, whatsAppApi } from '../api/client';
import type { GmailStatus } from '../types';

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

  const [users, setUsers] = useState<any[]>([]);
  const [advStartDate, setAdvStartDate] = useState('');
  const [advEndDate, setAdvEndDate] = useState('');
  const [advUserId, setAdvUserId] = useState<string>('');
  const [advLogs, setAdvLogs] = useState<{date: string, msg: string, status: string}[]>([]);
  const [advSyncing, setAdvSyncing] = useState(false);

  const loadStatus = async () => {
    const [g, w] = await Promise.all([
      gmailApi.getStatus().catch(() => null),
      whatsAppApi.getStatus().catch(() => '{}'),
    ]);
    setGmailStatus(g);
    setWaStatus(w);
  };

  const loadUsers = async () => {
    try {
      const { authApi } = await import('../api/client');
      const u = await authApi.getUsers();
      setUsers(u);
    } catch(e) {}
  };

  useEffect(() => { loadStatus(); loadUsers(); }, []);

  const getGmailAuthUrl = async () => {
    setAuthLoading(true);
    try {
      const r = await gmailApi.getAuthUrl();
      setAuthUrl(r.authUrl);
    } finally {
      setAuthLoading(false);
    }
  };

  const submitCode = async () => {
    if (!authCode.trim()) return;
    setAuthLoading(true);
    try {
      const r = await gmailApi.submitCode(authCode);
      setAuthSuccess(r.success);
      if (r.success) { setAuthUrl(''); setAuthCode(''); await loadStatus(); }
    } finally {
      setAuthLoading(false);
    }
  };

  const syncGmail = async () => {
    setSyncing(true);
    try {
      const r = await gmailApi.sync();
      alert(`${r.processed} e-mail(s) processados`);
    } catch (e: any) {
      alert(`Erro ao sincronizar: ${e.response?.data?.message || e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const syncHistory = async () => {
    setSyncing(true);
    try {
      const r = await gmailApi.syncHistory(historyDate);
      alert(`${r.processed} e-mail(s) do histórico processados`);
    } catch (e: any) {
      alert(`Erro ao sincronizar histórico: ${e.response?.data?.message || e.message}`);
    } finally {
      setSyncing(false);
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
    setAdvSyncing(true);
    setAdvLogs([]);
    
    // Assegura que o timezone não mude a data selecionada
    const current = new Date(advStartDate + 'T12:00:00');
    const end = new Date(advEndDate + 'T12:00:00');
    const userId = advUserId ? parseInt(advUserId) : undefined;

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDateStr = nextDay.toISOString().split('T')[0];

      setAdvLogs(prev => [...prev, { date: dateStr, msg: 'Buscando...', status: 'pending' }]);
      try {
        const r = await gmailApi.syncAdvanced({ startDate: dateStr, endDate: nextDateStr, userId });
        setAdvLogs(prev => prev.map(l => l.date === dateStr ? { ...l, msg: `${r.processed} batidas`, status: 'success' } : l));
      } catch (e: any) {
        setAdvLogs(prev => prev.map(l => l.date === dateStr ? { ...l, msg: `Erro`, status: 'error' } : l));
      }
      current.setDate(current.getDate() + 1);
    }
    setAdvSyncing(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Integrações com Gmail e WhatsApp</p>
      </div>

      <div className="grid-2">
        {/* Gmail */}
        <div className="card">
          <div className="section-title"><span className="dot" />Gmail Integration</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StatusRow label="credentials.json" ok={gmailStatus?.hasCredentials ?? false}
              okText="Encontrado" failText="Não encontrado" />
            <StatusRow label="OAuth2 Token" ok={gmailStatus?.isAuthenticated ?? false}
              okText="Autenticado" failText="Não autenticado" />

            {!gmailStatus?.isAuthenticated && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Como autorizar o Gmail:</strong><br />
                  1. Clique em "Gerar URL de Autorização"<br />
                  2. Abra o link no seu navegador, faça login e clique em "Permitir"<br />
                  3. A página vai dar erro (localhost:8888) — <strong>Isso é normal!</strong><br />
                  4. Copie o <strong>código</strong> que está na barra de endereço (ex: <code>?code=4/0A...</code>)<br />
                  5. Cole o código abaixo e clique em "Confirmar"
                </div>

                <button id="btn-gmail-auth-url" className="btn btn-primary" onClick={getGmailAuthUrl} disabled={authLoading}>
                  {authLoading ? <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> Gerando...</> : '🔑 Gerar URL de Autorização'}
                </button>

                {authUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', fontSize: 12, wordBreak: 'break-all' }}>
                      <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>URL de autorização:</div>
                      <a href={authUrl} target="_blank" rel="noopener" style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ExternalLink size={12} /> Abrir no navegador
                      </a>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Cole o código aqui</label>
                      <input id="input-gmail-code" className="form-input" placeholder="4/0AXO..."
                        value={authCode} onChange={e => setAuthCode(e.target.value)} />
                    </div>
                    <button id="btn-gmail-submit-code" className="btn btn-primary" onClick={submitCode} disabled={authLoading || !authCode}>
                      ✅ Confirmar e autenticar
                    </button>
                  </div>
                )}

                {authSuccess === false && (
                  <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>❌ Código inválido. Tente novamente.</div>
                )}
                {authSuccess === true && (
                  <div style={{ color: 'var(--accent-green)', fontSize: 13 }}>✅ Gmail autenticado com sucesso!</div>
                )}
              </div>
            )}

            {gmailStatus?.isAuthenticated && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button id="btn-sync-gmail-cfg" className="btn btn-primary" onClick={syncGmail} disabled={syncing}>
                  <RefreshCw size={15} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar Novos E-mails'}
                </button>
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sincronizar histórico a partir de:</div>
                  <input type="date" className="form-input" value={historyDate} onChange={e => setHistoryDate(e.target.value)} />
                  <button id="btn-sync-history-gmail-cfg" className="btn btn-secondary" onClick={syncHistory} disabled={syncing}>
                    <RefreshCw size={15} />
                    Sincronizar Histórico
                  </button>
                </div>
              </div>
            )}
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
                  <img src={`data:image/png;base64,${extractQr(qrCode)}`} alt="QR Code WhatsApp" style={{ width: 200, height: 200 }} />
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
              matricula: (form.elements.namedItem('matricula') as HTMLInputElement).value,
              whatsappPhone: (form.elements.namedItem('whatsappPhone') as HTMLInputElement).value,
              role: (form.elements.namedItem('role') as HTMLSelectElement).value,
            };
            try {
              const { authApi } = await import('../api/client');
              await authApi.register(data);
              alert('Usuário criado com sucesso!');
              form.reset();
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
              <label className="form-label">Matrícula (Sem zeros a esquerda - Obrigatório para ponto autom.)</label>
              <input name="matricula" className="form-input" placeholder="ex: 24719" />
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
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">Data Inicial</label>
                <input type="date" className="form-input" value={advStartDate} onChange={e => setAdvStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">Data Final</label>
                <input type="date" className="form-input" value={advEndDate} onChange={e => setAdvEndDate(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={runAdvancedSync} disabled={advSyncing}>
              {advSyncing ? 'Sincronizando lote...' : 'Iniciar Sincronização'}
            </button>
            
            {advLogs.length > 0 && (
              <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', maxHeight: 200, overflowY: 'auto' }}>
                {advLogs.map(l => (
                  <div key={l.date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l.date}</span>
                    <span style={{ 
                      color: l.status === 'success' ? 'var(--accent-green)' : 
                             l.status === 'error' ? 'var(--accent-red)' : 'var(--text-primary)' 
                    }}>
                      {l.msg}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
