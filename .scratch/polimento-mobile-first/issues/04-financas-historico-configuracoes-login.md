# 04: Polimento Mobile-First em Finanças, Histórico, Configurações e Login

**What to build:** concluir a padronização Mobile-First nas telas de `Finanças`, `Histórico`, `Configurações` e `Login`, migrando estilos inline para classes CSS responsivas em `index.css`, garantindo `font-size: 16px` em todos os campos de formulário e área mínima de `44×44px` em todos os botões e controles interativos, e convertendo o modal de Redefinir Senha de `Configurações` para Bottom Sheet.

**Blocked by:** 01: Sistema de Feedback Mobile-First (Toasts, Confirm Sheet e Base de Bottom Sheet).

**Status:** completed

- [x] Em `Finanças`, a lista de despesas fixas e o card de configuração de salário exibem valores monetários longos sem cortar em `360px`, os botões de editar/excluir despesa e editar/salvar salário têm `>= 44×44px` no celular, e o modal de despesa usa a estrutura padronizada de Bottom Sheet.
- [x] Em `Histórico`, os cards mensais e a grade `.hist-cells` (2×2 no celular) exibem rótulos `>= 11px` e saldos sem estourar a largura de `360px`.
- [x] Em `Configurações`, cada item da lista de usuários possui `<select>` de nível de acesso com `font-size: 16px` e `min-height: 44px` e botão "Senha" com `min-height: 44px`, empilhando de forma limpa em `360px`.
- [x] O Modal de Redefinir Senha em `Configurações` usa a estrutura `.modal-overlay` / `.modal` (Bottom Sheet no celular com `90dvh` e `safe-area-inset-bottom`), com botão de mostrar/ocultar senha de `44×44px`.
- [x] Em `Login`, o objeto `styles` inline é substituído por classes CSS Mobile-First em `index.css`, mantendo a animação de entrada, inputs com `16px`, `min-height: 44px` e botão de mostrar/ocultar senha com alvo de `44×44px`.
- [x] Zero rolagem horizontal em `360px`, `390px`, `768px` e `1280px` em todas as rotas, e `npx tsc -b && npm run build` passa sem erros.
