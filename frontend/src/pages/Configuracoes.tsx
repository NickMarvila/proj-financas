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
  const [sending, setSending] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<boolean | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);

  const loadStatus = async () => {
    const [g, w] = await Promise.all([
      gmailApi.getStatus().catch(() => null),
      whatsAppApi.getStatus().catch(() => '{}'),
    ]);
    setGmailStatus(g);
    setWaStatus(w);
  };

  useEffect(() => { loadStatus(); }, []);

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
      const r = await gmailApi.syncHistory();
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
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button id="btn-sync-gmail-cfg" className="btn btn-primary" onClick={syncGmail} disabled={syncing}>
                  <RefreshCw size={15} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar E-mails Agora'}
                </button>
                <button id="btn-sync-history-gmail-cfg" className="btn btn-secondary" onClick={syncHistory} disabled={syncing}>
                  <RefreshCw size={15} />
                  Sincronizar Histórico (Ler Antigos)
                </button>
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
