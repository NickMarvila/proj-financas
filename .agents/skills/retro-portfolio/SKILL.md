---
name: Retro Portfolio Context
description: Contexto arquitetural e decisões de design do portfólio em formato Retro OS Pixel Art.
---

# Contexto do Projeto: Retro OS Portfolio

Este projeto é um portfólio web construído com uma temática de Sistema Operacional Retrô (Pixel Art/Midnight Purple).

## 1. Arquitetura e Infraestrutura
O projeto está hospedado em uma VPS Oracle Cloud rodando Linux (Oracle Linux).
- **Gerenciamento de Containers:** Docker e Docker Compose.
- **Proxy Reverso e SSL:** Traefik configurado para gerar certificados SSL automáticos via Let's Encrypt e rotear o tráfego para os subdomínios (duckdns).
- **Monitoramento:** Portainer rodando sob o subdomínio gerido pelo Traefik.
- **Portfólio Web:** Nginx simples servindo arquivos estáticos na pasta `portfolio/html`.
- **Deploy Automático/Manual:** Atualmente, as atualizações são feitas através do comando `scp` da máquina local para a pasta `~/VM/portfolio/html/` na VPS, utilizando uma chave SSH privada `ssh-key-2026-06-26.key` (a chave NUNCA deve ser commitada no git).

## 2. Padrões de Design e UI
O portfólio simula a interface de um computador clássico dos anos 90, com um toque moderno.
- **Paleta de Cores:** Tema "Midnight Purple".
  - Fundo Desktop (Grid): `--bg-desktop: #1a0f2e`
  - Janelas (Card BG): `--window-bg: #292133`
  - Acentos Roxos: `--accent-bright: #a855f7`, `--accent-muted: #7e22ce`
  - Bordas (3D effect): Branco puro nas bordas superior e esquerda, e `--border-dark: #1e1133` nas bordas inferior e direita.
- **Tipografia:** Fonte `Pixelify Sans` (carregada do Google Fonts) para todos os textos.
- **Ícones:** 
  - `Bootstrap Icons` para ícones de UI (pastas, estrelas, etc).
  - `Devicon` para os ícones coloridos e grandes da Tech Stack (JS, TS, React, Node, Java, Python).
- **Mouse Customizado:** O site usa cursores (ponteiro e mãozinha) 100% renderizados via Base64 (SVG embutido direto no arquivo `style.css`).

## 3. Comportamento do Front-end (Vanilla JS)
- A lógica é toda escrita em Vanilla Javascript no arquivo `script.js`.
- **Busca Dupla no GitHub:** O script acessa a API do GitHub para listar os repositórios públicos. Em seguida, ele faz requisições secundárias para buscar o conteúdo de cada `README.md` bruto do projeto. Um processador de Markdown converte e extrai o primeiro parágrafo de texto puro para exibir como resumo na UI.
- **Sistema de Cache:** O script.js possui um cache interno (LocalStorage) que armazena as respostas do GitHub por 1 hora, impedindo bloqueios de limite de taxa da API (Rate Limit) caso o site receba muitos visitantes simultâneos.
- **Gerenciador de Janelas (Window Manager):** 
  - As janelas possuem botões de minimizar (`_`), maximizar (`O`) e fechar (`X`).
  - Minimizar esconde a janela e cria um botão na Barra de Tarefas (Taskbar).
  - Maximizar injeta a classe `.window-maximized` que fixa a janela em tela cheia e, no caso da janela "PROFILE.EXE", revela o conteúdo extra oculto `TECH_STACK.INI`.
  - Fechar esconde a janela, que só pode ser reaberta clicando nos atalhos localizados fisicamente no `Desktop`.

## 4. Práticas Futuras Recomendadas
Ao modificar o projeto, preserve rigorosamente as classes CSS e a estética de janelas fixas. Quando atualizar os arquivos `.js` ou `.css`, não esqueça de incrementar o sufixo `?v=X` na tag de inclusão no `index.html` para quebrar o cache de provedores e navegadores (Cash Busting).
