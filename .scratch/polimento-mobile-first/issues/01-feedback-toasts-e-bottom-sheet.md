# 01: Sistema de Feedback Mobile-First (Toasts, Confirm Sheet e Base de Bottom Sheet)

**What to build:** substituir todos os diálogos nativos (`alert()` e `window.confirm()`) do FinançasPonto por um sistema próprio de Toasts não-bloqueantes e um Bottom Sheet de confirmação no celular (modal centralizado no desktop). Padronizar a estrutura CSS global de modais (`.modal-overlay`, `.modal`, `.modal-handle`, `.modal-header`, `.modal-body`, `.modal-footer`) para funcionar como Bottom Sheet no celular (`max-height: 90dvh`, `env(safe-area-inset-bottom)`, trava de scroll do fundo e fechamento com `Escape` ou clique no backdrop).

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] Provedor global de feedback disponibiliza notificações Toast (`success`, `error`, `info`) e diálogo de confirmação assíncrono (`confirm`) acessível em todas as rotas.
- [x] Toasts respeitam `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`, não encobrem a navegação inferior fixa e possuem botão de fechar com alvo de toque `>= 44×44px`.
- [x] Diálogo de confirmação abre como Bottom Sheet no celular (`< 768px`) com `max-height: 90dvh` e botões de ação `>= 44px`, e centralizado em telas maiores (`>= 768px`).
- [x] Nenhuma chamada residual a `window.alert`, `alert(...)` ou `window.confirm(...)` permanece nas páginas e componentes do frontend.
- [x] Classes utilitárias de Bottom Sheet/Modal em `index.css` suportam alça superior (`.modal-handle`), bloqueio de `overflow` do `body` quando aberto e fechamento via tecla `Escape`.
- [x] `npx tsc -b && npm run build` passa sem erros.
