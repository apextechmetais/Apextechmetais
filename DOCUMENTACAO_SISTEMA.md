# 📘 Documentação Oficial do Sistema ApexTech Metais
**Gestão de Laboratório, Precificação FIDC e Fluxo de Produção**

Este documento serve como o manual definitivo para entender como o sistema funciona de ponta a ponta, explicar os papéis de cada usuário, e demonstrar com clareza o cálculo matemático por trás da calculadora **FIDC**. Ele é ideal para apresentação a clientes e treinamento da equipe.

---

## 1. Visão Geral do Fluxo do Sistema

O sistema acompanha a vida útil de uma amostra de sucata/material bruto desde sua chegada à ApexTech até a aprovação financeira e liberação para produção, gerando métricas de inteligência de negócios (BI).

O fluxo se divide em **5 passos principais**:
1. **Cadastro da Amostra:** Registro inicial do lote e do fornecedor, definição de peso inicial bruto.
2. **Análise de Desmonte (Laboratório):** O técnico separa e pesa os componentes extraídos, além de subir fotos. A calculadora FIDC atua neste momento sugerindo o preço de compra.
3. **Aprovação de Diretoria (Financeiro):** O diretor analisa o laudo, o rendimento, a foto e os valores calculados, e decide se aprova ou reprova a compra, ajustando os valores finais autorizados.
4. **PCP e Produção:** Liberação do lote para a área industrial após a negociação ter sido concluída com sucesso com o cliente.
5. **Business Intelligence (BI):** O sistema alimenta gráficos de evolução, rentabilidade e ranking de fornecedores com base nas amostras processadas.

---

## 2. Perfis e Permissões (Quem faz o quê?)

O sistema possui controle de acesso com base no papel (Role) do usuário:

### 🧑‍🔬 Técnico de Laboratório (Perfil: `Laboratório`)
**Permissões e Responsabilidades:**
- Acesso à **Fila de Amostras** para realizar a triagem.
- **Inserir Componentes:** Adiciona os materiais extraídos após o desmonte, pesando-os.
- **Tirar Fotos:** Responsável pelo envio (upload) de fotos reais da amostra bruta e após a separação.
- **Visualizar o FIDC:** Visualiza a sugestão de preço do sistema (Calculadora FIDC) em tempo real, baseando-se nos rendimentos e na dificuldade de desmonte.
- **Emitir Parecer Técnico:** Coloca observações vitais (ex: "Muito contaminado com plástico").
- **Restrição:** **Não pode** aprovar a compra nem preencher o valor que o diretor definiu. Ele submete a análise e o status muda para "Aguardando Decisão de Compra".

### 👔 Diretor / Administrador (Perfil: `Diretoria` ou `Administrador`)
**Permissões e Responsabilidades:**
- **Poder Total:** Visualiza abas restritas (Tabela de Preços, Planejamento Mensal de Lotes e Dashboard BI).
- **Aprovação / Reprovação:** Recebe o lote com a sugestão FIDC gerada pelo laboratório e decide o futuro comercial da amostra.
- **Ajuste Fino:** Se o sistema sugeriu comprar por R$ 5,00/kg, o diretor pode autorizar comprar por R$ 5,50/kg se for um fornecedor estratégico.
- **Autonomia para a Equipe Comercial:** O diretor aprova gerando um "Certificado de Autonomia". Ele define validade de preço para que o time comercial negocie livremente naquele teto aprovado.
- **Laudos PDF:** Pode baixar o Laudo com marca d'água oficial da empresa para enviar ao cliente.

---

## 3. O Módulo FIDC (Fórmula de Precificação)

O coração financeiro do sistema. **FIDC** é a sigla (interna) que reflete a composição de **Precificação por Rendimento**. 

Quando um material sujo chega, a ApexTech não pode pagar o valor de um material limpo. A calculadora diz exatamente quanto vale aquele "lote misturado", tirando as margens de segurança.

### Como a Fórmula Funciona:

1. **Rendimento por Material:** 
   O técnico pesa cada pecinha do desmonte.
   *Fórmula: `Rendimento (%) = (Peso do Componente / Peso Inicial Bruto) × 100`*

2. **Busca na Tabela de Preços (Tempo Real):**
   O sistema olha a Tabela de Preços cadastrada na aba "Preços de Venda" para ver quanto a ApexTech consegue faturar ao revender aquele componente puro (Preço Entregar).

3. **Cálculo do Valor Bruto (O valor real da sucata):**
   Soma-se o valor de mercado proporcional de cada componente.
   *Exemplo:* 
   - 10% é Cobre (Cobre vale R$ 40/kg) → `10% de R$ 40 = R$ 4,00`
   - 90% é Plástico (Plástico vale R$ 2/kg) → `90% de R$ 2 = R$ 1,80`
   - **Valor Bruto da Amostra = R$ 5,80 por kg.**

4. **Aplicação das Margens e Dificuldade (O Desconto FIDC):**
   A empresa não compra por R$ 5,80. Ela aplica uma **Margem de Lucro** desejada (ex: 100% de markup, o que divide o preço pela metade) e uma **Dificuldade de Desmonte** (ex: Peça dura de desmontar = +10% de markup).
   *Markup Total = Margem (1.00) + Dificuldade (0.10) = 1.10 (ou seja, 110%)*

5. **O Preço Sugerido (O que o sistema manda o Diretor pagar):**
   - **Sugestão Entregar:** `Valor Bruto / (1 + Markup Total)` 
     *Exemplo:* `R$ 5,80 / (1 + 1.10) = R$ 5,80 / 2.10 = R$ 2,76 / kg`
   - **Sugestão Coletar:** Desconto fixo logístico de 4% sobre a opção de Entregar.
     *Exemplo:* `R$ 2,76 × 0.96 = R$ 2,65 / kg`

**Resultado Final para o Cliente:** A transparência é absoluta. O laudo gerado pelo diretor mostra exatamente por que o preço da sucata é X, demonstrando as impurezas e os componentes que agregaram valor.

---

## 4. Disparo de E-mails e Notificações Automáticas

O sistema remove o gargalo de comunicação usando APIs locais:
1. O técnico clica em **Salvar Análise**.
2. O servidor `Node.js` intercepta o lote.
3. Altera o status da amostra no banco de dados.
4. **Trigger de E-mail:** A rota `/api/amostras/:id/enviar-laudo-email` é executada, enviando um alerta silencioso em background para o e-mail cadastrado da Diretoria com o aviso: *"Nova amostra número AM-XXX aguardando aprovação de compra"*.

---

## 5. Dashboard Business Intelligence (BI) Central

Todo desmonte gera um rastro de dados valioso. Na aba **BI**, o sistema consolida as aprovações.

**Métricas em Destaque:**
- **Perda Média (%):** Se o laboratório acusa sempre 5% de perda (sujeira) no desmonte físico, mas a indústria perde 8% no derretimento, a Diretoria sabe que precisa apertar as margens.
- **Top Fornecedor:** Quem entrega mais volume útil, não apenas peso sujo.
- **Lucro Operacional:** Diferença matemática de todo o Custo (aprovado pela Diretoria) versus o Previsível de Venda (pela tabela) vezes os rendimentos acumulados.

---
*Gerado via Automação de Arquitetura. ApexTech Metais - 2026.*
