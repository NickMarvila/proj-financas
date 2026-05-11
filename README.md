# 💰 FinançasPonto

Sistema completo e automatizado de controle de ponto (home-office e presencial) e gestão de finanças pessoais. Projetado com **Java 17 (Spring Boot)**, **React (TypeScript + Vite)**, **PostgreSQL** e integrado de forma inteligente com o **Gmail API** (para captura de pontos) e **WhatsApp (Evolution API)** para notificações instantâneas.

---

## 📱 Funcionalidades Principais

| Funcionalidade | Descrição |
|---|---|
| 📧 **Leitura Automática do Gmail** | Varre a caixa de entrada em busca de e-mails de comprovantes de ponto, processando-os via API oficial do Gmail. |
| 📋 **Registro Inteligente de Ponto** | Organiza as batidas do dia em pares de Entrada/Saída, calcula saldo diário e aceita lançamentos manuais retroativos. |
| ⏱ **Cálculo de Hora Extra (50%)** | Converte as horas excedentes (além de 8h/dia) em valor monetário com base no seu salário-base. |
| 📆 **Ciclo de Fechamento Personalizado** | Opera com o ciclo financeiro do **dia 21 de um mês ao dia 20 do próximo**. |
| ⚠️ **Meta de Sábados** | Monitora os sábados do mês comercial. Sábados não trabalhados deduzem 4 horas (carga contratual) do saldo de horas extras. |
| 💰 **Painel Financeiro Geral** | Gerencia salário bruto, abate despesas fixas cadastradas e projeta a "Sobra" líquida do mês. |
| 📦 **Sobra Acumulada** | O saldo positivo final de um mês transborda automaticamente como saldo inicial para o mês seguinte. |
| 📲 **Bot de Notificações no WhatsApp** | Dispara alertas instantâneos a cada batida processada e envia resumos financeiros diários consolidados (às 12h e às 21h). |

---

## 🧠 Regras de Negócio do Sistema

### 1. Ciclo Mensal (21 a 20)
* O sistema não utiliza o ciclo tradicional (dia 1 ao 30). O período padrão de fechamento é do **dia 21 de um mês até o dia 20 do próximo**.
* O painel exibe o mês de referência correspondente ao final do ciclo (ex: o ciclo *21/04 a 20/05* é exibido no painel como **Maio**).
* Para manter o histórico limpo, meses anteriores a Abril de 2026 exibem apenas os registros de ponto, sem efetuar cálculos financeiros.

### 2. Regra dos Sábados (Calendário Comercial)
Os sábados são calculados com base no mês calendário cheio (dia 1 ao último dia do mês) e **NÃO** no ciclo financeiro:
* **Desconto de 4 horas (240 minutos)** por sábado não trabalhado.
* Não existe conceito de folga aos sábados; a folga padrão semanal é aos domingos.
* Carga horária total semanal esperada de **44 horas** (8h de segunda a sexta + 4h aos sábados).

---

## 🚀 Guia de Instalação em Novas Máquinas

Siga o passo a passo abaixo para rodar todo o ecossistema (Frontend, Backend, Banco de Dados e Evolution API) em um novo computador.

### 📋 Pré-requisitos
Certifique-se de ter instalado em sua máquina:
1. **Git** (para versionamento e download do código).
2. **Docker** e **Docker Compose** (rodando em background).

---

### Passo 1 — Clonar o Repositório
Abra o terminal na pasta onde deseja salvar o projeto e execute:
```bash
git clone https://github.com/NickMarvila/proj-financas.git
cd proj-financas
```

### Passo 2 — Configurar Variáveis de Ambiente
Na raiz do projeto, você encontrará o arquivo `.env.example`. Copie-o para criar o arquivo `.env` de configuração local:
* No **Windows (PowerShell)**:
  ```powershell
  copy .env.example .env
  ```
* No **Linux/macOS (Terminal)**:
  ```bash
  cp .env.example .env
  ```

Abra o arquivo `.env` gerado e configure com seus dados reais:
```env
# ===== Banco de dados =====
DB_NAME=financasponto
DB_USER=financas
DB_PASSWORD=suasenhadobanco     # Defina uma senha segura

# ===== WhatsApp (Evolution API) =====
EVOLUTION_API_KEY=suachaveglobal  # Uma chave de segurança de sua escolha
EVOLUTION_INSTANCE_NAME=financasponto
WHATSAPP_PHONE=5524999999999    # Seu número com DDI e DDD (ex: 55 + DDD + Número)

# ===== Gmail =====
GMAIL_USER=seuemail@gmail.com   # O e-mail que receberá os alertas de ponto
```

> [!WARNING]
> Nunca compartilhe ou suba o arquivo `.env` configurado para o GitHub. Ele já está protegido no nosso arquivo `.gitignore`.

---

### Passo 3 — Obter Credenciais da API do Gmail
Para que o sistema consiga ler os comprovantes diretamente do seu e-mail:
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto (ex: `FinancasPonto`).
3. Vá em **APIs e Serviços > Biblioteca** e ative a **Gmail API**.
4. Vá em **Tela de consentimento OAuth**, selecione o tipo de usuário **Externo**, preencha os dados básicos e adicione seu e-mail como "Usuário de teste".
5. Vá em **Credenciais > Criar Credenciais > ID do cliente OAuth**.
6. Selecione o tipo de aplicativo: **Aplicativo da Web**.
7. Em **Origens JavaScript autorizadas**, insira: `http://localhost:3000` e `http://localhost:8080`.
8. Em **URIs de redirecionamento autorizados**, insira exatamente: `http://localhost:8888/Callback` (ou `http://localhost:8080/Callback`, de acordo com a porta do backend).
9. Clique em Criar, baixe o arquivo **JSON de credenciais**, renomeie-o para `credentials.json` e salve na pasta:
   `gmail-credentials/credentials.json`

---

### Passo 4 — Subir os Containers do Docker
Com as variáveis de ambiente e a credencial do Gmail configuradas nas pastas corretas, execute o comando abaixo para iniciar todos os serviços:
```bash
docker compose up -d --build
```
Este comando fará o download e build de todas as imagens necessárias e iniciará os serviços em segundo plano.

---

### Passo 5 — Autenticação do Gmail & WhatsApp (Primeiro Acesso)

#### 1. Autorizar Leitura do Gmail
* Acesse o painel pelo navegador em: **`http://localhost:3000`** ou veja os logs do backend.
* O sistema Java tentará se conectar ao Gmail. Se for a primeira vez, ele irá gerar uma URL de autenticação do Google nos logs do container do backend.
* Acesse essa URL no seu navegador, faça login com a conta cadastrada no Google Cloud, conceda as permissões necessárias e, na tela seguinte (que pode dar um erro de conexão local na porta 8888), **copie o código de autorização gerado na URL** e cole-o no prompt do sistema ou no campo apropriado no dashboard.
* Uma vez autenticado, o token de acesso seguro será gerado e persistido na pasta `gmail-tokens/`.

#### 2. Conectar o WhatsApp (Evolution API)
* Acesse o Dashboard em: **`http://localhost:3000/configuracoes`**
* Clique no botão **"Criar Instância / Ver QR Code"**.
* O sistema se comunicará com o container da Evolution API localmente e gerará o QR Code de pareamento em alguns segundos.
* Abra o WhatsApp no seu celular, vá em *Aparelhos Conectados > Conectar um Aparelho* e escaneie o QR Code exibido na tela.

---

## 🌐 URLs Locais do Sistema

| Serviço | URL de Acesso | Descrição |
|---|---|---|
| **Dashboard (Frontend)** | `http://localhost:3000` | Interface visual de controle e visualização de dados. |
| **API (Backend)** | `http://localhost:8080` | Swagger e endpoints do serviço Java Spring. |
| **Evolution API** | `http://localhost:8081` | Gerenciador local do bot de WhatsApp. |

---

## 🔧 Comandos Úteis de Manutenção

```bash
# Monitorar os logs do backend em tempo real
docker logs financas-backend -f

# Monitorar os logs do bot de WhatsApp (Evolution API)
docker logs financas-evolution -f

# Parar todos os serviços do sistema
docker compose down

# Reiniciar um serviço específico aplicando alterações de código
docker compose up -d --build backend
```

---

## 📤 Como subir o projeto para o GitHub (Primeira Vez)

Para subir o projeto para a sua conta do GitHub (`https://github.com/NickMarvila`), siga o roteiro de comandos abaixo.

> [!IMPORTANT]
> Graças ao nosso arquivo `.gitignore` configurado na raiz, arquivos confidenciais como o seu `.env`, segredos baixados da API do Google (`client_secret*.json`), tokens ativos (`gmail-tokens/`) e credenciais privadas (`gmail-credentials/credentials.json`) **nunca serão enviados ao GitHub**.

### Passo a Passo no Terminal (na raiz do projeto):

1. **Inicializar o repositório Git local:**
   ```bash
   git init
   ```

2. **Adicionar todos os arquivos do projeto para o commit:**
   ```bash
   git add .
   ```
   *(Você pode executar `git status` em seguida para validar que as credenciais e o arquivo `.env` não foram indexados, garantindo a sua segurança).*

3. **Criar o primeiro commit com as estruturas iniciais:**
   ```bash
   git commit -m "feat: estrutura inicial do sistema FinançasPonto com Docker e Integrações"
   ```

4. **Definir a branch principal como `main`:**
   ```bash
   git branch -M main
   ```

5. **Vincular o seu repositório local ao seu repositório remoto no GitHub:**
   *(Crie um repositório chamado `proj-financas` ou o nome de sua preferência no seu GitHub de forma vazia — sem README, sem .gitignore e sem licença — e execute o comando abaixo):*
   ```bash
   git remote add origin https://github.com/NickMarvila/proj-financas.git
   ```

6. **Enviar o código para o GitHub:**
   ```bash
   git push -u origin main
   ```

---
*Desenvolvido por [NickMarvila](https://github.com/NickMarvila)*
