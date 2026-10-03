# ApexTech Metais - Enterprise Portal & ERP System

Este é o repositório oficial do portal corporativo e sistema ERP de gestão comercial da **ApexTech Metais**. O projeto evoluiu de uma landing page estática para uma **Plataforma Enterprise completa**, contando com Banco de Dados em Nuvem (PostgreSQL), Cache em Memória, Pipeline de Integração Contínua (CI/CD), Containerização com Docker, e Segurança Avançada (RBAC e Rate Limiting).

---

## 📌 Visão Geral do Sistema

O portal foi projetado com uma estética visual premium (Dark Mode) e uma arquitetura robusta voltada a escalabilidade e máxima performance.

### 🚀 Principais Módulos

1. **Landing Page Institucional (Página Pública)**
   - Grade responsiva com efeito 3D Tilt, catálogo dinâmico e tabelas de cotação em tempo real.
2. **Painel ERP & Administrativo Privado (`/admin.html`)**
   - **Performance Extrema:** Motor de Cache em Memória (`window.ApexCache`) que reduz a latência de trânsito de abas para zero milissegundos.
   - **Gestão de Clientes & Fornecedores:** Validações de unicidade, cadastros eficientes no banco PostgreSQL e busca inteligente em NFD.
   - **Pedidos e Exportações:** Geração de PDFs com marcas d'água corporativas e exportação de planilhas complexas em Excel.
   - **Relatórios Automatizados LME:** Web Scrapers que buscam a cotação oficial em Dólar e agendador automático via CRON para disparos de e-mail pela API Resend.

---

## 🏗️ Arquitetura de Software e Infraestrutura

Esta aplicação foi reconstruída sob os padrões mais altos do mercado, adotando as seguintes premissas arquitetônicas:

- **Banco de Dados em Nuvem:** PostgreSQL hospedado no Railway para integridade transacional e acesso seguro a múltiplos nós.
- **Sistema de Injeção de Dependências:** O backend do `server.js` é modularizado com rotas independentes na pasta `/src/routes`, simplificando a manutenção.
- **Containerização Total (Docker):** O projeto dispõe de `Dockerfile` e `docker-compose.yml`, permitindo rodar a API, Banco de Dados e Frontend localmente com o comando universal `docker-compose up`.

---

## 🔒 Segurança de Elite, Testes e Monitoramento

- **Autenticação RBAC e JWT:** Controle severo de acesso por Perfil (Administrador, Produção, Laboratório). Tokens JWT garantem que cada usuário só interage com o que possui permissão criptográfica (ex: Laboratório bloqueado de ver Tabela de Preços).
- **Proteção Contra Força Bruta e Injeções:** Barreira de `Rate Limiting` implementada na tela de login (5 tentativas por IP a cada 15 min), blindagem de headers HTTP via `Helmet`, e Query Parametrizada nativa.
- **Testes Automatizados (Jest & Supertest):** O repositório engloba uma suíte rígida de testes BDD que validam as permissões sem intervenção humana, que rodam em zero segundos usando simulações in-memory.
- **Pipeline de Integração (GitHub Actions):** Robôs autônomos na nuvem validam a integridade da aplicação (`npm test`) a cada novo `git push`.
- **Auditoria e Logging (Winston):** Tratamento rigoroso de exceções não catalogadas (Uncaught Exceptions). Qualquer anomalia crítica ou queda de DB gera instantaneamente um arquivo rastreável na pasta `/logs/error.log`.

---

## 🛠️ Tecnologias e Bibliotecas

**Backend (API & Infra):**
- Node.js (Express), pg (PostgreSQL pooling), Jest, Supertest, Helmet, express-rate-limit, Winston, JSONWebToken, bcryptjs, Puppeteer, ExcelJS, Docker.

**Frontend:**
- Vanilla JavaScript com Modularização Avançada, HTML5, CSS3 Variables, Chart.js, jsPDF.

---

## ⚙️ Como Rodar o Projeto

Você tem duas formas de iniciar o projeto: Nativo ou via Docker.

### Opção 1: Via Docker (Recomendado - 1 Comando)
Pré-requisitos: Ter o Docker e Docker Compose instalados.
```bash
git clone https://github.com/devjohnnydev/ApexAmostra.git
cd ApexAmostra/apextech
docker-compose up
```

### Opção 2: Método Tradicional
Pré-requisitos: Node.js (18+) e PostgreSQL local/nuvem.
```bash
# 1. Clone o repositório
git clone https://github.com/devjohnnydev/ApexAmostra.git
cd ApexAmostra/apextech

# 2. Instale os pacotes de produção
npm install

# 3. Configure as Variáveis no arquivo .env
# PORT=3000
# DATABASE_URL=postgres://usuario:senha@host:5432/apextech
# JWT_SECRET=chave_segura_aqui

# 4. Inicie o sistema e rode a suíte de Testes
npm test
npm run dev
```

---
> Desenvolvido para a **ApexTech Metais** com foco em estabilidade Enterprise, usabilidade absoluta e engenharia inteligente. 🌿
