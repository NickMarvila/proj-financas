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
  const [isAdmin, setIsAdmin] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [advStartDate, setAdvStartDate] = useState('');
  const [advEndDate, setAdvEndDate] = useState('');
  const [advUserId, setAdvUserId] = useState<string>('');
  const [advLogs, setAdvLogs] = useState<{date: string, msg: string, status: string}[]>([]);
  const [advSyncing, setAdvSyncing] = useState(false);

  const loadStatus = async () => {
    try {
      const { authApi } = await import('../api/client');
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
      const { authApi } = await import('../api/client');
      const u = await authApi.getUsers();
      setUsers(u);
    } catch(e) {}
  };

  useEffect(() => { loadStatus(); loadUsers(); }, []);



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
    if (!advUserId) return alert("Selecione um usuário alvo para sincronizar");
    const userId = parseInt(advUserId);

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
        setAdvLogs(prev => prev.map(l => l.date === dateStr ? { ...l, msg: e.response?.data?.message || `Erro`, status: 'error' } : l));
      }
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
            
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Mudança na Integração Gmail:</strong><br />
              A partir de agora, cada usuário deve conectar seu próprio e-mail do Gmail na página <strong>Meu Perfil</strong>. 
              As credenciais globais cadastradas aqui no servidor servem apenas para habilitar o aplicativo OAuth2 do Google.
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
              cpf: (form.elements.namedItem('cpf') as HTMLInputElement).value,
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
        </>
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
