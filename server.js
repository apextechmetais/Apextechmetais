const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const express   = require('express');
const dotenv    = require('dotenv');
const path      = require('path');
const axios     = require('axios');
const cheerio   = require('cheerio');
const puppeteer = require('puppeteer');
const multer    = require('multer');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const logger    = require('./config/logger');
const ApexEngine = require('./lib/calculationEngine');

// Carregar variáveis de ambiente (precisa vir antes de qualquer leitura de process.env)
dotenv.config();

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.warn('⚠️ AVISO CRÍTICO: JWT_SECRET não definido no .env. Gerando chave aleatória temporária. Todos os usuários serão deslogados caso o servidor reinicie.');
    JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
}
// ─── Multer: armazenamento em memória (fotos de amostras) ──────────────────────
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por foto
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Apenas imagens são permitidas'), false);
    }
});

const app  = express();
app.set('trust proxy', 1); // Necessário para o express-rate-limit funcionar atrás de um proxy (Railway)

// ─── Utilitários ─────────────────────────────────────────────────────────────
/**
 * Capitaliza cada palavra do nome (ex: "sucata de cobre" → "Sucata De Cobre").
 * Artigos/preposições curtos em português permanecem em minúsculas quando no meio.
 */
function formatarNomeCapitalizado(nome) {
    if (!nome || typeof nome !== 'string') return nome;
    const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'com', 'para', 'por']);
    return nome
        .trim()
        .toLowerCase()
        .split(' ')
        .filter(p => p.length > 0)
        .map((palavra, idx) =>
            idx === 0 || !minusculas.has(palavra)
                ? palavra.charAt(0).toUpperCase() + palavra.slice(1)
                : palavra
        )
        .join(' ');
}
const PORT = process.env.PORT || 3000;

// ─── SEGURANÇA BÁSICA (HELMET) ───────────────────────────────────────────────
// CSP fica desligado: as páginas usam scripts inline e CDNs. Os demais headers ficam ativos.
// CORP "cross-origin" permite que o logo seja carregado pelos e-mails de relatório.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── PostgreSQL Pool (opcional) ──────────────────────────────────────────────
let pool = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000
    });

    pool.on('error', (err, client) => {
        console.error('❌ Erro inesperado no banco de dados (idle client):', err);
        // O painel deve continuar funcionando através do dbAvailable fallback
    });
}

// ─── Proteção contra Crashes & Desligamento Gracioso (Railway) ─────────
process.on('uncaughtException', (err) => {
    logger.error('💥 Erro não tratado (uncaughtException): ' + err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Promessa rejeitada não tratada (unhandledRejection): ' + reason);
});
process.on('SIGTERM', () => {
    console.log('🛑 Sinal SIGTERM recebido do Railway. Encerrando servidor graciosamente...');
    if (pool) pool.end().catch(() => {});
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('🛑 Sinal SIGINT recebido. Encerrando servidor...');
    if (pool) pool.end().catch(() => {});
    process.exit(0);
});

// ─── Registro da última atualização por tabela ──────────────────────────────
const tableLastUpdates = {};

async function registerTableUpdate(tableName) {
    const nowISO = new Date().toISOString();
    tableLastUpdates[tableName] = nowISO;
    if (pool) {
        try {
            await pool.query(`
                INSERT INTO table_last_updates (table_name, updated_at) 
                VALUES ($1, NOW()) 
                ON CONFLICT (table_name) 
                DO UPDATE SET updated_at = NOW();
            `, [tableName]);
        } catch (e) {}
    }
}

// ─── Armazenamento em memória (fallback sem banco) ──────────────────────────
let nextId = 1000;
const memStore = {
    solucoes: [
        { id: 1, nome: 'Sucatas de Indústrias',    img: 'assets/img/residuos-de-empresas-e-industrias.svg',  descricao: 'Nossos principais serviços incluem a gestão e comercialização de resíduos gerados por indústrias, assegurando o descarte adequado e a reciclagem responsável de materiais. Atendemos a diversos setores industriais, oferecendo soluções inovadoras e eficientes para a gestão de resíduos, com foco constante na sustentabilidade e no reaproveitamento, promovendo um ciclo ambientalmente consciente.', ordem: 1, criado_em: new Date().toISOString() },
        { id: 2, nome: 'Resíduos de Conectores',   img: 'assets/img/icon-residuos-de-conectores.svg',          descricao: 'Tratamos e reciclamos resíduos de conectores elétricos e eletrônicos, assegurando que esses materiais sejam reaproveitados de forma eficiente e sustentável. Nosso processo garante a máxima recuperação de metais, reduzindo o impacto ambienta e promovendo fortemente a economia circular em todos os nossos processos logísticos.', ordem: 2, criado_em: new Date().toISOString() },
        { id: 3, nome: 'Sucatas de Fios e Cabos',  img: 'assets/img/sucata-de-fio.svg',                         descricao: 'Especializamo-nos na compra e reciclagem de sucata de fio e cabos de todos os tipos. Transformamos resíduos em recursos reutilizáveis através de processos de separação de alta tecnologia que isolam o plástico dos metais valiosos como cobre e alumínio de maneira rápida, limpa e altamente sustentável.', ordem: 3, criado_em: new Date().toISOString() },
        { id: 4, nome: 'Resíduos e Sucatas de Obras', img: 'assets/img/residuos-e-sucatas-de-obras.svg',       descricao: 'Oferecemos serviços de gestão de resíduos em obras, proporcionando soluções completas e personalizadas para o setor da construção civil. Trabalhamos com planejamento de coleta programada para manter sua obra limpa, organizada e perfeitamente adequada às normas ambientais mais rigorosas de descarte.', ordem: 4, criado_em: new Date().toISOString() }
    ],
    materiais: [],
    noticias: [],
    settings: {
        show_sobre: 'true',
        show_solucoes: 'true',
        show_catalogo: 'true',
        show_onde_encontramos: 'true',
        show_cotacoes: 'true',
        show_noticias: 'true',
        show_galeria: 'true',
        lme_envio_ativo: 'true',
        lme_envio_horario: '14:00',
        lme_envio_dias: '1,2,3,4,5',
        lme_resend_api_key: '',
        lme_resend_from: 'Apextech Metais <noreply@apextechmetais.com.br>',
        role_permissions: JSON.stringify({
            "Administrador": ["view_lme", "view_precos", "view_catalogo", "view_fornecedores", "view_laboratorio", "view_planejamento", "view_estoque", "view_bi", "edit_financeiro", "edit_producao", "view_usuarios"],
            "Laboratório": ["view_laboratorio", "view_catalogo"],
            "Compras": ["view_lme", "view_precos", "view_catalogo", "view_fornecedores", "view_estoque"],
            "Produção": ["view_estoque", "view_planejamento", "view_catalogo", "edit_producao"],
            "Financeiro": ["view_lme", "view_precos", "view_fornecedores", "view_bi", "edit_financeiro"],
            "Diretoria": ["view_lme", "view_precos", "view_catalogo", "view_fornecedores", "view_laboratorio", "view_planejamento", "view_estoque", "view_bi", "edit_financeiro", "edit_producao"]
        })
    },
    lme_destinatarios: [],
    galeria: [
        { id: 1, url: 'assets/img/photo-1595246140625-573b715d11dc.jpg', titulo: 'Triagem de Sucata Eletrônica', ordem: 1 },
        { id: 2, url: 'assets/img/photo-1605647540924-852290f6b0d5.jpg', titulo: 'Processamento de Placas de Circuito', ordem: 2 },
        { id: 3, url: 'assets/img/photo-1532187863486-abf9d39d66e8.jpg', titulo: 'Metais Nobres Separados', ordem: 3 }
    ],
    // ── NOVOS MÓDULOS ──
    fornecedores: [
        { id: 1, razao_social: "Davi Reciclagem de Metais LTDA", nome_fantasia: "davi", cnpj: "12.345.678/0001-99", contato: "Davi", telefone: "(11) 98765-4321", email: "davi@apextech.com", endereco: "Av. da Reciclagem, 1000", observacoes: "Fornecedor Parceiro LME" }
    ],
    materiais_catalogo: [
        { id: 1, nome: "Sucata de chaparia de alumínio", unidade: "kg", categoria: "Alumínio", cor: "#7eb3d5", ncm: "7602.00.00", observacoes: "" },
        { id: 2, nome: "Sucata de alumínio bloco limpo", unidade: "kg", categoria: "Alumínio", cor: "#5a92b5", ncm: "7602.00.00", observacoes: "" },
        { id: 3, nome: "Sucata de alumínio roda", unidade: "kg", categoria: "Alumínio", cor: "#3b6d8c", ncm: "7602.00.00", observacoes: "" },
        { id: 4, nome: "Sucata de radiador de alumínio e cobre", unidade: "kg", categoria: "Alumínio", cor: "#3b6d8a", ncm: "7602.00.00", observacoes: "" },
        { id: 5, nome: "Sucata de cobre 1", unidade: "kg", categoria: "Cobre", cor: "#e07b39", ncm: "7404.00.00", observacoes: "" },
        { id: 6, nome: "Sucata de cobre 2", unidade: "kg", categoria: "Cobre", cor: "#c25e20", ncm: "7404.00.00", observacoes: "" },
        { id: 7, nome: "Sucata de cobre 4", unidade: "kg", categoria: "Cobre", cor: "#a3450c", ncm: "7404.00.00", observacoes: "" },
        { id: 8, nome: "Sucata de fio de internet", unidade: "kg", categoria: "Cobre", cor: "#b0a0c0", ncm: "7404.00.00", observacoes: "" },
        { id: 9, nome: "Sucata de fio de instalação", unidade: "kg", categoria: "Cobre", cor: "#8a7ba8", ncm: "7404.00.00", observacoes: "" },
        { id: 10, nome: "Sucata de fio PP", unidade: "kg", categoria: "Cobre", cor: "#685b8c", ncm: "7404.00.00", observacoes: "" },
        { id: 11, nome: "Sucata de tomada e conectores", unidade: "kg", categoria: "Tomada/Conectores", cor: "#d4b896", ncm: "7404.00.00", observacoes: "" },
        { id: 12, nome: "Sucata de aço 201", unidade: "kg", categoria: "Aço", cor: "#a8c5a0", ncm: "7204.21.00", observacoes: "" },
        { id: 13, nome: "Sucata de aço inox", unidade: "kg", categoria: "Aço", cor: "#7ea374", ncm: "7204.21.00", observacoes: "" },
        { id: 14, nome: "Sucata de cavaco de aço inox", unidade: "kg", categoria: "Aço", cor: "#5a8050", ncm: "7204.21.00", observacoes: "" },
        { id: 15, nome: "Plástico", unidade: "kg", categoria: "Outros", cor: "#cccccc", ncm: "3915.90.00", observacoes: "Resíduos e isolamentos" }
    ],
    tabela_precos: [
        { id: 1, material_id: 1, preco_entregar: 11.30, preco_coletar: 11.00, venda_ref: 12.80, validade: "2026-12-31" },
        { id: 2, material_id: 2, preco_entregar: 11.00, preco_coletar: 10.80, venda_ref: 12.30, validade: "2026-12-31" },
        { id: 3, material_id: 3, preco_entregar: 16.00, preco_coletar: 15.50, venda_ref: 17.50, validade: "2026-12-31" },
        { id: 4, material_id: 4, preco_entregar: 33.50, preco_coletar: 33.00, venda_ref: 37.00, validade: "2026-12-31" },
        { id: 5, material_id: 5, preco_entregar: 68.00, preco_coletar: 67.50, venda_ref: 70.00, validade: "2026-12-31" },
        { id: 8, material_id: 8, preco_entregar: 19.00, preco_coletar: 18.50, venda_ref: 28.10, validade: "2026-12-31" },
        { id: 10, material_id: 10, preco_entregar: 15.00, preco_coletar: 14.50, venda_ref: 23.20, validade: "2026-12-31" },
        { id: 11, material_id: 11, preco_entregar: 4.30, preco_coletar: 4.10, venda_ref: 10.29, validade: "2026-12-31" },
        { id: 12, material_id: 12, preco_entregar: 0.80, preco_coletar: 0.70, venda_ref: 1.60, validade: "2026-12-31" },
        { id: 13, material_id: 13, preco_entregar: 4.50, preco_coletar: 4.30, venda_ref: 5.70, validade: "2026-12-31" },
        { id: 14, material_id: 14, preco_entregar: 4.00, preco_coletar: 3.80, venda_ref: 5.30, validade: "2026-12-31" }
    ],
    amostras: [
        { id: 1, numero_amostra: "AM-001", nome_material: "Fio de Instalação 1.5mm", data: "2026-07-15", fornecedor_id: 1, responsavel: "Eng. Roberto", peso_inicial: 5000, status: "Processado", observacoes: "Fio de Instalação do Fornecedor davi", foto_original: "assets/img/photo-1595246140625-573b715d11dc.jpg" },
        { id: 2, numero_amostra: "AM-002", nome_material: "Fio Misto Comercial", data: "2026-07-16", fornecedor_id: 1, responsavel: "Eng. Roberto", peso_inicial: 20000, status: "Liberado para Produção", observacoes: "Fio Misto", foto_original: "" },
        { id: 3, numero_amostra: "AM-003", nome_material: "Fio Terminais Industrial", data: "2026-07-17", fornecedor_id: 1, responsavel: "Eng. Roberto", peso_inicial: 15000, status: "Aguardando Liberação PCP", observacoes: "Fio Terminais", foto_original: "" }
    ],
    componentes_amostra: [
        { id: 1, amostra_id: 1, material_id: 5, peso: 3100, percentual: 62.0, observacoes: "Cobre 1" },
        { id: 2, amostra_id: 1, material_id: 15, peso: 1900, percentual: 38.0, observacoes: "Isolamento plástico/perda" },
        { id: 3, amostra_id: 2, material_id: 6, peso: 8200, percentual: 41.0, observacoes: "Cobre 2" },
        { id: 4, amostra_id: 2, material_id: 15, peso: 11800, percentual: 59.0, observacoes: "Resíduos e plásticos" },
        { id: 5, amostra_id: 3, material_id: 6, peso: 4650, percentual: 31.0, observacoes: "Cobre 2" },
        { id: 6, amostra_id: 3, material_id: 15, peso: 10350, percentual: 69.0, observacoes: "Resíduos e plásticos" }
    ],
    lotes_compra: [
        { id: 1, amostra_id: 1, fornecedor_id: 1, produto: "fio de instalação", peso_comprado: 5000, preco_compra: 40.50, percentual_rendimento: 62.0, material_id: 5, preco_venda_material: 71.00, comissao: 2.0, fidc: 2.3, mes: "2026-07" },
        { id: 2, amostra_id: 2, fornecedor_id: 1, produto: "fio misto", peso_comprado: 20000, preco_compra: 18.00, percentual_rendimento: 41.0, material_id: 6, preco_venda_material: 65.50, comissao: 2.0, fidc: 2.3, mes: "2026-07" },
        { id: 3, amostra_id: 3, fornecedor_id: 1, produto: "fio terminais", peso_comprado: 15000, preco_compra: 14.00, percentual_rendimento: 31.0, material_id: 6, preco_venda_material: 65.00, comissao: 2.0, fidc: 2.3, mes: "2026-07" }
    ],
    estoque: [
        { material_id: 5, saldo: 3100 },
        { material_id: 6, saldo: 8200 },
        { material_id: 15, saldo: 13700 }
    ],
    movimentacoes_estoque: [
        { id: 1, material_id: 5, tipo: "ENTRADA", quantidade: 3100, motivo: "Processamento da amostra AM-001", data: "2026-07-15" },
        { id: 2, material_id: 15, tipo: "ENTRADA", quantidade: 1900, motivo: "Processamento da amostra AM-001", data: "2026-07-15" },
        { id: 3, material_id: 6, tipo: "ENTRADA", quantidade: 8200, motivo: "Processamento da amostra AM-002", data: "2026-07-16" },
        { id: 4, material_id: 15, tipo: "ENTRADA", quantidade: 11800, motivo: "Processamento da amostra AM-002", data: "2026-07-16" }
    ],
    planejamento_compras: [
        { id: 1, material_id: 5, fornecedor_id: 1, quantidade_necessaria: 10000, ponto_pedido_kg: 5000, lead_time_dias: 7, preco_estimado: 68.00, custo_total_estimado: 680000.00, mes_referencia: "2026-08", status: "Em Cotação", observacoes: "Reposição para alta demanda Cobre 1", criado_em: new Date().toISOString() },
        { id: 2, material_id: 1, fornecedor_id: 1, quantidade_necessaria: 15000, ponto_pedido_kg: 8000, lead_time_dias: 5, preco_estimado: 11.30, custo_total_estimado: 169500.00, mes_referencia: "2026-08", status: "Sugerido", observacoes: "Lote mínimo fornecedor davi", criado_em: new Date().toISOString() }
    ],
    equipamentos_industriais: [
        { id: 1, nome_equipamento: "Triturador Industrial Primário Apex-T1", codigo_tag: "TRIT-01", setor: "Trituração", capacidade_nominal_kgh: 1500, disponibilidade_horas_dia: 16, tempo_setup_horas: 1.5, eficiencia_oee_pct: 88, status: "Operacional", observacoes: "Manutenção preventiva em dia" },
        { id: 2, nome_equipamento: "Esteira de Triagem & Separação Manual", codigo_tag: "EST-01", setor: "Triagem", capacidade_nominal_kgh: 2500, disponibilidade_horas_dia: 16, tempo_setup_horas: 0.5, eficiencia_oee_pct: 92, status: "Operacional", observacoes: "4 operadores por turno" },
        { id: 3, nome_equipamento: "Separador Magnético Overband 500", codigo_tag: "SEP-01", setor: "Separação", capacidade_nominal_kgh: 2000, disponibilidade_horas_dia: 16, tempo_setup_horas: 0.5, eficiencia_oee_pct: 90, status: "Operacional", observacoes: "Alta eficiência remoção ferro" },
        { id: 4, nome_equipamento: "Prensa Hidráulica 100T Metais", codigo_tag: "PRE-01", setor: "Prensagem", capacidade_nominal_kgh: 1200, disponibilidade_horas_dia: 14, tempo_setup_horas: 1.0, eficiencia_oee_pct: 85, status: "Operacional", observacoes: "Fardos padrão exportação" }
    ],
    ordens_producao: [
        {
            id: 1,
            numero_op: "OP-2026-001",
            amostra_id: 1,
            lote_id: 1,
            material_entrada: "Fio de Instalação 1.5mm",
            peso_entrada_kg: 5000,
            material_saida_id: 5,
            peso_saida_estimado_kg: 3100,
            data_inicio_prevista: "2026-08-12",
            data_fim_prevista: "2026-08-14",
            responsavel_pcp: "Eng. Roberto",
            status: "Em Execução",
            observacoes: "Prioridade para entrega ao cliente FIDC",
            criado_em: new Date().toISOString(),
            etapas: [
                { id: 1, op_id: 1, nome_etapa: "Recepção & Pesagem", ordem: 1, equipamento_id: 2, tempo_estimado_horas: 2.0, tempo_real_horas: 1.8, status_etapa: "Concluída", operador_responsavel: "Carlos", observacoes: "Sem anomalias" },
                { id: 2, op_id: 1, nome_etapa: "Trituração & Separação Plástico", ordem: 2, equipamento_id: 1, tempo_estimado_horas: 4.5, tempo_real_horas: 5.0, status_etapa: "Em Andamento", operador_responsavel: "João", observacoes: "Ajuste na lâmina do triturador" },
                { id: 3, op_id: 1, nome_etapa: "Separação Magnética & Prensagem", ordem: 3, equipamento_id: 4, tempo_estimado_horas: 3.0, tempo_real_horas: 0.0, status_etapa: "Pendente", operador_responsavel: "Marcos", observacoes: "" },
                { id: 4, op_id: 1, nome_etapa: "Inspeção de Qualidade & Embalagem", ordem: 4, equipamento_id: null, tempo_estimado_horas: 1.5, tempo_real_horas: 0.0, status_etapa: "Pendente", operador_responsavel: "Eng. Roberto", observacoes: "" }
            ]
        }
    ],
    fotos_amostra: [],   // { id, amostra_id, tipo: 'bruta'|'separada'|'componente', data_b64, mimetype, nome, criado_em }
    usuarios: [
        { id: 1, user: "admin", pass: "$2b$10$OtCdpJ40BrNkHE2npxGDnOMxYHYl9HRGP6mw/le4NlJCnbtF6iyUS", perfil: "Administrador", nome: "Admin Apex" },
        { id: 2, user: "lab", pass: "$2b$10$IQb7v6yEEwWAkAqio4ZYOulYFteWjTUect2aDd49Vay7DtxiBQJXm", perfil: "Laboratório", nome: "Dr. Marcos (Lab)" },
        { id: 3, user: "compras", pass: "$2b$10$mpmo8hj4iXEN/BoZQN2Xr.3kjaps0Ip5yij09/styuWodKyW.cae.", perfil: "Compras", nome: "Ana (Compras)" },
        { id: 4, user: "producao", pass: "$2b$10$1BWuIfla8e52NApbFR8yGu9Kq0KYz04aHxLen0Lx9r9dH2OV5iZFe", perfil: "Produção", nome: "Carlos (PCP/Produção)" },
        { id: 5, user: "financeiro", pass: "$2b$10$4dxfQXRxOqoHQdeYQsj3Ue7v5CCZdhZOddhihwY4cAeGnRXBckjVK", perfil: "Financeiro", nome: "Mariana (Fin)" },
        { id: 6, user: "diretoria", pass: "$2b$10$S1be8oS/GPW/h1aM38o0Su0PFjxr8xl0O5QtNRBQ/knqLE6.JeA16", perfil: "Diretoria", nome: "Dr. Tiago (Diretor)" }
    ],
    clientes: [],
    pedidos_venda: [],
    pedidos_venda_itens: [],
    pedidos_compra: [],
    pedidos_compra_itens: [],
    estrategiav3_planos: [],
    estrategiav3_mix: [],
    audit_logs: [],
    tabela_precos_residuos: [],
    tabela_precos_ligas: [],
    tabela_precos_volume: [],
    tabela_precos_fundicao: []
};

// Inicializa tabelas na primeira execução (apenas se DB disponível)
async function initDatabase() {
    if (!pool) {
        console.log('⚠️  DATABASE_URL não configurada. Usando armazenamento em memória.');
        return;
    }
    let client;
    try {
        client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS solucoes (
                id        SERIAL PRIMARY KEY,
                nome      TEXT    NOT NULL,
                img       TEXT    NOT NULL,
                descricao TEXT    NOT NULL,
                ordem     INTEGER DEFAULT 0,
                criado_em TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS materiais (
                id        SERIAL PRIMARY KEY,
                nome      TEXT    NOT NULL,
                imagem    TEXT,
                descricao TEXT    NOT NULL,
                locais    JSONB   DEFAULT '[]',
                criado_em TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS noticias (
                id         SERIAL PRIMARY KEY,
                titulo     TEXT    NOT NULL,
                url        TEXT,
                resumo     TEXT,
                data_pub   DATE,
                categoria  TEXT,
                criado_em  TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS galeria (
                id        SERIAL PRIMARY KEY,
                url       TEXT NOT NULL,
                titulo    TEXT NOT NULL,
                ordem     INTEGER DEFAULT 0,
                criado_em TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS lme_destinatarios (
                id        SERIAL PRIMARY KEY,
                nome      TEXT NOT NULL,
                email     TEXT NOT NULL,
                tipo      TEXT DEFAULT 'lme',
                criado_em TIMESTAMP DEFAULT NOW()
            );
            ALTER TABLE lme_destinatarios ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'lme';

            -- NOVAS TABELAS APEX
            
            CREATE TABLE IF NOT EXISTS pedidos_venda (
                id              SERIAL PRIMARY KEY,
                numero          TEXT NOT NULL UNIQUE,
                cliente_id      INTEGER,
                cliente_nome    TEXT,
                data_emissao    DATE NOT NULL DEFAULT CURRENT_DATE,
                data_entrega    DATE,
                status          TEXT NOT NULL DEFAULT 'Rascunho',
                condicao_pagamento TEXT,
                observacoes     TEXT,
                desconto_pct    NUMERIC(5,2) DEFAULT 0.00,
                frete           NUMERIC(10,2) DEFAULT 0.00,
                total_itens     NUMERIC(14,2) DEFAULT 0.00,
                total_geral     NUMERIC(14,2) DEFAULT 0.00,
                criado_por      TEXT,
                criado_por_perfil TEXT,
                endereco_entrega TEXT,
                responsavel_recebimento TEXT,
                tipo_frete      TEXT,
                criado_em       TIMESTAMP DEFAULT NOW(),
                atualizado_em   TIMESTAMP DEFAULT NOW()
            );

            ALTER TABLE pedidos_venda ALTER COLUMN cliente_id DROP NOT NULL;
            ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS cliente_nome TEXT;
            ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS criado_por_perfil TEXT;
            ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS endereco_entrega TEXT;
            ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS responsavel_recebimento TEXT;
            ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS tipo_frete TEXT;

            CREATE TABLE IF NOT EXISTS pedidos_venda_itens (
                id              SERIAL PRIMARY KEY,
                pedido_id       INTEGER NOT NULL REFERENCES pedidos_venda(id) ON DELETE CASCADE,
                material_id     INTEGER,
                descricao       TEXT NOT NULL,
                unidade         TEXT DEFAULT 'kg',
                quantidade      NUMERIC(12,3) NOT NULL,
                preco_unitario  NUMERIC(10,4) NOT NULL,
                desconto_item   NUMERIC(5,2) DEFAULT 0.00,
                total_item      NUMERIC(14,2) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pedidos_compra (
                id                      SERIAL PRIMARY KEY,
                numero                  VARCHAR(50) NOT NULL UNIQUE,
                fornecedor_id           INTEGER,
                fornecedor_nome         TEXT,
                data_emissao            DATE DEFAULT CURRENT_DATE,
                data_entrega            DATE,
                status                  VARCHAR(50) NOT NULL DEFAULT 'Rascunho',
                condicao_pagamento      TEXT,
                observacoes             TEXT,
                desconto_pct            NUMERIC(5,2) DEFAULT 0.00,
                frete                   NUMERIC(10,2) DEFAULT 0.00,
                total_itens             NUMERIC(14,2) DEFAULT 0.00,
                total_geral             NUMERIC(14,2) DEFAULT 0.00,
                criado_por              TEXT,
                criado_por_perfil       TEXT,
                aprovado_por            TEXT,
                data_aprovacao          TIMESTAMP,
                endereco_entrega        TEXT,
                responsavel_recebimento TEXT,
                tipo_frete              TEXT,
                criado_em               TIMESTAMP DEFAULT NOW(),
                atualizado_em           TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS pedidos_compra_itens (
                id              SERIAL PRIMARY KEY,
                pedido_id       INTEGER NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
                material_id     INTEGER,
                descricao       TEXT NOT NULL,
                unidade         TEXT DEFAULT 'kg',
                quantidade      NUMERIC(12,3) NOT NULL,
                preco_unitario  NUMERIC(10,4) NOT NULL,
                desconto_item   NUMERIC(5,2) DEFAULT 0.00,
                total_item      NUMERIC(14,2) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS fornecedores (
                id            SERIAL PRIMARY KEY,
                codfor        INTEGER UNIQUE,
                nome          VARCHAR(255) NOT NULL,
                apelido       VARCHAR(255),
                cnpj          VARCHAR(18),
                comprador     VARCHAR(150),
                fone1         VARCHAR(20),
                email         VARCHAR(150),
                endereco      VARCHAR(255),
                complemento   TEXT,
                criado_em     TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS clientes (
                id                      SERIAL PRIMARY KEY,
                codigo                  INTEGER UNIQUE,
                nome                    VARCHAR(255) NOT NULL,
                fantasia                VARCHAR(255),
                telefone1               VARCHAR(50),
                telefone2               VARCHAR(50),
                dias                    TEXT DEFAULT '0',
                ultima_saida            DATE,
                endereco                VARCHAR(255),
                numero                  VARCHAR(50),
                bairro                  VARCHAR(100),
                cidade                  VARCHAR(100),
                uf                      VARCHAR(10),
                pais                    VARCHAR(50),
                cep                     VARCHAR(20),
                cnpj                    VARCHAR(25),
                ie                      VARCHAR(50),
                cpf                     VARCHAR(20),
                rg                      VARCHAR(50),
                tipo_cliente            VARCHAR(50),
                contato_comercial       VARCHAR(100),
                contato_financeiro      VARCHAR(100),
                status                  VARCHAR(50),
                vendedor                VARCHAR(100),
                filial                  VARCHAR(100),
                email                   VARCHAR(150),
                usuario_cadastro        VARCHAR(100),
                ultimo_alterou          VARCHAR(100),
                atualizado              TEXT,
                criado_em               TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS materiais_catalogo (
                id          SERIAL PRIMARY KEY,
                nome        TEXT NOT NULL,
                unidade     TEXT DEFAULT 'kg',
                categoria   TEXT NOT NULL,
                cor         TEXT,
                ncm         TEXT,
                observacoes TEXT,
                criado_em   TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS residuos_catalogo (
                id          SERIAL PRIMARY KEY,
                nome        TEXT NOT NULL,
                unidade     TEXT DEFAULT 'kg',
                categoria   TEXT NOT NULL,
                cor         TEXT,
                ncm         TEXT,
                observacoes TEXT,
                criado_em   TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ligas_catalogo (
                id          SERIAL PRIMARY KEY,
                nome        TEXT NOT NULL,
                unidade     TEXT DEFAULT 'kg',
                categoria   TEXT NOT NULL,
                cor         TEXT,
                ncm         TEXT,
                observacoes TEXT,
                criado_em   TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tabela_precos (
                id              SERIAL PRIMARY KEY,
                material_id     INTEGER NOT NULL,
                preco_entregar  NUMERIC(10,2) DEFAULT 0.00,
                preco_coletar   NUMERIC(10,2) DEFAULT 0.00,
                venda_ref       NUMERIC(10,2) DEFAULT 0.00,
                validade        DATE NOT NULL,
                criado_em       TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tabela_precos_residuos (
                id              SERIAL PRIMARY KEY,
                material_id     INTEGER NOT NULL,
                preco_entregar  NUMERIC(10,2) DEFAULT 0.00,
                preco_coletar   NUMERIC(10,2) DEFAULT 0.00,
                venda_ref       NUMERIC(10,2) DEFAULT 0.00,
                comissao        NUMERIC(6,2)  DEFAULT 0.00,
                pis_cofins      NUMERIC(6,2)  DEFAULT 0.00,
                fidc            NUMERIC(6,2)  DEFAULT 0.00,
                icms            NUMERIC(6,2)  DEFAULT 0.00,
                frete_coleta    NUMERIC(10,2) DEFAULT 0.00,
                validade        DATE NOT NULL,
                criado_em       TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tabela_precos_ligas (
                id              SERIAL PRIMARY KEY,
                material_id     INTEGER NOT NULL,
                preco_entregar  NUMERIC(10,2) DEFAULT 0.00,
                preco_coletar   NUMERIC(10,2) DEFAULT 0.00,
                venda_ref       NUMERIC(10,2) DEFAULT 0.00,
                comissao        NUMERIC(6,2)  DEFAULT 0.00,
                pis_cofins      NUMERIC(6,2)  DEFAULT 0.00,
                fidc            NUMERIC(6,2)  DEFAULT 0.00,
                icms            NUMERIC(6,2)  DEFAULT 0.00,
                frete_coleta    NUMERIC(10,2) DEFAULT 0.00,
                validade        DATE NOT NULL,
                criado_em       TIMESTAMP DEFAULT NOW()
            );

            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS comissao   NUMERIC(6,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS pis_cofins NUMERIC(6,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS fidc       NUMERIC(6,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS icms       NUMERIC(6,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS frete_coleta NUMERIC(10,2) DEFAULT 0.00;

            CREATE TABLE IF NOT EXISTS tabela_precos_volume (
                id              SERIAL PRIMARY KEY,
                material_id     INTEGER NOT NULL,
                preco_entregar  NUMERIC(10,2) DEFAULT 0.00,
                preco_coletar   NUMERIC(10,2) DEFAULT 0.00,
                venda_ref       NUMERIC(10,2) DEFAULT 0.00,
                comissao        NUMERIC(6,2)  DEFAULT 0.00,
                pis_cofins      NUMERIC(6,2)  DEFAULT 0.00,
                fidc            NUMERIC(6,2)  DEFAULT 0.00,
                icms            NUMERIC(6,2)  DEFAULT 0.00,
                frete_coleta    NUMERIC(10,2) DEFAULT 0.00,
                validade        DATE NOT NULL,
                criado_em       TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS tabela_precos_fundicao (
                id              SERIAL PRIMARY KEY,
                material_id     INTEGER NOT NULL,
                preco_entregar  NUMERIC(10,2) DEFAULT 0.00,
                preco_coletar   NUMERIC(10,2) DEFAULT 0.00,
                venda_ref       NUMERIC(10,2) DEFAULT 0.00,
                comissao        NUMERIC(6,2)  DEFAULT 0.00,
                pis_cofins      NUMERIC(6,2)  DEFAULT 0.00,
                fidc            NUMERIC(6,2)  DEFAULT 0.00,
                icms            NUMERIC(6,2)  DEFAULT 0.00,
                frete_coleta    NUMERIC(10,2) DEFAULT 0.00,
                validade        DATE NOT NULL,
                criado_em       TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS amostras (
                id             SERIAL PRIMARY KEY,
                numero_amostra TEXT NOT NULL UNIQUE,
                nome_material  TEXT,
                data           DATE NOT NULL,
                fornecedor_id  INTEGER NOT NULL,
                responsavel    TEXT NOT NULL,
                representante  TEXT,
                peso_inicial   NUMERIC(12,3) NOT NULL,
                status         TEXT DEFAULT 'Em Análise', -- 'Em Análise', 'Aguardando Precificação', 'Aguardando Liberação PCP', 'Liberado para Produção', 'Processado'
                observacoes    TEXT,
                foto_original  TEXT,
                criado_em      TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS componentes_amostra (
                id          SERIAL PRIMARY KEY,
                amostra_id  INTEGER NOT NULL,
                material_id INTEGER NOT NULL,
                peso        NUMERIC(12,3) NOT NULL,
                percentual  NUMERIC(5,2) NOT NULL,
                observacoes TEXT
            );

            CREATE TABLE IF NOT EXISTS lotes_compra (
                id                   SERIAL PRIMARY KEY,
                amostra_id           INTEGER,
                fornecedor_id        INTEGER NOT NULL,
                produto              TEXT NOT NULL,
                peso_comprado        NUMERIC(12,3) NOT NULL,
                preco_compra         NUMERIC(10,2) NOT NULL,
                percentual_rendimento NUMERIC(5,2) NOT NULL,
                material_id          INTEGER NOT NULL,
                preco_venda_material NUMERIC(10,2) NOT NULL,
                comissao             NUMERIC(5,2) DEFAULT 2.0,
                fidc                 NUMERIC(5,2) DEFAULT 2.3,
                mes                  TEXT NOT NULL,
                cliente              TEXT,
                prazo_recebimento_dias INTEGER,
                forma_pagamento      TEXT,
                simulacoes_historico JSONB DEFAULT '[]'::jsonb,
                criado_em            TIMESTAMP DEFAULT NOW()
            );

            -- Garantir que as colunas existam em DBs já criados
            ALTER TABLE lotes_compra ADD COLUMN IF NOT EXISTS cliente TEXT;
            ALTER TABLE lotes_compra ADD COLUMN IF NOT EXISTS prazo_recebimento_dias INTEGER;
            ALTER TABLE lotes_compra ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
            ALTER TABLE lotes_compra ADD COLUMN IF NOT EXISTS simulacoes_historico JSONB DEFAULT '[]'::jsonb;

            CREATE TABLE IF NOT EXISTS estoque (
                material_id INTEGER PRIMARY KEY,
                saldo       NUMERIC(12,3) DEFAULT 0.000
            );

            CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
                id          SERIAL PRIMARY KEY,
                material_id INTEGER NOT NULL,
                tipo        TEXT NOT NULL, -- ENTRADA / SAIDA
                quantidade  NUMERIC(12,3) NOT NULL,
                motivo      TEXT,
                data        TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS usuarios (
                id        SERIAL PRIMARY KEY,
                "user"    TEXT NOT NULL UNIQUE,
                pass      TEXT NOT NULL,
                perfil    TEXT NOT NULL,
                nome      TEXT NOT NULL,
                criado_em TIMESTAMP DEFAULT NOW()
            );

            -- Alterar tabelas existentes para adicionar novas colunas do fluxo de desmonte e decisão da diretoria
            ALTER TABLE componentes_amostra ADD COLUMN IF NOT EXISTS foto TEXT;
            ALTER TABLE componentes_amostra ADD COLUMN IF NOT EXISTS dificuldade TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS nome_material TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS tempo_desmonte INTEGER DEFAULT 0;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS parecer_tecnico TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS decisao_diretoria TEXT DEFAULT 'Aguardando';
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS tecnico_analise TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS admin_aprovacao TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS data_decisao TIMESTAMP;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS preco_compra_entregar NUMERIC(10,2);
            ALTER TABLE clientes ADD COLUMN IF NOT EXISTS vendedor TEXT;
            ALTER TABLE clientes ADD COLUMN IF NOT EXISTS filial TEXT;
            ALTER TABLE clientes ALTER COLUMN dias TYPE TEXT USING dias::TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS preco_compra_coletar NUMERIC(10,2);
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS preco_validade TIMESTAMP;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS autorizado_por TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS obs_diretoria TEXT;
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS representante TEXT;
            ALTER TABLE amostras ALTER COLUMN peso_inicial TYPE NUMERIC(14,4);

            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS comissao NUMERIC(10,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS pis_cofins NUMERIC(10,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS fidc NUMERIC(10,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS icms NUMERIC(10,2) DEFAULT 0.00;
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS frete_coleta NUMERIC(10,2) DEFAULT 0.00;

            CREATE TABLE IF NOT EXISTS fotos_amostra (
                id              SERIAL PRIMARY KEY,
                amostra_id      INTEGER NOT NULL,
                tipo            TEXT DEFAULT 'bruta',
                etapa           TEXT DEFAULT 'Recebimento',
                componente_idx  INTEGER DEFAULT NULL,
                data_b64        TEXT NOT NULL,
                mimetype        TEXT DEFAULT 'image/jpeg',
                nome            TEXT,
                criado_em       TIMESTAMP DEFAULT NOW()
            );
            ALTER TABLE fotos_amostra ADD COLUMN IF NOT EXISTS etapa TEXT DEFAULT 'Recebimento';
            ALTER TABLE fotos_amostra ADD COLUMN IF NOT EXISTS componente_idx INTEGER DEFAULT NULL;

            CREATE TABLE IF NOT EXISTS audit_logs (
                id         SERIAL PRIMARY KEY,
                usuario    TEXT DEFAULT 'Sistema',
                acao       TEXT NOT NULL,
                detalhe    TEXT,
                amostra_id INTEGER,
                ip         TEXT,
                criado_em  TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS table_last_updates (
                table_name TEXT PRIMARY KEY,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS planejamento_compras (
                id                     SERIAL PRIMARY KEY,
                tipo_planejamento      TEXT DEFAULT 'COMPRA_VENDA',
                material_id            INTEGER,
                fornecedor_id          INTEGER,
                quantidade_necessaria  NUMERIC(12,3) NOT NULL,
                quantidade_realizada_kg NUMERIC(12,3) DEFAULT 0.00,
                ponto_pedido_kg        NUMERIC(12,3) DEFAULT 0.00,
                lead_time_dias         INTEGER DEFAULT 7,
                preco_estimado         NUMERIC(10,4) DEFAULT 0.00,
                custo_total_estimado   NUMERIC(14,2) DEFAULT 0.00,
                custo_total_realizado  NUMERIC(14,2) DEFAULT 0.00,
                mes_referencia         TEXT,
                status                 TEXT DEFAULT 'Sugerido',
                observacoes            TEXT,
                criado_em              TIMESTAMP DEFAULT NOW()
            );
            ALTER TABLE planejamento_compras ADD COLUMN IF NOT EXISTS tipo_planejamento TEXT DEFAULT 'COMPRA_VENDA';
            ALTER TABLE planejamento_compras ADD COLUMN IF NOT EXISTS quantidade_realizada_kg NUMERIC(12,3) DEFAULT 0.00;
            ALTER TABLE planejamento_compras ADD COLUMN IF NOT EXISTS custo_total_realizado NUMERIC(14,2) DEFAULT 0.00;

            CREATE TABLE IF NOT EXISTS equipamentos_industriais (
                id                         SERIAL PRIMARY KEY,
                nome_equipamento           TEXT NOT NULL,
                codigo_tag                 TEXT UNIQUE NOT NULL,
                setor                      TEXT DEFAULT 'Processamento',
                capacidade_nominal_kgh     NUMERIC(10,2) DEFAULT 1000.00,
                disponibilidade_horas_dia  NUMERIC(5,2) DEFAULT 16.00,
                tempo_setup_horas          NUMERIC(5,2) DEFAULT 1.00,
                eficiencia_oee_pct         NUMERIC(5,2) DEFAULT 85.00,
                status                     TEXT DEFAULT 'Operacional',
                observacoes                TEXT,
                criado_em                  TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ordens_producao (
                id                      SERIAL PRIMARY KEY,
                numero_op               TEXT UNIQUE NOT NULL,
                amostra_id              INTEGER,
                lote_id                 INTEGER,
                material_entrada        TEXT,
                peso_entrada_kg         NUMERIC(12,3) NOT NULL,
                material_saida_id       INTEGER,
                peso_saida_estimado_kg  NUMERIC(12,3) DEFAULT 0.00,
                data_inicio_prevista    DATE,
                data_fim_prevista       DATE,
                responsavel_pcp         TEXT,
                status                  TEXT DEFAULT 'Planejada',
                observacoes             TEXT,
                criado_em               TIMESTAMP DEFAULT NOW(),
                atualizado_em           TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ordens_producao_etapas (
                id                   SERIAL PRIMARY KEY,
                op_id                INTEGER NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
                nome_etapa           TEXT NOT NULL,
                ordem                INTEGER DEFAULT 1,
                equipamento_id       INTEGER,
                tempo_estimado_horas NUMERIC(8,2) DEFAULT 0.00,
                tempo_real_horas     NUMERIC(8,2) DEFAULT 0.00,
                status_etapa         TEXT DEFAULT 'Pendente',
                operador_responsavel TEXT,
                observacoes          TEXT
            );

            -- Tabela cabeçalho do planejamento de produção (uma por planejamento)
            CREATE TABLE IF NOT EXISTS planejamento_producao_insumos (
                id                             SERIAL PRIMARY KEY,
                periodo                        TEXT NOT NULL,
                produto_id                     INTEGER,
                produto_nome                   TEXT,
                meta_faturamento_rs            NUMERIC(14,2) DEFAULT 0.00,
                preco_venda_produto_rs         NUMERIC(14,4) DEFAULT 0.00,
                qtd_produto_necessaria         NUMERIC(12,3) DEFAULT 0.00,
                custo_total_projetado_rs       NUMERIC(14,2) DEFAULT 0.00,
                margem_projetada_pct           NUMERIC(8,4) DEFAULT 0.00,
                prazo_compra_ate               DATE,
                prazo_venda_ate                DATE,
                status                         TEXT DEFAULT 'Pendente',
                criado_em                      TIMESTAMP DEFAULT NOW()
            );

            -- Colunas adicionais (migração segura para instâncias existentes)
            ALTER TABLE planejamento_producao_insumos ADD COLUMN IF NOT EXISTS meta_faturamento_rs NUMERIC(14,2) DEFAULT 0.00;
            ALTER TABLE planejamento_producao_insumos ADD COLUMN IF NOT EXISTS preco_venda_produto_rs NUMERIC(14,4) DEFAULT 0.00;
            ALTER TABLE planejamento_producao_insumos ADD COLUMN IF NOT EXISTS qtd_produto_necessaria NUMERIC(12,3) DEFAULT 0.00;
            ALTER TABLE planejamento_producao_insumos ADD COLUMN IF NOT EXISTS custo_total_projetado_rs NUMERIC(14,2) DEFAULT 0.00;
            ALTER TABLE planejamento_producao_insumos ADD COLUMN IF NOT EXISTS margem_projetada_pct NUMERIC(8,4) DEFAULT 0.00;
            ALTER TABLE planejamento_producao_insumos ADD COLUMN IF NOT EXISTS prazo_compra_ate DATE;
            ALTER TABLE planejamento_producao_insumos ADD COLUMN IF NOT EXISTS prazo_venda_ate DATE;

            -- Linhas de insumos de cada planejamento (N por planejamento)
            CREATE TABLE IF NOT EXISTS planejamento_producao_linhas (
                id                      SERIAL PRIMARY KEY,
                planejamento_id         INTEGER NOT NULL REFERENCES planejamento_producao_insumos(id) ON DELETE CASCADE,
                insumo_produto_id       INTEGER,
                insumo_nome             TEXT NOT NULL,
                coeficiente_pct         NUMERIC(8,4) NOT NULL DEFAULT 100,
                qtd_necessaria          NUMERIC(12,3) DEFAULT 0.00,
                preco_compra_tabela     NUMERIC(14,4) DEFAULT 0.00,
                preco_compra_simulado   NUMERIC(14,4) DEFAULT 0.00,
                preco_venda_tabela      NUMERIC(14,4) DEFAULT 0.00,
                custo_total_insumo      NUMERIC(14,2) DEFAULT 0.00,
                criado_em               TIMESTAMP DEFAULT NOW()
            );

            -- Movimentações reais por linha de insumo
            CREATE TABLE IF NOT EXISTS planejamento_producao_movimentacoes (
                id                  SERIAL PRIMARY KEY,
                linha_id            INTEGER NOT NULL REFERENCES planejamento_producao_linhas(id) ON DELETE CASCADE,
                planejamento_id     INTEGER NOT NULL,
                tipo                TEXT NOT NULL CHECK (tipo IN ('COMPRA','VENDA')),
                quantidade          NUMERIC(12,3) NOT NULL,
                preco_unitario      NUMERIC(14,4) NOT NULL,
                valor_total         NUMERIC(14,2),
                data_movimentacao   DATE DEFAULT CURRENT_DATE,
                obs                 TEXT,
                criado_em           TIMESTAMP DEFAULT NOW()
            );


            CREATE TABLE IF NOT EXISTS planejamento_comercial_revenda (
                id                         SERIAL PRIMARY KEY,
                mes_referencia             TEXT NOT NULL,
                produto_id                 INTEGER,
                produto_nome               TEXT,
                compra_planejada_kg        NUMERIC(12,3) DEFAULT 0.00,
                venda_planejada_kg         NUMERIC(12,3) DEFAULT 0.00,
                investimento_planejado_rs  NUMERIC(14,2) DEFAULT 0.00,
                faturamento_previsto_rs    NUMERIC(14,2) DEFAULT 0.00,
                compra_realizada_kg        NUMERIC(12,3) DEFAULT 0.00,
                venda_realizada_rs         NUMERIC(14,2) DEFAULT 0.00,
                participacao_meta_pct      NUMERIC(5,2) DEFAULT 0.00,
                status                     TEXT DEFAULT 'Em Cotação',
                observacoes                TEXT,
                criado_em                  TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS planejamento_comercial_transacoes (
                id                SERIAL PRIMARY KEY,
                planejamento_id   INTEGER NOT NULL,
                tipo              VARCHAR(10) NOT NULL,
                quantidade_kg     NUMERIC(12,3) NOT NULL,
                preco_unitario    NUMERIC(14,2) NOT NULL,
                valor_total       NUMERIC(14,2) NOT NULL,
                data_transacao    DATE NOT NULL,
                observacoes       TEXT,
                criado_em         TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS parametros_estoque_prazos (
                id                         SERIAL PRIMARY KEY,
                material_id                INTEGER UNIQUE NOT NULL,
                lead_time_compra_dias      INTEGER DEFAULT 7,
                prazo_entrega_dias         INTEGER DEFAULT 15,
                prazo_producao_dias        INTEGER DEFAULT 5,
                estoque_minimo_kg          NUMERIC(12,3) DEFAULT 0.00,
                estoque_seguranca_kg       NUMERIC(12,3) DEFAULT 0.00,
                prazo_permanencia_dias     INTEGER DEFAULT 30,
                atualizado_em              TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS configuracao_cenarios_planejamento (
                id                         SERIAL PRIMARY KEY,
                percentual_conservador     NUMERIC(5,2) DEFAULT 80.00,
                percentual_moderado        NUMERIC(5,2) DEFAULT 100.00,
                percentual_agressivo       NUMERIC(5,2) DEFAULT 120.00,
                cenario_foco               VARCHAR(20) DEFAULT 'AGRESSIVO',
                meta_base_padrao_rs        NUMERIC(15,2) DEFAULT 1000000.00,
                atualizado_em              TIMESTAMP DEFAULT NOW()
            );
        `);

        // Tabela de Planejamento Estratégico (Consolidado por mês e produto)
        await client.query(`
            CREATE TABLE IF NOT EXISTS planejamento_estrategico (
                id                         SERIAL PRIMARY KEY,
                mes                        VARCHAR(7) NOT NULL,
                material_id                INTEGER NOT NULL,
                qtd_conservador            NUMERIC(12,3) DEFAULT 0.00,
                qtd_moderado               NUMERIC(12,3) DEFAULT 0.00,
                qtd_agressivo              NUMERIC(12,3) DEFAULT 0.00,
                qtd_realizado              NUMERIC(12,3) DEFAULT 0.00,
                margem_alvo                NUMERIC(8,4) DEFAULT NULL,
                valor_compra_realizado     NUMERIC(14,2) DEFAULT 0.00,
                valor_venda_realizado      NUMERIC(14,2) DEFAULT 0.00,
                criado_em                  TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_mes_material UNIQUE (mes, material_id)
            );

            -- Migrações seguras das novas colunas
            ALTER TABLE planejamento_estrategico ADD COLUMN IF NOT EXISTS margem_alvo NUMERIC(8,4) DEFAULT NULL;
            ALTER TABLE planejamento_estrategico ADD COLUMN IF NOT EXISTS valor_compra_realizado NUMERIC(14,2) DEFAULT 0.00;
            ALTER TABLE planejamento_estrategico ADD COLUMN IF NOT EXISTS valor_venda_realizado NUMERIC(14,2) DEFAULT 0.00;

            CREATE TABLE IF NOT EXISTS planejamento_estrategicov3 (
                id                         SERIAL PRIMARY KEY,
                mes                        VARCHAR(7) NOT NULL,
                material_id                INTEGER NOT NULL,
                meta_faturamento           NUMERIC(14,2) DEFAULT 0.00,
                margem_desejada            NUMERIC(5,2) DEFAULT 0.00,
                operacao                   VARCHAR(15) DEFAULT 'entrega',
                qtd_realizado              NUMERIC(12,3) DEFAULT 0.00,
                valor_venda_realizado      NUMERIC(14,2) DEFAULT 0.00,
                criado_em                  TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_mes_material_v3 UNIQUE (mes, material_id)
            );
            CREATE TABLE IF NOT EXISTS estrategiav3_planos (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(150),
                data_inicial DATE,
                data_final DATE,
                frente VARCHAR(50),
                meta_faturamento NUMERIC(14,2) DEFAULT 0.00,
                status VARCHAR(50) DEFAULT 'EM ANDAMENTO',
                cenario_conservador_pct NUMERIC(5,2) DEFAULT 80.00,
                cenario_moderado_pct NUMERIC(5,2) DEFAULT 100.00,
                cenario_agressivo_pct NUMERIC(5,2) DEFAULT 120.00,
                criado_em TIMESTAMP DEFAULT NOW()
            );
        `);

        try {
            await client.query(`
                ALTER TABLE estrategiav3_planos 
                ADD COLUMN IF NOT EXISTS cenario_conservador_pct NUMERIC(5,2) DEFAULT 80.00,
                ADD COLUMN IF NOT EXISTS cenario_moderado_pct NUMERIC(5,2) DEFAULT 100.00,
                ADD COLUMN IF NOT EXISTS cenario_agressivo_pct NUMERIC(5,2) DEFAULT 120.00,
                ADD COLUMN IF NOT EXISTS faturamento_realizado NUMERIC(14,2) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS investimento_realizado NUMERIC(14,2) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS volume_realizado NUMERIC(12,3) DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS observacoes TEXT DEFAULT '';
            `);
        } catch(e) {}

        await client.query(`
            CREATE TABLE IF NOT EXISTS estrategiav3_mix (
                id SERIAL PRIMARY KEY,
                plano_id INTEGER REFERENCES estrategiav3_planos(id) ON DELETE CASCADE,
                material_id INTEGER NOT NULL,
                fracao_pct NUMERIC(5,2) DEFAULT 0.00,
                volume_necessario NUMERIC(12,3) DEFAULT 0.00,
                faturamento_alvo NUMERIC(14,2) DEFAULT 0.00,
                investimento_necessario NUMERIC(14,2) DEFAULT 0.00,
                faturamento_realizado NUMERIC(14,2) DEFAULT 0.00
            );
            ALTER TABLE estrategiav3_mix ADD COLUMN IF NOT EXISTS rendimento_pct NUMERIC(5,2) DEFAULT 100.00;
        `);

        // Migrações adicionais para Planejamento Comercial
        await client.query(`
            ALTER TABLE planejamento_comercial_revenda ADD COLUMN IF NOT EXISTS preco_compra_estimado NUMERIC(14,2) DEFAULT 0.00;
            ALTER TABLE planejamento_comercial_revenda ADD COLUMN IF NOT EXISTS preco_venda_estimado NUMERIC(14,2) DEFAULT 0.00;
            ALTER TABLE planejamento_comercial_revenda ADD COLUMN IF NOT EXISTS preco_compra_realizado NUMERIC(14,2) DEFAULT 0.00;
            ALTER TABLE planejamento_comercial_revenda ADD COLUMN IF NOT EXISTS preco_venda_realizado NUMERIC(14,2) DEFAULT 0.00;
            ALTER TABLE planejamento_comercial_revenda ADD COLUMN IF NOT EXISTS venda_realizada_kg NUMERIC(12,3) DEFAULT 0.00;
            ALTER TABLE planejamento_comercial_revenda ADD COLUMN IF NOT EXISTS prazo_compra_ate DATE;
            ALTER TABLE planejamento_comercial_revenda ADD COLUMN IF NOT EXISTS prazo_venda_ate DATE;
        `);

        // ==========================================
        // MÓDULO PCP (Planejamento e Controle da Produção)
        // ==========================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS pcp_planejamentos (
                id SERIAL PRIMARY KEY,
                ano INTEGER NOT NULL,
                mes VARCHAR(20) NOT NULL,
                meta_mensal NUMERIC(14,4) NOT NULL,
                dias_trabalhados INTEGER NOT NULL,
                qtd_linhas INTEGER NOT NULL,
                status VARCHAR(50) DEFAULT 'RASCUNHO',
                observacoes TEXT,
                criado_em TIMESTAMP DEFAULT NOW(),
                criado_por VARCHAR(100)
            );

            CREATE TABLE IF NOT EXISTS pcp_linhas (
                id SERIAL PRIMARY KEY,
                planejamento_id INTEGER NOT NULL REFERENCES pcp_planejamentos(id) ON DELETE CASCADE,
                numero_linha INTEGER NOT NULL,
                meta_mensal NUMERIC(14,4) NOT NULL,
                meta_diaria NUMERIC(14,4) NOT NULL,
                percentual_carga NUMERIC(14,4) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pcp_mix (
                id SERIAL PRIMARY KEY,
                planejamento_id INTEGER NOT NULL REFERENCES pcp_planejamentos(id) ON DELETE CASCADE,
                material_id INTEGER NOT NULL REFERENCES materiais_catalogo(id) ON DELETE RESTRICT,
                linha_id INTEGER REFERENCES pcp_linhas(id) ON DELETE SET NULL,
                numero_linha INTEGER NOT NULL,
                volume_total NUMERIC(14,4) NOT NULL,
                percentual_volume NUMERIC(14,4) NOT NULL,
                meta_dia NUMERIC(14,4) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pcp_plano_diario (
                id SERIAL PRIMARY KEY,
                planejamento_id INTEGER NOT NULL REFERENCES pcp_planejamentos(id) ON DELETE CASCADE,
                data DATE NOT NULL,
                is_dia_produtivo BOOLEAN DEFAULT TRUE,
                meta_l1 NUMERIC(14,4) DEFAULT 0,
                meta_l2 NUMERIC(14,4) DEFAULT 0,
                meta_l3 NUMERIC(14,4) DEFAULT 0,
                meta_l4 NUMERIC(14,4) DEFAULT 0,
                meta_total_dia NUMERIC(14,4) DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS pcp_producao_real (
                id SERIAL PRIMARY KEY,
                plano_diario_id INTEGER NOT NULL UNIQUE REFERENCES pcp_plano_diario(id) ON DELETE CASCADE,
                real_l1 NUMERIC(14,4) DEFAULT 0,
                real_l2 NUMERIC(14,4) DEFAULT 0,
                real_l3 NUMERIC(14,4) DEFAULT 0,
                real_l4 NUMERIC(14,4) DEFAULT 0,
                real_total NUMERIC(14,4) DEFAULT 0,
                observacao TEXT,
                atualizado_em TIMESTAMP DEFAULT NOW(),
                atualizado_por VARCHAR(100)
            );
        `);

        // Semeando Produtos Necessários para o PCP (Se não existirem)
        const pcpMaterials = [
            "Sucata de fio misto sujo (ELETRONICO)",
            "Sucata de induzidos",
            "Sucata de transformadores Cobre",
            "Sucata de cooler",
            "Sucata de disjuntores",
            "Sucata de tomada e conectores",
            "Sucata de fio de instalação",
            "Sucata de fio de internet",
            "Sucata de fio misto limpo",
            "Ajuste de arredondamento"
        ];
        
        for (const matName of pcpMaterials) {
            const { rowCount } = await client.query('SELECT 1 FROM materiais_catalogo WHERE nome = $1', [matName]);
            if (rowCount === 0) {
                await client.query(
                    'INSERT INTO materiais_catalogo (nome, unidade, categoria, cor, ncm, observacoes) VALUES ($1, $2, $3, $4, $5, $6)',
                    [matName, 'kg', 'PCP', '#4b7bec', '0000.00.00', 'Produto gerado para compatibilidade do módulo PCP']
                );
            }
        }


        // Semeando fornecedores e amostras
        const { rowCount: fCount } = await client.query('SELECT 1 FROM fornecedores LIMIT 1');
        if (fCount === 0) {
            await client.query(`
                INSERT INTO fornecedores (nome, apelido, cnpj, comprador, fone1, email, endereco, complemento)
                VALUES ('Davi Reciclagem de Metais LTDA', 'davi', '12.345.678/0001-99', 'Davi', '(11) 98765-4321', 'davi@apextech.com', 'Av. da Reciclagem, 1000', 'Fornecedor Parceiro LME');
            `);
            
            // Seed amostras/lotes do Davi
            await client.query(`
                INSERT INTO amostras (id, numero_amostra, data, fornecedor_id, responsavel, peso_inicial, status, observacoes, foto_original) VALUES
                (1, 'AM-001', '2026-07-15', 1, 'Eng. Roberto', 5000, 'Processado', 'Fio de Instalação do Fornecedor davi', 'assets/img/photo-1595246140625-573b715d11dc.jpg'),
                (2, 'AM-002', '2026-07-16', 1, 'Eng. Roberto', 20000, 'Liberado para Produção', 'Fio Misto', ''),
                (3, 'AM-003', '2026-07-17', 1, 'Eng. Roberto', 15000, 'Aguardando Liberação PCP', 'Fio Terminais', '');

                INSERT INTO componentes_amostra (id, amostra_id, material_id, peso, percentual, observacoes) VALUES
                (1, 1, 5, 3100, 62.0, 'Cobre 1'),
                (2, 1, 15, 1900, 38.0, 'Isolamento plástico/perda'),
                (3, 2, 6, 8200, 41.0, 'Cobre 2'),
                (4, 2, 15, 11800, 59.0, 'Resíduos e plásticos'),
                (5, 3, 6, 4650, 31.0, 'Cobre 2'),
                (6, 3, 15, 10350, 69.0, 'Resíduos e plásticos');

                INSERT INTO lotes_compra (id, amostra_id, fornecedor_id, produto, peso_comprado, preco_compra, percentual_rendimento, material_id, preco_venda_material, comissao, fidc, mes) VALUES
                (1, 1, 1, 'fio de instalação', 5000, 40.50, 62.0, 5, 71.00, 2.0, 2.3, '2026-07'),
                (2, 2, 1, 'fio misto', 20000, 18.00, 41.0, 6, 65.50, 2.0, 2.3, '2026-07'),
                (3, 3, 1, 'fio terminais', 15000, 14.00, 31.0, 6, 65.00, 2.0, 2.3, '2026-07');

                INSERT INTO estoque (material_id, saldo) VALUES
                (5, 3100),
                (6, 8200),
                (15, 13700) ON CONFLICT (material_id) DO NOTHING;

                INSERT INTO movimentacoes_estoque (id, material_id, tipo, quantidade, motivo, data) VALUES
                (1, 5, 'ENTRADA', 3100, 'Processamento da amostra AM-001', '2026-07-15'),
                (2, 15, 'ENTRADA', 1900, 'Processamento da amostra AM-001', '2026-07-15'),
                (3, 6, 'ENTRADA', 8200, 'Processamento da amostra AM-002', '2026-07-16'),
                (4, 15, 'ENTRADA', 11800, 'Processamento da amostra AM-002', '2026-07-16') ON CONFLICT (id) DO NOTHING;
            `);
            console.log('✅ Fornecedores e amostras semeados.');
        }

        // Seed materiais_catalogo — SEMPRE (ON CONFLICT protege dados existentes)
        {
            const mats = memStore.materiais_catalogo;
            for (const m of mats) {
                await client.query(`
                    INSERT INTO materiais_catalogo (id, nome, unidade, categoria, cor, ncm, observacoes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING;
                `, [m.id, m.nome, m.unidade, m.categoria, m.cor, m.ncm, m.observacoes]);
            }
            console.log('✅ Catálogo de materiais verificado/semeado.');
        }

        // Seed tabela_precos — SEMPRE (ON CONFLICT protege dados existentes)
        {
            const precos = memStore.tabela_precos;
            for (const p of precos) {
                await client.query(`
                    INSERT INTO tabela_precos (id, material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING;
                `, [p.id, p.material_id, p.preco_entregar, p.preco_coletar, p.venda_ref, p.validade,
                    p.comissao||0, p.pis_cofins||0, p.fidc||0, p.icms||0, p.frete_coleta||0]);
            }
            console.log('✅ Tabela de preços verificada/semeada.');
        }

        // Seed usuarios — SEMPRE (ON CONFLICT protege dados existentes)
        {
            const usrs = memStore.usuarios;
            for (const u of usrs) {
                await client.query(`
                    INSERT INTO usuarios (id, "user", pass, perfil, nome)
                    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING;
                `, [u.id, u.user, u.pass, u.perfil, u.nome]);
            }
            console.log('✅ Usuários verificados/semeados.');
        }

        // Inserir soluções padrão se a tabela estiver vazia
        const { rowCount } = await client.query('SELECT 1 FROM solucoes LIMIT 1');
        if (rowCount === 0) {
            const defaultSolucoes = [
                { nome: 'Sucatas de Indústrias',    img: 'assets/img/residuos-de-empresas-e-industrias.svg',  desc: 'Nossos principais serviços incluem a gestão e comercialização de resíduos gerados por indústrias, assegurando o descarte adequado e a reciclagem responsável de materiais. Atendemos a diversos setores industriais, oferecendo soluções inovadoras e eficientes para a gestão de resíduos, com foco constante na sustentabilidade e no reaproveitamento, promovendo um ciclo ambientalmente consciente.', ordem: 1 },
                { nome: 'Resíduos de Conectores',   img: 'assets/img/icon-residuos-de-conectores.svg',          desc: 'Tratamos e reciclamos resíduos de conectores elétricos e eletrônicos, assegurando que esses materiais sejam reaproveitados de forma eficiente e sustentável. Nosso processo garante a máxima recuperação de metais, reduzindo o impacto ambiental e promovendo fortemente a economia circular em todos os nossos processos logísticos.', ordem: 2 },
                { nome: 'Sucatas de Fios e Cabos',  img: 'assets/img/sucata-de-fio.svg',                         desc: 'Especializamo-nos na compra e reciclagem de sucata de fio e cabos de todos os tipos. Transformamos resíduos em recursos reutilizáveis através de processos de separação de alta tecnologia que isolam o plástico dos metais valiosos como cobre e alumínio de maneira rápida, limpa e altamente sustentável.', ordem: 3 },
                { nome: 'Resíduos e Sucatas de Obras', img: 'assets/img/residuos-e-sucatas-de-obras.svg',       desc: 'Oferecemos serviços de gestão de resíduos em obras, proporcionando soluções completas e personalizadas para o setor da construção civil. Trabalhamos com planejamento de coleta programada para manter sua obra limpa, organizada e perfeitamente adequada às normas ambientais mais rigorosas de descarte.', ordem: 4 }
            ];
            for (const s of defaultSolucoes) {
                await client.query(
                    'INSERT INTO solucoes (nome, img, descricao, ordem) VALUES ($1, $2, $3, $4)',
                    [s.nome, s.img, s.desc, s.ordem]
                );
            }
            console.log('✅ Soluções padrão inseridas no banco de dados.');
        }

        // Inserir configurações padrão da home se vazia
        const { rowCount: settingsCount } = await client.query('SELECT 1 FROM settings LIMIT 1');
        if (settingsCount === 0) {
            const defaultSettings = [
                { key: 'show_sobre', value: 'true' },
                { key: 'show_solucoes', value: 'true' },
                { key: 'show_catalogo', value: 'true' },
                { key: 'show_onde_encontramos', value: 'true' },
                { key: 'show_cotacoes', value: 'true' },
                { key: 'show_noticias', value: 'true' },
                { key: 'show_galeria', value: 'true' }
            ];
            for (const s of defaultSettings) {
                await client.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [s.key, s.value]);
            }
            console.log('✅ Configurações padrão da home inseridas no banco de dados.');
        }

        // Garante que todas as tabelas possuam a coluna atualizado_em e tipo de peso com 4 casas decimais
        await client.query(`
            ALTER TABLE amostras ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE amostras ALTER COLUMN peso_inicial TYPE NUMERIC(14,4);
            ALTER TABLE tabela_precos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE tabela_precos_residuos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE tabela_precos_ligas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE tabela_precos_volume ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE tabela_precos_fundicao ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE materiais_catalogo ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE residuos_catalogo ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE ligas_catalogo ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE clientes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
            ALTER TABLE pedidos_venda ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();
        `).catch(e => console.warn('Aviso na migração de colunas atualizado_em:', e.message));

        // Garante que as chaves de e-mail LME existam no banco (sem sobrescrever dados salvos)
        const lmeDefaults = [
            { key: 'lme_envio_ativo',   value: 'false' },
            { key: 'lme_envio_horario', value: '14:00' },
            { key: 'lme_envio_dias',    value: '1,2,3,4,5' },
            { key: 'lme_resend_api_key', value: process.env.RESEND_API_KEY || '' },
            { key: 'lme_resend_from',   value: process.env.RESEND_FROM || 'Apextech Metais <noreply@apextechmetais.com.br>' },
            { key: 'role_permissions',  value: JSON.stringify({
                "Administrador": ["view_lme", "view_precos", "view_catalogo", "view_fornecedores", "view_laboratorio", "view_planejamento", "view_estoque", "view_bi", "edit_financeiro", "edit_producao", "view_usuarios"],
                "Laboratório": ["view_laboratorio", "view_catalogo"],
                "Compras": ["view_lme", "view_precos", "view_catalogo", "view_fornecedores", "view_estoque"],
                "Produção": ["view_estoque", "view_planejamento", "view_catalogo", "edit_producao"],
                "Financeiro": ["view_lme", "view_precos", "view_fornecedores", "view_bi", "edit_financeiro"],
                "Diretoria": ["view_lme", "view_precos", "view_catalogo", "view_fornecedores", "view_laboratorio", "view_planejamento", "view_estoque", "view_bi", "edit_financeiro", "edit_producao"]
            }) }
        ];
        for (const s of lmeDefaults) {
            await client.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
                [s.key, s.value]
            );
        }
        // Sanitizar configurações legadas para garantir credenciais e remetente oficiais protegidos
        await client.query(`UPDATE settings SET value = 'Apextech Metais <noreply@apextechmetais.com.br>' WHERE key = 'lme_resend_from' AND (value LIKE '%onboarding%' OR value LIKE '%lme.lat%' OR value = '' OR value IS NULL)`);
        if (process.env.RESEND_API_KEY) {
            await client.query(`UPDATE settings SET value = $1 WHERE key = 'lme_resend_api_key' AND (value = '' OR value IS NULL)`, [process.env.RESEND_API_KEY]);
        }
        console.log('✅ Chaves de configuração LME garantidas no banco de dados.');

        // SEMPRE reseta as sequences para que novos INSERTs nunca conflitem com IDs do seed
        await client.query(`SELECT setval('materiais_catalogo_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM materiais_catalogo), false)`);
        await client.query(`SELECT setval('tabela_precos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM tabela_precos), false)`);
        await client.query(`SELECT setval('fornecedores_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM fornecedores), false)`);
        await client.query(`SELECT setval('amostras_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM amostras), false)`);
        await client.query(`SELECT setval('componentes_amostra_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM componentes_amostra), false)`);
        await client.query(`SELECT setval('lotes_compra_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM lotes_compra), false)`);
        await client.query(`SELECT setval('usuarios_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM usuarios), false)`);
        console.log('✅ Sequences do banco resetadas com sucesso.');

        dbAvailable = true;
        console.log('✅ Banco de dados inicializado com sucesso.');
    } catch (err) {
        console.warn('⚠️  Banco de dados indisponível. Usando armazenamento em memória.', err.message);
        dbAvailable = false;
    } finally {
        if (client) client.release();
    }
}

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Segurança: bloqueia acesso a arquivos sensíveis
app.use((req, res, next) => {
    const blockedFiles = [
        '/.env', '/.env.example', '/package.json', '/package-lock.json',
        '/server.js', '/.gitignore', '/readme.md',
        '/implementation_plan.md', '/task.md', '/walkthrough.md'
    ];
    const requestedPath = req.path.toLowerCase();
    if (blockedFiles.includes(requestedPath) || requestedPath.startsWith('/.git')) {
        return res.status(403).send('Forbidden: Access is denied.');
    }
    next();
});

// ─── Arquivos Estáticos ───────────────────────────────────────────────────────
// Somente o front-end é público. O restante da raiz (código do servidor, planilhas de
// clientes/fornecedores, logs, scripts, migrations) nunca é servido.
const PUBLIC_ROOT_FILES = new Set([
    '/', '/index.html', '/admin.html', '/contato.html', '/cotacoes.html', '/noticias.html',
    '/onde-comprar.html', '/produtos.html', '/servicos.html', '/sobre.html',
    '/style.css', '/admin.css', '/script.js', '/admin.js', '/partials.js',
    '/sw.js', '/manifest.json', '/lib/calculationengine.js'
]);

function isPublicAsset(reqPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(reqPath);
    } catch (e) {
        return false;
    }
    if (decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0')) return false;
    const normalized = path.posix.normalize(decoded).toLowerCase();
    if (normalized.startsWith('/assets/excel/')) return false;
    return PUBLIC_ROOT_FILES.has(normalized) || normalized.startsWith('/assets/');
}

// Desabilita cache agressivo de arquivos estáticos para que atualizações apareçam instantaneamente
const serveStatic = express.static(__dirname, {
    etag: false,
    maxAge: 0,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
});
app.use((req, res, next) => (isPublicAsset(req.path) ? serveStatic(req, res, next) : next()));

// ─── MIDDLEWARES DE SEGURANÇA (RBAC) ─────────────────────────────────────────
const authMiddleware = (req, res, next) => {
    const publicRoutes = [
        '/login', '/solucoes', '/cotacoes-hoje',
        '/lme/cron-trigger'
    ];
    // Configurações do site são públicas (para temas, ocultar menus etc)
    if (req.path === '/settings' && req.method === 'GET') return next();
    // Notícias e galeria são exibidas no site público (somente leitura)
    if (req.method === 'GET' && (req.path === '/noticias' || req.path === '/galeria')) return next();
    // Rotas de cotação LME são públicas (usadas na página cotacoes.html e home sem login)
    if (req.path.startsWith('/lme/tabela') || req.path.startsWith('/lme/graflme') || req.path.startsWith('/lme/varialme') || req.path === '/cotacoes-hoje') return next();
    if (publicRoutes.includes(req.path) || req.path.startsWith('/public')) return next();
    // Rota de imagem de fotos é pública: a tag <img> do HTML não pode enviar JWT
    if (/^\/api\/amostras\/\d+\/fotos\/\d+\/img$/.test(req.path)) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido. Acesso Negado.' });
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
};

const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
        
        const userRole = (req.user.perfil || '').trim().toLowerCase();
        const isAdmin = userRole === 'administrador';
        if (isAdmin) return next();

        const rolesLower = allowedRoles.map(r => r.toLowerCase().trim());
        if (rolesLower.includes(userRole)) return next();
        
        return res.status(403).json({ error: 'Acesso negado para o seu perfil: ' + req.user.perfil });
    };
};

// Aplica autenticação em todas as rotas da API
app.use('/api', authMiddleware);

// Middleware Global de Auditoria
const globalAuditMiddleware = async (req, res, next) => {
    // Escuta o término da requisição para registrar apenas se foi sucesso (opcional) ou registra na entrada
    // Vamos registrar na entrada para capturar tentativas, mas ignorar métodos GET e OPTIONS
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const usuario = req.user ? req.user.user : (req.body.user ? req.body.user : 'Anônimo');
        let acao = req.method;
        let detalhe = `Endpoint: ${req.path}`;
        
        let safeBody = { ...req.body };
        if (safeBody.pass) safeBody.pass = '***'; // Omitir senhas
        
        if (req.path === '/login') {
            acao = 'LOGIN';
            detalhe = 'Tentativa de Login';
        } else if (req.path.includes('/usuarios')) {
            acao = 'USUÁRIOS';
        } else if (req.path.includes('/amostras')) {
            acao = 'AMOSTRAS';
        } else if (req.path.includes('/tabela-precos')) {
            acao = 'PREÇOS';
        } else if (req.path.includes('/pedidos-venda')) {
            acao = 'PEDIDOS';
        } else if (req.path.includes('/fornecedores') || req.path.includes('/clientes')) {
            acao = 'CADASTROS';
        }

        const payloadStr = JSON.stringify(safeBody) || '';
        if (payloadStr !== '{}') {
            detalhe += ` | Dados: ${payloadStr.substring(0, 200)}`;
        }
        
        // Chamada não bloqueante
        registrarAuditLog(usuario, acao, detalhe, null, req).catch(console.error);
    }
    next();
};

app.use('/api', globalAuditMiddleware);

// Regras de Autorização por Agrupamento de Rotas (RBAC)
app.use('/api/usuarios', requireRole(['Diretoria']));
app.use('/api/tabela-precos', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-validade-geral', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-residuos', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-residuos-validade', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-ligas', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-ligas-validade', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-volume', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-volume-validade', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-fundicao', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/tabela-precos-fundicao-validade', requireRole(['Diretoria', 'Compras', 'Comercial']));
app.use('/api/amostras', requireRole(['Diretoria', 'Laboratório', 'Produção']));
app.use('/api/planejamento', requireRole(['Diretoria', 'Compras', 'Produção', 'Comercial']));
app.use('/api/planejamento-compras', requireRole(['Diretoria', 'Compras']));
app.use('/api/planejamento-estrategico', requireRole(['Diretoria']));
app.use('/api/planejamento-estrategicov3', requireRole(['Diretoria']));
app.get('/api/estrategiav3_planos', requireRole(['Diretoria', 'Compras', 'Financeiro', 'Produção', 'Comercial']));
app.post('/api/estrategiav3_planos', requireRole(['Diretoria']));
app.get('/api/estrategiav3_planos/:id/realizado-pedidos', requireRole(['Diretoria', 'Compras', 'Financeiro', 'Produção', 'Comercial']));
app.put('/api/estrategiav3_planos/:id/status', requireRole(['Diretoria']));
app.put('/api/estrategiav3_planos/:id/resultado_real', requireRole(['Diretoria']));
app.delete('/api/estrategiav3_planos/:id', requireRole(['Diretoria']));

app.get('/api/estrategiav3_mix', requireRole(['Diretoria', 'Compras', 'Financeiro', 'Produção', 'Comercial']));
app.post('/api/estrategiav3_mix', requireRole(['Diretoria']));
app.put('/api/estrategiav3_mix/:id/realizado', requireRole(['Diretoria']));
app.delete('/api/estrategiav3_mix/:id', requireRole(['Diretoria']));
// Nota: /api/lme/tabela, /api/lme/graflme e /api/lme/varialme são públicas (isentas no authMiddleware).
// Rotas administrativas do LME (gerar-excel, envio, etc.) continuam exigindo login via authMiddleware:
app.use('/api/lme/destinatarios', requireRole(['Diretoria', 'Compras', 'Administrador']));
app.use('/api/lme/enviar-email-manual', requireRole(['Diretoria', 'Compras', 'Administrador']));
app.use('/api/lme/gerar-excel', requireRole(['Diretoria', 'Compras', 'Administrador']));
app.use('/api/lme/relatorio-semanal', requireRole(['Diretoria', 'Compras', 'Administrador']));
app.use('/api/lme/relatorio-email', requireRole(['Diretoria', 'Compras', 'Administrador']));
app.use('/api/cotacoes', requireRole(['Diretoria', 'Compras']));
app.use('/api/fornecedores', requireRole(['Diretoria', 'Compras', 'Laboratório', 'Produção']));
app.use('/api/clientes', requireRole(['Diretoria', 'Comercial']));
app.use('/api/materiais', requireRole(['Diretoria', 'Laboratório', 'Compras', 'Produção']));
app.use('/api/materiais-catalogo', requireRole(['Diretoria', 'Laboratório', 'Compras', 'Produção']));
app.use('/api/residuos-catalogo', requireRole(['Diretoria', 'Laboratório', 'Compras', 'Produção']));
app.use('/api/ligas-catalogo', requireRole(['Diretoria', 'Laboratório', 'Compras', 'Produção']));
app.use('/api/pedidos-venda', requireRole(['Diretoria', 'Comercial', 'Financeiro']));
app.use('/api/estoque', requireRole(['Diretoria', 'Produção', 'Laboratório', 'Compras', 'Comercial']));
app.use('/api/audit-logs', requireRole(['Diretoria']));
// Setup/migrações/importações e endpoints de diagnóstico: somente Diretoria/Administrador
app.use('/api/admin', requireRole(['Diretoria']));
app.use('/api/debug-logs', requireRole(['Diretoria']));
app.use('/api/db-test', requireRole(['Diretoria']));

app.get('/api/debug-logs', (req, res) => {
    const fs = require('fs');
    try {
        const logContent = fs.readFileSync(path.join(__dirname, 'logs', 'error.log'), 'utf8');
        res.type('text/plain').send(logContent);
    } catch(e) {
        res.type('text/plain').send('No logs: ' + e.message);
    }
});

app.get('/api/db-test', async (req, res) => {
    try {
        if (!pool) return res.send('No pool');
        const result = await pool.query('SELECT * FROM estrategiav3_mix');
        res.json(result.rows);
    } catch(e) {
        res.send('SQL Error: ' + e.message);
    }
});

// ─── API: Login ───────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Limite de 5 tentativas de login por IP
    message: { success: false, error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { user, pass } = req.body;
        let foundUser = null;
        
        // Buscar usuário (somente o registro, sem comparar senha na query SQL)
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM usuarios WHERE "user" = $1', [user]);
            if (result.rows.length > 0) {
                foundUser = result.rows[0];
            }
        } else {
            const u = memStore.usuarios.find(x => x.user === user);
            if (u) foundUser = u;
        }

        // Validação da senha com bcrypt
        if (foundUser) {
            const passwordMatches = await bcrypt.compare(pass, foundUser.pass);
            
            if (passwordMatches) {
                const perfilFinal = foundUser.perfil;
                // Assina o Token JWT
                const token = jwt.sign({ user: foundUser.user, perfil: perfilFinal, nome: foundUser.nome }, JWT_SECRET, { expiresIn: '12h' });
                return res.json({ success: true, token, user: { user: foundUser.user, perfil: perfilFinal, nome: foundUser.nome } });
            }
        }
        
        res.status(401).json({ success: false, error: 'Usuário ou senha inválidos.' });
    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ─── API: Usuários (CRUD) ──────────────────────────────────────────────────────
app.get('/api/usuarios', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT id, "user", perfil, nome FROM usuarios ORDER BY id ASC');
            return res.json(result.rows);
        }
        res.json(memStore.usuarios.map(({ id, user, perfil, nome }) => ({ id, user, perfil, nome })));
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
});

app.post('/api/usuarios', async (req, res) => {
    try {
        const { user, pass, perfil, nome } = req.body;
        if (!user || !pass || !perfil || !nome) return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        
        // Gerar o hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(pass, salt);

        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO usuarios ("user", pass, perfil, nome) VALUES ($1, $2, $3, $4) RETURNING id, "user", perfil, nome',
                [user, hashedPassword, perfil, nome]
            );
            return res.json(result.rows[0]);
        } else {
            const newU = { id: nextId++, user, pass: hashedPassword, perfil, nome };
            memStore.usuarios.push(newU);
            return res.json({ id: newU.id, user, perfil, nome });
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar usuário: ' + err.message });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        } else {
            memStore.usuarios = memStore.usuarios.filter(x => x.id !== id);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
});

// ─── API: Fornecedores (CRUD com Paginação Server-side) ────────────────────────
app.get('/api/fornecedores', async (req, res) => {
    try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit) || 50;
        const search = (req.query.search || '').trim().toLowerCase();

        if (dbAvailable) {
            let whereClause = '';
            let params = [];
            if (search) {
                whereClause = `WHERE LOWER(nome) LIKE $1 OR LOWER(COALESCE(apelido,'')) LIKE $1 OR LOWER(COALESCE(cnpj,'')) LIKE $1 OR LOWER(COALESCE(email,'')) LIKE $1`;
                params.push(`%${search}%`);
            }

            const countResult = await pool.query(`SELECT COUNT(*) FROM fornecedores ${whereClause}`, params);
            const total = parseInt(countResult.rows[0].count);

            let dataQuery = `
                SELECT id, codfor, nome, apelido, fone1, fone2, whatsapp, celular,
                       tabela, concorrente, status_ok, dias, ultima_entrega,
                       tipo_pessoa, data_cadastro, endereco, numero, complemento,
                       bairro, cidade, uf, cep, cnpj, ie, im, rg, emissor, cpf,
                       comprador, email, condicao_pagamento, usuario_cadastro,
                       ultimo_alterou, dias_atraso, dias_previsao, filial,
                       criado_em, atualizado_em
                FROM fornecedores ${whereClause} ORDER BY nome ASC
            `;

            if (page) {
                const offset = (page - 1) * limit;
                dataQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                params.push(limit, offset);
            }

            const result = await pool.query(dataQuery, params);
            if (page) {
                return res.json({
                    data: result.rows,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
                });
            }
            return res.json(result.rows);
        } else {
            let list = memStore.fornecedores || [];
            if (search) {
                list = list.filter(f => 
                    (f.nome || '').toLowerCase().includes(search) ||
                    (f.apelido || '').toLowerCase().includes(search) ||
                    (f.cnpj || '').toLowerCase().includes(search) ||
                    (f.email || '').toLowerCase().includes(search)
                );
            }
            const total = list.length;
            if (page) {
                const start = (page - 1) * limit;
                return res.json({
                    data: list.slice(start, start + limit),
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
                });
            }
            res.json(list);
        }
    } catch (err) {
        console.error('Erro ao buscar fornecedores:', err);
        res.status(500).json({ error: 'Erro ao buscar fornecedores.' });
    }
});

app.post('/api/fornecedores', async (req, res) => {
    try {
        const { razao_social, nome_fantasia, cnpj, cpf, ie, contato,
                telefone, fone2, whatsapp, celular, email,
                endereco, numero, bairro, cidade, uf, cep,
                observacoes, condicao_pagamento, tabela, filial } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO fornecedores (nome, apelido, cnpj, cpf, ie, comprador, fone1, fone2,
                  whatsapp, celular, email, endereco, numero, bairro, cidade, uf, cep,
                  complemento, condicao_pagamento, tabela, filial)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
                 RETURNING *`,
                [razao_social, nome_fantasia, cnpj, cpf, ie, contato,
                 telefone, fone2, whatsapp, celular, email,
                 endereco, numero, bairro, cidade, uf, cep,
                 observacoes, condicao_pagamento, tabela, filial]
            );
            return res.json(result.rows[0]);
        }
        const newF = { 
            id: Date.now(), nome: razao_social, apelido: nome_fantasia, cnpj, cpf, ie, 
            comprador: contato, fone1: telefone, fone2, whatsapp, celular, email, 
            endereco, numero, bairro, cidade, uf, cep, 
            complemento: observacoes, condicao_pagamento, tabela, filial 
        };
        memStore.fornecedores.push(newF);
        return res.json(newF);
    } catch (err) {
        console.error('Erro ao criar fornecedor:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/fornecedores/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { razao_social, nome_fantasia, cnpj, cpf, ie, contato,
                telefone, fone2, whatsapp, celular, email,
                endereco, numero, bairro, cidade, uf, cep,
                observacoes, condicao_pagamento, tabela, filial } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE fornecedores SET
                    nome=$1, apelido=$2, cnpj=$3, cpf=$4, ie=$5, comprador=$6,
                    fone1=$7, fone2=$8, whatsapp=$9, celular=$10, email=$11,
                    endereco=$12, numero=$13, bairro=$14, cidade=$15, uf=$16,
                    cep=$17, complemento=$18, condicao_pagamento=$19, tabela=$20,
                    filial=$21, atualizado_em=NOW()
                WHERE id=$22 RETURNING *`,
                [razao_social, nome_fantasia, cnpj, cpf, ie, contato,
                 telefone, fone2, whatsapp, celular, email,
                 endereco, numero, bairro, cidade, uf, cep,
                 observacoes, condicao_pagamento, tabela, filial, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Fornecedor não encontrado.' });
            return res.json(result.rows[0]);
        }
        res.status(503).json({ error: 'Banco indisponível.' });
    } catch (err) {
        console.error('Erro ao atualizar fornecedor:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/fornecedores/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM fornecedores WHERE id=$1', [id]);
        } else {
            memStore.fornecedores = memStore.fornecedores.filter(x => x.id !== id);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar fornecedor.' });
    }
});


// ─── API: Reparo de Seed (força inserção de dados padrão no banco) ──────────
app.post('/api/admin/reparo-seed', async (req, res) => {
    if (!dbAvailable) return res.json({ msg: 'Usando memória, sem necessidade de reparo.' });
    try {
        const mats = memStore.materiais_catalogo;
        let insertedMat = 0;
        for (const m of mats) {
            const r = await pool.query(
                `INSERT INTO materiais_catalogo (id, nome, unidade, categoria, cor, ncm, observacoes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
                [m.id, m.nome, m.unidade, m.categoria, m.cor, m.ncm, m.observacoes]
            );
            insertedMat += r.rowCount;
        }

        const precos = memStore.tabela_precos;
        let insertedPreco = 0;
        for (const p of precos) {
            const r = await pool.query(
                `INSERT INTO tabela_precos (id, material_id, preco_entregar, preco_coletar, venda_ref, validade)
                 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
                [p.id, p.material_id, p.preco_entregar, p.preco_coletar, p.venda_ref, p.validade]
            );
            insertedPreco += r.rowCount;
        }

        // CRITICAL: Reset sequences so new INSERTs use IDs after the seeded ones
        await pool.query(`SELECT setval('materiais_catalogo_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM materiais_catalogo), false)`);
        await pool.query(`SELECT setval('tabela_precos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM tabela_precos), false)`);
        await pool.query(`SELECT setval('fornecedores_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM fornecedores), false)`);
        await pool.query(`SELECT setval('amostras_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM amostras), false)`);

        res.json({ ok: true, materiais_inseridos: insertedMat, precos_inseridos: insertedPreco, sequences_resetadas: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─── API: Materiais de Catálogo (CRUD) ─────────────────────────────────────────
app.get('/api/materiais-catalogo', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM materiais_catalogo ORDER BY categoria ASC, nome ASC');
            // Fallback para memStore se DB retornar vazio (dados padrão não foram semeados)
            if (result.rows.length > 0) return res.json(result.rows);
        }
        res.json(memStore.materiais_catalogo);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar materiais.' });
    }
});

app.post('/api/materiais-catalogo', async (req, res) => {
    try {
        let { nome, unidade, categoria, cor, ncm, observacoes } = req.body;
        nome = formatarNomeCapitalizado(nome);
        let material;
        const validadeDefault = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO materiais_catalogo (nome, unidade, categoria, cor, ncm, observacoes)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [nome, unidade || 'kg', categoria, cor || '#ffffff', ncm, observacoes]
            );
            material = result.rows[0];

            // Auto-create pricing row (non-blocking)
            try {
                await pool.query(
                    `INSERT INTO tabela_precos (material_id, preco_entregar, preco_coletar, venda_ref, validade)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [material.id, 0.00, 0.00, 0.00, validadeDefault]
                );
                await atualizarDataUltimaModificacaoPrecos();
            } catch (pricingErr) {
                console.error('Aviso: não foi possível criar preço automaticamente:', pricingErr.message);
            }
        } else {
            const newM = { id: nextId++, nome, unidade: unidade || 'kg', categoria, cor: cor || '#ffffff', ncm, observacoes };
            memStore.materiais_catalogo.push(newM);
            material = newM;

            // Auto-create pricing row in memory (non-blocking)
            try {
                memStore.tabela_precos.push({
                    id: nextId++,
                    material_id: material.id,
                    preco_entregar: 0.00,
                    preco_coletar: 0.00,
                    venda_ref: 0.00,
                    validade: validadeDefault
                });
                await atualizarDataUltimaModificacaoPrecos();
            } catch (pricingErr) {
                console.error('Aviso: não foi possível criar preço em memória:', pricingErr.message);
            }
        }
        res.json(material);
    } catch (err) {
        console.error('Erro ao criar material:', err);
        res.status(500).json({ error: 'Erro ao criar material: ' + err.message });
    }
});

app.put('/api/materiais-catalogo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nome, unidade, categoria, cor, ncm, observacoes } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE materiais_catalogo SET nome=$1, unidade=$2, categoria=$3, cor=$4, ncm=$5, observacoes=$6
                 WHERE id=$7 RETURNING *`,
                [nome, unidade, categoria, cor, ncm, observacoes, id]
            );
            return res.json(result.rows[0]);
        } else {
            const idx = memStore.materiais_catalogo.findIndex(x => x.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Material não encontrado.' });
            memStore.materiais_catalogo[idx] = { id, nome, unidade, categoria, cor, ncm, observacoes };
            return res.json(memStore.materiais_catalogo[idx]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar material.' });
    }
});

app.delete('/api/materiais-catalogo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM tabela_precos WHERE material_id=$1', [id]);
            await pool.query('DELETE FROM materiais_catalogo WHERE id=$1', [id]);
            await atualizarDataUltimaModificacaoPrecos();
        } else {
            memStore.tabela_precos = memStore.tabela_precos.filter(x => x.material_id !== id);
            memStore.materiais_catalogo = memStore.materiais_catalogo.filter(x => x.id !== id);
            await atualizarDataUltimaModificacaoPrecos();
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar material:', err);
        res.status(500).json({ error: 'Erro ao deletar material.' });
    }
});

// ─── API: Resíduos (CRUD) ──────────────────────────────────────────────────────
app.get('/api/residuos-catalogo', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM residuos_catalogo ORDER BY categoria ASC, nome ASC');
            return res.json(result.rows);
        }
        res.json(memStore.residuos_catalogo || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar resíduos.' });
    }
});

app.post('/api/residuos-catalogo', async (req, res) => {
    try {
        let { nome, unidade, categoria, cor, ncm, observacoes } = req.body;
        nome = formatarNomeCapitalizado(nome);
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO residuos_catalogo (nome, unidade, categoria, cor, ncm, observacoes)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [nome, unidade || 'kg', categoria, cor || '#ffffff', ncm, observacoes]
            );
            return res.json(result.rows[0]);
        } else {
            const newM = { id: nextId++, nome, unidade: unidade || 'kg', categoria, cor: cor || '#ffffff', ncm, observacoes };
            if (!memStore.residuos_catalogo) memStore.residuos_catalogo = [];
            memStore.residuos_catalogo.push(newM);
            return res.json(newM);
        }
    } catch (err) {
        console.error('Erro ao criar resíduo:', err);
        res.status(500).json({ error: 'Erro ao criar resíduo: ' + err.message });
    }
});

app.put('/api/residuos-catalogo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nome, unidade, categoria, cor, ncm, observacoes } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE residuos_catalogo SET nome=$1, unidade=$2, categoria=$3, cor=$4, ncm=$5, observacoes=$6
                 WHERE id=$7 RETURNING *`,
                [nome, unidade, categoria, cor, ncm, observacoes, id]
            );
            return res.json(result.rows[0]);
        } else {
            if (!memStore.residuos_catalogo) memStore.residuos_catalogo = [];
            const idx = memStore.residuos_catalogo.findIndex(x => x.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Resíduo não encontrado.' });
            memStore.residuos_catalogo[idx] = { id, nome, unidade, categoria, cor, ncm, observacoes };
            return res.json(memStore.residuos_catalogo[idx]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar resíduo.' });
    }
});

app.delete('/api/residuos-catalogo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM residuos_catalogo WHERE id=$1', [id]);
        } else {
            if (!memStore.residuos_catalogo) memStore.residuos_catalogo = [];
            memStore.residuos_catalogo = memStore.residuos_catalogo.filter(x => x.id !== id);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar resíduo:', err);
        res.status(500).json({ error: 'Erro ao deletar resíduo.' });
    }
});

// ─── API: Ligas (CRUD) ─────────────────────────────────────────────────────────
app.get('/api/ligas-catalogo', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM ligas_catalogo ORDER BY categoria ASC, nome ASC');
            return res.json(result.rows);
        }
        res.json(memStore.ligas_catalogo || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar ligas.' });
    }
});

app.post('/api/ligas-catalogo', async (req, res) => {
    try {
        let { nome, unidade, categoria, cor, ncm, observacoes } = req.body;
        nome = formatarNomeCapitalizado(nome);
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO ligas_catalogo (nome, unidade, categoria, cor, ncm, observacoes)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [nome, unidade || 'kg', categoria, cor || '#ffffff', ncm, observacoes]
            );
            return res.json(result.rows[0]);
        } else {
            const newM = { id: nextId++, nome, unidade: unidade || 'kg', categoria, cor: cor || '#ffffff', ncm, observacoes };
            if (!memStore.ligas_catalogo) memStore.ligas_catalogo = [];
            memStore.ligas_catalogo.push(newM);
            return res.json(newM);
        }
    } catch (err) {
        console.error('Erro ao criar liga:', err);
        res.status(500).json({ error: 'Erro ao criar liga: ' + err.message });
    }
});

app.put('/api/ligas-catalogo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nome, unidade, categoria, cor, ncm, observacoes } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE ligas_catalogo SET nome=$1, unidade=$2, categoria=$3, cor=$4, ncm=$5, observacoes=$6
                 WHERE id=$7 RETURNING *`,
                [nome, unidade, categoria, cor, ncm, observacoes, id]
            );
            return res.json(result.rows[0]);
        } else {
            if (!memStore.ligas_catalogo) memStore.ligas_catalogo = [];
            const idx = memStore.ligas_catalogo.findIndex(x => x.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Liga não encontrada.' });
            memStore.ligas_catalogo[idx] = { id, nome, unidade, categoria, cor, ncm, observacoes };
            return res.json(memStore.ligas_catalogo[idx]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar liga.' });
    }
});

app.delete('/api/ligas-catalogo/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM ligas_catalogo WHERE id=$1', [id]);
        } else {
            if (!memStore.ligas_catalogo) memStore.ligas_catalogo = [];
            memStore.ligas_catalogo = memStore.ligas_catalogo.filter(x => x.id !== id);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar liga:', err);
        res.status(500).json({ error: 'Erro ao deletar liga.' });
    }
});

// ─── API: Tabela de Preços (CRUD) ─────────────────────────────────────────────
async function atualizarDataUltimaModificacaoPrecos() {
    try {
        const todayStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const localDate = new Date(todayStr);
        const day = String(localDate.getDate()).padStart(2, '0');
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const year = localDate.getFullYear();
        const formatted = `${day}/${month}/${year}`;
        
        if (dbAvailable) {
            await pool.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                ['tabela_precos_ultima_atualizacao', formatted]
            );
        } else {
            memStore.settings.tabela_precos_ultima_atualizacao = formatted;
        }
    } catch (err) {
        console.error('Erro ao atualizar data de modificação da tabela de preços:', err);
    }
}

app.get('/api/tabela-precos', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query(`
                SELECT tp.*, mc.nome as material_nome, mc.categoria as material_categoria, mc.ncm as material_ncm
                FROM tabela_precos tp
                JOIN materiais_catalogo mc ON tp.material_id = mc.id
                ORDER BY mc.categoria ASC, mc.nome ASC
            `);
            // Fallback para memStore se JOIN retornar vazio (dados padrão ausentes no DB)
            if (result.rows.length > 0) return res.json(result.rows);
        }
        const data = memStore.tabela_precos.map(p => {
            const mc = memStore.materiais_catalogo.find(x => x.id === p.material_id);
            return {
                ...p,
                material_nome: mc ? mc.nome : '',
                material_categoria: mc ? mc.categoria : '',
                material_ncm: mc ? mc.ncm : ''
            };
        });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar tabela de preços.' });
    }
});

app.post('/api/tabela-precos', async (req, res) => {
    try {
        const { material_id, preco_entregar, preco_coletar, venda_ref, validade, aplicar_todos, comissao, pis_cofins, fidc, icms, frete_coleta } = req.body;
        if (dbAvailable) {
            if (aplicar_todos && validade) {
                await pool.query('UPDATE tabela_precos SET validade = $1', [validade]);
            }
            const result = await pool.query(
                `INSERT INTO tabela_precos (material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                [material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao || 0, pis_cofins || 0, fidc || 0, icms || 0, frete_coleta || 0]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        } else {
            if (aplicar_todos && validade) {
                memStore.tabela_precos.forEach(p => p.validade = validade);
            }
            const newP = { id: Date.now(), material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar), preco_coletar: parseFloat(preco_coletar), venda_ref: parseFloat(venda_ref), validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 };
            memStore.tabela_precos.push(newP);
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(newP);
        }
    } catch (err) {
        console.error('Erro ao criar preço:', err);
        res.status(500).json({ error: 'Erro ao salvar preço.' });
    }
});

app.put('/api/tabela-precos-validade-geral', async (req, res) => {
    try {
        const { validade } = req.body;
        if (!validade) return res.status(400).json({ error: 'Data de validade é obrigatória.' });
        if (dbAvailable) {
            await pool.query('UPDATE tabela_precos SET validade = $1', [validade]);
            await atualizarDataUltimaModificacaoPrecos();
            return res.json({ success: true, validade });
        } else {
            memStore.tabela_precos.forEach(p => p.validade = validade);
            await atualizarDataUltimaModificacaoPrecos();
            return res.json({ success: true, validade });
        }
    } catch (err) {
        console.error('Erro ao atualizar validade geral:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tabela-precos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { preco_entregar, preco_coletar, venda_ref, validade, aplicar_todos, comissao, pis_cofins, fidc, icms, frete_coleta } = req.body;
        if (dbAvailable) {
            if (aplicar_todos && validade) {
                await pool.query('UPDATE tabela_precos SET validade = $1', [validade]);
            }
            const result = await pool.query(
                `UPDATE tabela_precos SET preco_entregar=$1, preco_coletar=$2, venda_ref=$3, validade=$4,
                        comissao=$5, pis_cofins=$6, fidc=$7, icms=$8, frete_coleta=$9
                 WHERE id=$10 RETURNING *`,
                [preco_entregar, preco_coletar, venda_ref, validade, comissao || 0, pis_cofins || 0, fidc || 0, icms || 0, frete_coleta || 0, id]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        } else {
            if (aplicar_todos && validade) {
                memStore.tabela_precos.forEach(p => p.validade = validade);
            }
            const idx = memStore.tabela_precos.findIndex(x => x.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Preço não encontrado.' });
            memStore.tabela_precos[idx].preco_entregar = parseFloat(preco_entregar);
            memStore.tabela_precos[idx].preco_coletar = parseFloat(preco_coletar);
            memStore.tabela_precos[idx].venda_ref = parseFloat(venda_ref);
            memStore.tabela_precos[idx].validade = validade;
            memStore.tabela_precos[idx].comissao = parseFloat(comissao)||0;
            memStore.tabela_precos[idx].pis_cofins = parseFloat(pis_cofins)||0;
            memStore.tabela_precos[idx].fidc = parseFloat(fidc)||0;
            memStore.tabela_precos[idx].icms = parseFloat(icms)||0;
            memStore.tabela_precos[idx].frete_coleta = parseFloat(frete_coleta)||0;
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(memStore.tabela_precos[idx]);
        }
    } catch (err) {
        console.error('Erro ao atualizar preço:', err);
        res.status(500).json({ error: 'Erro ao atualizar preço.' });
    }
});

app.delete('/api/tabela-precos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM tabela_precos WHERE id=$1', [id]);
            await atualizarDataUltimaModificacaoPrecos();
        } else {
            memStore.tabela_precos = memStore.tabela_precos.filter(x => x.id !== id);
            await atualizarDataUltimaModificacaoPrecos();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar preço.' });
    }
});

// ─── API: Tabela de Preços — Resíduos (CRUD) ──────────────────────────────────
app.get('/api/tabela-precos-residuos', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query(`
                SELECT tp.*, mc.nome as material_nome, mc.categoria as material_categoria, mc.ncm as material_ncm
                FROM tabela_precos_residuos tp
                JOIN materiais_catalogo mc ON tp.material_id = mc.id
                ORDER BY mc.categoria ASC, mc.nome ASC
            `);
            if (result.rows.length > 0) return res.json(result.rows);
        }
        const data = memStore.tabela_precos_residuos.map(p => {
            const mc = memStore.materiais_catalogo.find(x => x.id === p.material_id);
            return { ...p, material_nome: mc?.nome||'', material_categoria: mc?.categoria||'', material_ncm: mc?.ncm||'' };
        });
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar tabela de preços de resíduos.' }); }
});

app.post('/api/tabela-precos-residuos', async (req, res) => {
    try {
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_residuos SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_residuos.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO tabela_precos_residuos (material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const newP = { id: Date.now(), material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 };
        memStore.tabela_precos_residuos.push(newP);
        await atualizarDataUltimaModificacaoPrecos();
        res.json(newP);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao salvar preço de resíduo.' }); }
});

app.put('/api/tabela-precos-residuos-validade', async (req, res) => {
    try {
        const { validade } = req.body;
        if (!validade) return res.status(400).json({ error: 'Data de validade obrigatória.' });
        if (dbAvailable) {
            await pool.query('UPDATE tabela_precos_residuos SET validade = $1', [validade]);
            await atualizarDataUltimaModificacaoPrecos();
            return res.json({ success: true, validade });
        }
        memStore.tabela_precos_residuos.forEach(p => p.validade = validade);
        res.json({ success: true, validade });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tabela-precos-residuos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_residuos SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_residuos.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE tabela_precos_residuos SET material_id=$1, preco_entregar=$2, preco_coletar=$3, venda_ref=$4, validade=$5, comissao=$6,
                 pis_cofins=$7, fidc=$8, icms=$9, frete_coleta=$10 WHERE id=$11 RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0, id]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const idx = memStore.tabela_precos_residuos.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Não encontrado.' });
        Object.assign(memStore.tabela_precos_residuos[idx], { material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 });
        await atualizarDataUltimaModificacaoPrecos();
        res.json(memStore.tabela_precos_residuos[idx]);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar preço de resíduo.' }); }
});

app.delete('/api/tabela-precos-residuos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) { await pool.query('DELETE FROM tabela_precos_residuos WHERE id=$1', [id]); }
        else { memStore.tabela_precos_residuos = memStore.tabela_precos_residuos.filter(x => x.id !== id); }
        await atualizarDataUltimaModificacaoPrecos();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao deletar preço de resíduo.' }); }
});

// ─── API: Tabela de Preços — Ligas (CRUD) ────────────────────────────────────
app.get('/api/tabela-precos-ligas', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query(`
                SELECT tp.*, mc.nome as material_nome, mc.categoria as material_categoria, mc.ncm as material_ncm
                FROM tabela_precos_ligas tp
                JOIN materiais_catalogo mc ON tp.material_id = mc.id
                ORDER BY mc.categoria ASC, mc.nome ASC
            `);
            if (result.rows.length > 0) return res.json(result.rows);
        }
        const data = memStore.tabela_precos_ligas.map(p => {
            const mc = memStore.materiais_catalogo.find(x => x.id === p.material_id);
            return { ...p, material_nome: mc?.nome||'', material_categoria: mc?.categoria||'', material_ncm: mc?.ncm||'' };
        });
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar tabela de preços de ligas.' }); }
});

app.post('/api/tabela-precos-ligas', async (req, res) => {
    try {
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_ligas SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_ligas.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO tabela_precos_ligas (material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const newP = { id: Date.now(), material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 };
        memStore.tabela_precos_ligas.push(newP);
        await atualizarDataUltimaModificacaoPrecos();
        res.json(newP);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao salvar preço de liga.' }); }
});

app.put('/api/tabela-precos-ligas-validade', async (req, res) => {
    try {
        const { validade } = req.body;
        if (!validade) return res.status(400).json({ error: 'Data de validade obrigatória.' });
        if (dbAvailable) {
            await pool.query('UPDATE tabela_precos_ligas SET validade = $1', [validade]);
            await atualizarDataUltimaModificacaoPrecos();
            return res.json({ success: true, validade });
        }
        memStore.tabela_precos_ligas.forEach(p => p.validade = validade);
        res.json({ success: true, validade });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tabela-precos-ligas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_ligas SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_ligas.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE tabela_precos_ligas SET material_id=$1, preco_entregar=$2, preco_coletar=$3, venda_ref=$4, validade=$5, comissao=$6,
                 pis_cofins=$7, fidc=$8, icms=$9, frete_coleta=$10 WHERE id=$11 RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0, id]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const idx = memStore.tabela_precos_ligas.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Não encontrado.' });
        Object.assign(memStore.tabela_precos_ligas[idx], { material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 });
        await atualizarDataUltimaModificacaoPrecos();
        res.json(memStore.tabela_precos_ligas[idx]);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar preço de liga.' }); }
});

app.delete('/api/tabela-precos-ligas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) { await pool.query('DELETE FROM tabela_precos_ligas WHERE id=$1', [id]); }
        else { memStore.tabela_precos_ligas = memStore.tabela_precos_ligas.filter(x => x.id !== id); }
        await atualizarDataUltimaModificacaoPrecos();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao deletar preço de liga.' }); }
});

// ─── API: Tabela de Preços — Volume (CRUD) ───────────────────────────────────
app.get('/api/tabela-precos-volume', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query(`
                SELECT tp.*, mc.nome as material_nome, mc.categoria as material_categoria, mc.ncm as material_ncm
                FROM tabela_precos_volume tp
                JOIN materiais_catalogo mc ON tp.material_id = mc.id
                ORDER BY mc.categoria ASC, mc.nome ASC
            `);
            if (result.rows.length > 0) return res.json(result.rows);
        }
        const data = memStore.tabela_precos_volume.map(p => {
            const mc = memStore.materiais_catalogo.find(x => x.id === p.material_id);
            return { ...p, material_nome: mc?.nome||'', material_categoria: mc?.categoria||'', material_ncm: mc?.ncm||'' };
        });
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar tabela de preços de volume.' }); }
});

app.post('/api/tabela-precos-volume', async (req, res) => {
    try {
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_volume SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_volume.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO tabela_precos_volume (material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const newP = { id: Date.now(), material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 };
        memStore.tabela_precos_volume.push(newP);
        await atualizarDataUltimaModificacaoPrecos();
        res.json(newP);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao salvar preço de volume.' }); }
});

app.put('/api/tabela-precos-volume-validade', async (req, res) => {
    try {
        const { validade } = req.body;
        if (!validade) return res.status(400).json({ error: 'Data de validade obrigatória.' });
        if (dbAvailable) {
            await pool.query('UPDATE tabela_precos_volume SET validade = $1', [validade]);
            await atualizarDataUltimaModificacaoPrecos();
            return res.json({ success: true, validade });
        }
        memStore.tabela_precos_volume.forEach(p => p.validade = validade);
        res.json({ success: true, validade });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tabela-precos-volume/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_volume SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_volume.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE tabela_precos_volume SET material_id=$1, preco_entregar=$2, preco_coletar=$3, venda_ref=$4, validade=$5, comissao=$6,
                 pis_cofins=$7, fidc=$8, icms=$9, frete_coleta=$10 WHERE id=$11 RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0, id]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const idx = memStore.tabela_precos_volume.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Não encontrado.' });
        Object.assign(memStore.tabela_precos_volume[idx], { material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 });
        await atualizarDataUltimaModificacaoPrecos();
        res.json(memStore.tabela_precos_volume[idx]);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar preço de volume.' }); }
});

app.delete('/api/tabela-precos-volume/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) { await pool.query('DELETE FROM tabela_precos_volume WHERE id=$1', [id]); }
        else { memStore.tabela_precos_volume = memStore.tabela_precos_volume.filter(x => x.id !== id); }
        await atualizarDataUltimaModificacaoPrecos();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao deletar preço de volume.' }); }
});

// ─── API: Tabela de Preços — Fundição (CRUD) ─────────────────────────────────
app.get('/api/tabela-precos-fundicao', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query(`
                SELECT tp.*, mc.nome as material_nome, mc.categoria as material_categoria, mc.ncm as material_ncm
                FROM tabela_precos_fundicao tp
                JOIN materiais_catalogo mc ON tp.material_id = mc.id
                ORDER BY mc.categoria ASC, mc.nome ASC
            `);
            if (result.rows.length > 0) return res.json(result.rows);
        }
        const data = memStore.tabela_precos_fundicao.map(p => {
            const mc = memStore.materiais_catalogo.find(x => x.id === p.material_id);
            return { ...p, material_nome: mc?.nome||'', material_categoria: mc?.categoria||'', material_ncm: mc?.ncm||'' };
        });
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar tabela de preços de fundição.' }); }
});

app.post('/api/tabela-precos-fundicao', async (req, res) => {
    try {
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_fundicao SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_fundicao.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO tabela_precos_fundicao (material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const newP = { id: Date.now(), material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 };
        memStore.tabela_precos_fundicao.push(newP);
        await atualizarDataUltimaModificacaoPrecos();
        res.json(newP);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao salvar preço de fundição.' }); }
});

app.put('/api/tabela-precos-fundicao-validade', async (req, res) => {
    try {
        const { validade } = req.body;
        if (!validade) return res.status(400).json({ error: 'Data de validade obrigatória.' });
        if (dbAvailable) {
            await pool.query('UPDATE tabela_precos_fundicao SET validade = $1', [validade]);
            await atualizarDataUltimaModificacaoPrecos();
            return res.json({ success: true, validade });
        }
        memStore.tabela_precos_fundicao.forEach(p => p.validade = validade);
        res.json({ success: true, validade });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tabela-precos-fundicao/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { aplicar_todos,  material_id, preco_entregar, preco_coletar, venda_ref, validade, comissao, pis_cofins, fidc, icms, frete_coleta  } = req.body;
        if (dbAvailable && aplicar_todos && validade) {
            await pool.query('UPDATE tabela_precos_fundicao SET validade = $1', [validade]);
        }
        if (!dbAvailable && aplicar_todos && validade) {
            memStore.tabela_precos_fundicao.forEach(p => p.validade = validade);
        }
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE tabela_precos_fundicao SET material_id=$1, preco_entregar=$2, preco_coletar=$3, venda_ref=$4, validade=$5, comissao=$6,
                 pis_cofins=$7, fidc=$8, icms=$9, frete_coleta=$10 WHERE id=$11 RETURNING *`,
                [material_id, preco_entregar||0, preco_coletar||0, venda_ref||0, validade, comissao||0, pis_cofins||0, fidc||0, icms||0, frete_coleta||0, id]
            );
            await atualizarDataUltimaModificacaoPrecos();
            return res.json(result.rows[0]);
        }
        const idx = memStore.tabela_precos_fundicao.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Não encontrado.' });
        Object.assign(memStore.tabela_precos_fundicao[idx], { material_id: parseInt(material_id), preco_entregar: parseFloat(preco_entregar)||0, preco_coletar: parseFloat(preco_coletar)||0, venda_ref: parseFloat(venda_ref)||0, validade, comissao: parseFloat(comissao)||0, pis_cofins: parseFloat(pis_cofins)||0, fidc: parseFloat(fidc)||0, icms: parseFloat(icms)||0, frete_coleta: parseFloat(frete_coleta)||0 });
        await atualizarDataUltimaModificacaoPrecos();
        res.json(memStore.tabela_precos_fundicao[idx]);
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar preço de fundição.' }); }
});

app.delete('/api/tabela-precos-fundicao/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) { await pool.query('DELETE FROM tabela_precos_fundicao WHERE id=$1', [id]); }
        else { memStore.tabela_precos_fundicao = memStore.tabela_precos_fundicao.filter(x => x.id !== id); }
        await atualizarDataUltimaModificacaoPrecos();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao deletar preço de fundição.' }); }
});

// ─── API: Amostras & Análise (CRUD) ───────────────────────────────────────────
app.get('/api/amostras', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query(`
                SELECT a.*, COALESCE(f.apelido, f.nome) as fornecedor_nome
                FROM amostras a
                LEFT JOIN fornecedores f ON a.fornecedor_id = f.id
                ORDER BY a.data DESC, a.id DESC
            `);
            return res.json(result.rows);
        }
        const data = memStore.amostras.map(a => {
            const f = memStore.fornecedores.find(x => x.id === a.fornecedor_id);
            return {
                ...a,
                fornecedor_nome: f ? (f.apelido || f.nome || f.nome_fantasia) : ''
            };
        });
        res.json(data);
    } catch (err) {
        console.error('Erro ao buscar amostras:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/amostras/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let amostra;
        let componentes;

        if (dbAvailable) {
            const aRes = await pool.query('SELECT a.*, COALESCE(f.apelido, f.nome) as fornecedor_nome FROM amostras a LEFT JOIN fornecedores f ON a.fornecedor_id = f.id WHERE a.id=$1', [id]);
            if (aRes.rows.length === 0) return res.status(404).json({ error: 'Amostra não encontrada.' });
            amostra = aRes.rows[0];

            const cRes = await pool.query(`
                SELECT ca.*, mc.nome as material_nome, mc.categoria as material_categoria
                FROM componentes_amostra ca
                LEFT JOIN materiais_catalogo mc ON ca.material_id = mc.id
                WHERE ca.amostra_id=$1
            `, [id]);
            componentes = cRes.rows;
        } else {
            amostra = memStore.amostras.find(x => x.id === id);
            if (!amostra) return res.status(404).json({ error: 'Amostra não encontrada.' });
            const f = memStore.fornecedores.find(x => x.id === amostra.fornecedor_id);
            amostra.fornecedor_nome = f ? (f.apelido || f.nome || f.nome_fantasia) : '';

            componentes = memStore.componentes_amostra.filter(x => x.amostra_id === id).map(ca => {
                const mc = memStore.materiais_catalogo.find(x => x.id === ca.material_id);
                return {
                    ...ca,
                    material_nome: mc ? mc.nome : '',
                    material_categoria: mc ? mc.categoria : ''
                };
            });
        }
        res.json({ amostra, componentes });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao carregar detalhes da amostra.' });
    }
});

app.get('/api/admin/last-updates', async (req, res) => {
    try {
        if (dbAvailable && pool) {
            const r = await pool.query('SELECT table_name, updated_at FROM table_last_updates');
            r.rows.forEach(row => {
                tableLastUpdates[row.table_name] = row.updated_at;
            });
        }
        res.json({ success: true, updates: tableLastUpdates, serverTime: new Date().toISOString() });
    } catch (e) {
        res.json({ success: true, updates: tableLastUpdates, serverTime: new Date().toISOString() });
    }
});

app.post('/api/amostras', async (req, res) => {
    try {
        const { numero_amostra, nome_material, data, fornecedor_id, responsavel, representante, peso_inicial, observacoes, foto_original } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO amostras (numero_amostra, nome_material, data, fornecedor_id, responsavel, representante, peso_inicial, status, observacoes, foto_original)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'Em Análise', $8, $9) RETURNING *`,
                [numero_amostra, nome_material || '', data, fornecedor_id, responsavel, representante || '', peso_inicial, observacoes, foto_original || '']
            );
            return res.json(result.rows[0]);
        } else {
            const newA = { id: nextId++, numero_amostra, nome_material: nome_material || '', data, fornecedor_id: parseInt(fornecedor_id), responsavel, representante: representante || '', peso_inicial: parseFloat(peso_inicial), status: 'Em Análise', observacoes, foto_original: foto_original || '' };
            memStore.amostras.push(newA);
            return res.json(newA);
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar amostra: ' + err.message });
    }
});

app.post('/api/amostras/:id/componentes', async (req, res) => {
    try {
        const amostra_id = parseInt(req.params.id);
        const { componentes, tempo_desmonte, parecer_tecnico, tecnico_analise } = req.body; // componentes: array of { material_id, peso, percentual, observacoes, foto, dificuldade }

        if (dbAvailable) {
            // Delete old components
            await pool.query('DELETE FROM componentes_amostra WHERE amostra_id=$1', [amostra_id]);
            
            // Insert new components with foto and dificuldade
            for (const c of componentes) {
                await pool.query(
                    `INSERT INTO componentes_amostra (amostra_id, material_id, peso, percentual, observacoes, foto, dificuldade)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [amostra_id, c.material_id, c.peso, c.percentual, c.observacoes, c.foto || '', c.dificuldade || 'Fácil']
                );
            }
            // Update sample info: tempo, parecer and status
            await pool.query(
                `UPDATE amostras 
                 SET tempo_desmonte = $1, parecer_tecnico = $2, status = 'Aguardando Decisão de Compra', tecnico_analise = $4 
                 WHERE id = $3`,
                [parseInt(tempo_desmonte) || 0, parecer_tecnico || '', amostra_id, tecnico_analise || '']
            );
        } else {
            memStore.componentes_amostra = memStore.componentes_amostra.filter(x => x.amostra_id !== amostra_id);
            for (const c of componentes) {
                memStore.componentes_amostra.push({
                    id: nextId++,
                    amostra_id,
                    material_id: parseInt(c.material_id),
                    peso: parseFloat(c.peso),
                    percentual: parseFloat(c.percentual),
                    observacoes: c.observacoes,
                    foto: c.foto || '',
                    dificuldade: c.dificuldade || 'Fácil'
                });
            }
            const a = memStore.amostras.find(x => x.id === amostra_id);
            if (a) {
                a.tempo_desmonte = parseInt(tempo_desmonte) || 0;
                a.parecer_tecnico = parecer_tecnico || '';
                a.tecnico_analise = tecnico_analise || '';
                a.status = 'Aguardando Decisão de Compra';
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar componentes e parecer técnico.' });
    }
});

// Liberação e Processamento PCP
app.patch('/api/amostras/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;

        if (dbAvailable) {
            const currentA = await pool.query('SELECT status FROM amostras WHERE id=$1', [id]);
            if (currentA.rows.length === 0) return res.status(404).json({ error: 'Amostra não encontrada.' });
            const currStatus = currentA.rows[0].status;

            if (status === 'Liberado para Produção' && currStatus !== 'Aprovado - Compra Autorizada') {
                return res.status(400).json({ error: 'A amostra precisa estar aprovada (Aprovado - Compra Autorizada) antes de ser liberada para produção.' });
            }
            if (status === 'Processado' && currStatus !== 'Liberado para Produção') {
                return res.status(400).json({ error: 'A amostra precisa estar Liberada para Produção antes de ser processada.' });
            }

            await pool.query('UPDATE amostras SET status=$1 WHERE id=$2', [status, id]);
            
            // Se for "Processado", efetua a movimentação de estoque
            if (status === 'Processado') {
                const cRes = await pool.query('SELECT * FROM componentes_amostra WHERE amostra_id=$1', [id]);
                const compList = cRes.rows;
                const aRes = await pool.query('SELECT * FROM amostras WHERE id=$1', [id]);
                const amostra = aRes.rows[0];

                for (const c of compList) {
                    // Update estoque
                    await pool.query(
                        `INSERT INTO estoque (material_id, saldo) VALUES ($1, $2)
                         ON CONFLICT (material_id) DO UPDATE SET saldo = estoque.saldo + EXCLUDED.saldo`,
                        [c.material_id, c.peso]
                    );
                    // Log movimentação
                    await pool.query(
                        `INSERT INTO movimentacoes_estoque (material_id, tipo, quantidade, motivo)
                         VALUES ($1, 'ENTRADA', $2, $3)`,
                        [c.material_id, c.peso, `Processamento da amostra ${amostra.numero_amostra}`]
                    );
                }
            }
        } else {
            const a = memStore.amostras.find(x => x.id === id);
            if (!a) return res.status(404).json({ error: 'Amostra não encontrada.' });
            
            if (status === 'Liberado para Produção' && a.status !== 'Aprovado - Compra Autorizada') {
                return res.status(400).json({ error: 'A amostra precisa estar aprovada (Aprovado - Compra Autorizada) antes de ser liberada para produção.' });
            }
            if (status === 'Processado' && a.status !== 'Liberado para Produção') {
                return res.status(400).json({ error: 'A amostra precisa estar Liberada para Produção antes de ser processada.' });
            }

            a.status = status;

            if (status === 'Processado') {
                const compList = memStore.componentes_amostra.filter(x => x.amostra_id === id);
                for (const c of compList) {
                    const est = memStore.estoque.find(x => x.material_id === c.material_id);
                    if (est) {
                        est.saldo += c.peso;
                    } else {
                        memStore.estoque.push({ material_id: c.material_id, saldo: c.peso });
                    }
                    memStore.movimentacoes_estoque.push({
                        id: nextId++,
                        material_id: c.material_id,
                        tipo: "ENTRADA",
                        quantidade: c.peso,
                        motivo: `Processamento da amostra ${a.numero_amostra}`,
                        data: new Date().toISOString()
                    });
                }
            }
        }
        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar status e estoque.' });
    }
});

// Decisão da Diretoria (Comprar / Não Comprar)
app.patch('/api/amostras/:id/decisao', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { decisao_diretoria, motivo_reprovacao, obs_diretoria, preco_compra_entregar, preco_compra_coletar, preco_validade, user_perfil, user_nome } = req.body;

        if (user_perfil !== 'Administrador' && user_perfil !== 'Diretoria') {
            return res.status(403).json({ error: 'Apenas o Administrador ou Diretoria pode tomar esta decisão.' });
        }

        // Checkup de segurança: verifica se a amostra passou pela etapa de desmonte do laboratório
        if (dbAvailable) {
            const compCheck = await pool.query('SELECT COUNT(*) as total FROM componentes_amostra WHERE amostra_id=$1', [id]);
            const totalComp = parseInt(compCheck.rows[0]?.total || 0);
            if (totalComp === 0) {
                return res.status(400).json({ error: 'Amostra sem desmonte concluído! Cadastre os componentes desmontados no laboratório antes da decisão de compra.' });
            }
        } else {
            const totalComp = (memStore.componentes_amostra || []).filter(c => c.amostra_id === id).length;
            if (totalComp === 0) {
                return res.status(400).json({ error: 'Amostra sem desmonte concluído! Cadastre os componentes desmontados no laboratório antes da decisão de compra.' });
            }
        }

        const status = decisao_diretoria === 'Aprovado' ? 'Aprovado - Compra Autorizada' : 'Reprovado';

        if (dbAvailable) {
            await pool.query(
                `UPDATE amostras 
                 SET decisao_diretoria=$1, motivo_reprovacao=$2, status=$3, data_decisao=NOW(),
                     preco_compra_entregar=$4, preco_compra_coletar=$5, preco_validade=$6, autorizado_por=$7,
                     obs_diretoria=$8, admin_aprovacao=$10
                 WHERE id=$9`,
                [
                    decisao_diretoria, 
                    motivo_reprovacao || '', 
                    status, 
                    decisao_diretoria === 'Aprovado' ? parseFloat(preco_compra_entregar) || null : null,
                    decisao_diretoria === 'Aprovado' ? parseFloat(preco_compra_coletar) || null : null,
                    decisao_diretoria === 'Aprovado' ? preco_validade || null : null,
                    user_nome || 'Admin',
                    obs_diretoria || '',
                    id,
                    user_nome || 'Admin'
                ]
            );
        } else {
            const a = memStore.amostras.find(x => x.id === id);
            if (!a) return res.status(404).json({ error: 'Amostra não encontrada.' });
            a.decisao_diretoria = decisao_diretoria;
            a.motivo_reprovacao = motivo_reprovacao || '';
            a.obs_diretoria = obs_diretoria || '';
            a.status = status;
            a.data_decisao = new Date().toISOString();
            if (decisao_diretoria === 'Aprovado') {
                a.preco_compra_entregar = parseFloat(preco_compra_entregar) || null;
                a.preco_compra_coletar = parseFloat(preco_compra_coletar) || null;
                a.preco_validade = preco_validade || null;
            }
            a.autorizado_por = user_nome || 'Admin';
            a.admin_aprovacao = user_nome || 'Admin';
        }
        res.json({ success: true, status, decisao_diretoria });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar decisão da diretoria.' });
    }
});

// Exclusão de Amostra restrita a ADM e Diretoria
app.delete('/api/amostras/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { user_perfil } = req.query;

        if (user_perfil !== 'Administrador' && user_perfil !== 'Diretoria') {
            return res.status(403).json({ error: 'Apenas o Administrador ou Diretoria pode excluir registros.' });
        }

        if (dbAvailable) {
            await pool.query('DELETE FROM componentes_amostra WHERE amostra_id=$1', [id]);
            await pool.query('DELETE FROM amostras WHERE id=$1', [id]);
        } else {
            memStore.componentes_amostra = memStore.componentes_amostra.filter(x => x.amostra_id !== id);
            memStore.amostras = memStore.amostras.filter(x => x.id !== id);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir amostra.' });
    }
});

// ─── API: Fotos de Amostras ────────────────────────────────────────────────────
app.get('/api/amostras/:id/fotos', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            const r = await pool.query('SELECT id, amostra_id, tipo, COALESCE(etapa, \'Recebimento\') as etapa, componente_idx, mimetype, nome, criado_em FROM fotos_amostra WHERE amostra_id=$1 ORDER BY criado_em ASC', [id]);
            return res.json(r.rows);
        }
        const fotos = (memStore.fotos_amostra || []).filter(f => f.amostra_id === id)
            .map(f => ({ id: f.id, amostra_id: f.amostra_id, tipo: f.tipo, etapa: f.etapa || 'Recebimento', componente_idx: f.componente_idx ?? null, mimetype: f.mimetype, nome: f.nome, criado_em: f.criado_em }));
        res.json(fotos);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/amostras/:id/fotos/:fotoId/img', async (req, res) => {
    try {
        const id     = parseInt(req.params.id);
        const fotoId = parseInt(req.params.fotoId);
        if (dbAvailable) {
            const r = await pool.query('SELECT data_b64, mimetype FROM fotos_amostra WHERE id=$1 AND amostra_id=$2', [fotoId, id]);
            if (!r.rows[0]) return res.status(404).send('Foto não encontrada');
            const buf = Buffer.from(r.rows[0].data_b64, 'base64');
            res.set('Content-Type', r.rows[0].mimetype);
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Content-Length', buf.length);
            return res.send(buf);
        }
        const foto = (memStore.fotos_amostra || []).find(f => f.id === fotoId && f.amostra_id === id);
        if (!foto) return res.status(404).send('Foto não encontrada');
        const buf = Buffer.from(foto.data_b64, 'base64');
        res.set('Content-Type', foto.mimetype);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Content-Length', buf.length);
        res.send(buf);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/amostras/:id/fotos', uploadMemory.array('fotos', 20), async (req, res) => {
    try {
        const id            = parseInt(req.params.id);
        const tipo          = req.body.tipo || 'bruta';
        const etapa         = req.body.etapa || 'Recebimento';
        const componenteIdx = req.body.componente_idx !== undefined ? parseInt(req.body.componente_idx) : null;
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        console.log(`[FOTO-UPLOAD] amostra=${id}, tipo=${tipo}, etapa=${etapa}, arquivos=${req.files.length}, tamanhos=${req.files.map(f => f.size + 'b').join(',')}`);
        const inseridas = [];
        for (const file of req.files) {
            const b64      = file.buffer.toString('base64');
            const mimetype = file.mimetype;
            const nome     = file.originalname;
            if (dbAvailable) {
                const r = await pool.query(
                    'INSERT INTO fotos_amostra (amostra_id, tipo, etapa, componente_idx, data_b64, mimetype, nome) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, amostra_id, tipo, etapa, componente_idx, mimetype, nome, criado_em',
                    [id, tipo, etapa, componenteIdx, b64, mimetype, nome]
                );
                inseridas.push(r.rows[0]);
            } else {
                const f = { id: nextId++, amostra_id: id, tipo, etapa, componente_idx: componenteIdx, data_b64: b64, mimetype, nome, criado_em: new Date().toISOString() };
                if (!memStore.fotos_amostra) memStore.fotos_amostra = [];
                memStore.fotos_amostra.push(f);
                inseridas.push({ id: f.id, amostra_id: f.amostra_id, tipo: f.tipo, etapa: f.etapa, componente_idx: f.componente_idx, mimetype: f.mimetype, nome: f.nome, criado_em: f.criado_em });
            }
        }
        res.json({ success: true, fotos: inseridas });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/amostras/:id/fotos/:fotoId', async (req, res) => {
    try {
        const id     = parseInt(req.params.id);
        const fotoId = parseInt(req.params.fotoId);
        if (dbAvailable) {
            await pool.query('DELETE FROM fotos_amostra WHERE id=$1 AND amostra_id=$2', [fotoId, id]);
        } else {
            memStore.fotos_amostra = (memStore.fotos_amostra || []).filter(f => !(f.id === fotoId && f.amostra_id === id));
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── API: Enviar E-mail do Laudo ao Diretor (disparo após análise técnica) ─────
app.post('/api/amostras/:id/enviar-laudo-email', async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Buscar dados da amostra
        let amostra, componentes, fornecedor;
        if (dbAvailable) {
            const ar = await pool.query('SELECT a.*, COALESCE(f.apelido, f.nome) as fornecedor_nome FROM amostras a LEFT JOIN fornecedores f ON a.fornecedor_id=f.id WHERE a.id=$1', [id]);
            amostra = ar.rows[0];
            const cr = await pool.query('SELECT ca.*, mc.nome as material_nome FROM componentes_amostra ca LEFT JOIN materiais_catalogo mc ON ca.material_id=mc.id WHERE ca.amostra_id=$1', [id]);
            componentes = cr.rows;
        } else {
            amostra = memStore.amostras.find(a => a.id === id);
            if (!amostra) return res.status(404).json({ error: 'Amostra não encontrada' });
            const forn = memStore.fornecedores.find(f => f.id === amostra.fornecedor_id);
            amostra = { ...amostra, fornecedor_nome: forn ? (forn.apelido || forn.nome || 'N/A') : 'N/A' };
            componentes = memStore.componentes_amostra
                .filter(c => c.amostra_id === id)
                .map(c => ({ ...c, material_nome: (memStore.materiais_catalogo.find(m => m.id === c.material_id) || {}).nome || 'N/A' }));
        }
        if (!amostra) return res.status(404).json({ error: 'Amostra não encontrada' });

        // Montar corpo do e-mail
        const tabelaComponentes = componentes.map(c =>
            `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${c.material_nome}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${parseFloat(c.peso).toLocaleString('pt-BR')} kg</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${parseFloat(c.percentual).toFixed(2)}%</td></tr>`
        ).join('');

        const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#0d2416;padding:20px;border-radius:8px 8px 0 0">
                <h1 style="color:#2AD07A;margin:0;font-size:20px">🔬 APEXTECH METAIS — Análise Laboratorial Concluída</h1>
                <p style="color:#aaa;margin:5px 0 0">O técnico concluiu a análise e encaminhou para decisão de compra.</p>
            </div>
            <div style="background:#fff;padding:20px;border:1px solid #ddd">
                <table style="width:100%;border-collapse:collapse;margin-bottom:15px">
                    <tr><td style="width:40%;color:#555;font-size:13px"><strong>Nº Amostra</strong></td><td style="color:#222">${amostra.numero_amostra}</td></tr>
                    <tr><td style="color:#555;font-size:13px"><strong>Fornecedor</strong></td><td style="color:#222">${amostra.fornecedor_nome}</td></tr>
                    <tr><td style="color:#555;font-size:13px"><strong>Peso Inicial</strong></td><td style="color:#222">${parseFloat(amostra.peso_inicial).toLocaleString('pt-BR')} kg</td></tr>
                    <tr><td style="color:#555;font-size:13px"><strong>Responsável</strong></td><td style="color:#222">${amostra.responsavel}</td></tr>
                    <tr><td style="color:#555;font-size:13px"><strong>Data</strong></td><td style="color:#222">${new Date(amostra.data).toLocaleDateString('pt-BR')}</td></tr>
                </table>
                <h3 style="color:#0d2416;border-bottom:2px solid #2AD07A;padding-bottom:5px">Composição Identificada</h3>
                <table style="width:100%;border-collapse:collapse">
                    <thead><tr style="background:#0d2416"><th style="padding:8px 10px;color:#2AD07A;text-align:left">Material</th><th style="padding:8px 10px;color:#2AD07A;text-align:right">Peso</th><th style="padding:8px 10px;color:#2AD07A;text-align:right">Rend.</th></tr></thead>
                    <tbody>${tabelaComponentes}</tbody>
                </table>
                ${amostra.parecer_tecnico ? `<div style="margin-top:15px;background:#f5fff8;border-left:4px solid #2AD07A;padding:10px"><strong>Parecer Técnico:</strong><p style="margin:5px 0 0">${amostra.parecer_tecnico}</p></div>` : ''}
                <div style="margin-top:20px;text-align:center">
                    <a href="http://localhost:3000/admin.html" style="background:#2AD07A;color:#0d2416;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">🔗 Acessar Sistema para Aprovar</a>
                </div>
            </div>
            <div style="background:#f5f5f5;padding:10px;text-align:center;font-size:11px;color:#999;border-radius:0 0 8px 8px">
                APEXTECH METAIS ERP — Mensagem automática. Não responda este e-mail.
            </div>
        </div>`;

        // Buscar destinatários (usar lista LME ou settings)
        let destinatarios = [];
        if (dbAvailable) {
            const dr = await pool.query('SELECT email FROM lme_destinatarios');
            destinatarios = dr.rows.map(r => r.email);
        } else {
            destinatarios = (memStore.lme_destinatarios || []).map(d => d.email);
        }

        // Verificar se há configuração de e-mail
        const settingsObj = {};
        if (dbAvailable) {
            const sr = await pool.query('SELECT key, value FROM settings');
            sr.rows.forEach(r => { settingsObj[r.key] = r.value; });
        } else {
            Object.assign(settingsObj, memStore.settings || {});
        }
        const resendKey = settingsObj.lme_resend_api_key || process.env.RESEND_API_KEY || null;


        if (!resendKey || destinatarios.length === 0) {
            // Sem e-mail configurado: apenas log
            console.log(`📧 [SEM CONFIG] E-mail de laudo para amostra ${amostra.numero_amostra} não enviado (sem chave Resend ou destinatários).`);
            return res.json({ success: true, enviado: false, motivo: 'Sem chave Resend ou destinatários cadastrados' });
        }

        // Enviar via Resend (padrão do sistema)
        const { Resend } = require('resend');
        const resend = new Resend(resendKey);
        const rawFrom = settingsObj.lme_resend_from || process.env.RESEND_FROM || 'Apextech Metais <noreply@apextechmetais.com.br>';
        const fromEmail = rawFrom.includes('<') ? rawFrom : `Apextech Metais <${rawFrom.trim()}>`;


        for (const dest of destinatarios) {
            await resend.emails.send({
                from: fromEmail,
                to: dest,
                subject: `[APEXTECH] Análise ${amostra.numero_amostra} — Aguardando Decisão de Compra`,
                html
            });
        }
        console.log(`📧 E-mail de laudo enviado para ${destinatarios.length} destinatário(s).`);
        res.json({ success: true, enviado: true, destinatarios });
    } catch (err) {
        console.error('Erro ao enviar e-mail de laudo:', err);
        res.json({ success: true, enviado: false, motivo: err.message });
    }
});

async function registrarAuditLog(usuario, acao, detalhe, amostraId = null, req = null) {
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
        const usr = usuario || 'Sistema';
        if (dbAvailable) {
            await pool.query(
                `INSERT INTO audit_logs (usuario, acao, detalhe, amostra_id, ip) VALUES ($1, $2, $3, $4, $5)`,
                [usr, acao, detalhe || '', amostraId, ip]
            );
        } else {
            if (!memStore.audit_logs) memStore.audit_logs = [];
            memStore.audit_logs.push({
                id: (memStore.audit_logs.length + 1),
                usuario: usr,
                acao,
                detalhe: detalhe || '',
                amostra_id: amostraId,
                ip,
                criado_em: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('Erro ao registrar log de auditoria:', err);
    }
}

// ─── API: Cotações Internacionais em Tempo Real (USD / BRL & LME) ─────────────
app.get('/api/cotacoes/dolar-lme', async (req, res) => {
    try {
        let dolarVal = 5.60;
        let dolarPctChange = 0;
        try {
            const apiRes = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL', { timeout: 3000 });
            if (apiRes.data && apiRes.data.USDBRL) {
                dolarVal = parseFloat(apiRes.data.USDBRL.bid) || 5.60;
                dolarPctChange = parseFloat(apiRes.data.USDBRL.pctChange) || 0;
            }
        } catch (e) {
            console.warn('Usando fallback para cotação do dólar (5.60 BRL):', e.message);
        }

        // Cotações base LME ($/tonelada)
        const lmePrecosUsd = {
            cobre: 9450.00,
            aluminio: 2420.00,
            latão: 6800.00,
            niquel: 16200.00,
            chumbo: 2050.00,
            zinco: 2780.00
        };

        const lmePrecosBrlKg = {};
        for (const [k, v] of Object.entries(lmePrecosUsd)) {
            // Conversão: ($ / 1000kg) * Dólar = R$/kg
            lmePrecosBrlKg[k] = parseFloat(((v / 1000) * dolarVal).toFixed(2));
        }

        const variacaoAlta = Math.abs(dolarPctChange) >= 1.5;

        res.json({
            dolar: dolarVal,
            dolar_pct_change: dolarPctChange,
            variacao_alta: variacaoAlta,
            data: new Date().toISOString(),
            lme_usd_ton: lmePrecosUsd,
            lme_brl_kg: lmePrecosBrlKg
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Audit Logs ─────────────────────────────────────────────────────────
// Importando rota modularizada (Início da Fase 9)
const auditLogsRoute = require('./src/routes/auditLogs');
app.use('/api/audit-logs', auditLogsRoute(pool, dbAvailable, memStore));

// ─── API: Planejamento Mensal / Lotes Compra (CRUD + Motor Financeiro) ─────────
app.get('/api/planejamento-compras', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query(`
                SELECT lc.*, COALESCE(f.apelido, f.nome) as fornecedor_nome, mc.nome as material_nome, a.numero_amostra
                FROM lotes_compra lc
                LEFT JOIN fornecedores f ON lc.fornecedor_id = f.id
                LEFT JOIN materiais_catalogo mc ON lc.material_id = mc.id
                LEFT JOIN amostras a ON lc.amostra_id = a.id
                ORDER BY lc.id DESC
            `);
            return res.json(result.rows);
        }
        
        const data = memStore.lotes_compra.map(lc => {
            const f = memStore.fornecedores.find(x => x.id === lc.fornecedor_id);
            const mc = memStore.materiais_catalogo.find(x => x.id === lc.material_id);
            const a = memStore.amostras.find(x => x.id === lc.amostra_id);
            return {
                ...lc,
                fornecedor_nome: f ? (f.apelido || f.nome || f.nome_fantasia) : '',
                material_nome: mc ? mc.nome : '',
                numero_amostra: a ? a.numero_amostra : ''
            };
        });
        res.json(data);
    } catch (err) {
        console.error('Erro ao carregar planejamento:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento-compras', async (req, res) => {
    try {
        const { amostra_id, fornecedor_id, produto, peso_comprado, preco_compra, percentual_rendimento, material_id, preco_venda_material, comissao, fidc, mes, cliente, prazo_recebimento_dias, forma_pagamento, simulacoes_historico } = req.body;
        
        if (dbAvailable) {
            const result = await pool.query(
                `INSERT INTO lotes_compra (amostra_id, fornecedor_id, produto, peso_comprado, preco_compra, percentual_rendimento, material_id, preco_venda_material, comissao, fidc, mes, cliente, prazo_recebimento_dias, forma_pagamento, simulacoes_historico)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
                [amostra_id, fornecedor_id, produto, peso_comprado, preco_compra, percentual_rendimento, material_id, preco_venda_material, comissao || 2.0, fidc || 2.3, mes, cliente, prazo_recebimento_dias || 30, forma_pagamento, simulacoes_historico ? JSON.stringify(simulacoes_historico) : '[]']
            );
            
            if (amostra_id) {
                // Se vinculou a uma amostra, avança o status dela
                await pool.query("UPDATE amostras SET status = 'Aguardando Liberação PCP' WHERE id = $1 AND status = 'Aguardando Precificação'", [amostra_id]);
            }
            return res.json(result.rows[0]);
        } else {
            const newL = {
                id: nextId++,
                amostra_id: amostra_id ? parseInt(amostra_id) : null,
                fornecedor_id: parseInt(fornecedor_id),
                produto,
                peso_comprado: parseFloat(peso_comprado),
                preco_compra: parseFloat(preco_compra),
                percentual_rendimento: parseFloat(percentual_rendimento),
                material_id: parseInt(material_id),
                preco_venda_material: parseFloat(preco_venda_material),
                comissao: parseFloat(comissao || 2.0),
                fidc: parseFloat(fidc || 2.3),
                mes,
                cliente,
                prazo_recebimento_dias: parseInt(prazo_recebimento_dias || 30),
                forma_pagamento,
                simulacoes_historico: simulacoes_historico || []
            };
            memStore.lotes_compra.push(newL);

            if (amostra_id) {
                const a = memStore.amostras.find(x => x.id === parseInt(amostra_id));
                if (a && a.status === 'Aguardando Precificação') {
                    a.status = 'Aguardando Liberação PCP';
                }
            }
            return res.json(newL);
        }
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar planejamento.' });
    }
});

// ─── API: Planejamento de Compras (Trading Comercial & Insumos da Indústria) ─
app.get('/api/planejamento/compras', async (req, res) => {
    try {
        const { tipo } = req.query;
        if (!dbAvailable) {
            let list = (memStore.planejamento_compras || []).map(p => {
                const mc = (memStore.materiais_catalogo || []).find(m => m.id == p.material_id);
                const f = (memStore.fornecedores || []).find(x => x.id == p.fornecedor_id);
                return {
                    ...p,
                    tipo_planejamento: p.tipo_planejamento || 'COMPRA_VENDA',
                    material_nome: mc ? mc.nome : 'Material',
                    fornecedor_nome: f ? (f.apelido || f.nome) : 'Fornecedor'
                };
            });
            if (tipo) {
                list = list.filter(x => x.tipo_planejamento === tipo);
            }
            return res.json(list.sort((a, b) => b.id - a.id));
        }

        let query = `
            SELECT pc.*, mc.nome as material_nome, COALESCE(f.apelido, f.nome) as fornecedor_nome
            FROM planejamento_compras pc
            LEFT JOIN materiais_catalogo mc ON pc.material_id = mc.id
            LEFT JOIN fornecedores f ON pc.fornecedor_id = f.id
        `;
        const params = [];
        if (tipo) {
            query += ` WHERE pc.tipo_planejamento = $1 `;
            params.push(tipo);
        }
        query += ` ORDER BY pc.id DESC `;

        const r = await pool.query(query, params);
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento/compras', async (req, res) => {
    try {
        const { tipo_planejamento, material_id, fornecedor_id, quantidade_necessaria, quantidade_realizada_kg, ponto_pedido_kg, lead_time_dias, preco_estimado, mes_referencia, status, observacoes } = req.body;
        const tipoFinal = tipo_planejamento || 'COMPRA_VENDA';
        const qty = parseFloat(quantidade_necessaria || 0);
        const qtyReal = parseFloat(quantidade_realizada_kg || 0);
        const prc = parseFloat(preco_estimado || 0);
        const custoTotalEst = qty * prc;
        const custoTotalReal = qtyReal * prc;

        if (!dbAvailable) {
            if (!memStore.planejamento_compras) memStore.planejamento_compras = [];
            const item = {
                id: nextId++,
                tipo_planejamento: tipoFinal,
                material_id: material_id ? parseInt(material_id) : null,
                fornecedor_id: fornecedor_id ? parseInt(fornecedor_id) : null,
                quantidade_necessaria: qty,
                quantidade_realizada_kg: qtyReal,
                ponto_pedido_kg: parseFloat(ponto_pedido_kg || 0),
                lead_time_dias: parseInt(lead_time_dias || 7),
                preco_estimado: prc,
                custo_total_estimado: custoTotalEst,
                custo_total_realizado: custoTotalReal,
                mes_referencia: mes_referencia || new Date().toISOString().slice(0, 7),
                status: status || 'Sugerido',
                observacoes: observacoes || '',
                criado_em: new Date().toISOString()
            };
            memStore.planejamento_compras.push(item);
            return res.json(item);
        }

        const r = await pool.query(`
            INSERT INTO planejamento_compras (tipo_planejamento, material_id, fornecedor_id, quantidade_necessaria, quantidade_realizada_kg, ponto_pedido_kg, lead_time_dias, preco_estimado, custo_total_estimado, custo_total_realizado, mes_referencia, status, observacoes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *
        `, [
            tipoFinal,
            material_id ? parseInt(material_id) : null,
            fornecedor_id ? parseInt(fornecedor_id) : null,
            qty,
            qtyReal,
            parseFloat(ponto_pedido_kg || 0),
            parseInt(lead_time_dias || 7),
            prc,
            custoTotalEst,
            custoTotalReal,
            mes_referencia || new Date().toISOString().slice(0, 7),
            status || 'Sugerido',
            observacoes || ''
        ]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/planejamento/compras/:id/realizado', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { quantidade_realizada_kg, custo_total_realizado, status } = req.body;

        if (!dbAvailable) {
            const item = (memStore.planejamento_compras || []).find(x => x.id === id);
            if (!item) return res.status(404).json({ error: 'Planejamento não encontrado' });
            if (quantidade_realizada_kg !== undefined) item.quantidade_realizada_kg = parseFloat(quantidade_realizada_kg);
            if (custo_total_realizado !== undefined) item.custo_total_realizado = parseFloat(custo_total_realizado);
            if (status) item.status = status;
            return res.json(item);
        }

        const r = await pool.query(`
            UPDATE planejamento_compras SET
                quantidade_realizada_kg = COALESCE($1, quantidade_realizada_kg),
                custo_total_realizado = COALESCE($2, custo_total_realizado),
                status = COALESCE($3, status)
            WHERE id = $4 RETURNING *
        `, [
            quantidade_realizada_kg !== undefined ? parseFloat(quantidade_realizada_kg) : null,
            custo_total_realizado !== undefined ? parseFloat(custo_total_realizado) : null,
            status || null,
            id
        ]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/planejamento/compras/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            memStore.planejamento_compras = (memStore.planejamento_compras || []).filter(x => x.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM planejamento_compras WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Planejamento de Produção & Explosão de Insumos ─────────────────────
// ─── API: Planejamento de Produção & Insumos (Simulador) ───────────────────

// GET - listar todos os planejamentos com linhas e métricas agregadas
app.get('/api/planejamento/producao-insumos', async (req, res) => {
    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            const pl = await pool.query('SELECT * FROM planejamento_producao_insumos ORDER BY id DESC');
            const result = await Promise.all(pl.rows.map(async p => {
                const linhas = await pool.query(
                    'SELECT * FROM planejamento_producao_linhas WHERE planejamento_id=$1 ORDER BY id', [p.id]);
                const lWithMovs = await Promise.all(linhas.rows.map(async l => {
                    const movs = await pool.query(
                        'SELECT * FROM planejamento_producao_movimentacoes WHERE linha_id=$1 ORDER BY data_movimentacao', [l.id]);
                    return { ...l, movimentacoes: movs.rows };
                }));
                return { ...p, linhas: lWithMovs };
            }));
            return res.json(result);
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no GET producao-insumos. ', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    const pl = memStore.planejamento_producao_insumos || [];
    const linhas = memStore.planejamento_producao_linhas || [];
    const movs = memStore.planejamento_producao_movimentacoes || [];
    res.json(pl.map(p => ({
        ...p,
        linhas: linhas.filter(l => l.planejamento_id === p.id).map(l => ({
            ...l,
            movimentacoes: movs.filter(m => m.linha_id === l.id)
        }))
    })));
});

// POST - criar novo planejamento com N linhas de insumos
app.post('/api/planejamento/producao-insumos', async (req, res) => {
    const {
        periodo, produto_id, produto_nome,
        meta_faturamento_rs, preco_venda_produto_rs,
        qtd_produto_necessaria, custo_total_projetado_rs, margem_projetada_pct,
        prazo_compra_ate, prazo_venda_ate, status,
        linhas
    } = req.body;

    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            const r = await pool.query(`
                INSERT INTO planejamento_producao_insumos
                (periodo, produto_id, produto_nome, meta_faturamento_rs, preco_venda_produto_rs,
                 qtd_produto_necessaria, custo_total_projetado_rs, margem_projetada_pct,
                 prazo_compra_ate, prazo_venda_ate, status)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
            `, [
                periodo||new Date().toISOString().slice(0,7),
                produto_id ? parseInt(produto_id) : null, produto_nome||'',
                parseFloat(meta_faturamento_rs||0), parseFloat(preco_venda_produto_rs||0),
                parseFloat(qtd_produto_necessaria||0), parseFloat(custo_total_projetado_rs||0),
                parseFloat(margem_projetada_pct||0),
                prazo_compra_ate||null, prazo_venda_ate||null, status||'Ativo'
            ]);
            const planejamento = r.rows[0];

            const linhasResult = [];
            if (Array.isArray(linhas)) {
                for (const l of linhas) {
                    const lr = await pool.query(`
                        INSERT INTO planejamento_producao_linhas
                        (planejamento_id, insumo_produto_id, insumo_nome, coeficiente_pct,
                         qtd_necessaria, preco_compra_tabela, preco_compra_simulado, preco_venda_tabela, custo_total_insumo)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
                    `, [
                        planejamento.id,
                        l.insumo_produto_id ? parseInt(l.insumo_produto_id) : null,
                        l.insumo_nome||'', parseFloat(l.coeficiente_pct||100),
                        parseFloat(l.qtd_necessaria||0), parseFloat(l.preco_compra_tabela||0),
                        parseFloat(l.preco_compra_simulado||0), parseFloat(l.preco_venda_tabela||0),
                        parseFloat(l.custo_total_insumo||0)
                    ]);
                    linhasResult.push({ ...lr.rows[0], movimentacoes: [] });
                }
            }
            return res.json({ ...planejamento, linhas: linhasResult });
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no POST producao-insumos. ', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    if (!memStore.planejamento_producao_insumos) memStore.planejamento_producao_insumos = [];
    if (!memStore.planejamento_producao_linhas) memStore.planejamento_producao_linhas = [];
    const pid = nextId++;
    const item = {
        id: pid, periodo: periodo || new Date().toISOString().slice(0,7),
        produto_id: produto_id ? parseInt(produto_id) : null, produto_nome: produto_nome || '',
        meta_faturamento_rs: parseFloat(meta_faturamento_rs||0),
        preco_venda_produto_rs: parseFloat(preco_venda_produto_rs||0),
        qtd_produto_necessaria: parseFloat(qtd_produto_necessaria||0),
        custo_total_projetado_rs: parseFloat(custo_total_projetado_rs||0),
        margem_projetada_pct: parseFloat(margem_projetada_pct||0),
        prazo_compra_ate: prazo_compra_ate||null, prazo_venda_ate: prazo_venda_ate||null,
        status: status||'Ativo', criado_em: new Date().toISOString(), linhas: []
    };
    memStore.planejamento_producao_insumos.push(item);
    if (Array.isArray(linhas)) {
        linhas.forEach(l => {
            const lid = nextId++;
            const linha = {
                id: lid, planejamento_id: pid,
                insumo_produto_id: l.insumo_produto_id ? parseInt(l.insumo_produto_id) : null,
                insumo_nome: l.insumo_nome||'', coeficiente_pct: parseFloat(l.coeficiente_pct||100),
                qtd_necessaria: parseFloat(l.qtd_necessaria||0),
                preco_compra_tabela: parseFloat(l.preco_compra_tabela||0),
                preco_compra_simulado: parseFloat(l.preco_compra_simulado||0),
                preco_venda_tabela: parseFloat(l.preco_venda_tabela||0),
                custo_total_insumo: parseFloat(l.custo_total_insumo||0),
                movimentacoes: []
            };
            memStore.planejamento_producao_linhas.push(linha);
            item.linhas.push(linha);
        });
    }
    res.json(item);
});

// POST - registrar movimentação (compra ou venda) em uma linha de insumo
app.post('/api/planejamento/producao-insumos/:planId/linhas/:linhaId/movimentacao', async (req, res) => {
    const planId = parseInt(req.params.planId);
    const linhaId = parseInt(req.params.linhaId);
    const { tipo, quantidade, preco_unitario, data_movimentacao, obs } = req.body;
    const valorTotal = parseFloat(quantidade||0) * parseFloat(preco_unitario||0);
    const datamov = data_movimentacao || new Date().toISOString().slice(0,10);

    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            const r = await pool.query(`
                INSERT INTO planejamento_producao_movimentacoes
                (linha_id, planejamento_id, tipo, quantidade, preco_unitario, valor_total, data_movimentacao, obs)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
            `, [linhaId, planId, tipo.toUpperCase(), parseFloat(quantidade||0),
                parseFloat(preco_unitario||0), valorTotal, datamov, obs||'']);
            return res.json(r.rows[0]);
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no POST movimentacao. ', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    if (!memStore.planejamento_producao_movimentacoes) memStore.planejamento_producao_movimentacoes = [];
    const mov = {
        id: nextId++, linha_id: linhaId, planejamento_id: planId,
        tipo: tipo.toUpperCase(), quantidade: parseFloat(quantidade||0),
        preco_unitario: parseFloat(preco_unitario||0), valor_total: valorTotal,
        data_movimentacao: datamov, obs: obs||'', criado_em: new Date().toISOString()
    };
    memStore.planejamento_producao_movimentacoes.push(mov);
    res.json(mov);
});

// DELETE movimentação
app.delete('/api/planejamento/producao-insumos/:planId/linhas/:linhaId/movimentacao/:movId', async (req, res) => {
    try {
        const movId = parseInt(req.params.movId);
        if (!dbAvailable) {
            memStore.planejamento_producao_movimentacoes = (memStore.planejamento_producao_movimentacoes||[]).filter(m => m.id !== movId);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM planejamento_producao_movimentacoes WHERE id=$1', [movId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE planejamento (cascata remove linhas e movimentações)
app.delete('/api/planejamento/producao-insumos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            const linhas = (memStore.planejamento_producao_linhas||[]).filter(l => l.planejamento_id === id).map(l => l.id);
            memStore.planejamento_producao_movimentacoes = (memStore.planejamento_producao_movimentacoes||[]).filter(m => !linhas.includes(m.linha_id));
            memStore.planejamento_producao_linhas = (memStore.planejamento_producao_linhas||[]).filter(l => l.planejamento_id !== id);
            memStore.planejamento_producao_insumos = (memStore.planejamento_producao_insumos||[]).filter(x => x.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM planejamento_producao_insumos WHERE id=$1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ─── API: Planejamento Estratégico ──────────────────────────────────────────
app.get('/api/planejamento-estrategico', async (req, res) => {
    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            const queryStr = `
                SELECT pe.*,
                       mc.nome as material_nome,
                       mc.categoria as material_categoria,
                       tp.preco_entregar as preco_compra,
                       tp.preco_coletar as preco_compra_coletar,
                       tp.venda_ref as preco_venda,
                       tp.comissao,
                       tp.pis_cofins,
                       tp.fidc,
                       tp.icms,
                       tp.frete_coleta
                FROM planejamento_estrategico pe
                JOIN materiais_catalogo mc ON pe.material_id = mc.id
                LEFT JOIN tabela_precos tp ON pe.material_id = tp.material_id
                ORDER BY pe.mes DESC, mc.nome ASC
            `;
            const result = await pool.query(queryStr);
            return res.json(result.rows);
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no GET planejamento-estrategico:', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    const list = memStore.planejamento_estrategico || [];
    const enriched = list.map(pe => {
        const mc = (memStore.materiais_catalogo || []).find(x => x.id === pe.material_id);
        const tp = (memStore.tabela_precos || []).find(x => x.material_id === pe.material_id) || {};
        return {
            ...pe,
            material_nome: mc ? mc.nome : 'Material desconhecido',
            material_categoria: mc ? mc.categoria : 'Outros',
            preco_compra: tp.preco_entregar || 0,
            preco_compra_coletar: tp.preco_coletar || 0,
            preco_venda: tp.venda_ref || 0,
            comissao: tp.comissao || 0,
            pis_cofins: tp.pis_cofins || 0,
            fidc: tp.fidc || 0,
            icms: tp.icms || 0,
            frete_coleta: tp.frete_coleta || 0
        };
    });
    res.json(enriched);
});

app.post('/api/planejamento-estrategico', async (req, res) => {
    const { 
        mes, 
        material_id, 
        qtd_conservador, 
        qtd_moderado, 
        qtd_agressivo, 
        qtd_realizado,
        margem_alvo,
        valor_compra_realizado,
        valor_venda_realizado
    } = req.body;
    const matId = parseInt(material_id);
    const qCons = parseFloat(qtd_conservador || 0);
    const qMod = parseFloat(qtd_moderado || 0);
    const qAgr = parseFloat(qtd_agressivo || 0);
    const qReal = parseFloat(qtd_realizado || 0);
    const mAlvo = margem_alvo !== undefined && margem_alvo !== null && margem_alvo !== '' ? parseFloat(margem_alvo) : null;
    const valCompraReal = parseFloat(valor_compra_realizado || 0);
    const valVendaReal = parseFloat(valor_venda_realizado || 0);
    const mesStr = mes || new Date().toISOString().slice(0, 7);

    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            const queryStr = `
                INSERT INTO planejamento_estrategico (
                    mes, material_id, qtd_conservador, qtd_moderado, qtd_agressivo, qtd_realizado, 
                    margem_alvo, valor_compra_realizado, valor_venda_realizado
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (mes, material_id) DO UPDATE
                SET qtd_conservador = EXCLUDED.qtd_conservador,
                    qtd_moderado = EXCLUDED.qtd_moderado,
                    qtd_agressivo = EXCLUDED.qtd_agressivo,
                    qtd_realizado = EXCLUDED.qtd_realizado,
                    margem_alvo = EXCLUDED.margem_alvo,
                    valor_compra_realizado = EXCLUDED.valor_compra_realizado,
                    valor_venda_realizado = EXCLUDED.valor_venda_realizado
                RETURNING *
            `;
            const r = await pool.query(queryStr, [mesStr, matId, qCons, qMod, qAgr, qReal, mAlvo, valCompraReal, valVendaReal]);
            return res.json(r.rows[0]);
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no POST planejamento-estrategico:', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    if (!memStore.planejamento_estrategico) memStore.planejamento_estrategico = [];
    const idx = memStore.planejamento_estrategico.findIndex(x => x.mes === mesStr && x.material_id === matId);
    const item = {
        id: idx >= 0 ? memStore.planejamento_estrategico[idx].id : nextId++,
        mes: mesStr,
        material_id: matId,
        qtd_conservador: qCons,
        qtd_moderado: qMod,
        qtd_agressivo: qAgr,
        qtd_realizado: qReal,
        margem_alvo: mAlvo,
        valor_compra_realizado: valCompraReal,
        valor_venda_realizado: valVendaReal,
        criado_em: new Date().toISOString()
    };
    if (idx >= 0) {
        memStore.planejamento_estrategico[idx] = item;
    } else {
        memStore.planejamento_estrategico.push(item);
    }
    res.json(item);
});

app.delete('/api/planejamento-estrategico/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            await pool.query('DELETE FROM planejamento_estrategico WHERE id = $1', [id]);
            return res.json({ success: true });
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no DELETE planejamento-estrategico:', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    memStore.planejamento_estrategico = (memStore.planejamento_estrategico || []).filter(x => x.id !== id);
    res.json({ success: true });
});


// ─── API: Planejamento Estratégico V3 (Teste Meta Faturamento -> Insumo) ─────
app.get('/api/planejamento-estrategicov3', async (req, res) => {
    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            const queryStr = `
                SELECT pe.*,
                       mc.nome as material_nome,
                       mc.categoria as material_categoria,
                       tp.preco_entregar as preco_compra_entregar,
                       tp.preco_coletar as preco_compra_coletar,
                       tp.venda_ref as preco_venda,
                       tp.comissao,
                       tp.pis_cofins,
                       tp.fidc,
                       tp.icms,
                       tp.frete_coleta
                FROM planejamento_estrategicov3 pe
                JOIN materiais_catalogo mc ON pe.material_id = mc.id
                LEFT JOIN tabela_precos tp ON pe.material_id = tp.material_id
                ORDER BY pe.mes DESC, mc.nome ASC
            `;
            const result = await pool.query(queryStr);
            return res.json(result.rows);
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no GET planejamento-estrategicov3:', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    const list = memStore.planejamento_estrategicov3 || [];
    const enriched = list.map(pe => {
        const mc = (memStore.materiais_catalogo || []).find(x => x.id === pe.material_id);
        const tp = (memStore.tabela_precos || []).find(x => x.material_id === pe.material_id) || {};
        return {
            ...pe,
            material_nome: mc ? mc.nome : 'Material desconhecido',
            material_categoria: mc ? mc.categoria : 'Outros',
            preco_compra_entregar: tp.preco_entregar || 0,
            preco_compra_coletar: tp.preco_coletar || 0,
            preco_venda: tp.venda_ref || 0,
            comissao: tp.comissao || 0,
            pis_cofins: tp.pis_cofins || 0,
            fidc: tp.fidc || 0,
            icms: tp.icms || 0,
            frete_coleta: tp.frete_coleta || 0
        };
    });
    res.json(enriched);
});

app.post('/api/planejamento-estrategicov3', async (req, res) => {
    const { 
        mes, 
        material_id, 
        meta_faturamento, 
        margem_desejada, 
        operacao, 
        qtd_realizado,
        valor_venda_realizado
    } = req.body;
    const matId = parseInt(material_id);
    const mFat = parseFloat(meta_faturamento || 0);
    const mMargem = parseFloat(margem_desejada || 0);
    const op = operacao || 'entrega';
    const qReal = parseFloat(qtd_realizado || 0);
    const valVendaReal = parseFloat(valor_venda_realizado || 0);
    const mesStr = mes || new Date().toISOString().slice(0, 7);

    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            const queryStr = `
                INSERT INTO planejamento_estrategicov3 (
                    mes, material_id, meta_faturamento, margem_desejada, operacao, qtd_realizado, valor_venda_realizado
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (mes, material_id) DO UPDATE
                SET meta_faturamento = EXCLUDED.meta_faturamento,
                    margem_desejada = EXCLUDED.margem_desejada,
                    operacao = EXCLUDED.operacao,
                    qtd_realizado = EXCLUDED.qtd_realizado,
                    valor_venda_realizado = EXCLUDED.valor_venda_realizado
                RETURNING *
            `;
            const r = await pool.query(queryStr, [mesStr, matId, mFat, mMargem, op, qReal, valVendaReal]);
            return res.json(r.rows[0]);
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no POST planejamento-estrategicov3:', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    if (!memStore.planejamento_estrategicov3) memStore.planejamento_estrategicov3 = [];
    const idx = memStore.planejamento_estrategicov3.findIndex(x => x.mes === mesStr && x.material_id === matId);
    const item = {
        id: idx >= 0 ? memStore.planejamento_estrategicov3[idx].id : nextId++,
        mes: mesStr,
        material_id: matId,
        meta_faturamento: mFat,
        margem_desejada: mMargem,
        operacao: op,
        qtd_realizado: qReal,
        valor_venda_realizado: valVendaReal,
        criado_em: new Date().toISOString()
    };
    if (idx >= 0) {
        memStore.planejamento_estrategicov3[idx] = item;
    } else {
        memStore.planejamento_estrategicov3.push(item);
    }
    res.json(item);
});

app.delete('/api/planejamento-estrategicov3/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    let useDb = dbAvailable && pool;
    try {
        if (useDb) {
            await pool.query('DELETE FROM planejamento_estrategicov3 WHERE id = $1', [id]);
            return res.json({ success: true });
        }
    } catch (err) {
        console.warn('⚠️ Erro de banco no DELETE planejamento-estrategicov3:', err.message);
        return res.status(500).json({ error: 'Erro de banco de dados. Tente novamente em instantes.' });
    }

    memStore.planejamento_estrategicov3 = (memStore.planejamento_estrategicov3 || []).filter(x => x.id !== id);
    res.json({ success: true });
});


// ─── API: Planejamento Comercial (Compra e Venda / Revenda) ─────────────────
app.get('/api/planejamento/comercial-revenda', async (req, res) => {
    try {
        if (!dbAvailable) {
            const metas = memStore.planejamento_comercial_revenda || [];
            const trans = memStore.planejamento_comercial_transacoes || [];
            return res.json(metas.map(m => {
                const mt = trans.filter(t => t.planejamento_id === m.id);
                const compras = mt.filter(t => t.tipo === 'COMPRA');
                const vendas  = mt.filter(t => t.tipo === 'VENDA');
                const totalCompraKg = compras.reduce((s, t) => s + parseFloat(t.quantidade_kg), 0);
                const totalVendaKg  = vendas.reduce((s, t) => s + parseFloat(t.quantidade_kg), 0);
                const totalCompraRs = compras.reduce((s, t) => s + parseFloat(t.valor_total), 0);
                const totalVendaRs  = vendas.reduce((s, t) => s + parseFloat(t.valor_total), 0);
                return { ...m, totalCompraKg, totalVendaKg, totalCompraRs, totalVendaRs,
                    mediaPrecoCompra: totalCompraKg > 0 ? totalCompraRs / totalCompraKg : 0,
                    mediaPrecoVenda:  totalVendaKg  > 0 ? totalVendaRs  / totalVendaKg  : 0 };
            }));
        }
        const r = await pool.query(`
            SELECT p.*,
                COALESCE(c.total_kg, 0) AS totalCompraKg,
                COALESCE(c.total_rs, 0) AS totalCompraRs,
                COALESCE(v.total_kg, 0) AS totalVendaKg,
                COALESCE(v.total_rs, 0) AS totalVendaRs,
                CASE WHEN COALESCE(c.total_kg,0) > 0 THEN COALESCE(c.total_rs,0)/COALESCE(c.total_kg,1) ELSE 0 END AS "mediaPrecoCompra",
                CASE WHEN COALESCE(v.total_kg,0) > 0 THEN COALESCE(v.total_rs,0)/COALESCE(v.total_kg,1) ELSE 0 END AS "mediaPrecoVenda"
            FROM planejamento_comercial_revenda p
            LEFT JOIN (SELECT planejamento_id, SUM(quantidade_kg) AS total_kg, SUM(valor_total) AS total_rs FROM planejamento_comercial_transacoes WHERE tipo='COMPRA' GROUP BY planejamento_id) c ON c.planejamento_id = p.id
            LEFT JOIN (SELECT planejamento_id, SUM(quantidade_kg) AS total_kg, SUM(valor_total) AS total_rs FROM planejamento_comercial_transacoes WHERE tipo='VENDA'  GROUP BY planejamento_id) v ON v.planejamento_id = p.id
            ORDER BY p.id DESC
        `);
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET extrato de transações de uma meta
app.get('/api/planejamento/comercial-revenda/:id/transacoes', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            const trans = (memStore.planejamento_comercial_transacoes || []).filter(t => t.planejamento_id === id);
            return res.json(trans);
        }
        const r = await pool.query('SELECT * FROM planejamento_comercial_transacoes WHERE planejamento_id=$1 ORDER BY data_transacao ASC, id ASC', [id]);
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST nova transação (compra ou venda fracionada)
app.post('/api/planejamento/comercial-transacao', async (req, res) => {
    try {
        const { planejamento_id, tipo, quantidade_kg, preco_unitario, data_transacao, observacoes } = req.body;
        const pid = parseInt(planejamento_id);
        const qtd = parseFloat(quantidade_kg || 0);
        const preco = parseFloat(preco_unitario || 0);
        const total = qtd * preco;
        const dataStr = data_transacao || new Date().toISOString().slice(0,10);
        if (!dbAvailable) {
            if (!memStore.planejamento_comercial_transacoes) memStore.planejamento_comercial_transacoes = [];
            const item = { id: nextId++, planejamento_id: pid, tipo: tipo.toUpperCase(), quantidade_kg: qtd, preco_unitario: preco, valor_total: total, data_transacao: dataStr, observacoes: observacoes||'', criado_em: new Date().toISOString() };
            memStore.planejamento_comercial_transacoes.push(item);
            return res.json(item);
        }
        const r = await pool.query(
            `INSERT INTO planejamento_comercial_transacoes (planejamento_id,tipo,quantidade_kg,preco_unitario,valor_total,data_transacao,observacoes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [pid, tipo.toUpperCase(), qtd, preco, total, dataStr, observacoes||'']
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE transação
app.delete('/api/planejamento/comercial-transacao/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            memStore.planejamento_comercial_transacoes = (memStore.planejamento_comercial_transacoes||[]).filter(t => t.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM planejamento_comercial_transacoes WHERE id=$1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento/comercial-revenda', async (req, res) => {
    try {
        const {
            mes_referencia, produto_id, produto_nome, compra_planejada_kg, venda_planejada_kg,
            investimento_planejado_rs, faturamento_previsto_rs, compra_realizada_kg,
            venda_realizada_rs, status, observacoes,
            preco_compra_estimado, preco_venda_estimado,
            preco_compra_realizado, preco_venda_realizado, venda_realizada_kg,
            prazo_compra_ate, prazo_venda_ate
        } = req.body;

        const fatPrev = parseFloat(faturamento_previsto_rs || 0);
        const metaGlobal = 5000000.00;
        const partPct = (fatPrev / metaGlobal) * 100;

        if (!dbAvailable) {
            if (!memStore.planejamento_comercial_revenda) memStore.planejamento_comercial_revenda = [];
            const item = {
                id: nextId++,
                mes_referencia: mes_referencia || new Date().toISOString().slice(0, 7),
                produto_id: parseInt(produto_id),
                produto_nome: produto_nome || 'Produto Comercial',
                compra_planejada_kg: parseFloat(compra_planejada_kg || 0),
                venda_planejada_kg: parseFloat(venda_planejada_kg || 0),
                investimento_planejado_rs: parseFloat(investimento_planejado_rs || 0),
                faturamento_previsto_rs: fatPrev,
                compra_realizada_kg: parseFloat(compra_realizada_kg || 0),
                venda_realizada_rs: parseFloat(venda_realizada_rs || 0),
                participacao_meta_pct: parseFloat(partPct.toFixed(2)),
                status: status || 'Em Cotação',
                observacoes: observacoes || '',
                criado_em: new Date().toISOString(),
                preco_compra_estimado: parseFloat(preco_compra_estimado || 0),
                preco_venda_estimado: parseFloat(preco_venda_estimado || 0),
                preco_compra_realizado: parseFloat(preco_compra_realizado || 0),
                preco_venda_realizado: parseFloat(preco_venda_realizado || 0),
                venda_realizada_kg: parseFloat(venda_realizada_kg || 0),
                prazo_compra_ate: prazo_compra_ate || null,
                prazo_venda_ate: prazo_venda_ate || null
            };
            memStore.planejamento_comercial_revenda.push(item);
            return res.json(item);
        }

        const r = await pool.query(`
            INSERT INTO planejamento_comercial_revenda (
                mes_referencia, produto_id, produto_nome, compra_planejada_kg, venda_planejada_kg,
                investimento_planejado_rs, faturamento_previsto_rs, compra_realizada_kg,
                venda_realizada_rs, participacao_meta_pct, status, observacoes,
                preco_compra_estimado, preco_venda_estimado,
                preco_compra_realizado, preco_venda_realizado, venda_realizada_kg,
                prazo_compra_ate, prazo_venda_ate
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *
        `, [
            mes_referencia || new Date().toISOString().slice(0, 7),
            produto_id ? parseInt(produto_id) : null, produto_nome || 'Produto Comercial',
            parseFloat(compra_planejada_kg || 0), parseFloat(venda_planejada_kg || 0),
            parseFloat(investimento_planejado_rs || 0), fatPrev,
            parseFloat(compra_realizada_kg || 0), parseFloat(venda_realizada_rs || 0),
            parseFloat(partPct.toFixed(2)), status || 'Em Cotação', observacoes || '',
            parseFloat(preco_compra_estimado || 0), parseFloat(preco_venda_estimado || 0),
            parseFloat(preco_compra_realizado || 0), parseFloat(preco_venda_realizado || 0),
            parseFloat(venda_realizada_kg || 0),
            prazo_compra_ate || null, prazo_venda_ate || null
        ]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/planejamento/comercial-revenda/:id/realizado', async (req, res) => {

    try {
        const id = parseInt(req.params.id);
        const {
            compra_realizada_kg,
            venda_realizada_rs,
            venda_realizada_kg,
            preco_compra_realizado,
            preco_venda_realizado,
            status
        } = req.body;

        if (!dbAvailable) {
            const item = (memStore.planejamento_comercial_revenda || []).find(x => x.id === id);
            if (!item) return res.status(404).json({ error: 'Planejamento não encontrado' });
            if (compra_realizada_kg !== undefined) item.compra_realizada_kg = parseFloat(compra_realizada_kg);
            if (venda_realizada_rs !== undefined) item.venda_realizada_rs = parseFloat(venda_realizada_rs);
            if (venda_realizada_kg !== undefined) item.venda_realizada_kg = parseFloat(venda_realizada_kg);
            if (preco_compra_realizado !== undefined) item.preco_compra_realizado = parseFloat(preco_compra_realizado);
            if (preco_venda_realizado !== undefined) item.preco_venda_realizado = parseFloat(preco_venda_realizado);
            if (status) item.status = status;
            return res.json(item);
        }

        const r = await pool.query(`
            UPDATE planejamento_comercial_revenda SET
                compra_realizada_kg = COALESCE($1, compra_realizada_kg),
                venda_realizada_rs = COALESCE($2, venda_realizada_rs),
                venda_realizada_kg = COALESCE($3, venda_realizada_kg),
                preco_compra_realizado = COALESCE($4, preco_compra_realizado),
                preco_venda_realizado = COALESCE($5, preco_venda_realizado),
                status = COALESCE($6, status)
            WHERE id = $7 RETURNING *
        `, [
            compra_realizada_kg !== undefined ? parseFloat(compra_realizada_kg) : null,
            venda_realizada_rs !== undefined ? parseFloat(venda_realizada_rs) : null,
            venda_realizada_kg !== undefined ? parseFloat(venda_realizada_kg) : null,
            preco_compra_realizado !== undefined ? parseFloat(preco_compra_realizado) : null,
            preco_venda_realizado !== undefined ? parseFloat(preco_venda_realizado) : null,
            status || null,
            id
        ]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/planejamento/comercial-revenda/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            memStore.planejamento_comercial_revenda = (memStore.planejamento_comercial_revenda || []).filter(x => x.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM planejamento_comercial_revenda WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Parâmetros de Prazos & Estoque Mínimo ─────────────────────────────
app.get('/api/planejamento/parametros-prazos', async (req, res) => {
    try {
        if (!dbAvailable) {
            return res.json(memStore.parametros_estoque_prazos || []);
        }
        const r = await pool.query(`
            SELECT p.*, mc.nome as material_nome
            FROM parametros_estoque_prazos p
            LEFT JOIN materiais_catalogo mc ON p.material_id = mc.id
            ORDER BY p.id DESC
        `);
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento/parametros-prazos', async (req, res) => {
    try {
        const { material_id, lead_time_compra_dias, prazo_entrega_dias, prazo_producao_dias, estoque_minimo_kg, estoque_seguranca_kg, prazo_permanencia_dias } = req.body;
        const matId = parseInt(material_id);

        if (!dbAvailable) {
            if (!memStore.parametros_estoque_prazos) memStore.parametros_estoque_prazos = [];
            const idx = memStore.parametros_estoque_prazos.findIndex(x => x.material_id === matId);
            const item = {
                id: idx >= 0 ? memStore.parametros_estoque_prazos[idx].id : nextId++,
                material_id: matId,
                lead_time_compra_dias: parseInt(lead_time_compra_dias || 7),
                prazo_entrega_dias: parseInt(prazo_entrega_dias || 15),
                prazo_producao_dias: parseInt(prazo_producao_dias || 5),
                estoque_minimo_kg: parseFloat(estoque_minimo_kg || 0),
                estoque_seguranca_kg: parseFloat(estoque_seguranca_kg || 0),
                prazo_permanencia_dias: parseInt(prazo_permanencia_dias || 30),
                atualizado_em: new Date().toISOString()
            };
            if (idx >= 0) memStore.parametros_estoque_prazos[idx] = item;
            else memStore.parametros_estoque_prazos.push(item);
            return res.json(item);
        }

        const r = await pool.query(`
            INSERT INTO parametros_estoque_prazos (material_id, lead_time_compra_dias, prazo_entrega_dias, prazo_producao_dias, estoque_minimo_kg, estoque_seguranca_kg, prazo_permanencia_dias)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (material_id) DO UPDATE SET
                lead_time_compra_dias = EXCLUDED.lead_time_compra_dias,
                prazo_entrega_dias = EXCLUDED.prazo_entrega_dias,
                prazo_producao_dias = EXCLUDED.prazo_producao_dias,
                estoque_minimo_kg = EXCLUDED.estoque_minimo_kg,
                estoque_seguranca_kg = EXCLUDED.estoque_seguranca_kg,
                prazo_permanencia_dias = EXCLUDED.prazo_permanencia_dias,
                atualizado_em = NOW()
            RETURNING *
        `, [
            matId, parseInt(lead_time_compra_dias || 7), parseInt(prazo_entrega_dias || 15),
            parseInt(prazo_producao_dias || 5), parseFloat(estoque_minimo_kg || 0),
            parseFloat(estoque_seguranca_kg || 0), parseInt(prazo_permanencia_dias || 30)
        ]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Planejamento por Cenários (Conservador, Moderado, Agressivo) ──────
app.get('/api/planejamento/cenarios/configuracao', async (req, res) => {
    try {
        const defaultConfig = {
            id: 1,
            percentual_conservador: 80.00,
            percentual_moderado: 100.00,
            percentual_agressivo: 120.00,
            cenario_foco: 'AGRESSIVO',
            meta_base_padrao_rs: 1000000.00
        };

        if (!dbAvailable) {
            if (!memStore.configuracao_cenarios_planejamento) {
                memStore.configuracao_cenarios_planejamento = [defaultConfig];
            }
            return res.json(memStore.configuracao_cenarios_planejamento[0]);
        }

        const r = await pool.query('SELECT * FROM configuracao_cenarios_planejamento ORDER BY id ASC LIMIT 1');
        if (r.rows.length === 0) {
            const ins = await pool.query(`
                INSERT INTO configuracao_cenarios_planejamento (percentual_conservador, percentual_moderado, percentual_agressivo, cenario_foco, meta_base_padrao_rs)
                VALUES (80.00, 100.00, 120.00, 'AGRESSIVO', 1000000.00) RETURNING *
            `);
            return res.json(ins.rows[0]);
        }
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento/cenarios/configuracao', async (req, res) => {
    try {
        const { percentual_conservador, percentual_moderado, percentual_agressivo, cenario_foco, meta_base_padrao_rs } = req.body;
        const pCons = parseFloat(percentual_conservador || 80);
        const pMod = parseFloat(percentual_moderado || 100);
        const pAgr = parseFloat(percentual_agressivo || 120);
        const cFoco = cenario_foco || 'AGRESSIVO';
        const mBase = parseFloat(meta_base_padrao_rs || 1000000);

        if (!dbAvailable) {
            const item = {
                id: 1,
                percentual_conservador: pCons,
                percentual_moderado: pMod,
                percentual_agressivo: pAgr,
                cenario_foco: cFoco,
                meta_base_padrao_rs: mBase,
                atualizado_em: new Date().toISOString()
            };
            memStore.configuracao_cenarios_planejamento = [item];
            return res.json(item);
        }

        const r = await pool.query(`
            INSERT INTO configuracao_cenarios_planejamento (id, percentual_conservador, percentual_moderado, percentual_agressivo, cenario_foco, meta_base_padrao_rs)
            VALUES (1, $1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
                percentual_conservador = EXCLUDED.percentual_conservador,
                percentual_moderado = EXCLUDED.percentual_moderado,
                percentual_agressivo = EXCLUDED.percentual_agressivo,
                cenario_foco = EXCLUDED.cenario_foco,
                meta_base_padrao_rs = EXCLUDED.meta_base_padrao_rs,
                atualizado_em = NOW()
            RETURNING *
        `, [pCons, pMod, pAgr, cFoco, mBase]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento/cenarios/simular', async (req, res) => {
    try {
        const { meta_base_rs, p_conservador, p_moderado, p_agressivo, produto_id } = req.body;
        const metaBase = parseFloat(meta_base_rs || 1000000);
        const pctCons = parseFloat(p_conservador || 80);
        const pctMod = parseFloat(p_moderado || 100);
        const pctAgr = parseFloat(p_agressivo || 120);

        const calcCenario = (nome, pct, riskLabel, statusTag) => {
            const faturamento = metaBase * (pct / 100);
            const investimento = faturamento * 0.70; // 70% custo das vendas/compras
            const caixa = investimento * 1.15; // 15% reserva operacional
            const margem = faturamento - investimento;
            const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0;
            const volumeVendasKg = faturamento / 30.00; // R$ 30/kg médio
            const volumeComprasKg = volumeVendasKg * 1.05; // 5% perda/quebra
            const qtdProdutos = Math.max(1, Math.round(faturamento / 250000));

            return {
                cenario: nome,
                percentual: pct,
                faturamento_previsto_rs: faturamento,
                investimento_necessario_rs: investimento,
                necessidade_caixa_rs: caixa,
                margem_estimada_rs: margem,
                margem_estimada_pct: margemPct,
                volume_vendas_kg: volumeVendasKg,
                volume_compras_kg: volumeComprasKg,
                qtd_produtos: qtdProdutos,
                crescimento_esperado_pct: pct - 100,
                risco: riskLabel,
                status: statusTag
            };
        };

        const conservador = calcCenario('CONSERVADOR', pctCons, 'Baixo Risco (Cenário de Segurança)', '🟢 CENÁRIO CONSERVADOR');
        const moderado = calcCenario('MODERADO', pctMod, 'Risco Moderado (Padrão Operacional)', '🟡 META BASE (MODERADO)');
        const agressivo = calcCenario('AGRESSIVO', pctAgr, 'Risco Controlado (Expansão)', '🔴 META EXPANSÃO (AGRESSIVO)');

        res.json({
            meta_base_rs: metaBase,
            cenarios: {
                conservador,
                moderado,
                agressivo
            },
            cenario_foco: agressivo,
            diferenca_foco_moderado_rs: agressivo.faturamento_previsto_rs - moderado.faturamento_previsto_rs,
            diferenca_foco_conservador_rs: agressivo.faturamento_previsto_rs - conservador.faturamento_previsto_rs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Planejamento Industrial / Equipamentos ────────────────────────────
app.get('/api/planejamento/industrial/equipamentos', async (req, res) => {
    try {
        if (!dbAvailable) {
            return res.json((memStore.equipamentos_industriais || []).sort((a, b) => a.id - b.id));
        }
        const r = await pool.query('SELECT * FROM equipamentos_industriais ORDER BY id ASC');
        res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento/industrial/equipamentos', async (req, res) => {
    try {
        const { nome_equipamento, codigo_tag, setor, capacidade_nominal_kgh, disponibilidade_horas_dia, tempo_setup_horas, eficiencia_oee_pct, status, observacoes } = req.body;

        if (!dbAvailable) {
            if (!memStore.equipamentos_industriais) memStore.equipamentos_industriais = [];
            const eq = {
                id: nextId++,
                nome_equipamento,
                codigo_tag,
                setor: setor || 'Processamento',
                capacidade_nominal_kgh: parseFloat(capacidade_nominal_kgh || 1000),
                disponibilidade_horas_dia: parseFloat(disponibilidade_horas_dia || 16),
                tempo_setup_horas: parseFloat(tempo_setup_horas || 1.0),
                eficiencia_oee_pct: parseFloat(eficiencia_oee_pct || 85),
                status: status || 'Operacional',
                observacoes: observacoes || ''
            };
            memStore.equipamentos_industriais.push(eq);
            return res.json(eq);
        }

        const r = await pool.query(`
            INSERT INTO equipamentos_industriais (nome_equipamento, codigo_tag, setor, capacidade_nominal_kgh, disponibilidade_horas_dia, tempo_setup_horas, eficiencia_oee_pct, status, observacoes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `, [nome_equipamento, codigo_tag, setor || 'Processamento', capacidade_nominal_kgh || 1000, disponibilidade_horas_dia || 16, tempo_setup_horas || 1.0, eficiencia_oee_pct || 85, status || 'Operacional', observacoes]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/planejamento/industrial/equipamentos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { nome_equipamento, codigo_tag, setor, capacidade_nominal_kgh, disponibilidade_horas_dia, tempo_setup_horas, eficiencia_oee_pct, status, observacoes } = req.body;

        if (!dbAvailable) {
            const idx = (memStore.equipamentos_industriais || []).findIndex(x => x.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Equipamento não encontrado' });
            memStore.equipamentos_industriais[idx] = {
                ...memStore.equipamentos_industriais[idx],
                nome_equipamento: nome_equipamento || memStore.equipamentos_industriais[idx].nome_equipamento,
                codigo_tag: codigo_tag || memStore.equipamentos_industriais[idx].codigo_tag,
                setor: setor || memStore.equipamentos_industriais[idx].setor,
                capacidade_nominal_kgh: parseFloat(capacidade_nominal_kgh || memStore.equipamentos_industriais[idx].capacidade_nominal_kgh),
                disponibilidade_horas_dia: parseFloat(disponibilidade_horas_dia || memStore.equipamentos_industriais[idx].disponibilidade_horas_dia),
                tempo_setup_horas: parseFloat(tempo_setup_horas || memStore.equipamentos_industriais[idx].tempo_setup_horas),
                eficiencia_oee_pct: parseFloat(eficiencia_oee_pct || memStore.equipamentos_industriais[idx].eficiencia_oee_pct),
                status: status || memStore.equipamentos_industriais[idx].status,
                observacoes: observacoes !== undefined ? observacoes : memStore.equipamentos_industriais[idx].observacoes
            };
            return res.json(memStore.equipamentos_industriais[idx]);
        }

        const r = await pool.query(`
            UPDATE equipamentos_industriais SET
                nome_equipamento = $1, codigo_tag = $2, setor = $3, capacidade_nominal_kgh = $4,
                disponibilidade_horas_dia = $5, tempo_setup_horas = $6, eficiencia_oee_pct = $7, status = $8, observacoes = $9
            WHERE id = $10 RETURNING *
        `, [nome_equipamento, codigo_tag, setor, capacidade_nominal_kgh, disponibilidade_horas_dia, tempo_setup_horas, eficiencia_oee_pct, status, observacoes, id]);

        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/planejamento/industrial/equipamentos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            memStore.equipamentos_industriais = (memStore.equipamentos_industriais || []).filter(x => x.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM equipamentos_industriais WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Planejamento de Produção & PCP (Com Tempos Operacionais) ─────────
app.get('/api/planejamento/producao/ops', async (req, res) => {
    try {
        if (!dbAvailable) {
            const list = (memStore.ordens_producao || []).map(op => {
                const mc = (memStore.materiais_catalogo || []).find(m => m.id == op.material_saida_id);
                return {
                    ...op,
                    material_saida_nome: mc ? mc.nome : ''
                };
            });
            return res.json(list.sort((a, b) => b.id - a.id));
        }

        const ops = await pool.query(`
            SELECT op.*, mc.nome as material_saida_nome, a.numero_amostra
            FROM ordens_producao op
            LEFT JOIN materiais_catalogo mc ON op.material_saida_id = mc.id
            LEFT JOIN amostras a ON op.amostra_id = a.id
            ORDER BY op.id DESC
        `);

        for (const op of ops.rows) {
            const etapas = await pool.query(`
                SELECT e.*, eq.nome_equipamento
                FROM ordens_producao_etapas e
                LEFT JOIN equipamentos_industriais eq ON e.equipamento_id = eq.id
                WHERE e.op_id = $1
                ORDER BY e.ordem ASC
            `, [op.id]);
            op.etapas = etapas.rows;
        }

        res.json(ops.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/planejamento/producao/ops', async (req, res) => {
    try {
        const { numero_op, amostra_id, lote_id, material_entrada, peso_entrada_kg, material_saida_id, peso_saida_estimado_kg, data_inicio_prevista, data_fim_prevista, responsavel_pcp, status, observacoes, etapas } = req.body;

        let numOpFinal = (numero_op && numero_op.trim()) ? numero_op.trim() : ('OP-' + new Date().getFullYear() + '-' + String(Math.floor(Date.now() / 1000) % 100000).padStart(5, '0'));

        if (!dbAvailable) {
            if (!memStore.ordens_producao) memStore.ordens_producao = [];
            const opId = nextId++;
            const newOp = {
                id: opId,
                numero_op: numOpFinal,
                amostra_id: amostra_id && !isNaN(parseInt(amostra_id)) ? parseInt(amostra_id) : null,
                lote_id: lote_id && !isNaN(parseInt(lote_id)) ? parseInt(lote_id) : null,
                material_entrada: material_entrada || 'Material de Entrada',
                peso_entrada_kg: parseFloat(peso_entrada_kg || 0),
                material_saida_id: material_saida_id && !isNaN(parseInt(material_saida_id)) ? parseInt(material_saida_id) : null,
                peso_saida_estimado_kg: parseFloat(peso_saida_estimado_kg || 0),
                data_inicio_prevista: data_inicio_prevista || null,
                data_fim_prevista: data_fim_prevista || null,
                responsavel_pcp: responsavel_pcp || 'Admin PCP',
                status: status || 'Planejada',
                observacoes: observacoes || '',
                criado_em: new Date().toISOString(),
                etapas: (etapas || []).map((et, idx) => ({
                    id: idx + 1,
                    op_id: opId,
                    nome_etapa: et.nome_etapa || `Etapa ${idx + 1}`,
                    ordem: idx + 1,
                    equipamento_id: et.equipamento_id && !isNaN(parseInt(et.equipamento_id)) ? parseInt(et.equipamento_id) : null,
                    tempo_estimado_horas: parseFloat(et.tempo_estimado_horas || 0),
                    tempo_real_horas: parseFloat(et.tempo_real_horas || 0),
                    status_etapa: et.status_etapa || 'Pendente',
                    operador_responsavel: et.operador_responsavel || '',
                    observacoes: et.observacoes || ''
                }))
            };
            memStore.ordens_producao.push(newOp);
            return res.json(newOp);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let opRes;
            try {
                opRes = await client.query(`
                    INSERT INTO ordens_producao (numero_op, amostra_id, lote_id, material_entrada, peso_entrada_kg, material_saida_id, peso_saida_estimado_kg, data_inicio_prevista, data_fim_prevista, responsavel_pcp, status, observacoes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
                `, [
                    numOpFinal,
                    amostra_id && !isNaN(parseInt(amostra_id)) ? parseInt(amostra_id) : null,
                    lote_id && !isNaN(parseInt(lote_id)) ? parseInt(lote_id) : null,
                    material_entrada || 'Material de Entrada',
                    parseFloat(peso_entrada_kg || 0),
                    material_saida_id && !isNaN(parseInt(material_saida_id)) ? parseInt(material_saida_id) : null,
                    parseFloat(peso_saida_estimado_kg || 0),
                    data_inicio_prevista || null,
                    data_fim_prevista || null,
                    responsavel_pcp || 'PCP Admin',
                    status || 'Planejada',
                    observacoes || ''
                ]);
            } catch (errDup) {
                // Se der duplicidade de numero_op, recria com timestamp unico
                numOpFinal = 'OP-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6);
                opRes = await client.query(`
                    INSERT INTO ordens_producao (numero_op, amostra_id, lote_id, material_entrada, peso_entrada_kg, material_saida_id, peso_saida_estimado_kg, data_inicio_prevista, data_fim_prevista, responsavel_pcp, status, observacoes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
                `, [
                    numOpFinal,
                    amostra_id && !isNaN(parseInt(amostra_id)) ? parseInt(amostra_id) : null,
                    lote_id && !isNaN(parseInt(lote_id)) ? parseInt(lote_id) : null,
                    material_entrada || 'Material de Entrada',
                    parseFloat(peso_entrada_kg || 0),
                    material_saida_id && !isNaN(parseInt(material_saida_id)) ? parseInt(material_saida_id) : null,
                    parseFloat(peso_saida_estimado_kg || 0),
                    data_inicio_prevista || null,
                    data_fim_prevista || null,
                    responsavel_pcp || 'PCP Admin',
                    status || 'Planejada',
                    observacoes || ''
                ]);
            }

            const createdOp = opRes.rows[0];
            const createdEtapas = [];
            if (etapas && Array.isArray(etapas)) {
                for (let i = 0; i < etapas.length; i++) {
                    const et = etapas[i];
                    const eqId = et.equipamento_id && !isNaN(parseInt(et.equipamento_id)) ? parseInt(et.equipamento_id) : null;
                    const etRes = await client.query(`
                        INSERT INTO ordens_producao_etapas (op_id, nome_etapa, ordem, equipamento_id, tempo_estimado_horas, tempo_real_horas, status_etapa, operador_responsavel, observacoes)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
                    `, [
                        createdOp.id,
                        et.nome_etapa || `Etapa ${i + 1}`,
                        i + 1,
                        eqId,
                        parseFloat(et.tempo_estimado_horas || 0),
                        parseFloat(et.tempo_real_horas || 0),
                        et.status_etapa || 'Pendente',
                        et.operador_responsavel || '',
                        et.observacoes || ''
                    ]);
                    createdEtapas.push(etRes.rows[0]);
                }
            }
            await client.query('COMMIT');
            res.json({ ...createdOp, etapas: createdEtapas });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/planejamento/producao/ops/:id/etapas', async (req, res) => {
    try {
        const opId = parseInt(req.params.id);
        const { etapa_id, tempo_real_horas, status_etapa, operador_responsavel, status_op } = req.body;

        if (!dbAvailable) {
            const op = (memStore.ordens_producao || []).find(x => x.id === opId);
            if (!op) return res.status(404).json({ error: 'Ordem de Produção não encontrada' });
            if (status_op) op.status = status_op;
            if (etapa_id && op.etapas) {
                const et = op.etapas.find(e => e.id == etapa_id);
                if (et) {
                    if (tempo_real_horas !== undefined) et.tempo_real_horas = parseFloat(tempo_real_horas);
                    if (status_etapa) et.status_etapa = status_etapa;
                    if (operador_responsavel) et.operador_responsavel = operador_responsavel;
                }
            }
            return res.json(op);
        }

        if (status_op) {
            await pool.query('UPDATE ordens_producao SET status = $1, atualizado_em = NOW() WHERE id = $2', [status_op, opId]);
        }
        if (etapa_id) {
            await pool.query(`
                UPDATE ordens_producao_etapas SET
                    tempo_real_horas = COALESCE($1, tempo_real_horas),
                    status_etapa = COALESCE($2, status_etapa),
                    operador_responsavel = COALESCE($3, operador_responsavel)
                WHERE id = $4 AND op_id = $5
            `, [tempo_real_horas !== undefined ? parseFloat(tempo_real_horas) : null, status_etapa || null, operador_responsavel || null, etapa_id, opId]);
        }

        const opRes = await pool.query('SELECT * FROM ordens_producao WHERE id = $1', [opId]);
        const etapasRes = await pool.query('SELECT * FROM ordens_producao_etapas WHERE op_id = $1 ORDER BY ordem ASC', [opId]);
        res.json({ ...opRes.rows[0], etapas: etapasRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/planejamento/producao/ops/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            memStore.ordens_producao = (memStore.ordens_producao || []).filter(x => x.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM ordens_producao WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Estoque (GET) ───────────────────────────────────────────────────────
app.get('/api/estoque', async (req, res) => {
    try {
        if (dbAvailable) {
            const eRes = await pool.query(`
                SELECT e.*, mc.nome as material_nome, mc.categoria as material_categoria, mc.unidade as material_unidade
                FROM estoque e
                JOIN materiais_catalogo mc ON e.material_id = mc.id
                ORDER BY mc.categoria ASC, mc.nome ASC
            `);
            const mRes = await pool.query(`
                SELECT m.*, mc.nome as material_nome
                FROM movimentacoes_estoque m
                JOIN materiais_catalogo mc ON m.material_id = mc.id
                ORDER BY m.data DESC LIMIT 100
            `);
            return res.json({ estoque: eRes.rows, movimentacoes: mRes.rows });
        }

        const estoque = memStore.estoque.map(e => {
            const mc = memStore.materiais_catalogo.find(x => x.id === e.material_id);
            return {
                ...e,
                material_nome: mc ? mc.nome : '',
                material_categoria: mc ? mc.categoria : '',
                material_unidade: mc ? mc.unidade : 'kg'
            };
        });

        const movimentacoes = memStore.movimentacoes_estoque.map(m => {
            const mc = memStore.materiais_catalogo.find(x => x.id === m.material_id);
            return {
                ...m,
                material_nome: mc ? mc.nome : ''
            };
        }).sort((a,b) => new Date(b.data) - new Date(a.data));

        res.json({ estoque, movimentacoes });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao carregar estoque.' });
    }
});

// ─── API: Login ───────────────────────────────────────────────────────────────

// ─── API: Groq Chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    try {
        const { message, systemPrompt } = req.body;
        if (!message) return res.status(400).json({ error: 'O parâmetro message é obrigatório.' });

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt || 'Você é o assistente virtual da ApexTech Metais.' },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 250
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Erro Groq:', errorData);
            return res.status(response.status).json({ error: 'Erro de comunicação com o serviço de IA.' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro no proxy /api/chat:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ─── API: Soluções (CRUD) ─────────────────────────────────────────────────────
app.get('/api/solucoes', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM solucoes ORDER BY ordem ASC, criado_em ASC');
            return res.json(result.rows);
        }
        res.json([...memStore.solucoes].sort((a, b) => a.ordem - b.ordem));
    } catch (err) {
        console.error('Erro GET /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao buscar soluções.' });
    }
});

app.post('/api/solucoes', async (req, res) => {
    try {
        const { nome, img, descricao, ordem } = req.body;
        if (!nome || !img || !descricao) return res.status(400).json({ error: 'nome, img e descricao são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO solucoes (nome, img, descricao, ordem) VALUES ($1, $2, $3, $4) RETURNING *',
                [nome, img, descricao, ordem || 0]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, nome, img, descricao, ordem: ordem || 0, criado_em: new Date().toISOString() };
        memStore.solucoes.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao criar solução.' });
    }
});

app.put('/api/solucoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, img, descricao, ordem } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                'UPDATE solucoes SET nome=$1, img=$2, descricao=$3, ordem=$4 WHERE id=$5 RETURNING *',
                [nome, img, descricao, ordem || 0, id]
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Solução não encontrada.' });
            return res.json(result.rows[0]);
        }
        const idx = memStore.solucoes.findIndex(s => s.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Solução não encontrada.' });
        Object.assign(memStore.solucoes[idx], { nome, img, descricao, ordem: ordem || 0 });
        res.json(memStore.solucoes[idx]);
    } catch (err) {
        console.error('Erro PUT /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao atualizar solução.' });
    }
});

app.delete('/api/solucoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM solucoes WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Solução não encontrada.' });
            return res.json({ success: true });
        }
        const idx = memStore.solucoes.findIndex(s => s.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Solução não encontrada.' });
        memStore.solucoes.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao remover solução.' });
    }
});

// ─── API: Materiais (CRUD) ────────────────────────────────────────────────────
app.get('/api/materiais', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM materiais ORDER BY criado_em DESC');
            return res.json(result.rows);
        }
        res.json([...memStore.materiais]);
    } catch (err) {
        console.error('Erro GET /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao buscar materiais.' });
    }
});

app.post('/api/materiais', async (req, res) => {
    try {
        const { nome, imagem, descricao, locais } = req.body;
        if (!nome || !descricao) return res.status(400).json({ error: 'nome e descricao são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO materiais (nome, imagem, descricao, locais) VALUES ($1, $2, $3, $4) RETURNING *',
                [nome, imagem || null, descricao, JSON.stringify(locais || [])]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, nome, imagem: imagem || null, descricao, locais: locais || [], criado_em: new Date().toISOString() };
        memStore.materiais.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao criar material.' });
    }
});

app.delete('/api/materiais/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM materiais WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Material não encontrado.' });
            return res.json({ success: true });
        }
        const idx = memStore.materiais.findIndex(m => m.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Material não encontrado.' });
        memStore.materiais.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao remover material.' });
    }
});

// ─── API: Notícias (CRUD) ─────────────────────────────────────────────────────
app.get('/api/noticias', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM noticias ORDER BY data_pub DESC, criado_em DESC');
            return res.json(result.rows);
        }
        res.json([...memStore.noticias]);
    } catch (err) {
        console.error('Erro GET /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao buscar notícias.' });
    }
});

app.post('/api/noticias', async (req, res) => {
    try {
        const { titulo, url, resumo, data, categoria } = req.body;
        if (!titulo) return res.status(400).json({ error: 'titulo é obrigatório.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO noticias (titulo, url, resumo, data_pub, categoria) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [titulo, url || null, resumo || null, data || null, categoria || null]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, titulo, url: url || null, resumo: resumo || null, data_pub: data || null, categoria: categoria || null, criado_em: new Date().toISOString() };
        memStore.noticias.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao criar notícia.' });
    }
});

app.delete('/api/noticias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM noticias WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Notícia não encontrada.' });
            return res.json({ success: true });
        }
        const idx = memStore.noticias.findIndex(n => n.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Notícia não encontrada.' });
        memStore.noticias.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao remover notícia.' });
    }
});

// ─── API: Busca de NCM (Siscomex com Cache) ──────────────────────────────────
let cacheNcm = null;

async function carregarNcms() {
    if (cacheNcm) return cacheNcm;
    try {
        const response = await axios.get('https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json', {
            timeout: 15000,
            headers: { 'Accept-Encoding': 'gzip, deflate, br' }
        });
        if (response.data && response.data.Nomenclaturas) {
            cacheNcm = response.data.Nomenclaturas.map(n => ({
                codigo: n.Codigo,
                descricao: n.Descricao
            }));
            console.log(`[NCM] Carregados ${cacheNcm.length} códigos do Siscomex.`);
            return cacheNcm;
        }
    } catch (e) {
        console.error('Erro ao baixar NCMs do Siscomex:', e.message);
    }
    
    // Fallback básico para não travar o sistema
    return [
        { codigo: "76020000", descricao: "Desperdícios e resíduos, de alumínio" },
        { codigo: "74040000", descricao: "Desperdícios e resíduos, de cobre" },
        { codigo: "79020000", descricao: "Desperdícios e resíduos, de zinco" },
        { codigo: "78020000", descricao: "Desperdícios e resíduos, de chumbo" },
        { codigo: "80020000", descricao: "Desperdícios e resíduos, de estanho" },
        { codigo: "75030000", descricao: "Desperdícios e resíduos, de níquel" }
    ];
}

app.get('/api/ncm/buscar', async (req, res) => {
    try {
        const query = (req.query.q || '').trim().toLowerCase();
        if (!query) return res.json([]);
        
        const ncms = await carregarNcms();
        const cleanQuery = query.replace(/\D/g, '');
        
        const results = ncms.filter(n => {
            const cleanCodigo = n.codigo.replace(/\D/g, '');
            return (cleanQuery && cleanCodigo.includes(cleanQuery)) || 
                   n.descricao.toLowerCase().includes(query);
        }).slice(0, 50); // Limita a 50 resultados para performance
        
        res.json(results);
    } catch (err) {
        console.error('Erro na busca de NCM:', err);
        res.status(500).json({ error: 'Erro ao buscar NCM.' });
    }
});

// ─── API: Configurações da Home ──────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM settings');
            const settingsObj = {};
            result.rows.forEach(row => {
                settingsObj[row.key] = row.value;
            });
            return res.json(settingsObj);
        }
        res.json(memStore.settings);
    } catch (err) {
        console.error('Erro GET /api/settings:', err);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        const settings = req.body;
        if (dbAvailable) {
            for (const [key, value] of Object.entries(settings)) {
                await pool.query(
                    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                    [key, String(value)]
                );
            }
            return res.json({ success: true });
        }
        Object.assign(memStore.settings, settings);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro PUT /api/settings:', err);
        res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
});

// ─── API: Galeria de Fotos ───────────────────────────────────────────────────
app.get('/api/galeria', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM galeria ORDER BY ordem ASC, criado_em DESC');
            return res.json(result.rows);
        }
        const list = [...memStore.galeria].sort((a, b) => a.ordem - b.ordem);
        res.json(list);
    } catch (err) {
        console.error('Erro GET /api/galeria:', err);
        res.status(500).json({ error: 'Erro ao buscar galeria.' });
    }
});

app.post('/api/galeria', async (req, res) => {
    try {
        const { url, titulo, ordem } = req.body;
        if (!url || !titulo) return res.status(400).json({ error: 'url e titulo são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO galeria (url, titulo, ordem) VALUES ($1, $2, $3) RETURNING *',
                [url, titulo, ordem || 0]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, url, titulo, ordem: ordem || 0, criado_em: new Date().toISOString() };
        memStore.galeria.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/galeria:', err);
        res.status(500).json({ error: 'Erro ao adicionar imagem à galeria.' });
    }
});

app.delete('/api/galeria/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM galeria WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Imagem não encontrada.' });
            return res.json({ success: true });
        }
        const idx = memStore.galeria.findIndex(g => g.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Imagem não encontrada.' });
        memStore.galeria.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/galeria:', err);
        res.status(500).json({ error: 'Erro ao remover imagem da galeria.' });
    }
});

// ─── API: LME Relatório Semanal (sem planilha, cálculo automático) ─────────────
// Busca dados da LME via scraping, agrupa por semana e calcula todas as métricas

function parseNum(str) {
    if (!str || str.trim() === '' || str.trim() === '-') return null;
    // Remove R$, %, espaços
    let s = str.replace(/R\$\s*/g, '').replace(/%/g, '').trim();
    
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    
    if (lastComma > lastDot) {
        // Formato BR: 1.234,56 ou apenas 1234,56
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
        // Formato US: 1,234.56 ou apenas 1234.56
        s = s.replace(/,/g, '');
    }
    
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

const mesMapLME = {
    'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
};

function parseDate(diaStr, currentYearStr) {
    if (!diaStr) return null;
    
    // Formato: "27/Abr"
    const parts = diaStr.split('/');
    if (parts.length === 2) {
        const d = parseInt(parts[0], 10);
        const mStr = parts[1].toLowerCase();
        let m = mesMapLME[mStr];
        if (m === undefined) return null;
        
        // Determina o ano. Se currentYearStr não for passado, usa o atual.
        const localTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        let y = currentYearStr ? parseInt(currentYearStr, 10) : new Date(localTimeStr).getFullYear();
        // Nota: O site pode ter 'Dez' no relatório de 'Jan/2026'.
        // Trataremos isso comparando se m=11 e o mês do relatório é 0.
        return new Date(y, m, d);
    }
    
    // Formato antigo: "dd/mm/yyyy"
    if (parts.length >= 3) {
        let [d, m, y] = parts.map(Number);
        if (y < 100) y += 2000;
        return new Date(y, m - 1, d);
    }
    return null;
}

function weekKey(dateObj) {
    // Semana começa na segunda-feira — retorna "YYYY-Www"
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    const year = d.getFullYear();
    const start = new Date(year, 0, 1);
    const weekNum = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function avg(arr) {
    const valid = arr.filter(v => v !== null && v !== undefined);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function getPreviousMonthStr(mesStr) {
    const parts = mesStr.split('-');
    if (parts.length !== 2) return null;
    let m = parseInt(parts[0], 10);
    let y = parseInt(parts[1], 10);
    if (m === 1) {
        m = 12;
        y = y - 1;
    } else {
        m = m - 1;
    }
    return `${m}-${y}`;
}



// ─── Cache em memória para LME (TTL: 10 minutos) ────────────────────────────
const lmeCache = new Map(); // key -> { data, ts }
const LME_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

async function fetchLMEWithCache(url) {
    const now = Date.now();
    const cached = lmeCache.get(url);
    if (cached && (now - cached.ts) < LME_CACHE_TTL) {
        return cached.data;
    }
    const { data } = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    lmeCache.set(url, { data, ts: now });
    return data;
}

async function generateRelatorioSemanas(mes) {
    // 1. Busca dados do mês atual
    let targetUrl = mes === 'atual' ? `https://shockmetais.com.br/lme/` : `https://shockmetais.com.br/lme/${mes}`;
    let html;
    try {
        html = await fetchLMEWithCache(targetUrl);
    } catch (err) {
        console.warn(`Erro no agendador ao buscar ${targetUrl}, tentando fallback para a home:`, err.message);
        targetUrl = `https://shockmetais.com.br/lme/`;
        html = await fetchLMEWithCache(targetUrl);
    }
    const $ = cheerio.load(html);

    // 2. Extrai opções de meses disponíveis
    const mesesDisponiveis = [];
    $('#meslme option').each((i, el) => {
        mesesDisponiveis.push({ valor: $(el).val(), texto: $(el).text().trim() });
    });

    let resolvedMes = mes;
    if (mes === 'atual' && mesesDisponiveis.length > 0) {
        resolvedMes = mesesDisponiveis[0].valor;
    }

    const reqParts = resolvedMes.split('-');
    const reqMonth = parseInt(reqParts[0], 10);
    const reqYearNum = parseInt(reqParts[1], 10);

    // Helper to extract rows
    function extractRows($, year) {
        const rows = [];
        $('#boxtabela table tbody tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length < 8) return;
            const isMedia   = $(tds[0]).hasClass('lmemedia');
            const isMensal  = $(tds[0]).hasClass('lmemensal');
            if (isMedia || isMensal) return;

            const diaStr = $(tds[0]).text().trim();
            const dateObj = parseDate(diaStr, year);
            if (!dateObj) return;

            rows.push({
                data:     diaStr,
                dateObj,
                cobre:    parseNum($(tds[1]).text()),
                zinco:    parseNum($(tds[2]).text()),
                aluminio: parseNum($(tds[3]).text()),
                chumbo:   parseNum($(tds[4]).text()),
                estanho:  parseNum($(tds[5]).text()),
                niquel:   parseNum($(tds[6]).text()),
                dolar:    parseNum($(tds[7]).text()),
            });
        });
        return rows;
    }

    const mainRows = extractRows($, reqYearNum);

    // Fetch previous month to get the preceding weeks for historical calculations
    let dailyRows = [...mainRows];
    const prevMes = getPreviousMonthStr(mes);
    if (prevMes) {
        try {
            const prevUrl = `https://shockmetais.com.br/lme/${prevMes}`;
            const { data: prevHtml } = await axios.get(prevUrl, { timeout: 10000 });
            const $prev = cheerio.load(prevHtml);
            const prevYearNum = parseInt(prevMes.split('-')[1], 10);
            const prevRows = extractRows($prev, prevYearNum);

            const existingTimes = new Set(mainRows.map(r => r.dateObj.getTime()));
            prevRows.forEach(r => {
                if (!existingTimes.has(r.dateObj.getTime())) {
                    dailyRows.push(r);
                }
            });
        } catch (err) {
            console.warn(`Could not fetch previous month ${prevMes}:`, err.message);
        }
    }

    // Sort chronologically
    dailyRows.sort((a, b) => a.dateObj - b.dateObj);

    const METALS = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];

    // 4. Agrupa por semana
    const weekMap = new Map();
    dailyRows.forEach(row => {
        const wk = weekKey(row.dateObj);
        if (!weekMap.has(wk)) weekMap.set(wk, []);
        weekMap.get(wk).push(row);
    });

    // 5. Pré-calcula 100% LME de cada semana (necessário para semanaAnterior e mediaMensal)
    const allWeekLME = {}; // wk -> {metal: valor100pct}
    weekMap.forEach((days, wk) => {
        const entry = {};
        METALS.forEach(m => {
            const mediaMetal = avg(days.map(d => d[m]));
            const mediaDolar = avg(days.map(d => d.dolar));
            entry[m] = (mediaMetal !== null && mediaDolar !== null)
                ? (mediaMetal * mediaDolar) / 1000 : null;
        });
        entry.dolar = avg(days.map(d => d.dolar));
        allWeekLME[wk] = entry;
    });

    // 6. Monta blocos semanais com todos os cálculos
    const sortedWeekKeys = [...weekMap.keys()].sort();
    const weekBlocks = sortedWeekKeys.map((wk, idx) => {
        const days = weekMap.get(wk);
        const prevWk = idx > 0 ? sortedWeekKeys[idx - 1] : null;
        const prevLME = prevWk ? allWeekLME[prevWk] : null;
        const prevPrevWk = idx > 1 ? sortedWeekKeys[idx - 2] : null;

        // Médias semanais
        const mediaSemanal = {};
        METALS.forEach(m => { mediaSemanal[m] = avg(days.map(d => d[m])); });
        mediaSemanal.dolar = avg(days.map(d => d.dolar));

        // 100% LME = (média_metal * média_dolar) / 1000
        const lme100 = {};
        METALS.forEach(m => {
            lme100[m] = (mediaSemanal[m] !== null && mediaSemanal.dolar !== null)
                ? (mediaSemanal[m] * mediaSemanal.dolar) / 1000 : null;
        });
        lme100.dolar = mediaSemanal.dolar;

        // SEMANA ANTERIOR = 100% LME da semana anterior
        const semanaAnterior = {};
        METALS.forEach(m => { semanaAnterior[m] = prevLME ? prevLME[m] : null; });
        semanaAnterior.dolar = prevLME ? prevLME.dolar : null;

        // OSCILAÇÃO R$ = 100% LME - SEMANA ANTERIOR
        const oscRS = {};
        METALS.forEach(m => {
            oscRS[m] = (lme100[m] !== null && semanaAnterior[m] !== null)
                ? lme100[m] - semanaAnterior[m] : null;
        });
        oscRS.dolar = (lme100.dolar !== null && semanaAnterior.dolar !== null)
            ? lme100.dolar - semanaAnterior.dolar : null;

        // OSCILAÇÃO % = oscRS / semanaAnterior
        const oscPct = {};
        METALS.forEach(m => {
            oscPct[m] = (oscRS[m] !== null && semanaAnterior[m] !== null && semanaAnterior[m] !== 0)
                ? oscRS[m] / semanaAnterior[m] : null;
        });
        oscPct.dolar = (oscRS.dolar !== null && semanaAnterior.dolar !== null && semanaAnterior.dolar !== 0)
            ? oscRS.dolar / semanaAnterior.dolar : null;

        // FECHAMENTO % (SEMANA ANTERIOR) = OSCILAÇÃO % da semana anterior
        const fechamentoPct = {};
        if (prevPrevWk) {
            const prevPrevLME = allWeekLME[prevPrevWk];
            METALS.forEach(m => {
                const osc = (prevLME && prevPrevLME && prevLME[m] !== null && prevPrevLME[m] !== null && prevPrevLME[m] !== 0)
                    ? (prevLME[m] - prevPrevLME[m]) / prevPrevLME[m] : null;
                fechamentoPct[m] = osc;
            });
            fechamentoPct.dolar = (prevLME && prevPrevLME && prevLME.dolar !== null && prevPrevLME.dolar !== null && prevPrevLME.dolar !== 0)
                ? (prevLME.dolar - prevPrevLME.dolar) / prevPrevLME.dolar : null;
        } else {
            [...METALS, 'dolar'].forEach(m => { fechamentoPct[m] = null; });
        }

        // Formata dias para exibição (pad até 5 dias)
        const daysDisplay = [];
        for (let i = 0; i < 5; i++) {
            daysDisplay.push(days[i] ? {
                data:     days[i].data,
                cobre:    days[i].cobre,
                zinco:    days[i].zinco,
                aluminio: days[i].aluminio,
                chumbo:   days[i].chumbo,
                estanho:  days[i].estanho,
                niquel:   days[i].niquel,
                dolar:    days[i].dolar,
            } : { data: '—', cobre: null, zinco: null, aluminio: null, chumbo: null, estanho: null, niquel: null, dolar: null });
        }

        const firstDate = days[0].data;
        const lastDate  = days[days.length - 1].data;
        const numDias = days.length;

        // Média Mensal: apenas semanas FECHADAS anteriores à atual
        const mediaMensal = {};
        METALS.forEach(m => {
            const vals = sortedWeekKeys.slice(0, idx)
                .map(k => allWeekLME[k][m])
                .filter(v => v !== null);
            mediaMensal[m] = vals.length ? avg(vals) : null;
        });
        const prevDailyDolar = sortedWeekKeys.slice(0, idx)
            .flatMap(k => weekMap.get(k).map(d => d.dolar))
            .filter(v => v !== null);
        mediaMensal.dolar = prevDailyDolar.length ? avg(prevDailyDolar) : null;

        return {
            weekKey: wk,
            header:  firstDate,
            lastDay: lastDate,
            label:   `${firstDate} a ${lastDate}`,
            numDias,
            days:    daysDisplay,
            computed: {
                'MEDIA SEMANAL':                    mediaSemanal,
                '100% LME':                         lme100,
                'SEMANA ANTERIOR':                  semanaAnterior,
                'FECHAMENTO % ( SEMANA ANTERIOR )': fechamentoPct,
                'OSCILAÇÃO %':                      oscPct,
                'OSCILAÇÃO R$':                     oscRS,
                'MEDIA MENSAL':                     mediaMensal,
            }
        };
    });

    const filteredBlocks = weekBlocks.filter(block => {
        const days = weekMap.get(block.weekKey);
        return days.some(d => {
            const m = d.dateObj.getMonth() + 1;
            const y = d.dateObj.getFullYear();
            return m === reqMonth && y === reqYearNum;
        });
    });

    return { semanas: filteredBlocks, mesesDisponiveis };
}

app.get('/api/lme/relatorio-semanal', async (req, res) => {
    try {
        const mes = req.query.mes || 'atual';

        const data = await generateRelatorioSemanas(mes);
        res.json({ semanas: [...data.semanas].reverse(), mesesDisponiveis: data.mesesDisponiveis });
    } catch (err) {
        console.error('Erro GET /api/lme/relatorio-semanal:', err.message);
        res.status(500).json({ error: 'Erro ao gerar relatório semanal LME: ' + err.message });
    }
});

// ─── API: LME Destinatários (CRUD) ─────────────────────────────────────────────
app.get('/api/lme/destinatarios', async (req, res) => {
    try {
        const tipo = req.query.tipo || 'lme';
        if (dbAvailable) {
            const result = await pool.query("SELECT * FROM lme_destinatarios WHERE COALESCE(tipo, 'lme') = $1 ORDER BY nome ASC", [tipo]);
            return res.json(result.rows);
        }
        const filtered = (memStore.lme_destinatarios || []).filter(d => (d.tipo || 'lme') === tipo);
        res.json(filtered.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (err) {
        console.error('Erro GET /api/lme/destinatarios:', err);
        res.status(500).json({ error: 'Erro ao buscar destinatários.' });
    }
});

app.post('/api/lme/destinatarios', async (req, res) => {
    try {
        const { nome, email, tipo = 'lme' } = req.body;
        if (!nome || !email) return res.status(400).json({ error: 'nome e email são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO lme_destinatarios (nome, email, tipo) VALUES ($1, $2, $3) RETURNING *',
                [nome, email, tipo]
            );
            return res.status(201).json(result.rows[0]);
        }
        if ((memStore.lme_destinatarios || []).some(d => d.email.toLowerCase() === email.toLowerCase() && (d.tipo || 'lme') === tipo)) {
            return res.status(400).json({ error: 'E-mail já cadastrado nesta lista.' });
        }
        const item = { id: nextId++, nome, email, tipo, criado_em: new Date().toISOString() };
        memStore.lme_destinatarios.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/lme/destinatarios:', err);
        res.status(500).json({ error: 'Erro ao criar destinatário.' });
    }
});

app.put('/api/lme/destinatarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, tipo = 'lme' } = req.body;
        if (!nome || !email) return res.status(400).json({ error: 'nome e email são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'UPDATE lme_destinatarios SET nome=$1, email=$2, tipo=$3 WHERE id=$4 RETURNING *',
                [nome, email, tipo, id]
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Destinatário não encontrado.' });
            return res.json(result.rows[0]);
        }
        const idx = memStore.lme_destinatarios.findIndex(d => d.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Destinatário não encontrado.' });
        Object.assign(memStore.lme_destinatarios[idx], { nome, email, tipo });
        res.json(memStore.lme_destinatarios[idx]);
    } catch (err) {
        console.error('Erro PUT /api/lme/destinatarios:', err);
        res.status(500).json({ error: 'Erro ao atualizar destinatário.' });
    }
});

app.delete('/api/lme/destinatarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM lme_destinatarios WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Destinatário não encontrado.' });
            return res.json({ success: true });
        }
        const idx = memStore.lme_destinatarios.findIndex(d => d.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Destinatário não encontrado.' });
        memStore.lme_destinatarios.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/lme/destinatarios:', err);
        res.status(500).json({ error: 'Erro ao remover destinatário.' });
    }
});

// ─── API: LME Enviar Relatório Manual ──────────────────────────────────────────
app.post('/api/lme/enviar-agora', async (req, res) => {
    try {
        const localTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const dObj = new Date(localTimeStr);
        const mes = `${dObj.getMonth() + 1}-${dObj.getFullYear()}`;
        let data = await generateRelatorioSemanas(mes);
        if (!data || !data.semanas || data.semanas.length === 0) {
            data = await generateRelatorioSemanas('atual');
        }
        if (!data || !data.semanas || data.semanas.length === 0) {
            return res.status(404).json({ error: 'Nenhuma semana encontrada para enviar.' });
        }
        const latestWeek = data.semanas[data.semanas.length - 1];
        await enviarRelatorioEmail(latestWeek);
        res.json({ success: true, message: 'Relatório LME enviado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/lme/enviar-email-manual', async (req, res) => {
    try {
        const localTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const dObj = new Date(localTimeStr);
        const month = dObj.getMonth() + 1;
        const year = dObj.getFullYear();
        const mes = `${month}-${year}`;

        let data = await generateRelatorioSemanas(mes);
        if (!data || !data.semanas || data.semanas.length === 0) {
            data = await generateRelatorioSemanas('atual');
        }
        if (!data || !data.semanas || data.semanas.length === 0) {
            return res.status(404).json({ error: 'Nenhuma semana encontrada para enviar.' });
        }

        const latestWeek = data.semanas[data.semanas.length - 1];
        const pdfBase64 = req.body && req.body.pdfBase64 ? req.body.pdfBase64 : null;

        await enviarRelatorioEmail(latestWeek, pdfBase64);

        res.json({ success: true, message: 'Relatório enviado com sucesso!' });
    } catch (err) {
        console.error('Erro no envio manual de e-mail:', err);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + err.message });
    }
});

app.post('/api/tabela-precos/enviar-email', async (req, res) => {
    try {
        let pdfBase64 = req.body && req.body.pdfBase64 ? req.body.pdfBase64 : null;
        const modo = (req.body && req.body.modo) || 'fornecedor';
        const emailDestino = (req.body && req.body.email) || null;
        if (!pdfBase64) {
            console.log(`📄 Gerando PDF da Tabela de Preços (${modo}) via Puppeteer no backend...`);
            pdfBase64 = await gerarPdfTabelaPrecosViaHeadless(modo);
        }
        if (!pdfBase64) {
            return res.status(500).json({ error: 'Não foi possível obter ou gerar o PDF da tabela de preços.' });
        }
        await enviarTabelaPrecosEmail(pdfBase64, modo, emailDestino);
        const nomeModo = modo === 'completa' ? 'Geral Completa' : 'Fornecedor';
        res.json({ success: true, message: `Tabela de preços (${nomeModo}) enviada por e-mail com sucesso!` });
    } catch (err) {
        console.error('Erro no envio da tabela de preços por e-mail:', err);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + err.message });
    }
});

app.post('/api/lme/html-relatorio', (req, res) => {
    try {
        const { weekBlock } = req.body;
        if (!weekBlock) {
            return res.status(400).json({ error: 'weekBlock is required' });
        }
        const html = gerarHtmlRelatorio(weekBlock);
        res.send(html);
    } catch (err) {
        console.error('Error generating HTML report:', err);
        res.status(500).json({ error: 'Error generating report: ' + err.message });
    }
});

// ─── Helpers de Formatação e Envio de E-mail ──────────────────────────────────
const nodemailer = require('nodemailer');

const fmtUSD = (val) => {
    if (val === null || val === undefined || val === 'feriado' || isNaN(val)) return '—';
    return '$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};
const fmtBRL = (val, dec = 3) => {
    if (val === null || val === undefined || val === 'feriado' || isNaN(val)) return '—';
    return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
const fmtPct = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return (val * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
};
const fmtVar = (val, type, textColor = '#000000', dec = 3) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const num = Number(val);
    let arrow = '';
    if (num > 0) {
        arrow = `<span style="color: #00B050 !important; font-weight: bold; margin-right: 4px;">▲</span>`;
    } else if (num < 0) {
        arrow = `<span style="color: #FF0000 !important; font-weight: bold; margin-right: 4px;">▼</span>`;
    }
    let txt = '';
    if (type === 'pct') {
        txt = (num * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
    } else {
        txt = 'R$ ' + Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }
    return `${arrow}<span style="color: ${textColor} !important;">${txt}</span>`;
};

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekHeaderInfo(firstDateStr) {
    const localTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const today = new Date(localTimeStr);
    const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dateText = `${today.getDate()} de ${monthNames[today.getMonth()]}`;
    const weekNum = getISOWeek(today);
    return { dateText, weekNum };
}

function generateQuickChartUrl(labels, dataAtu, dataAnt, title) {
    const bgAnt = [];
    const borderAnt = [];
    const bgAtu = [];
    const borderAtu = [];

    for (let i = 0; i < labels.length; i++) {
        const valAtu = dataAtu[i] || 0;
        const valAnt = dataAnt[i] || 0;
        if (valAtu > valAnt) {
            // Atual foi melhor (Verde), Anterior foi pior (Vermelho)
            bgAtu.push('#27ae60');
            borderAtu.push('#1e8449');
            bgAnt.push('#e74c3c');
            borderAnt.push('#c0392b');
        } else {
            // Atual foi pior (Vermelho), Anterior foi melhor (Verde)
            bgAtu.push('#e74c3c');
            borderAtu.push('#c0392b');
            bgAnt.push('#27ae60');
            borderAnt.push('#1e8449');
        }
    }

    const chartConfig = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Semana Anterior',
                    backgroundColor: bgAnt,
                    borderColor: borderAnt,
                    borderWidth: 1,
                    data: dataAnt
                },
                {
                    label: 'Semana Atual',
                    backgroundColor: bgAtu,
                    borderColor: borderAtu,
                    borderWidth: 1,
                    data: dataAtu
                }
            ]
        },
        options: {
            title: {
                display: true,
                text: title,
                position: 'bottom',
                fontColor: '#222222',
                fontSize: 13,
                fontFamily: 'Calibri'
            },
            legend: {
                display: false
            },
            layout: { padding: { top: 90, right: 8, left: 8, bottom: 8 } },
            plugins: {
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    rotation: -90,
                    color: '#111111',
                    font: {
                        weight: 'bold',
                        size: 9
                    },
                    formatter: 'datalabels_formatter'
                }
            },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true,
                        fontColor: '#444',
                        callback: 'callback_y'
                    },
                    gridLines: { color: 'rgba(0,0,0,0.06)' }
                }],
                xAxes: [{
                    ticks: { fontColor: '#222', fontWeight: 'bold' },
                    gridLines: { display: false }
                }]
            }
        }
    };

    const configStr = JSON.stringify(chartConfig)
        .replace('"callback_y"', 'function(v) { return "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }); }')
        .replace('"datalabels_formatter"', 'function(value, ctx) { var prefix = ctx.dataset.label === "Semana Anterior" ? "Ant: " : "Atu: "; return prefix + "R$ " + Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }');

    const encodedConfig = encodeURIComponent(configStr);
    return `https://quickchart.io/chart?w=800&h=350&bkg=%23ffffff&c=${encodedConfig}`;
}

function generateKpiCard(metalName, key, comp) {
    const atual = comp['100% LME']?.[key] || 0;
    const anterior = comp['SEMANA ANTERIOR']?.[key] || 0;
    const diff = atual - anterior;
    const isUp = diff > 0;
    const isDown = diff < 0;
    const arrow = isUp ? '▲' : isDown ? '▼' : '–';
    const color = isUp ? '#1a7f4b' : isDown ? '#c0392b' : '#555';
    const bg = isUp ? '#e9f7f0' : isDown ? '#fdecea' : '#f5f5f5';
    const border = isUp ? '#a8dfc4' : isDown ? '#f5b8b2' : '#ddd';

    const fmtR = (val) => {
        return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    };

    return `
    <div style="display: inline-block; width: 140px; margin: 6px; padding: 10px; border: 1.5px solid ${border}; background-color: ${bg}; border-radius: 6px; text-align: center; vertical-align: top; font-family: Calibri, Arial, sans-serif; box-sizing: border-box;">
        <div style="font-size: 8pt; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 2px;">${metalName}</div>
        <div style="font-size: 10pt; font-weight: bold; color: ${color}; margin: 4px 0;">
            ${arrow} ${fmtR(atual)}
        </div>
        <div style="font-size: 7.5pt; color: #777;">era ${fmtR(anterior)}</div>
        <div style="font-size: 7.5pt; font-weight: bold; color: ${color}; margin-top: 2px;">
            ${isUp ? '+' : isDown ? '-' : ''}${fmtR(Math.abs(diff))}
        </div>
    </div>
    `;
}

function gerarHtmlRelatorio(weekBlock) {
    const fs = require('fs');
    const path = require('path');

    const label = weekBlock.label;
    const days = weekBlock.days || [];
    const comp = weekBlock.computed || {};

    const metals = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];
    
    const firstDate = (days && days.filter(d => d.data && d.data !== '—')[0]?.data) || '';
    const lastDate  = (days && days.filter(d => d.data && d.data !== '—').pop()?.data)  || '';

    let referenceDate = new Date();
    if (firstDate && firstDate.includes('/')) {
        const parts = firstDate.split('/');
        if (parts.length >= 2) {
            const yr = new Date().getFullYear();
            const monthMap = { 'jan':1,'fev':2,'mar':3,'abr':4,'mai':5,'jun':6,'jul':7,'ago':8,'set':9,'out':10,'nov':11,'dez':12 };
            const monthAbbr = parts[1].toLowerCase().replace('.','').trim();
            const monthNum = monthMap[monthAbbr] || parseInt(parts[1], 10) || (new Date().getMonth() + 1);
            const dayNum = parseInt(parts[0], 10) || 1;
            referenceDate = new Date(yr, monthNum - 1, dayNum);
        }
    }
    const weekNum = getISOWeek(referenceDate);
    const dateRangeStr = label || (firstDate && lastDate ? `${firstDate} a ${lastDate}` : 'Semana');

    const numDias = weekBlock.numDias !== undefined ? weekBlock.numDias : days.filter(d => d.cobre !== null && d.cobre !== undefined && d.cobre !== 'feriado').length;

    const chartGroup1 = generateQuickChartUrl(
        ['COBRE', 'ZINCO', 'ALUMÍNIO', 'CHUMBO'],
        [comp['100% LME']?.cobre || 0, comp['100% LME']?.zinco || 0, comp['100% LME']?.aluminio || 0, comp['100% LME']?.chumbo || 0],
        [comp['SEMANA ANTERIOR']?.cobre || 0, comp['SEMANA ANTERIOR']?.zinco || 0, comp['SEMANA ANTERIOR']?.aluminio || 0, comp['SEMANA ANTERIOR']?.chumbo || 0],
        'Cobre · Zinco · Alumínio · Chumbo'
    );

    const chartGroup2 = generateQuickChartUrl(
        ['ESTANHO', 'NÍQUEL'],
        [comp['100% LME']?.estanho || 0, comp['100% LME']?.niquel || 0],
        [comp['SEMANA ANTERIOR']?.estanho || 0, comp['SEMANA ANTERIOR']?.niquel || 0],
        'Estanho · Níquel'
    );

    let logoUrl = 'https://apextechmetais.com.br/assets/img/apexlogo.png';
    let watermarkBase64 = '';
    try {
        const logoFile = path.join(__dirname, 'assets/img/apexlogo.png');
        if (fs.existsSync(logoFile)) {
            logoUrl = 'data:image/png;base64,' + fs.readFileSync(logoFile).toString('base64');
        }
        const wmFile = path.join(__dirname, 'assets/img/logo (2).png');
        if (fs.existsSync(wmFile)) {
            watermarkBase64 = 'data:image/png;base64,' + fs.readFileSync(wmFile).toString('base64');
        }
    } catch (e) {
        console.warn('Aviso ao carregar imagens locais:', e.message);
    }

    const metalColStyles = {
        cobre: 'background-color: #FF8B9B; color: #000000;',
        zinco: 'background-color: #E6B8B7; color: #3d1a1a;',
        aluminio: 'background-color: #BFBFBF; color: #111111;',
        chumbo: 'background-color: #C9A8E8; color: #2d0060;',
        estanho: 'background-color: #B5B059; color: #3a3000;',
        niquel: 'background-color: #FFFFFF; color: #222222; border: 1px solid #ddd;',
        dolar: 'background-color: #70AD47; color: #1a4000;'
    };

    let html = `
    <div id="capture-area" class="capture-area" style="position: relative; width: 800px; margin: 0 auto; background: #ffffff; padding: 20px; font-family: Calibri, Arial, sans-serif; color: #333333; box-sizing: border-box; border: 1px solid #ddd;">
        ${watermarkBase64 ? `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url('${watermarkBase64}'); background-size: 150px 150px; background-repeat: repeat; background-position: top left; opacity: 0.05; pointer-events: none; z-index: 1;"></div>` : ''}
        <div style="position: relative; z-index: 2;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="width: 40%; vertical-align: middle; text-align: left; padding: 5px;">
                    <img src="${logoUrl}" alt="Apextech Metais" style="max-height: 48px; max-width: 100%; display: block;">
                </td>
                <td style="width: 60%; vertical-align: middle; padding: 5px;">
                    <div style="background: #ffff00; border: 2px solid #000000; padding: 10px; text-align: center; font-family: Arial, sans-serif; border-radius: 4px;">
                        <div style="font-size: 7.5pt; font-weight: bold; color: #000000; letter-spacing: 0.8px; margin-bottom: 2px; text-transform: uppercase;">COTAÇÃO VÁLIDA PARA A SEMANA</div>
                        <div style="font-size: 13.5pt; font-weight: bold; color: #000000;">${dateRangeStr} &mdash; Semana ${weekNum}</div>
                    </div>
                </td>
            </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 10pt; font-family: Calibri, Arial, sans-serif; border: 1px solid #ddd;">
            <thead>
                <tr>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #000000; color: #ffffff;">DATA</th>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #db1f1f; color: #000000;">Cobre U$/t</th>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #e6b8b7; color: #000000;">Zinco U$/t</th>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #bfbfbf; color: #000000;">Alumínio U$/t</th>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #C9A8E8; color: #2d0060;">Chumbo U$/t</th>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #b5b059; color: #000000;">Estanho U$/t</th>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #ffffff; color: #000000;">Níquel U$/t</th>
                    <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background: #70ad47; color: #000000;">Dólar US$</th>
                </tr>
            </thead>
            <tbody>
    `;

    days.forEach(d => {
        html += `
            <tr>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #000000;">${d.data || '—'}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.cobre}">${fmtUSD(d.cobre)}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.zinco}">${fmtUSD(d.zinco)}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.aluminio}">${fmtUSD(d.aluminio)}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.chumbo}">${fmtUSD(d.chumbo)}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.estanho}">${fmtUSD(d.estanho)}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.niquel}">${fmtUSD(d.niquel)}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #e2efda; color: #000000;">${fmtBRL(d.dolar, 4)}</td>
            </tr>
        `;
    });

    for (let i = days.length; i < 5; i++) {
        html += `
            <tr style="color: #999;">
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #999;">—</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.cobre}">-</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.zinco}">-</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.aluminio}">-</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.chumbo}">-</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.estanho}">-</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.niquel}">-</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #e2efda; color: #999;">-</td>
            </tr>
        `;
    }

    const mediaLabelText = numDias < 5 ? `MÉDIA SEMANAL <span style="font-size:0.65em;font-weight:normal;opacity:0.7;font-style:italic">(${numDias} dias úteis)</span>` : 'MÉDIA SEMANAL';

    html += `
        <tr style="background-color: #fde9d9; font-weight: bold; color: #000000;">
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #000000; background-color: #fde9d9;">${mediaLabelText}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.cobre}">${fmtUSD(comp['MEDIA SEMANAL'].cobre)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.zinco}">${fmtUSD(comp['MEDIA SEMANAL'].zinco)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.aluminio}">${fmtUSD(comp['MEDIA SEMANAL'].aluminio)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.chumbo}">${fmtUSD(comp['MEDIA SEMANAL'].chumbo)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.estanho}">${fmtUSD(comp['MEDIA SEMANAL'].estanho)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.niquel}">${fmtUSD(comp['MEDIA SEMANAL'].niquel)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #c6e0b4; color: #000000;">${fmtBRL(comp['MEDIA SEMANAL'].dolar, 4)}</td>
        </tr>
        <tr style="background-color: #ffff00; font-weight: bold; color: #000000;">
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #000000; background-color: #ffff00;">100% LME</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #ffff00; color: #000000;">${fmtBRL(comp['100% LME'].cobre)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #ffff00; color: #000000;">${fmtBRL(comp['100% LME'].zinco)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #ffff00; color: #000000;">${fmtBRL(comp['100% LME'].aluminio)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #ffff00; color: #000000;">${fmtBRL(comp['100% LME'].chumbo)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #ffff00; color: #000000;">${fmtBRL(comp['100% LME'].estanho)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #ffff00; color: #000000;">${fmtBRL(comp['100% LME'].niquel)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #ffffff; color: #000000;"></td>
        </tr>
        <tr style="background-color: #000000; font-weight: bold; color: #ffffff;">
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #ffffff; background-color: #000000;">SEMANA ANTERIOR</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #000000; color: #ffffff;">${fmtBRL(comp['SEMANA ANTERIOR'].cobre)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #000000; color: #ffffff;">${fmtBRL(comp['SEMANA ANTERIOR'].zinco)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #000000; color: #ffffff;">${fmtBRL(comp['SEMANA ANTERIOR'].aluminio)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #000000; color: #ffffff;">${fmtBRL(comp['SEMANA ANTERIOR'].chumbo)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #000000; color: #ffffff;">${fmtBRL(comp['SEMANA ANTERIOR'].estanho)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #000000; color: #ffffff;">${fmtBRL(comp['SEMANA ANTERIOR'].niquel)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #000000; color: #ffffff;">${fmtBRL(comp['SEMANA ANTERIOR'].dolar, 4)}</td>
        </tr>
        <tr style="background-color: #A6A6A6; font-size: 9pt; color: #000000;">
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; color: #000000; background-color: #A6A6A6;">FECHAMENTO % (SEMANA ANTERIOR)</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #A6A6A6;">${fmtVar(comp['FECHAMENTO % ( SEMANA ANTERIOR )'].cobre, 'pct', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #A6A6A6;">${fmtVar(comp['FECHAMENTO % ( SEMANA ANTERIOR )'].zinco, 'pct', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #A6A6A6;">${fmtVar(comp['FECHAMENTO % ( SEMANA ANTERIOR )'].aluminio, 'pct', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #A6A6A6;">${fmtVar(comp['FECHAMENTO % ( SEMANA ANTERIOR )'].chumbo, 'pct', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #A6A6A6;">${fmtVar(comp['FECHAMENTO % ( SEMANA ANTERIOR )'].estanho, 'pct', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #A6A6A6;">${fmtVar(comp['FECHAMENTO % ( SEMANA ANTERIOR )'].niquel, 'pct', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; background-color: #A6A6A6; color: #000000;">${fmtVar(comp['FECHAMENTO % ( SEMANA ANTERIOR )'].dolar, 'pct', '#000000')}</td>
        </tr>
        <tr style="background-color: #A6A6A6; font-weight: bold; font-size: 9pt; color: #ffffff;">
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; color: #ffffff; background-color: #A6A6A6;">OSCILAÇÃO %</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #0070c0;">${fmtVar(comp['OSCILAÇÃO %'].cobre, 'pct', '#ffffff')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #0070c0;">${fmtVar(comp['OSCILAÇÃO %'].zinco, 'pct', '#ffffff')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #0070c0;">${fmtVar(comp['OSCILAÇÃO %'].aluminio, 'pct', '#ffffff')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #0070c0;">${fmtVar(comp['OSCILAÇÃO %'].chumbo, 'pct', '#ffffff')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #0070c0;">${fmtVar(comp['OSCILAÇÃO %'].estanho, 'pct', '#ffffff')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #0070c0;">${fmtVar(comp['OSCILAÇÃO %'].niquel, 'pct', '#ffffff')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #c6e0b4; color: #000000;">${fmtVar(comp['OSCILAÇÃO %'].dolar, 'pct', '#000000')}</td>
        </tr>
        <tr style="background-color: #A6A6A6; font-weight: bold; font-size: 9pt; color: #000000;">
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; color: #000000; background-color: #A6A6A6;">OSCILAÇÃO R$</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #A6A6A6;">${fmtVar(comp['OSCILAÇÃO R$'].cobre, 'brl', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #A6A6A6;">${fmtVar(comp['OSCILAÇÃO R$'].zinco, 'brl', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #A6A6A6;">${fmtVar(comp['OSCILAÇÃO R$'].aluminio, 'brl', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #A6A6A6;">${fmtVar(comp['OSCILAÇÃO R$'].chumbo, 'brl', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #A6A6A6;">${fmtVar(comp['OSCILAÇÃO R$'].estanho, 'brl', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #A6A6A6;">${fmtVar(comp['OSCILAÇÃO R$'].niquel, 'brl', '#000000')}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 9pt; background-color: #A6A6A6; color: #000000;">${fmtVar(comp['OSCILAÇÃO R$'].dolar, 'brl', '#000000', 4)}</td>
        </tr>
        <tr style="background-color: #fde9d9; font-weight: bold; color: #000000;">
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #000000; background-color: #fde9d9;">MÉDIA MENSAL</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.cobre}">${fmtBRL(comp['MEDIA MENSAL'].cobre)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.zinco}">${fmtBRL(comp['MEDIA MENSAL'].zinco)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.aluminio}">${fmtBRL(comp['MEDIA MENSAL'].aluminio)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.chumbo}">${fmtBRL(comp['MEDIA MENSAL'].chumbo)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.estanho}">${fmtBRL(comp['MEDIA MENSAL'].estanho)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.niquel}">${fmtBRL(comp['MEDIA MENSAL'].niquel)}</td>
            <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color: #c6e0b4; color: #000000;">${fmtBRL(comp['MEDIA MENSAL'].dolar, 4)}</td>
        </tr>
                </tbody>
            </table>

            <div style="font-size: 11pt; font-weight: bold; margin: 25px 0 10px 0; color: #000; text-transform: uppercase; text-align: center; font-family: Raleway, Calibri, Arial, sans-serif;">Tabela Comparativa (R$/kg)</div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 10pt; font-family: Calibri, Arial, sans-serif; border: 1px solid #ddd;">
                <thead>
                    <tr style="background:#595959; color:#ffffff;">
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#000000; color:#ffffff; width: 120px;">TIPO</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#db1f1f; color:#000000;">Cobre R$/kg</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#e6b8b7; color:#000000;">Zinco R$/kg</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#bfbfbf; color:#000000;">Alumínio R$/kg</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#C9A8E8; color:#2d0060;">Chumbo R$/kg</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#b5b059; color:#000000;">Estanho R$/kg</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#ffffff; color:#000000;">Níquel R$/kg</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#70ad47; color:#000000;">Dólar R$</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#eaeaea; color:#0070c0;">
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">SEMANA ANTERIOR</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">${fmtBRL(comp['SEMANA ANTERIOR'].cobre)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">${fmtBRL(comp['SEMANA ANTERIOR'].zinco)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">${fmtBRL(comp['SEMANA ANTERIOR'].aluminio)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">${fmtBRL(comp['SEMANA ANTERIOR'].chumbo)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">${fmtBRL(comp['SEMANA ANTERIOR'].estanho)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">${fmtBRL(comp['SEMANA ANTERIOR'].niquel)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color:#0070c0; background-color: #eaeaea;">${fmtBRL(comp['SEMANA ANTERIOR'].dolar, 4)}</td>
                    </tr>
                    <tr style="font-weight:bold; color: #000000;">
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #000000;">LME ATUAL</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.cobre}">${fmtBRL(comp['100% LME'].cobre)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.zinco}">${fmtBRL(comp['100% LME'].zinco)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.aluminio}">${fmtBRL(comp['100% LME'].aluminio)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.chumbo}">${fmtBRL(comp['100% LME'].chumbo)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.estanho}">${fmtBRL(comp['100% LME'].estanho)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.niquel}">${fmtBRL(comp['100% LME'].niquel)}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color:#c6e0b4; color: #000000;">${fmtBRL(comp['100% LME'].dolar, 4)}</td>
                    </tr>
                    <tr style="font-weight:bold; color: #000000;">
                        <td style="padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; color: #000000;">Oscilaçao</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.cobre}">${fmtVar(comp['OSCILAÇÃO R$'].cobre, 'brl', '#000000')}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.zinco}">${fmtVar(comp['OSCILAÇÃO R$'].zinco, 'brl', '#000000')}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.aluminio}">${fmtVar(comp['OSCILAÇÃO R$'].aluminio, 'brl', '#000000')}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.chumbo}">${fmtVar(comp['OSCILAÇÃO R$'].chumbo, 'brl', '#000000')}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.estanho}">${fmtVar(comp['OSCILAÇÃO R$'].estanho, 'brl', '#000000')}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${metalColStyles.niquel}">${fmtVar(comp['OSCILAÇÃO R$'].niquel, 'brl', '#000000')}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; background-color:#c6e0b4; color: #000000;">${fmtVar(comp['OSCILAÇÃO R$'].dolar, 'brl', '#000000', 4)}</td>
                    </tr>
                </tbody>
            </table>

            <div style="font-size: 11pt; font-weight: bold; margin: 25px 0 10px 0; color: #000; text-transform: uppercase; text-align: center; font-family: Raleway, Calibri, Arial, sans-serif;">VALORES BASE DE 90% A 110% X LME DA SEMANA X DOLAR</div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 10pt; font-family: Calibri, Arial, sans-serif; border: 1px solid #ddd;">
                <thead>
                    <tr>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; width:50px; background:#000000; color:#ffffff;">%</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#db1f1f; color:#000000;">COBRE</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#e6b8b7; color:#000000;">ZINCO</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#bfbfbf; color:#000000;">ALUMÍNIO</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#C9A8E8; color:#2d0060;">CHUMBO</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#b5b059; color:#000000;">ESTANHO</th>
                        <th style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 11pt; background:#ffffff; color:#000000;">NÍQUEL</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (let p = 90; p <= 110; p++) {
        let pStyle = '';
        if (p < 100) {
            pStyle = 'background-color: #fdecea;';
        } else if (p === 100) {
            pStyle = 'background-color: #000000; color: #ffffff;';
        } else {
            pStyle = 'background-color: #e9f7f0;';
        }

        html += `<tr><td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${pStyle}">${p === 100 ? '<strong>100%</strong>' : p + '%'}</td>`;
        metals.forEach(m => {
            const lme = comp['SEMANA ANTERIOR']?.[m] ?? null;
            let cellStyle = '';
            
            if (p === 100) {
                cellStyle = 'background-color: #000000; color: #ffffff;';
            } else {
                if (m === 'cobre') cellStyle = 'background-color: #ffcccc; color: #000000;';
                else if (m === 'zinco') cellStyle = 'background-color: #f2dcdd; color: #000000;';
                else if (m === 'aluminio') cellStyle = 'background-color: #EDE9ED; color: #000000;';
                else if (m === 'chumbo') cellStyle = 'background-color: #f2f2f2; color: #000000;';
                else if (m === 'estanho') cellStyle = 'background-color: #d9d4a8; color: #000000;';
                else if (m === 'niquel') cellStyle = 'background-color: #ffffff; color: #000000;';
            }

            if (lme === null) {
                html += `<td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${cellStyle}">-</td>`;
            } else {
                const baseVal = lme * (p / 100);
                html += `<td style="padding: 8px; text-align: center; border: 1px solid #ddd; font-weight: bold; font-size: 10pt; ${cellStyle}">${fmtBRL(baseVal, 3)}</td>`;
            }
        });
        html += `</tr>`;
    }

    html += `
                </tbody>
            </table>

            <div style="font-size: 11pt; font-weight: bold; margin: 25px 0 10px 0; color: #000; text-transform: uppercase; text-align: center; font-family: Raleway, Calibri, Arial, sans-serif;">Gráficos de Comparação de Cotações</div>
            
            <div style="font-family: Calibri, Arial, sans-serif; font-size: 10pt; margin-bottom: 12px; text-align: center; font-weight: bold;">
                <span style="display: inline-block; width: 12px; height: 12px; background-color: #27ae60; vertical-align: middle; margin-right: 4px; border-radius: 2px;"></span>
                <span style="color: #27ae60; margin-right: 15px;">Melhor Desempenho</span>
                <span style="display: inline-block; width: 12px; height: 12px; background-color: #e74c3c; vertical-align: middle; margin-right: 4px; border-radius: 2px;"></span>
                <span style="color: #e74c3c;">Pior Desempenho</span>
            </div>
            
            <div style="text-align: center; margin-top: 15px;">
                <div style="margin-bottom: 25px;">
                    <img src="${chartGroup1}" width="100%" style="border-radius: 6px; border: 1px solid #ddd; max-width: 100%; display: block; margin: 0 auto; height: auto;" alt="Cobre, Zinco, Alumínio, Chumbo" />
                    <div style="margin-top: 10px; text-align: center;">
                        ${generateKpiCard('Cobre', 'cobre', comp)}
                        ${generateKpiCard('Zinco', 'zinco', comp)}
                        ${generateKpiCard('Alumínio', 'aluminio', comp)}
                        ${generateKpiCard('Chumbo', 'chumbo', comp)}
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <img src="${chartGroup2}" width="100%" style="border-radius: 6px; border: 1px solid #ddd; max-width: 100%; display: block; margin: 0 auto; height: auto;" alt="Estanho, Níquel" />
                    <div style="margin-top: 10px; text-align: center;">
                        ${generateKpiCard('Estanho', 'estanho', comp)}
                        ${generateKpiCard('Níquel', 'niquel', comp)}
                    </div>
                </div>
            </div>

            <div id="rel-rodape" style="display: none; text-align: center; font-size: 8pt; color: #666; margin-top: 15px; font-family: Calibri, Arial, sans-serif;"></div>

            <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 9pt; color: #666; border-top: 1px solid #eee; margin-top: 20px;">
                <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} &mdash; Apextech Metais</p>
                <p style="font-size: 8pt; color: #999; margin-top: 8px;">Este e-mail é enviado de forma automática conforme as configurações do painel administrativo.</p>
            </div>
        </div>
    </div>
    `;

    return html;
}

async function getResendConfig() {
    const settings = {};
    if (dbAvailable) {
        try {
            const result = await pool.query('SELECT * FROM settings');
            result.rows.forEach(r => { settings[r.key] = r.value; });
        } catch (e) {
            console.error('Error reading settings from DB:', e);
        }
    } else {
        Object.assign(settings, memStore.settings);
    }

    const apiKey = process.env.RESEND_API_KEY || settings.lme_resend_api_key || '';
    let from     = settings.lme_resend_from || process.env.RESEND_FROM || 'Apextech Metais <noreply@apextechmetais.com.br>';
    if (!from || from.includes('onboarding@resend.dev') || from.includes('lme.lat')) {
        from = 'Apextech Metais <noreply@apextechmetais.com.br>';
    } else if (!from.includes('<') && !from.includes('>')) {
        from = `Apextech Metais <${from.trim()}>`;
    }

    return { apiKey, from };
}

const { gerarPdfRelatorioLME } = require('./src/pdf-lme');

/** Valida se o buffer é realmente um PDF (evita anexar arquivo vazio/corrompido) */
function isValidPdfBuffer(buf) {
    return !!buf && buf.length > 2048 && buf.slice(0, 5).toString('latin1') === '%PDF-';
}

/**
 * Gera o PDF do Relatório LME exatamente como o botão "PDF" do painel (download local):
 * renderiza o MESMO HTML (#capture-area, 800px) no Chrome headless e exporta em página única.
 * Diferença: aqui o PDF é vetorial (texto nítido/selecionável) em vez de imagem.
 */
async function gerarPdfLmeViaPuppeteer(weekBlock) {
    const nowSp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const pad = (n) => String(n).padStart(2, '0');
    const tsStr = `${pad(nowSp.getDate())}/${pad(nowSp.getMonth() + 1)}/${nowSp.getFullYear()} às ${pad(nowSp.getHours())}:${pad(nowSp.getMinutes())}:${pad(nowSp.getSeconds())}`;

    // Setas desenhadas em CSS (não dependem de fontes instaladas no servidor Linux)
    const TRI_UP = '<span style="display:inline-block;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid currentColor;vertical-align:middle;margin-bottom:2px;"></span>';
    const TRI_DN = '<span style="display:inline-block;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:7px solid currentColor;vertical-align:middle;margin-bottom:2px;"></span>';

    let inner = gerarHtmlRelatorio(weekBlock)
        .replace(/▲/g, TRI_UP)
        .replace(/▼/g, TRI_DN)
        // Exibe o rodapé com data/hora, igual ao download local
        .replace(/<div id="rel-rodape" style="display: none;([^"]*)"><\/div>/,
            `<div id="rel-rodape" style="display: block;$1">Relatório gerado em: ${tsStr} — ApexTech Metais</div>`);

    const fullHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
        <style>
            html, body { margin: 0; padding: 0; background: #ffffff; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style></head><body>${inner}</body></html>`;

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
        await page.emulateMediaType('screen');
        await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Aguarda logo e gráficos (QuickChart) carregarem — no máximo 25s
        await page.evaluate(() => Promise.race([
            Promise.all(Array.from(document.images).map(img => img.complete
                ? Promise.resolve()
                : new Promise(r => { img.onload = r; img.onerror = r; }))),
            new Promise(r => setTimeout(r, 25000))
        ]));

        const dims = await page.evaluate(() => {
            const el = document.getElementById('capture-area') || document.body;
            const r = el.getBoundingClientRect();
            return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
        });

        const pdf = await page.pdf({
            width: '210mm',
            height: `${Math.ceil((dims.h * 210) / (dims.w || 800))}mm`,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            pageRanges: '1'
        });
        const buf = Buffer.from(pdf);
        if (!isValidPdfBuffer(buf)) throw new Error('PDF gerado pelo Chrome está vazio/inválido.');
        return buf;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

async function gerarPdfRelatorioViaHeadless(weekBlock) {
    let block = weekBlock;
    try {
        if (!block) {
            const localTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
            const dObj = new Date(localTimeStr);
            const mes = `${dObj.getMonth() + 1}-${dObj.getFullYear()}`;
            let data = await generateRelatorioSemanas(mes);
            if (!data || !data.semanas || data.semanas.length === 0) {
                data = await generateRelatorioSemanas('atual');
            }
            if (data && data.semanas && data.semanas.length > 0) {
                block = data.semanas[data.semanas.length - 1];
            }
        }
    } catch (e) {
        console.error('Erro ao obter semana LME para o PDF:', e.message);
    }
    if (!block) return null;

    // 1ª opção: idêntico ao download local (Chrome headless)
    try {
        const buf = await gerarPdfLmeViaPuppeteer(block);
        console.log(`📄 PDF LME gerado via Chrome headless (${Math.round(buf.length / 1024)} KB).`);
        return buf.toString('base64');
    } catch (e) {
        console.warn('⚠️ Chrome headless indisponível para o PDF LME, usando jsPDF:', e.message);
    }

    // 2ª opção (fallback): PDF vetorial via jsPDF
    try {
        const buf = await gerarPdfRelatorioLME(block);
        if (!isValidPdfBuffer(buf)) throw new Error('PDF jsPDF inválido.');
        console.log(`📄 PDF LME gerado via jsPDF (${Math.round(buf.length / 1024)} KB).`);
        return buf.toString('base64');
    } catch (e) {
        console.error('Erro ao gerar PDF da LME via jsPDF:', e);
        return null;
    }
}

async function enviarRelatorioEmail(weekBlock, pdfBase64 = null) {
    const config = await getResendConfig();
    if (!config.apiKey) {
        throw new Error('API Key do Resend não configurada. Preencha a chave no painel.');
    }

    let recipients = [];
    if (dbAvailable) {
        const result = await pool.query("SELECT * FROM lme_destinatarios WHERE COALESCE(tipo, 'lme') = 'lme'");
        recipients = result.rows;
    } else {
        recipients = (memStore.lme_destinatarios || []).filter(r => (r.tipo || 'lme') === 'lme');
    }

    if (recipients.length === 0) {
        throw new Error('Nenhum destinatário cadastrado.');
    }

    const emailsList = recipients.map(r => r.email);
    const label = weekBlock ? weekBlock.label : 'Semanal';

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="background-color: #f7f9f8; padding: 30px 15px; margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; color: #222222;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e1e8e5; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <tr>
                <td style="background-color: #0d281a; padding: 25px 30px; text-align: left; border-bottom: 3px solid #2AD07A;">
                    <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Apextech Metais</h2>
                    <p style="color: #2AD07A; margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">Relatório Oficial de Cotações LME</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px;">
                    <p style="font-size: 15px; line-height: 1.6; color: #333333; margin-top: 0;">Olá,</p>
                    <p style="font-size: 15px; line-height: 1.6; color: #444444;">
                        Segue em anexo o relatório oficial em PDF com as <strong>Cotações LME (${label})</strong>, contemplando os valores de Cobre, Zinco, Alumínio, Chumbo, Estanho, Níquel e Dólar.
                    </p>
                    <div style="background-color: #f0faf4; border-left: 4px solid #2AD07A; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #0d4a2b; font-weight: 600;">
                            📎 O documento em anexo inclui a tabela completa, cálculos de médias, comparativo semanal e a matriz de valores base (90% a 110%).
                        </p>
                    </div>
                    <p style="font-size: 14px; line-height: 1.6; color: #666666; margin-bottom: 0;">
                        Atenciosamente,<br>
                        <strong style="color: #0d281a;">Apextech Metais — Indústria e Comércio de Resíduos Ltda</strong><br>
                        <a href="https://apextechmetais.com.br" style="color: #2AD07A; text-decoration: none; font-weight: 600;">apextechmetais.com.br</a>
                    </p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #f4f6f5; padding: 15px 30px; text-align: center; font-size: 11px; color: #888888; border-top: 1px solid #e1e8e5;">
                    Este é um e-mail automático enviado pelo sistema de monitoramento de mercado da Apextech Metais.
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // Parâmetros do e-mail com a data atual no assunto
    const localTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const localDate = new Date(localTimeStr);
    const day = String(localDate.getDate()).padStart(2, '0');
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const year = localDate.getFullYear();
    const timeStr = localDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const todayDateStr = `${day}/${month}/${year}`;

    // Garantir envio em Cópia Oculta (BCC) para privacidade absoluta dos destinatários
    const senderEmail = config.from.match(/<([^>]+)>/) ? config.from.match(/<([^>]+)>/)[1].trim() : config.from.trim();
    const bccList = emailsList.filter(e => e.toLowerCase() !== senderEmail.toLowerCase());
    const emailPayload = {
        from: config.from,
        to: [senderEmail],
        ...(bccList.length > 0 ? { bcc: bccList } : {}),
        subject: `📊 Relatório Cotações LME - ApexTech Metais - ${todayDateStr} ${timeStr}`,
        html: html,
        attachments: []
    };

    // Anexar o PDF gerado pelo cliente ou gerar via backend de forma infalível
    let finalPdfBase64 = pdfBase64;
    
    if (!finalPdfBase64) {
        console.log('📄 Gerando PDF vetorial oficial LME 100% server-side...');
        finalPdfBase64 = await gerarPdfRelatorioViaHeadless(weekBlock);
    }

    if (!finalPdfBase64) {
        console.log('🔄 Tentando fallback para semana mais recente disponível da LME...');
        try {
            const data = await generateRelatorioSemanas('atual');
            if (data && data.semanas && data.semanas.length > 0) {
                const wk = data.semanas[data.semanas.length - 1];
                const buf = await gerarPdfRelatorioLME(wk);
                if (buf) finalPdfBase64 = buf.toString('base64');
            }
        } catch (retryErr) {
            console.error('❌ Falha no fallback de obtenção da semana LME:', retryErr.message);
        }
    }

    if (!finalPdfBase64) {
        console.error('❌ CRÍTICO: Não foi possível anexar o PDF ao e-mail.');
        throw new Error('Falha ao gerar o arquivo PDF da LME para anexo. O envio foi cancelado para não enviar e-mail sem anexo.');
    }

    const firstDate = (weekBlock && weekBlock.days && weekBlock.days.filter(d => d.data && d.data !== '—')[0]?.data) || 'semanal';
    const fileName = `LME-ApexTech-${firstDate.replace(/\//g, '-')}.pdf`;

    emailPayload.attachments.push({
        filename: fileName,
        content: finalPdfBase64
    });
    console.log(`📎 PDF anexado com sucesso ao e-mail (${fileName}, ${Math.round(finalPdfBase64.length / 1024)} KB).`);

    try {
        const response = await axios.post('https://api.resend.com/emails', emailPayload, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ Relatório enviado por e-mail via Resend para [${emailsList.join(', ')}]:`, response.data.id);
        return response.data;
    } catch (axiosErr) {
        const resendMsg = axiosErr.response?.data?.message || axiosErr.response?.data?.error || axiosErr.message;
        console.error('❌ Erro da API do Resend:', axiosErr.response?.data || axiosErr.message);
        throw new Error(resendMsg);
    }
}

async function gerarPdfTabelaPrecosViaHeadless(modo = 'fornecedor') {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    });
    try {
        const page = await browser.newPage();
        
        // Mock authentication for the headless browser so admin.js runs initAdmin()
        await page.evaluateOnNewDocument(() => {
            sessionStorage.setItem('apex_admin_logged_in', 'true');
        });

        // Set viewport and go to page
        const port = process.env.PORT || 3000;
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
        await page.goto(`http://localhost:${port}/admin.html`, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Wait for dashboard and login overlay to hide
        await page.evaluate(() => {
            const overlay = document.getElementById('login-overlay');
            if (overlay) overlay.style.display = 'none';
            const dashboard = document.getElementById('admin-dashboard-container');
            if (dashboard) dashboard.style.display = 'flex';
        });

        // Execute frontend helper that returns base64 PDF
        const base64Pdf = await page.evaluate(async (m) => {
            if (window.gerarPdfTabelaPrecosBase64) {
                return await window.gerarPdfTabelaPrecosBase64(m);
            }
            return null;
        }, modo);
        
        return base64Pdf;
    } catch (e) {
        console.error('Erro ao gerar PDF da Tabela de Preços via Puppeteer:', e);
        return null;
    } finally {
        await browser.close();
    }
}

async function enviarTabelaPrecosEmail(pdfBase64, modo = 'fornecedor', emailDestino = null) {
    const config = await getResendConfig();
    if (!config.apiKey) {
        throw new Error('API Key do Resend não configurada. Preencha a chave no painel.');
    }

    let emailsList = [];
    if (emailDestino) {
        emailsList = [emailDestino];
    } else {
        let recipients = [];
        const isCompleta = modo === 'completa';
        const targetTipo = isCompleta ? 'tabela_geral' : 'tabela_fornecedor';
        if (dbAvailable) {
            const result = await pool.query("SELECT * FROM lme_destinatarios WHERE COALESCE(tipo, 'lme') = $1", [targetTipo]);
            recipients = result.rows;
        } else {
            recipients = (memStore.lme_destinatarios || []).filter(r => (r.tipo || 'lme') === targetTipo);
        }

        if (recipients.length === 0) {
            throw new Error('Nenhum destinatário cadastrado.');
        }

        emailsList = recipients.map(r => r.email);
    }

    // Format today's date for subject and body
    const spTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const localDate = new Date(spTimeStr);
    const day = String(localDate.getDate()).padStart(2, '0');
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const year = localDate.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    const isCompleta = modo === 'completa';
    const tituloTabela = isCompleta ? 'Tabela de Preços Geral Completa' : 'Tabela de Preços (Fornecedor)';
    const nomeArquivo = isCompleta ? 'Tabela_de_Precos_Geral_Completa.pdf' : 'Tabela_de_Precos_Fornecedor.pdf';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="background-color: #ffffff; padding: 20px; margin: 0; font-family: Arial, sans-serif; color: #333333;">
        <p>Olá,</p>
        <p>Segue em anexo a <strong>${tituloTabela}</strong> vigente da Apextech Metais.</p>
        <p>Este documento foi aprovado pelo CEO Jose Tiago.</p>
        <br>
        <p>Atenciosamente,<br>Apextech Metais</p>
    </body>
    </html>
    `;

    // Se for envio individual para um único e-mail direto (ex: cotação individual):
    // envia direto para ele em 'to'.
    // Se for envio para a lista de fornecedores/clientes (mala direta):
    // envia com 'to: [config.from]' e 'bcc: emailsList' para total sigilo.
    const senderEmail = config.from.match(/<([^>]+)>/) ? config.from.match(/<([^>]+)>/)[1].trim() : config.from.trim();
    const isSingleRecipient = !!emailDestino;
    const bccList = !isSingleRecipient ? emailsList.filter(e => e.toLowerCase() !== senderEmail.toLowerCase()) : [];

    const emailPayload = {
        from: config.from,
        to: isSingleRecipient ? [emailDestino] : [senderEmail],
        ...(bccList.length > 0 ? { bcc: bccList } : {}),
        subject: `📋 ${tituloTabela} - Apextech Metais - ${formattedDate}`,
        html: html,
        attachments: []
    };

    if (pdfBase64) {
        emailPayload.attachments.push({
            filename: nomeArquivo,
            content: pdfBase64
        });
        console.log(`📎 PDF (${nomeArquivo}) anexado com sucesso ao e-mail.`);
    } else {
        console.warn('⚠️ Não foi possível anexar o PDF da Tabela de Preços.');
    }

    try {
        const response = await axios.post('https://api.resend.com/emails', emailPayload, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ ${tituloTabela} enviada por e-mail via Resend para [${emailsList.join(', ')}]:`, response.data.id);
        return response.data;
    } catch (axiosErr) {
        const resendMsg = axiosErr.response?.data?.message || axiosErr.response?.data?.error || axiosErr.message;
        console.error('❌ Erro da API do Resend:', axiosErr.response?.data || axiosErr.message);
        throw new Error(resendMsg);
    }
}

// ─── Agendador Automático de E-mails ──────────────────────────────────────────
// Regras de confiabilidade:
//  • Só marca como "enviado" quando o envio realmente dá certo (antes marcava ANTES de enviar,
//    então qualquer falha de PDF/rede fazia o dia ser perdido sem nova tentativa).
//  • Janela de recuperação: se o servidor estava reiniciando/fora do ar no horário exato,
//    ainda envia em até SCHEDULER_CATCHUP_MIN minutos depois do horário programado.
//  • Até SCHEDULER_MAX_ATTEMPTS tentativas, com SCHEDULER_RETRY_MS entre elas.
//  • Trava contra envio duplicado (job em andamento / já enviado, persistido no banco).
const SCHEDULER_CATCHUP_MIN = 180;
const SCHEDULER_MAX_ATTEMPTS = 6;
const SCHEDULER_RETRY_MS = 5 * 60 * 1000;
const schedulerState = {};

async function persistSchedulerLastSent(activeKey, value) {
    const key = activeKey + '_last_sent';
    if (!memStore.settings) memStore.settings = {};
    memStore.settings[key] = value;
    if (dbAvailable) {
        await pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
            [key, value]
        ).catch(e => console.warn(`⚠️ [Agendador] Não foi possível gravar ${key}:`, e.message));
    }
}

async function runScheduledJob(job, settings, now) {
    const { activeKey, timeKey, daysKey, name, run } = job;
    const activeVal = settings[activeKey] !== undefined && settings[activeKey] !== null ? settings[activeKey] : 'true';
    if (activeVal !== 'true' && activeVal !== true) return;

    const daysStr = settings[daysKey] !== undefined && settings[daysKey] !== null ? String(settings[daysKey]) : '0,1,2,3,4,5,6';
    const days = daysStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (!days.includes(now.dayOfWeek)) return;

    const [sHour, sMin] = String(settings[timeKey] || '14:00').split(':').map(n => parseInt(n, 10));
    if (isNaN(sHour) || isNaN(sMin)) return;
    const sMins = sHour * 60 + sMin;
    if (now.mins < sMins || now.mins >= sMins + SCHEDULER_CATCHUP_MIN) return;

    const targetKey = `${now.dateStr} ${String(sHour).padStart(2, '0')}:${String(sMin).padStart(2, '0')}`;
    const st = schedulerState[activeKey] || (schedulerState[activeKey] = {});
    const recorded = settings[activeKey + '_last_sent'];
    // Compatível com o formato antigo (apenas a data) para não reenviar no dia da atualização
    if (recorded === targetKey || recorded === now.dateStr || st.sentKey === targetKey) return;
    if (st.inFlight) return;

    if (st.targetKey !== targetKey) {
        st.targetKey = targetKey;
        st.attempts = 0;
        st.nextRetryAt = 0;
    }
    if (st.attempts >= SCHEDULER_MAX_ATTEMPTS) return;
    if (Date.now() < st.nextRetryAt) return;

    st.inFlight = true;
    st.attempts++;
    const atraso = now.mins - sMins;
    console.log(`⏰ [Agendador] ${name}: disparo ${targetKey} (tentativa ${st.attempts}/${SCHEDULER_MAX_ATTEMPTS}${atraso > 0 ? `, ${atraso} min após o horário` : ''})...`);
    try {
        await run();
        st.sentKey = targetKey;
        await persistSchedulerLastSent(activeKey, targetKey);
        console.log(`✅ [Agendador] ${name} enviado com sucesso (${targetKey}).`);
    } catch (err) {
        st.nextRetryAt = Date.now() + SCHEDULER_RETRY_MS;
        const restante = SCHEDULER_MAX_ATTEMPTS - st.attempts;
        console.error(`❌ [Agendador] Falha ao enviar ${name} (tentativa ${st.attempts}): ${err.message}${restante > 0 ? ' — nova tentativa em 5 min.' : ' — limite de tentativas atingido.'}`);
    } finally {
        st.inFlight = false;
    }
}

async function enviarRelatorioLmeAgendado() {
    const spDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const mes = `${spDate.getMonth() + 1}-${spDate.getFullYear()}`;
    let data = await generateRelatorioSemanas(mes);
    if (!data || !data.semanas || data.semanas.length === 0) {
        data = await generateRelatorioSemanas('atual');
    }
    if (!data || !data.semanas || data.semanas.length === 0) {
        throw new Error(`Nenhuma semana LME encontrada para ${mes} ou atual.`);
    }
    const latestWeek = data.semanas[data.semanas.length - 1];
    // Gera o PDF igual ao download local e só envia se o anexo existir (enviarRelatorioEmail valida)
    const pdfBase64 = await gerarPdfRelatorioViaHeadless(latestWeek);
    await enviarRelatorioEmail(latestWeek, pdfBase64);
}

function startEmailScheduler() {
    console.log('⏰ Inicializando o agendador de e-mails da ApexTech (Fuso: América/São Paulo)...');

    const tick = async () => {
        try {
            const settings = {};
            if (dbAvailable) {
                const result = await pool.query('SELECT * FROM settings');
                result.rows.forEach(r => { settings[r.key] = r.value; });
            } else {
                Object.assign(settings, memStore.settings);
            }

            // Horário oficial de Brasília (São Paulo)
            const spDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            const now = {
                dayOfWeek: spDate.getDay(), // 0=Dom ... 6=Sáb
                mins: spDate.getHours() * 60 + spDate.getMinutes(),
                dateStr: `${spDate.getFullYear()}-${String(spDate.getMonth() + 1).padStart(2, '0')}-${String(spDate.getDate()).padStart(2, '0')}`
            };

            const jobs = [
                {
                    name: 'Relatório LME',
                    activeKey: 'lme_envio_ativo', timeKey: 'lme_envio_horario', daysKey: 'lme_envio_dias',
                    run: enviarRelatorioLmeAgendado
                },
                {
                    name: 'Tabela Geral Completa',
                    activeKey: 'tabela_geral_envio_ativo', timeKey: 'tabela_geral_envio_horario', daysKey: 'tabela_geral_envio_dias',
                    run: async () => {
                        let pdfBase64 = null;
                        try { pdfBase64 = await gerarPdfTabelaPrecosViaHeadless('completa'); }
                        catch (pdfErr) { console.warn('⚠️ [Agendador] Aviso na geração do PDF da tabela:', pdfErr.message); }
                        await enviarTabelaPrecosEmail(pdfBase64, 'completa');
                    }
                },
                {
                    name: 'Tabela do Fornecedor',
                    activeKey: 'tabela_fornecedor_envio_ativo', timeKey: 'tabela_fornecedor_envio_horario', daysKey: 'tabela_fornecedor_envio_dias',
                    run: async () => {
                        let pdfBase64 = null;
                        try { pdfBase64 = await gerarPdfTabelaPrecosViaHeadless('fornecedor'); }
                        catch (pdfErr) { console.warn('⚠️ [Agendador] Aviso na geração do PDF da tabela:', pdfErr.message); }
                        await enviarTabelaPrecosEmail(pdfBase64, 'fornecedor');
                    }
                }
            ];

            // Sequencial para não abrir vários Chrome headless ao mesmo tempo
            for (const job of jobs) {
                await runScheduledJob(job, settings, now);
            }
        } catch (err) {
            console.error('❌ Erro no agendador automático de e-mails:', err.message);
        }
    };

    let ticking = false;
    const safeTick = async () => {
        if (ticking) return;
        ticking = true;
        try { await tick(); } finally { ticking = false; }
    };

    setTimeout(safeTick, 15000); // verifica logo após o boot (recupera envio perdido em restart)
    setInterval(safeTick, 60000);
}

// ─── API: LME Disparar E-mail (Endpoint Externo) ─────────────────────────────
app.post('/api/lme/relatorio-email', async (req, res) => {
    try {
        const localTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const dObj = new Date(localTimeStr);
        const month = dObj.getMonth() + 1;
        const year = dObj.getFullYear();
        const mes = `${month}-${year}`;

        let data = await generateRelatorioSemanas(mes);
        if (!data || !data.semanas || data.semanas.length === 0) {
            data = await generateRelatorioSemanas('atual');
        }
        if (!data || !data.semanas || data.semanas.length === 0) {
            return res.status(404).json({ error: 'Nenhuma semana encontrada para enviar.' });
        }

        const latestWeek = data.semanas[data.semanas.length - 1];
        console.log('Gerando PDF da LME para o endpoint /api/lme/relatorio-email...');
        const pdfBase64 = await gerarPdfRelatorioViaHeadless(latestWeek);
        
        await enviarRelatorioEmail(latestWeek, pdfBase64);

        res.json({ success: true, message: 'Relatório disparado com sucesso via endpoint!' });
    } catch (err) {
        console.error('Erro no endpoint de disparo de e-mail:', err);
        res.status(500).json({ error: 'Erro ao disparar e-mail: ' + err.message });
    }
});

// ─── API: LME Meses Disponíveis ───────────────────────────────────────────────
app.get('/api/lme/meses', async (req, res) => {
    try {
        const { data: html } = await axios.get(`https://shockmetais.com.br/lme/`, { 
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(html);
        const meses = [];
        $('#meslme option').each((i, el) => {
            meses.push({ valor: $(el).val(), texto: $(el).text().trim() });
        });
        res.json(meses);
    } catch (err) {
        console.error('Erro GET /api/lme/meses:', err.message);
        res.status(500).json({ error: 'Erro ao buscar meses LME.' });
    }
});

// ─── API: LME Gerar Excel (Node.js / ExcelJS — sem Python) ───────────────────
app.post('/api/lme/gerar-excel', async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const { semana, mesLabel } = req.body;
        if (!semana) return res.status(400).json({ error: 'Dados da semana obrigatórios.' });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'ApexTech Metais';
        const ws = wb.addWorksheet('TABELA LME', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

        // ── Estilos ──
        const METALS = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel', 'dolar'];
        const METAL_LABELS = ['COBRE', 'ZINCO', 'ALUMÍNIO', 'CHUMBO', 'ESTANHO', 'NÍQUEL', 'DÓLAR'];
        const HDR_COLORS   = ['db1f1f', 'E6B8B7', 'BFBFBF', 'BFBFBF', 'B5B059', 'FFFFFF', '70AD47'];

        const fontBase = { name: 'Calibri', size: 11 };
        const bold = { ...fontBase, bold: true };
        const boldWhite = { ...bold, color: { argb: 'FFFFFFFF' } };
        const centerAlign = { horizontal: 'center', vertical: 'middle' };
        const leftAlign   = { horizontal: 'left',   vertical: 'middle' };

        const thin = { style: 'thin', color: { argb: 'FF000000' } };
        const border = { top: thin, bottom: thin, left: thin, right: thin };

        function fill(hex)  { return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } }; }

        // ── Widths ──
        ws.getColumn(1).width = 3;
        ws.getColumn(2).width = 36;
        METALS.forEach((_, i) => { ws.getColumn(i + 3).width = 17; });

        // ── Título ──
        ws.mergeCells('B1:I1');
        const titleCell = ws.getCell('B1');
        const labelFull = `COTACAO VALIDA PARA A SEMANA: ${semana.label || semana.header}`.toUpperCase();
        titleCell.value = labelFull;
        titleCell.font  = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } };
        titleCell.fill  = fill('FFFF00');
        titleCell.alignment = centerAlign;
        titleCell.border = border;
        ws.getRow(1).height = 30;

        ws.getRow(2).height = 10; // Espaço
        
        // ── Cabeçalho da Tabela (linha 3) ──
        ws.getRow(3).height = 20;
        const hdrRow = ws.getRow(3);
        hdrRow.getCell(2).value = 'DATA';
        hdrRow.getCell(2).fill  = fill('000000');
        hdrRow.getCell(2).font  = boldWhite;
        hdrRow.getCell(2).alignment = centerAlign;
        hdrRow.getCell(2).border = border;

        METALS.forEach((_, i) => {
            const c = hdrRow.getCell(i + 3);
            c.value     = METAL_LABELS[i];
            c.fill      = fill(HDR_COLORS[i]);
            c.font      = bold;
            c.alignment = centerAlign;
            c.border    = border;
        });

        // ── Dias (linhas 4–8) ──
        const days = semana.days || [];
        for (let i = 0; i < 5; i++) {
            const rowNum = 4 + i;
            ws.getRow(rowNum).height = 18;
            const r = ws.getRow(rowNum);
            const day = days[i] || {};
            r.getCell(2).value     = day.data || '—';
            r.getCell(2).font      = bold;
            r.getCell(2).alignment = centerAlign;
            r.getCell(2).border    = border;

            METALS.forEach((m, mi) => {
                const c = r.getCell(mi + 3);
                const v = day[m];
                c.value     = (v !== null && v !== undefined) ? v : '—';
                c.font      = fontBase;
                c.fill      = fill(HDR_COLORS[mi]);
                c.alignment = centerAlign;
                c.border    = border;
                if (typeof v === 'number') {
                    // Valores diários: US$/tonelada (sem prefixo R$)
                    c.numFmt = m === 'dolar' ? '0.0000' : '#,##0.00';
                }
            });
        }
        
        ws.getRow(9).height = 10; // Espaço

        // ── Linhas Computadas (10–19) ──
        const comp = semana.computed || {};
        const COMP_ROWS = [
            // MEDIA SEMANAL: US$/ton (preço bruto scraped) — sem prefixo R$
            { lbl: 'MEDIA SEMANAL (US$/t)',            key: 'MEDIA SEMANAL',                    bg: 'E7E6E6', lblFont: bold, fmt: '#,##0.00',      dolFmt: '0.0000'      },
            { space: true },
            // 100% LME: R$/kg (média_metal × média_dólar / 1000)
            { lbl: '100% LME (R$/kg)',                 key: '100% LME',                         bg: 'FFFF00', lblFont: bold, fmt: 'R$ #,##0.000',  dolFmt: '0.0000'      },
            { space: true },
            { lbl: 'SEMANA ANTERIOR (R$/kg)',          key: 'SEMANA ANTERIOR',                  bg: '000000', lblFont: boldWhite, fmt: 'R$ #,##0.000', dolFmt: '$ #,##0.0000' },
            { lbl: 'FECHAMENTO % (SEMANA ANTERIOR)',   key: 'FECHAMENTO % ( SEMANA ANTERIOR )', bg: 'FFFFFF', lblFont: { ...bold, color: {argb:'FF00B050'} }, fmt: '0.00%', dolFmt: '0.00%' },
            { space: true },
            { lbl: 'OSCILAÇÃO %',                     key: 'OSCILAÇÃO %',                      bg: '00B0F0', lblFont: bold, fmt: '0.00%',         dolFmt: '0.00%'       },
            { space: true },
            { lbl: 'OSCILAÇÃO R$',                    key: 'OSCILAÇÃO R$',                     bg: 'E2EFDA', lblFont: bold, fmt: 'R$ #,##0.0000', dolFmt: '$ #,##0.0000' },
            { space: true },
            // MEDIA MENSAL: R$/kg (média das semanas fechadas do mês)
            { lbl: 'MEDIA MENSAL (R$/kg)',             key: 'MEDIA MENSAL',                     bg: 'A6A6A6', lblFont: bold, fmt: 'R$ #,##0.000',  dolFmt: '$ #,##0.00'  },
        ];

        let curRow = 10;
        COMP_ROWS.forEach((row) => {
            if (row.space) {
                ws.getRow(curRow).height = 8;
                curRow++;
                return;
            }
            ws.getRow(curRow).height = 20;
            const r = ws.getRow(curRow);
            r.getCell(2).value     = row.lbl;
            r.getCell(2).font      = row.lblFont;
            r.getCell(2).fill      = fill(row.bg);
            r.getCell(2).alignment = centerAlign;
            r.getCell(2).border    = border;

            const vals = comp[row.key] || {};
            METALS.forEach((m, mi) => {
                const c  = r.getCell(mi + 3);
                const v  = vals[m];
                c.fill      = fill(HDR_COLORS[mi]);
                c.font      = bold;
                c.alignment = centerAlign;
                c.border    = border;
                
                if (row.key === 'FECHAMENTO % ( SEMANA ANTERIOR )' || row.key === 'OSCILAÇÃO %' || row.key === 'OSCILAÇÃO R$') {
                    if (v !== null && v !== undefined) {
                        c.font = { ...bold, color: { argb: v >= 0 ? 'FF00B050' : 'FFFF0000' } };
                    }
                }
                
                if (row.key === 'OSCILAÇÃO R$' && v !== null && v !== undefined) {
                    const arrow = v >= 0 ? '⬆ ' : '⬇ ';
                    const pre = m === 'dolar' ? '$ ' : 'R$ ';
                    c.value = `${arrow}${v < 0 ? '-' : ''}${pre}${Math.abs(v).toFixed(4).replace('.', ',')}`;
                    c.numFmt = '@'; 
                } else if (v !== null && v !== undefined) {
                    c.value  = v;
                    c.numFmt = m === 'dolar' ? row.dolFmt : row.fmt;
                } else {
                    c.value = '—';
                }
            });
            curRow++;
        });

        // ── Tabela Resumo ──
        curRow += 2;
        ws.getRow(curRow).height = 20;
        const sumHdr = ws.getRow(curRow);
        sumHdr.getCell(2).value = 'TIPO';
        sumHdr.getCell(2).fill  = fill('A6A6A6');
        sumHdr.getCell(2).font  = bold;
        sumHdr.getCell(2).alignment = centerAlign;
        sumHdr.getCell(2).border = border;
        METALS.forEach((_, i) => {
            const c = sumHdr.getCell(i + 3);
            c.value     = METAL_LABELS[i];
            c.fill      = fill(HDR_COLORS[i]);
            c.font      = bold;
            c.alignment = centerAlign;
            c.border    = border;
        });

        const SUMMARY_ROWS = [
            { lbl: 'SEMANA ANTERIOR', key: 'SEMANA ANTERIOR', fmt: 'R$ #,##0.00', dolFmt: '0.00', bg: 'D9E1F2' },
            { lbl: 'LME ATUAL',       key: '100% LME',        fmt: 'R$ #,##0.00', dolFmt: '0.00', bg: 'FFF2CC' },
        ];
        curRow++;
        SUMMARY_ROWS.forEach((row) => {
            ws.getRow(curRow).height = 20;
            const r = ws.getRow(curRow);
            r.getCell(2).value     = row.lbl;
            r.getCell(2).font      = { ...fontBase, italic: true };
            r.getCell(2).fill      = fill(row.bg);
            r.getCell(2).alignment = leftAlign;
            r.getCell(2).border    = border;
            const vals = comp[row.key] || {};
            METALS.forEach((m, mi) => {
                const c = r.getCell(mi + 3);
                const v = vals[m];
                c.fill      = fill(HDR_COLORS[mi]);
                c.font      = fontBase;
                c.alignment = centerAlign;
                c.border    = border;
                if (v !== null && v !== undefined) {
                    c.value  = v;
                    c.numFmt = m === 'dolar' ? row.dolFmt : row.fmt;
                } else {
                    c.value = '—';
                }
            });
            curRow++;
        });

        // ── Linha Oscilação com setas (Bottom table) ──
        ws.getRow(curRow).height = 20;
        const oscRow = ws.getRow(curRow);
        oscRow.getCell(2).value     = 'Osilacao';
        oscRow.getCell(2).font      = { ...bold, italic: true };
        oscRow.getCell(2).alignment = leftAlign;
        oscRow.getCell(2).border    = border;

        const oscVals = comp['OSCILAÇÃO R$'] || {};
        METALS.forEach((m, mi) => {
            const c = oscRow.getCell(mi + 3);
            const v = oscVals[m];
            c.fill      = fill(HDR_COLORS[mi]);
            c.alignment = centerAlign;
            c.border    = border;
            if (v !== null && v !== undefined) {
                const arrow = v >= 0 ? '⬆' : '⬇';
                const colorHex = v >= 0 ? 'FF00B050' : 'FFFF0000';
                const prefix = m === 'dolar' ? '$ ' : 'R$ ';
                const decimals = m === 'dolar' ? 4 : 4; // Use 4 decimals since oscillation requires precision
                c.value = `${arrow} ${v < 0 ? '-' : ''}${prefix}${Math.abs(v).toFixed(decimals).replace('.', ',')}`;
                c.font  = { ...bold, color: { argb: colorHex } };
            } else {
                c.value = '—';
                c.font  = fontBase;
            }
        });

        // ── Gera buffer e envia ──
        const safeName = (semana.header || 'semana').replace(/\//g, '-');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="LME-ApexTech-${safeName}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Erro POST /api/lme/gerar-excel:', err.message);
        res.status(500).json({ error: 'Erro ao gerar Excel: ' + err.message });
    }
});

// ─── API: LME (Scraping e Proxy — mantido para dashboard existente) ────────────
app.get('/api/lme/tabela/:mes', async (req, res) => {
    try {
        const mes = req.params.mes;
        const targetUrl = mes === 'atual' ? 'https://shockmetais.com.br/lme/' : `https://shockmetais.com.br/lme/${mes}`;
        let html;
        try {
            html = await fetchLMEWithCache(targetUrl);
        } catch (err) {
            console.warn(`Erro ao buscar ${targetUrl}, tentando fallback para a home:`, err.message);
            html = await fetchLMEWithCache('https://shockmetais.com.br/lme/');
        }
        const $ = cheerio.load(html);
        
        const cotacoes = [];
        $('#boxtabela table tbody tr').each((index, element) => {
            const colunas = $(element).find('td');
            if (colunas.length > 0) {
                const dia      = $(colunas[0]).text().trim();
                const cobre    = $(colunas[1]).text().trim();
                const zinco    = $(colunas[2]).text().trim();
                const aluminio = $(colunas[3]).text().trim();
                const chumbo   = $(colunas[4]).text().trim();
                const estanho  = $(colunas[5]).text().trim();
                const niquel   = $(colunas[6]).text().trim();
                const dolar    = $(colunas[7]).text().trim();
                const isMedia  = $(colunas[0]).hasClass('lmemedia');
                const isMensal = $(colunas[0]).hasClass('lmemensal');
                cotacoes.push({ dia, cobre, zinco, aluminio, chumbo, estanho, niquel, dolar,
                    tipo: isMensal ? 'mensal' : (isMedia ? 'semanal' : 'diaria') });
            }
        });

        const mesesDisponiveis = [];
        $('#meslme option').each((i, el) => {
            mesesDisponiveis.push({ valor: $(el).val(), texto: $(el).text() });
        });

        res.json({ cotacoes, mesesDisponiveis });
    } catch (err) {
        console.error('Erro GET /api/lme/tabela:', err.message);
        res.status(500).json({ error: 'Erro ao buscar tabela LME.' });
    }
});

app.post('/api/lme/graflme', async (req, res) => {
    try {
        const response = await axios.post('https://shockmetais.com.br/lme/graflme', new URLSearchParams(req.body), {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Erro POST /api/lme/graflme:', err.message);
        res.status(500).json({ error: 'Erro ao buscar gráfico LME.' });
    }
});

app.post('/api/lme/varialme', async (req, res) => {
    try {
        const response = await axios.post('https://shockmetais.com.br/lme/varialme', new URLSearchParams(req.body), {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const variaveis = [];
        $('.card').each((i, el) => {
            const titulo = $(el).find('.card-header').text().trim();
            const cols = $(el).find('.card-body .col-6');
            let dataAnt = '', valAnt = '', dataAtual = '', valAtual = '';
            if (cols.length >= 2) {
                dataAtual = $(cols[0]).find('small').text().trim();
                valAtual  = $(cols[0]).find('b').text().trim();
                dataAnt   = $(cols[1]).find('small').text().trim();
                valAnt    = $(cols[1]).find('b').text().trim();
            }
            const footerText = $(el).find('.card-footer h3').text().trim();
            const iconClass  = $(el).find('.card-footer i').attr('class') || '';
            const isPositive = footerText.includes('+') || $(el).find('.card-footer h3').hasClass('text-success') || iconClass.includes('up');
            variaveis.push({ titulo, dataAtual, valAtual, dataAnt, valAnt, footerText, isPositive });
        });
        res.json({ html: response.data, parsed: variaveis });
    } catch (err) {
        console.error('Erro POST /api/lme/varialme:', err.message);
        res.status(500).json({ error: 'Erro ao buscar variações LME.' });
    }
});


// ─── CRUD Clientes (com Paginação Server-side) ─────────────────────────────────
app.get('/api/clientes', async (req, res) => {
    try {
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit) || 50;
        const search = (req.query.search || '').trim().toLowerCase();

        if (dbAvailable) {
            let whereClause = '';
            let params = [];
            if (search) {
                whereClause = `WHERE LOWER(nome) LIKE $1 OR LOWER(COALESCE(fantasia,'')) LIKE $1 OR LOWER(COALESCE(cnpj,'')) LIKE $1 OR LOWER(COALESCE(cpf,'')) LIKE $1 OR LOWER(COALESCE(email,'')) LIKE $1`;
                params.push(`%${search}%`);
            }

            const countResult = await pool.query(`SELECT COUNT(*) FROM clientes ${whereClause}`, params);
            const total = parseInt(countResult.rows[0].count);

            let dataQuery = `SELECT * FROM clientes ${whereClause} ORDER BY nome ASC`;
            if (page) {
                const offset = (page - 1) * limit;
                dataQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                params.push(limit, offset);
            }

            const result = await pool.query(dataQuery, params);
            if (page) {
                return res.json({
                    data: result.rows,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
                });
            }
            return res.json(result.rows);
        } else {
            let list = memStore.clientes || [];
            if (search) {
                list = list.filter(c => 
                    (c.nome || '').toLowerCase().includes(search) ||
                    (c.fantasia || '').toLowerCase().includes(search) ||
                    (c.cnpj || '').toLowerCase().includes(search) ||
                    (c.cpf || '').toLowerCase().includes(search) ||
                    (c.email || '').toLowerCase().includes(search)
                );
            }
            const total = list.length;
            if (page) {
                const start = (page - 1) * limit;
                return res.json({
                    data: list.slice(start, start + limit),
                    total,
                    page,
                    totalPages: Math.ceil(total / limit)
                });
            }
            res.json(list);
        }
    } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        res.status(500).json({ error: 'Erro ao buscar clientes.' });
    }
});

app.get('/api/clientes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });
            return res.json(result.rows[0]);
        }
        res.status(404).json({ error: 'Cliente não encontrado.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar cliente.' });
    }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { codigo, nome, fantasia, telefone1, telefone2, cnpj, cpf, ie, rg,
                email, endereco, numero, bairro, cidade, uf, pais, cep,
                tipo_cliente, contato_comercial, contato_financeiro, status,
                vendedor, dias, filial } = req.body;

        if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });

        if (dbAvailable) {
            let codigoNum = parseInt(codigo);
            if (isNaN(codigoNum) || !codigoNum) {
                const maxRes = await pool.query('SELECT COALESCE(MAX(codigo), 0) + 1 AS proximo FROM clientes');
                codigoNum = parseInt(maxRes.rows[0].proximo) || Math.floor(Date.now() % 100000);
            }

            const result = await pool.query(
                `INSERT INTO clientes (
                    codigo, nome, fantasia, telefone1, telefone2,
                    cnpj, cpf, ie, rg, email,
                    endereco, numero, bairro, cidade, uf,
                    pais, cep, tipo_cliente, contato_comercial,
                    contato_financeiro, status, vendedor, dias, filial
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
                RETURNING *`,
                [codigoNum, nome, fantasia, telefone1, telefone2,
                 cnpj, cpf, ie, rg, email,
                 endereco, numero, bairro, cidade, uf,
                 pais || 'BR', cep, tipo_cliente, contato_comercial,
                 contato_financeiro, status || 'ATIVO', vendedor, dias !== undefined && dias !== null ? String(dias).trim() : '0', filial || '01']
            );
            return res.json(result.rows[0]);
        }
        res.status(503).json({ error: 'Banco de dados indisponível.' });
    } catch (err) {
        console.error('Erro ao criar cliente:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { codigo, nome, fantasia, telefone1, telefone2, cnpj, cpf, ie, rg,
                email, endereco, numero, bairro, cidade, uf, pais, cep,
                tipo_cliente, contato_comercial, contato_financeiro, status,
                usuario_cadastro, vendedor, dias, filial } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                `UPDATE clientes SET
                    codigo=$1, nome=$2, fantasia=$3, telefone1=$4, telefone2=$5,
                    cnpj=$6, cpf=$7, ie=$8, rg=$9, email=$10,
                    endereco=$11, numero=$12, bairro=$13, cidade=$14, uf=$15,
                    pais=$16, cep=$17, tipo_cliente=$18, contato_comercial=$19,
                    contato_financeiro=$20, status=$21, vendedor=$22, dias=$23, filial=$24
                WHERE id=$25 RETURNING *`,
                [codigo, nome, fantasia, telefone1, telefone2,
                 cnpj, cpf, ie, rg, email,
                 endereco, numero, bairro, cidade, uf,
                 pais, cep, tipo_cliente, contato_comercial,
                 contato_financeiro, status || 'ATIVO', vendedor, dias !== undefined && dias !== null ? String(dias).trim() : '0', filial,
                 id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });
            return res.json(result.rows[0]);
        }
        res.status(503).json({ error: 'Banco de dados indisponível.' });
    } catch (err) {
        console.error('Erro ao atualizar cliente:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (dbAvailable) {
            await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
            return res.json({ success: true });
        }
        res.status(503).json({ error: 'Banco de dados indisponível.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao deletar cliente.' });
    }
});


// ══════════════════════════════════════════════════════════════
// PEDIDOS DE VENDA
// ══════════════════════════════════════════════════════════════
// PEDIDOS DE VENDA
// ══════════════════════════════════════════════════════════════

// Buscar próximo número de pedido
app.get('/api/pedidos-venda/proximo-numero', async (req, res) => {
    try {
        if (!dbAvailable) {
            const count = (memStore.pedidos_venda || []).length;
            return res.json({ numero: 'PV-' + String(count + 1).padStart(4, '0') });
        }
        const r = await pool.query("SELECT numero FROM pedidos_venda ORDER BY id DESC LIMIT 1");
        if (r.rows.length === 0) return res.json({ numero: 'PV-0001' });
        const last = parseInt(r.rows[0].numero.replace('PV-', '')) || 0;
        const next = 'PV-' + String(last + 1).padStart(4, '0');
        return res.json({ numero: next });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar todos os pedidos
app.get('/api/pedidos-venda', async (req, res) => {
    try {
        if (!dbAvailable) {
            const list = (memStore.pedidos_venda || []).map(p => {
                const cli = (memStore.clientes || []).find(c => c.id == p.cliente_id);
                return {
                    ...p,
                    cliente_nome: p.cliente_nome || (cli ? (cli.nome || cli.fantasia) : 'Cliente Avulso'),
                    cliente_cnpj: cli ? cli.cnpj : '',
                    cliente_cidade: cli ? cli.cidade : '',
                    cliente_uf: cli ? cli.uf : ''
                };
            });
            return res.json(list.sort((a, b) => b.id - a.id));
        }
        const r = await pool.query(`
            SELECT pv.*, COALESCE(c.nome, pv.cliente_nome, 'Cliente') AS cliente_nome, c.cnpj AS cliente_cnpj, c.cidade AS cliente_cidade, c.uf AS cliente_uf
            FROM pedidos_venda pv
            LEFT JOIN clientes c ON c.id = pv.cliente_id
            ORDER BY pv.id DESC
        `);
        return res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buscar pedido por ID com itens
app.get('/api/pedidos-venda/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            const p = (memStore.pedidos_venda || []).find(x => x.id === id);
            if (!p) return res.status(404).json({ error: 'Pedido não encontrado' });
            const cli = (memStore.clientes || []).find(c => c.id == p.cliente_id);
            return res.json({
                ...p,
                cliente_nome: p.cliente_nome || (cli ? (cli.nome || cli.fantasia) : ''),
                cliente_cnpj: cli ? cli.cnpj : '',
                cliente_telefone: cli ? cli.telefone1 : '',
                cliente_email: cli ? cli.email : '',
                cliente_endereco: cli ? cli.endereco : '',
                cliente_cidade: cli ? cli.cidade : '',
                cliente_uf: cli ? cli.uf : ''
            });
        }
        const pedido = await pool.query(`
            SELECT pv.*, COALESCE(c.nome, pv.cliente_nome, '') AS cliente_nome, c.cnpj AS cliente_cnpj, c.telefone1 AS cliente_telefone,
                   c.email AS cliente_email, c.endereco AS cliente_endereco, c.cidade AS cliente_cidade, c.uf AS cliente_uf
            FROM pedidos_venda pv
            LEFT JOIN clientes c ON c.id = pv.cliente_id
            WHERE pv.id = $1
        `, [id]);
        if (pedido.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
        const itens = await pool.query('SELECT * FROM pedidos_venda_itens WHERE pedido_id = $1 ORDER BY id', [id]);
        return res.json({ ...pedido.rows[0], itens: itens.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Criar pedido
app.post('/api/pedidos-venda', async (req, res) => {
    try {
        const { numero, cliente_id, cliente_nome, data_emissao, data_entrega, status, condicao_pagamento,
                observacoes, desconto_pct, frete, itens, criado_por, criado_por_perfil,
                endereco_entrega, responsavel_recebimento, tipo_frete } = req.body;
        if (!cliente_id && !cliente_nome) {
            return res.status(400).json({ error: 'Cliente é obrigatório.' });
        }
        if (!itens || itens.length === 0) {
            return res.status(400).json({ error: 'Ao menos um item é obrigatório.' });
        }
        const total_itens = itens.reduce((s, i) => s + parseFloat(i.total_item || 0), 0);
        const desc = parseFloat(desconto_pct || 0);
        const fr = parseFloat(frete || 0);
        const total_geral = total_itens * (1 - desc / 100) + fr;
        const cid = (cliente_id && !isNaN(parseInt(cliente_id))) ? parseInt(cliente_id) : null;

        if (!dbAvailable) {
            if (!memStore.pedidos_venda) memStore.pedidos_venda = [];
            const newId = nextId++;
            const item = {
                id: newId,
                numero: numero || ('PV-' + String(newId).padStart(4, '0')),
                cliente_id: cid,
                cliente_nome: cliente_nome || '',
                data_emissao: data_emissao || new Date().toISOString().split('T')[0],
                data_entrega: data_entrega || null,
                status: status || 'Rascunho',
                condicao_pagamento: condicao_pagamento || '',
                observacoes: observacoes || '',
                desconto_pct: desc,
                frete: fr,
                total_itens,
                total_geral,
                criado_por: criado_por || 'Admin',
                criado_por_perfil: criado_por_perfil || 'Administrador',
                endereco_entrega: endereco_entrega || '',
                responsavel_recebimento: responsavel_recebimento || '',
                tipo_frete: tipo_frete || 'CIF - Entrega APEXTECH',
                itens: itens.map((it, idx) => ({ id: idx + 1, ...it })),
                criado_em: new Date().toISOString()
            };
            memStore.pedidos_venda.push(item);
            return res.json(item);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const pedido = await client.query(`
                INSERT INTO pedidos_venda (numero, cliente_id, cliente_nome, data_emissao, data_entrega, status, condicao_pagamento,
                    observacoes, desconto_pct, frete, total_itens, total_geral, criado_por, criado_por_perfil,
                    endereco_entrega, responsavel_recebimento, tipo_frete)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *
            `, [numero, cid, cliente_nome || '', data_emissao || new Date().toISOString().split('T')[0],
                 data_entrega || null, status || 'Rascunho', condicao_pagamento, observacoes,
                 desc, fr, total_itens, total_geral, criado_por, criado_por_perfil,
                 endereco_entrega, responsavel_recebimento, tipo_frete]);

            const pedidoId = pedido.rows[0].id;
            for (const item of itens) {
                await client.query(`
                    INSERT INTO pedidos_venda_itens (pedido_id, material_id, descricao, unidade, quantidade, preco_unitario, desconto_item, total_item)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                `, [pedidoId, item.material_id || null, item.descricao, item.unidade || 'kg',
                     item.quantidade, item.preco_unitario, item.desconto_item || 0, item.total_item]);
            }

            await client.query('COMMIT');
            res.json(pedido.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Erro ao criar pedido:', err);
        res.status(500).json({ error: err.message });
    }
});

// Atualizar pedido
app.put('/api/pedidos-venda/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { cliente_id, cliente_nome, data_emissao, data_entrega, status, condicao_pagamento,
                observacoes, desconto_pct, frete, itens, criado_por_perfil,
                endereco_entrega, responsavel_recebimento, tipo_frete } = req.body;
        const total_itens = (itens || []).reduce((s, i) => s + parseFloat(i.total_item || 0), 0);
        const desc = parseFloat(desconto_pct || 0);
        const fr = parseFloat(frete || 0);
        const total_geral = total_itens * (1 - desc / 100) + fr;
        const cid = (cliente_id && !isNaN(parseInt(cliente_id))) ? parseInt(cliente_id) : null;

        if (!dbAvailable) {
            const idx = (memStore.pedidos_venda || []).findIndex(x => x.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Pedido não encontrado' });
            memStore.pedidos_venda[idx] = {
                ...memStore.pedidos_venda[idx],
                cliente_id: cid || memStore.pedidos_venda[idx].cliente_id,
                cliente_nome: cliente_nome !== undefined ? cliente_nome : memStore.pedidos_venda[idx].cliente_nome,
                data_emissao,
                data_entrega,
                status,
                condicao_pagamento,
                observacoes,
                desconto_pct: desc,
                frete: fr,
                total_itens,
                total_geral,
                criado_por_perfil,
                endereco_entrega,
                responsavel_recebimento,
                tipo_frete,
                itens: (itens || []).map((it, i) => ({ id: i + 1, ...it })),
                atualizado_em: new Date().toISOString()
            };
            return res.json(memStore.pedidos_venda[idx]);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`
                UPDATE pedidos_venda SET cliente_id=$1, cliente_nome=$2, data_emissao=$3, data_entrega=$4, status=$5,
                    condicao_pagamento=$6, observacoes=$7, desconto_pct=$8, frete=$9,
                    total_itens=$10, total_geral=$11, criado_por_perfil=$12, endereco_entrega=$13,
                    responsavel_recebimento=$14, tipo_frete=$15, atualizado_em=NOW()
                WHERE id=$16
            `, [cid, cliente_nome || '', data_emissao, data_entrega || null, status, condicao_pagamento,
                 observacoes, desc, fr, total_itens, total_geral, criado_por_perfil,
                 endereco_entrega, responsavel_recebimento, tipo_frete, id]);
            await client.query('DELETE FROM pedidos_venda_itens WHERE pedido_id = $1', [id]);
            for (const item of (itens || [])) {
                await client.query(`
                    INSERT INTO pedidos_venda_itens (pedido_id, material_id, descricao, unidade, quantidade, preco_unitario, desconto_item, total_item)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                `, [id, item.material_id || null, item.descricao, item.unidade || 'kg',
                     item.quantidade, item.preco_unitario, item.desconto_item || 0, item.total_item]);
            }
            await client.query('COMMIT');
            const updated = await pool.query('SELECT * FROM pedidos_venda WHERE id=$1', [id]);
            res.json(updated.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar pedido
app.delete('/api/pedidos-venda/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            memStore.pedidos_venda = (memStore.pedidos_venda || []).filter(x => x.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM pedidos_venda WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ROTAS PEDIDOS DE COMPRA ─────────────────────────────────────────────────
app.get('/api/pedidos-compra/proximo-numero', async (req, res) => {
    try {
        if (!dbAvailable) {
            const count = (memStore.pedidos_compra || []).length;
            return res.json({ numero: 'PC-' + String(count + 1).padStart(4, '0') });
        }
        const r = await pool.query("SELECT numero FROM pedidos_compra WHERE length(numero) <= 10 AND numero LIKE 'PC-%' ORDER BY id DESC LIMIT 1");
        if (r.rows.length === 0) return res.json({ numero: 'PC-0001' });
        const last = parseInt((r.rows[0].numero || '').replace(/PC-|PV-/g, '')) || 0;
        const next = 'PC-' + String(last + 1).padStart(4, '0');
        return res.json({ numero: next });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pedidos-compra', async (req, res) => {
    try {
        if (!dbAvailable) {
            const list = (memStore.pedidos_compra || []).map(p => {
                const forn = (memStore.fornecedores || []).find(f => f.id == p.fornecedor_id);
                return {
                    ...p,
                    fornecedor_nome: p.fornecedor_nome || (forn ? (forn.nome || forn.apelido) : 'Fornecedor Avulso'),
                    cliente_cnpj: forn ? forn.cnpj : '',
                    cliente_cidade: forn ? forn.cidade : '',
                    cliente_uf: forn ? forn.uf : ''
                };
            });
            return res.json(list.sort((a, b) => b.id - a.id));
        }
        const r = await pool.query(`
            SELECT pc.*, COALESCE(f.nome, pc.fornecedor_nome, 'Fornecedor') AS fornecedor_nome,
                   f.cnpj AS cliente_cnpj, f.cidade AS cliente_cidade, f.uf AS cliente_uf
            FROM pedidos_compra pc
            LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
            ORDER BY pc.id DESC
        `);
        return res.json(r.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pedidos-compra/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            const p = (memStore.pedidos_compra || []).find(x => x.id === id);
            if (!p) return res.status(404).json({ error: 'Pedido não encontrado' });
            const forn = (memStore.fornecedores || []).find(f => f.id == p.fornecedor_id);
            return res.json({
                ...p,
                fornecedor_nome: p.fornecedor_nome || (forn ? (forn.nome || forn.apelido) : ''),
                cliente_cnpj: forn ? forn.cnpj : '',
                cliente_telefone: forn ? forn.fone1 : '',
                cliente_email: forn ? forn.email : '',
                cliente_endereco: forn ? forn.endereco : '',
                cliente_cidade: forn ? forn.cidade : '',
                cliente_uf: forn ? forn.uf : ''
            });
        }
        const pedido = await pool.query(`
            SELECT pc.*, COALESCE(f.nome, pc.fornecedor_nome, '') AS fornecedor_nome,
                   f.cnpj AS cliente_cnpj, f.fone1 AS cliente_telefone,
                   f.email AS cliente_email, f.endereco AS cliente_endereco,
                   f.cidade AS cliente_cidade, f.uf AS cliente_uf
            FROM pedidos_compra pc
            LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
            WHERE pc.id = $1
        `, [id]);
        if (pedido.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
        const itens = await pool.query('SELECT * FROM pedidos_compra_itens WHERE pedido_id = $1 ORDER BY id', [id]);
        return res.json({ ...pedido.rows[0], itens: itens.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/pedidos-compra', async (req, res) => {
    try {
        const { numero, fornecedor_id, fornecedor_nome, data_emissao, data_entrega, status, condicao_pagamento,
                observacoes, desconto_pct, frete, itens, criado_por, criado_por_perfil,
                endereco_entrega, responsavel_recebimento, tipo_frete } = req.body;
        if (!fornecedor_id && !fornecedor_nome) {
            return res.status(400).json({ error: 'Fornecedor é obrigatório.' });
        }
        if (!itens || itens.length === 0) {
            return res.status(400).json({ error: 'Ao menos um item é obrigatório.' });
        }
        const total_itens = itens.reduce((s, i) => s + parseFloat(i.total_item || 0), 0);
        const desc = parseFloat(desconto_pct || 0);
        const fr = parseFloat(frete || 0);
        const total_geral = total_itens * (1 - desc / 100) + fr;
        const fid = (fornecedor_id && !isNaN(parseInt(fornecedor_id))) ? parseInt(fornecedor_id) : null;

        if (!dbAvailable) {
            if (!memStore.pedidos_compra) memStore.pedidos_compra = [];
            const newId = nextId++;
            const item = {
                id: newId,
                numero: numero || ('PC-' + String(newId).padStart(4, '0')),
                fornecedor_id: fid,
                fornecedor_nome: fornecedor_nome || '',
                data_emissao: data_emissao || new Date().toISOString().split('T')[0],
                data_entrega: data_entrega || null,
                status: status || 'Rascunho',
                condicao_pagamento: condicao_pagamento || '',
                observacoes: observacoes || '',
                desconto_pct: desc,
                frete: fr,
                total_itens,
                total_geral,
                criado_por: criado_por || 'Admin',
                criado_por_perfil: criado_por_perfil || 'Administrador',
                endereco_entrega: endereco_entrega || '',
                responsavel_recebimento: responsavel_recebimento || '',
                tipo_frete: tipo_frete || 'CIF - Entrega APEXTECH',
                itens: itens.map((it, idx) => ({ id: idx + 1, ...it })),
                criado_em: new Date().toISOString()
            };
            memStore.pedidos_compra.push(item);
            return res.json(item);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const pedido = await client.query(`
                INSERT INTO pedidos_compra (numero, fornecedor_id, fornecedor_nome, data_emissao, data_entrega, status, condicao_pagamento,
                    observacoes, desconto_pct, frete, total_itens, total_geral, criado_por, criado_por_perfil,
                    endereco_entrega, responsavel_recebimento, tipo_frete)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING *
            `, [numero, fid, fornecedor_nome || '', data_emissao || new Date().toISOString().split('T')[0],
                 data_entrega || null, status || 'Rascunho', condicao_pagamento, observacoes,
                 desc, fr, total_itens, total_geral, criado_por, criado_por_perfil,
                 endereco_entrega, responsavel_recebimento, tipo_frete]);

            const pedidoId = pedido.rows[0].id;
            for (const item of itens) {
                await client.query(`
                    INSERT INTO pedidos_compra_itens (pedido_id, material_id, descricao, unidade, quantidade, preco_unitario, desconto_item, total_item)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [pedidoId, item.material_id || null, item.descricao, item.unidade || 'kg',
                     item.quantidade, item.preco_unitario, item.desconto_item || 0, item.total_item]);
            }

            await client.query('COMMIT');
            res.json(pedido.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Erro ao criar pedido de compra:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/pedidos-compra/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { fornecedor_id, fornecedor_nome, data_emissao, data_entrega, status, condicao_pagamento,
                observacoes, desconto_pct, frete, itens, criado_por_perfil,
                endereco_entrega, responsavel_recebimento, tipo_frete, aprovado_por } = req.body;
        const total_itens = (itens || []).reduce((s, i) => s + parseFloat(i.total_item || 0), 0);
        const desc = parseFloat(desconto_pct || 0);
        const fr = parseFloat(frete || 0);
        const total_geral = total_itens * (1 - desc / 100) + fr;
        const fid = (fornecedor_id && !isNaN(parseInt(fornecedor_id))) ? parseInt(fornecedor_id) : null;

        if (!dbAvailable) {
            const idx = (memStore.pedidos_compra || []).findIndex(x => x.id === id);
            if (idx === -1) return res.status(404).json({ error: 'Pedido não encontrado' });
            memStore.pedidos_compra[idx] = {
                ...memStore.pedidos_compra[idx],
                fornecedor_id: fid || memStore.pedidos_compra[idx].fornecedor_id,
                fornecedor_nome: fornecedor_nome !== undefined ? fornecedor_nome : memStore.pedidos_compra[idx].fornecedor_nome,
                data_emissao,
                data_entrega,
                status,
                condicao_pagamento,
                observacoes,
                desconto_pct: desc,
                frete: fr,
                total_itens,
                total_geral,
                criado_por_perfil,
                endereco_entrega,
                responsavel_recebimento,
                tipo_frete,
                itens: (itens || []).map((it, i) => ({ id: i + 1, ...it })),
                atualizado_em: new Date().toISOString()
            };
            return res.json(memStore.pedidos_compra[idx]);
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let updateAprovacao = '';
            let params = [fid, fornecedor_nome || '', data_emissao, data_entrega || null, status, condicao_pagamento,
                 observacoes, desc, fr, total_itens, total_geral, criado_por_perfil,
                 endereco_entrega, responsavel_recebimento, tipo_frete];
            
            if (aprovado_por) {
                params.push(aprovado_por);
                updateAprovacao = `, aprovado_por=$${params.length}, data_aprovacao=NOW()`;
            }
            params.push(id);

            await client.query(`
                UPDATE pedidos_compra SET fornecedor_id=$1, fornecedor_nome=$2, data_emissao=$3, data_entrega=$4, status=$5,
                    condicao_pagamento=$6, observacoes=$7, desconto_pct=$8, frete=$9,
                    total_itens=$10, total_geral=$11, criado_por_perfil=$12, endereco_entrega=$13,
                    responsavel_recebimento=$14, tipo_frete=$15, atualizado_em=NOW()${updateAprovacao}
                WHERE id=$${params.length}
            `, params);

            await client.query('DELETE FROM pedidos_compra_itens WHERE pedido_id = $1', [id]);
            for (const item of (itens || [])) {
                await client.query(`
                    INSERT INTO pedidos_compra_itens (pedido_id, material_id, descricao, unidade, quantidade, preco_unitario, desconto_item, total_item)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [id, item.material_id || null, item.descricao, item.unidade || 'kg',
                     item.quantidade, item.preco_unitario, item.desconto_item || 0, item.total_item]);
            }
            await client.query('COMMIT');
            const updRows = await pool.query('SELECT * FROM pedidos_compra WHERE id = $1 LIMIT 1', [id]);
            res.json(updRows.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/pedidos-compra/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!dbAvailable) {
            memStore.pedidos_compra = (memStore.pedidos_compra || []).filter(x => x.id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM pedidos_compra WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─── Master Password Update ──────────────────────────────────────────────────
app.put('/api/usuarios/:id/password', authMiddleware, async (req, res) => {
    try {
        const userRole = (req.user?.perfil || '').trim().toLowerCase();
        if (!userRole.includes('admin') && !userRole.includes('master')) {
            return res.status(403).json({ error: 'Acesso negado. Apenas o Administrador Master pode alterar senhas por esta via.' });
        }
        const userId = parseInt(req.params.id);
        const { novaSenha } = req.body;
        if (!novaSenha) {
            return res.status(400).json({ error: 'A nova senha é obrigatória.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(novaSenha, salt);

        if (dbAvailable) {
            await pool.query('UPDATE usuarios SET pass = $1 WHERE id = $2', [hashedPassword, userId]);
            return res.json({ success: true, message: 'Senha atualizada com sucesso!' });
        } else {
            const u = (memStore.usuarios || []).find(x => x.id === userId);
            if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });
            u.pass = hashedPassword;
            return res.json({ success: true, message: 'Senha atualizada com sucesso no memStore.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── API: Planejamento Estratégico V3 (Planos e Mix) ─────────────────────────
const ESTRATEGIA_STATUS_VALIDOS = ['EM ANDAMENTO', 'CONCLUIDO', 'FINALIZADO'];
// Pedidos que ainda não representam venda/compra efetiva não entram no realizado
const PEDIDO_STATUS_NAO_REALIZADO = ['Cancelado', 'Rascunho', 'Em Cotação'];

function _numOuNulo(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
}

/** Valida e normaliza o corpo de um plano estratégico. Retorna { erro } ou { plano }. */
function validarPlanoEstrategico(body) {
    const b = body || {};
    const titulo = String(b.titulo || b.nome || '').trim().slice(0, 150);
    const data_inicial = b.data_inicial || b.data_inicio;
    const data_final = b.data_final || b.data_fim;
    const itensRecebidos = b.mix || b.itens || [];

    if (!titulo) return { erro: 'Informe o título do plano.' };
    const dIni = new Date(data_inicial), dFim = new Date(data_final);
    if (!data_inicial || !data_final || isNaN(dIni) || isNaN(dFim)) return { erro: 'Informe datas de início e fim válidas.' };
    if (dFim < dIni) return { erro: 'A data final deve ser igual ou posterior à data inicial.' };

    const frente = b.frente === 'compra' ? 'compra' : 'venda';
    const meta = _numOuNulo(b.meta_faturamento);
    if (Number.isNaN(meta) || (meta !== null && meta < 0)) return { erro: 'Meta de faturamento inválida.' };
    if (!Array.isArray(itensRecebidos)) return { erro: 'O mix de produtos é inválido.' };

    const cenarios = {};
    for (const [campo, padrao] of [['cenario_conservador_pct', 80], ['cenario_moderado_pct', 100], ['cenario_agressivo_pct', 120]]) {
        const v = _numOuNulo(b[campo]);
        if (Number.isNaN(v) || (v !== null && (v <= 0 || v > 999))) return { erro: 'Percentuais de cenário devem ficar entre 0 e 999.' };
        cenarios[campo] = v === null ? padrao : v;
    }

    let somaFracao = 0;
    const mix = [];
    for (const item of itensRecebidos) {
        const material_id = parseInt(item && item.material_id);
        if (!Number.isInteger(material_id)) return { erro: 'Há um item do mix sem material.' };
        const campos = {};
        for (const campo of ['fracao_pct', 'volume_necessario', 'faturamento_alvo', 'investimento_necessario', 'rendimento_pct']) {
            const v = _numOuNulo(item[campo]);
            if (Number.isNaN(v) || (v !== null && v < 0)) return { erro: `Valor inválido em "${campo}" no mix.` };
            campos[campo] = v;
        }
        const fracao_pct = campos.fracao_pct === null ? 0 : campos.fracao_pct;
        const rendimento_pct = campos.rendimento_pct === null ? 100 : campos.rendimento_pct;
        if (fracao_pct > 100) return { erro: 'A fração de um produto não pode passar de 100%.' };
        if (rendimento_pct <= 0 || rendimento_pct > 100) return { erro: 'O rendimento deve ficar entre 0 e 100%.' };
        somaFracao += fracao_pct;
        mix.push({
            material_id, fracao_pct, rendimento_pct,
            volume_necessario: campos.volume_necessario || 0,
            faturamento_alvo: campos.faturamento_alvo || 0,
            investimento_necessario: campos.investimento_necessario || 0
        });
    }
    if (somaFracao > 100.5) return { erro: `O mix soma ${somaFracao.toFixed(1)}%. Reduza as frações para no máximo 100%.` };

    return { plano: { titulo, data_inicial, data_final, frente, meta_faturamento: meta || 0, ...cenarios, mix } };
}

app.get('/api/estrategiav3_planos', async (req, res) => {
    try {
        if (!dbAvailable) {
            const planos = memStore.estrategiav3_planos || [];
            const mix = memStore.estrategiav3_mix || [];
            const resultado = planos.map(p => ({
                ...p,
                itens: mix.filter(m => m.plano_id === p.id)
            }));
            return res.json({ success: true, planos: resultado });
        }
        const planosRes = await pool.query('SELECT * FROM estrategiav3_planos ORDER BY id DESC');
        const mixRes = await pool.query('SELECT * FROM estrategiav3_mix');
        const resultado = planosRes.rows.map(p => ({
            ...p,
            itens: mixRes.rows.filter(m => m.plano_id === p.id)
        }));
        res.json({ success: true, planos: resultado });
    } catch (err) {
        console.warn('⚠️ Erro GET estrategiav3_planos:', err.message);
        res.status(500).json({ error: 'Erro ao buscar planos' });
    }
});

app.post('/api/estrategiav3_planos', async (req, res) => {
    const { erro, plano } = validarPlanoEstrategico(req.body);
    if (erro) return res.status(400).json({ error: erro });
    const { titulo, data_inicial, data_final, frente, meta_faturamento, mix, cenario_conservador_pct, cenario_moderado_pct, cenario_agressivo_pct } = plano;
    try {
        if (!dbAvailable) {
            if (!memStore.estrategiav3_planos) memStore.estrategiav3_planos = [];
            if (!memStore.estrategiav3_mix) memStore.estrategiav3_mix = [];
            const newId = nextId++;
            memStore.estrategiav3_planos.push({
                id: newId,
                titulo, data_inicial, data_final, frente, meta_faturamento,
                status: 'EM ANDAMENTO',
                cenario_conservador_pct, cenario_moderado_pct, cenario_agressivo_pct,
                criado_em: new Date().toISOString()
            });
            for (const item of mix) {
                memStore.estrategiav3_mix.push({ id: nextId++, plano_id: newId, ...item, faturamento_realizado: 0 });
            }
            return res.json({ success: true, plano_id: newId });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const planoRes = await client.query(`
                INSERT INTO estrategiav3_planos (titulo, data_inicial, data_final, frente, meta_faturamento, cenario_conservador_pct, cenario_moderado_pct, cenario_agressivo_pct)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [titulo, data_inicial, data_final, frente, meta_faturamento, cenario_conservador_pct, cenario_moderado_pct, cenario_agressivo_pct]);
            const planoId = planoRes.rows[0].id;

            for (const item of mix) {
                await client.query(`
                    INSERT INTO estrategiav3_mix (plano_id, material_id, fracao_pct, volume_necessario, faturamento_alvo, investimento_necessario, rendimento_pct)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [planoId, item.material_id, item.fracao_pct, item.volume_necessario, item.faturamento_alvo, item.investimento_necessario, item.rendimento_pct]);
            }
            await client.query('COMMIT');
            res.json({ success: true, plano_id: planoId });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('⚠️ Erro POST estrategiav3_planos:', err);
        res.status(500).json({ error: 'Erro ao salvar plano estratégico' });
    }
});

app.delete('/api/estrategiav3_planos/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        if (!dbAvailable) {
            memStore.estrategiav3_planos = (memStore.estrategiav3_planos || []).filter(x => x.id !== id);
            memStore.estrategiav3_mix = (memStore.estrategiav3_mix || []).filter(x => x.plano_id !== id);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM estrategiav3_planos WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('⚠️ Erro DELETE estrategiav3_planos:', err);
        res.status(500).json({ error: 'Erro ao excluir plano' });
    }
});

app.put('/api/estrategiav3_planos/:id/status', async (req, res) => {
    const id = parseInt(req.params.id);
    const status = String((req.body || {}).status || '').trim().toUpperCase();
    if (!ESTRATEGIA_STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Use: ${ESTRATEGIA_STATUS_VALIDOS.join(', ')}.` });
    }
    try {
        if (!dbAvailable) {
            const p = (memStore.estrategiav3_planos || []).find(x => x.id === id);
            if (p) p.status = status;
            return res.json({ success: true });
        }
        await pool.query('UPDATE estrategiav3_planos SET status = $1 WHERE id = $2', [status, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('⚠️ Erro PUT STATUS:', err);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

app.put('/api/estrategiav3_planos/:id/resultado_real', async (req, res) => {
    const id = parseInt(req.params.id);
    const { observacoes } = req.body || {};
    const faturamento_realizado = _numOuNulo((req.body || {}).faturamento_realizado);
    const investimento_realizado = _numOuNulo((req.body || {}).investimento_realizado);
    const volume_realizado = _numOuNulo((req.body || {}).volume_realizado);
    for (const v of [faturamento_realizado, investimento_realizado, volume_realizado]) {
        if (Number.isNaN(v) || (v !== null && v < 0)) return res.status(400).json({ error: 'Valores do resultado real inválidos.' });
    }
    try {
        if (!dbAvailable) {
            const p = (memStore.estrategiav3_planos || []).find(x => x.id === id);
            if (p) {
                p.faturamento_realizado = faturamento_realizado;
                p.investimento_realizado = investimento_realizado;
                p.volume_realizado = volume_realizado;
                p.observacoes = observacoes;
                p.status = 'CONCLUIDO';
            }
            return res.json({ success: true });
        }
        await pool.query(`
            UPDATE estrategiav3_planos
            SET faturamento_realizado = $1,
                investimento_realizado = $2,
                volume_realizado = $3,
                observacoes = $4,
                status = 'CONCLUIDO'
            WHERE id = $5
        `, [faturamento_realizado, investimento_realizado, volume_realizado, observacoes || '', id]);
        res.json({ success: true });
    } catch (err) {
        console.error('⚠️ Erro PUT resultado_real:', err);
        res.status(500).json({ error: 'Erro ao salvar resultado real' });
    }
});

// Realizado automático: soma os pedidos de venda e de compra do período do plano, por material do mix
app.get('/api/estrategiav3_planos/:id/realizado-pedidos', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        let plano, itensMix, vendas = [], compras = [];

        if (!dbAvailable) {
            plano = (memStore.estrategiav3_planos || []).find(x => x.id === id);
            if (!plano) return res.status(404).json({ error: 'Plano não encontrado.' });
            itensMix = (memStore.estrategiav3_mix || []).filter(m => m.plano_id === id);
            const ini = String(plano.data_inicial).slice(0, 10), fim = String(plano.data_final).slice(0, 10);
            const somar = (pedidos) => {
                const acc = {};
                (pedidos || []).forEach(pd => {
                    const data = String(pd.data_emissao || pd.criado_em || '').slice(0, 10);
                    if (PEDIDO_STATUS_NAO_REALIZADO.includes(pd.status) || data < ini || data > fim) return;
                    (pd.itens || []).forEach(i => {
                        if (i.material_id == null) return;
                        const a = acc[i.material_id] || (acc[i.material_id] = { material_id: i.material_id, kg: 0, valor: 0 });
                        a.kg += parseFloat(i.quantidade || 0);
                        a.valor += parseFloat(i.total_item != null ? i.total_item : (i.quantidade || 0) * (i.preco_unitario || 0));
                    });
                });
                return Object.values(acc);
            };
            vendas = somar(memStore.pedidos_venda);
            compras = somar(memStore.pedidos_compra);
        } else {
            const planoRes = await pool.query('SELECT * FROM estrategiav3_planos WHERE id = $1', [id]);
            if (planoRes.rows.length === 0) return res.status(404).json({ error: 'Plano não encontrado.' });
            plano = planoRes.rows[0];
            itensMix = (await pool.query('SELECT * FROM estrategiav3_mix WHERE plano_id = $1', [id])).rows;
            const somaSql = (tabela) => `
                SELECT i.material_id, COALESCE(SUM(i.quantidade), 0) AS kg, COALESCE(SUM(i.total_item), 0) AS valor
                FROM ${tabela}_itens i
                JOIN ${tabela} p ON p.id = i.pedido_id
                WHERE p.status <> ALL($1) AND p.data_emissao BETWEEN $2 AND $3 AND i.material_id IS NOT NULL
                GROUP BY i.material_id
            `;
            const params = [PEDIDO_STATUS_NAO_REALIZADO, plano.data_inicial, plano.data_final];
            vendas = (await pool.query(somaSql('pedidos_venda'), params)).rows;
            compras = (await pool.query(somaSql('pedidos_compra'), params)).rows;
        }

        const idsMix = itensMix.map(m => parseInt(m.material_id));
        const porMaterial = (lista, matId) => lista.find(x => parseInt(x.material_id) === matId) || { kg: 0, valor: 0 };
        const itens = itensMix.map(m => {
            const matId = parseInt(m.material_id);
            const v = porMaterial(vendas, matId), c = porMaterial(compras, matId);
            return {
                mix_id: m.id,
                material_id: matId,
                faturamento_alvo: parseFloat(m.faturamento_alvo || 0),
                volume_planejado_kg: parseFloat(m.volume_necessario || 0),
                investimento_planejado: parseFloat(m.investimento_necessario || 0),
                vendido_kg: parseFloat(v.kg || 0),
                faturamento_realizado: parseFloat(v.valor || 0),
                comprado_kg: parseFloat(c.kg || 0),
                investimento_realizado: parseFloat(c.valor || 0)
            };
        });
        const soma = (campo) => parseFloat(itens.reduce((t, i) => t + i[campo], 0).toFixed(2));
        const foraDoMix = (lista) => parseFloat(lista.filter(x => !idsMix.includes(parseInt(x.material_id))).reduce((t, x) => t + parseFloat(x.valor || 0), 0).toFixed(2));

        res.json({
            success: true,
            plano_id: id,
            periodo: { inicio: plano.data_inicial, fim: plano.data_final },
            criterio: `Pedidos emitidos no período, exceto ${PEDIDO_STATUS_NAO_REALIZADO.join(', ')}; somente materiais do mix.`,
            itens,
            totais: {
                faturamento_realizado: soma('faturamento_realizado'),
                investimento_realizado: soma('investimento_realizado'),
                vendido_kg: soma('vendido_kg'),
                comprado_kg: soma('comprado_kg'),
                faturamento_fora_do_mix: foraDoMix(vendas),
                investimento_fora_do_mix: foraDoMix(compras)
            }
        });
    } catch (err) {
        console.error('⚠️ Erro GET realizado-pedidos:', err);
        res.status(500).json({ error: 'Erro ao calcular o realizado a partir dos pedidos' });
    }
});

app.put('/api/estrategiav3_mix/:id/realizado', async (req, res) => {
    const id = parseInt(req.params.id);
    const faturamento_realizado = _numOuNulo((req.body || {}).faturamento_realizado);
    if (faturamento_realizado === null || Number.isNaN(faturamento_realizado) || faturamento_realizado < 0) {
        return res.status(400).json({ error: 'Faturamento realizado inválido.' });
    }
    try {
        if (!dbAvailable) {
            const m = (memStore.estrategiav3_mix || []).find(x => x.id === id);
            if (m) m.faturamento_realizado = faturamento_realizado;
            return res.json({ success: true });
        }
        await pool.query('UPDATE estrategiav3_mix SET faturamento_realizado = $1 WHERE id = $2', [faturamento_realizado, id]);
        res.json({ success: true });
    } catch (err) {
        console.error('⚠️ Erro PUT estrategiav3_mix:', err);
        res.status(500).json({ error: 'Erro ao atualizar realizado' });
    }
});

// ─── API: Forecast e Estratégia de Compras ───────────────────────────────────
app.get('/api/planejamento/compras/forecast', async (req, res) => {
    try {
        let rows = [];
    if (dbAvailable && pool) {
        try {
            const queryStr = `
                SELECT 
                    mc.id, 
                    mc.nome, 
                    mc.categoria,
                    COALESCE(mc.estoque_atual, 0) as estoque_atual, 
                    COALESCE(tp.preco_entregar, 0) as preco_compra, 
                    COALESCE(tp.venda_ref, 0) as preco_venda,
                    COALESCE(tp.comissao, 0) as comissao,
                    COALESCE(tp.pis_cofins, 0) as pis_cofins,
                    COALESCE(tp.fidc, 0) as fidc,
                    COALESCE(tp.icms, 0) as icms,
                    (SELECT COALESCE(SUM(pvi.quantidade), 0) 
                     FROM pedidos_venda_itens pvi 
                     JOIN pedidos_venda pv ON pvi.pedido_id = pv.id 
                     WHERE pv.status != 'Cancelado' 
                     AND pvi.material_id = mc.id 
                     AND pv.criado_em >= NOW() - INTERVAL '90 days') as demanda_90d,
                     
                    (SELECT COALESCE(SUM(pci.quantidade), 0) 
                     FROM pedidos_compra_itens pci 
                     JOIN pedidos_compra pc ON pci.pedido_id = pc.id 
                     WHERE pc.status NOT IN ('Cancelado', 'Entregue') 
                     AND pci.material_id = mc.id) as compras_pendentes
                     
                FROM materiais_catalogo mc
                LEFT JOIN tabela_precos tp ON mc.id = tp.material_id
                ORDER BY mc.categoria, mc.nome;
            `;
            const result = await pool.query(queryStr);
            if (result && result.rows) {
                rows = result.rows;
            }
        } catch (err) {
            console.warn('⚠️ Erro BD Forecast, caindo para memStore:', err.message);
        }
    }

    if (rows.length === 0) {
        const matList = memStore.materiais_catalogo || [];
        const tpList = memStore.tabela_precos || [];
        
        rows = matList.map(mc => {
            const tp = tpList.find(x => x.material_id === mc.id) || {};
            let demanda_90d = 0;
            let compras_pendentes = 0;
            
            const limite90d = Date.now() - 90 * 24 * 60 * 60 * 1000;
            (memStore.pedidos_venda || []).forEach(pv => {
                const criado = new Date(pv.criado_em || pv.data_emissao || Date.now()).getTime();
                if (pv.status !== 'Cancelado' && criado >= limite90d) {
                    (pv.itens || []).forEach(i => {
                        if (i.material_id === mc.id) demanda_90d += parseFloat(i.quantidade || 0);
                    });
                }
            });
            
            (memStore.pedidos_compra || []).forEach(pc => {
                if (pc.status !== 'Cancelado' && pc.status !== 'Entregue') {
                    (pc.itens || []).forEach(i => {
                        if (i.material_id === mc.id) compras_pendentes += i.quantidade;
                    });
                }
            });

            return {
                id: mc.id,
                nome: mc.nome,
                categoria: mc.categoria,
                estoque_atual: mc.estoque_atual || 0,
                preco_compra: tp.preco_entregar || 0,
                preco_venda: tp.venda_ref || 0,
                comissao: tp.comissao || 0,
                pis_cofins: tp.pis_cofins || 0,
                fidc: tp.fidc || 0,
                icms: tp.icms || 0,
                demanda_90d: demanda_90d,
                compras_pendentes: compras_pendentes
            };
        });
    }

        const forecast = rows.map(r => {
            const pVenda = parseFloat(r.preco_venda || 0);
            const pCompra = parseFloat(r.preco_compra || 0);
            // Margem líquida (após comissão, PIS/COFINS, FIDC e ICMS): mesma regra do simulador e do ranking
            const mg = ApexEngine.calcularMargemMaterial(
                { venda_ref: pVenda, preco_entregar: pCompra, comissao: r.comissao, pis_cofins: r.pis_cofins, fidc: r.fidc, icms: r.icms },
                { operacao: 'entrega' }
            );
            const margem = mg.margemLiquidaPct;
            const demanda_mensal_media = parseFloat(r.demanda_90d || 0) / 3.0;
            const estoque_projetado = parseFloat(r.estoque_atual || 0) + parseFloat(r.compras_pendentes || 0);
            
            let sug_conservadora = Math.max(0, demanda_mensal_media - estoque_projetado);
            let fator_moderado = margem > 20 ? 2.0 : 1.5;
            let sug_moderada = Math.max(0, (demanda_mensal_media * fator_moderado) - estoque_projetado);
            let fator_agressivo = margem > 30 ? 4.0 : 3.0;
            let sug_agressiva = Math.max(0, (demanda_mensal_media * fator_agressivo) - estoque_projetado);
            
            let acao = 'AGUARDAR';
            let motivo = 'Estoque saudável para a demanda atual.';
            if (sug_conservadora > 0) {
                acao = 'COMPRAR';
                motivo = 'Estoque projetado não cobre os próximos 30 dias.';
            } else if (estoque_projetado > demanda_mensal_media * 5 && demanda_mensal_media > 0) {
                acao = 'VENDER ESTOQUE';
                motivo = 'Alto volume de estoque imobilizado (>5 meses).';
            } else if (sug_moderada > 0 && margem > 25) {
                acao = 'OPORTUNIDADE';
                motivo = 'Margem alta, considere formar estoque moderado/agressivo.';
            }

            return {
                id: r.id,
                nome: r.nome,
                categoria: r.categoria,
                estoque_atual: parseFloat(r.estoque_atual || 0),
                compras_pendentes: parseFloat(r.compras_pendentes || 0),
                estoque_projetado: parseFloat(estoque_projetado.toFixed(2)),
                demanda_90d: parseFloat(r.demanda_90d || 0),
                demanda_mensal: parseFloat(demanda_mensal_media.toFixed(2)),
                preco_compra: pCompra,
                preco_venda: pVenda,
                margem_pct: parseFloat(margem.toFixed(2)),
                margem_bruta_pct: parseFloat(mg.margemBrutaPct.toFixed(2)),
                lucro_liquido_kg: parseFloat(mg.lucroLiquidoKg.toFixed(4)),
                acao_recomendada: acao,
                motivo_acao: motivo,
                cenarios: {
                    conservador: parseFloat(sug_conservadora.toFixed(2)),
                    moderado: parseFloat(sug_moderada.toFixed(2)),
                    agressivo: parseFloat(sug_agressiva.toFixed(2))
                }
            };
        });

        res.json(forecast);
    } catch (err) {
        console.error('⚠️ Erro GET /api/planejamento/compras/forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Setup e Migrações do Banco de Dados ──────────────────────────────────────
app.get('/api/admin/setup-db', async (req, res) => {
    const { exec } = require('child_process');
    const logs = [];

    const runCmd = (cmd) => new Promise((resolve) => {
        exec(cmd, (err, stdout, stderr) => {
            logs.push(`=== COMANDO: ${cmd} ===\n${err ? 'ERRO: ' + err.message + '\n' + stderr : stdout}`);
            resolve(!err);
        });
    });

    try {
        await runCmd('node scripts/force-migrations.js');
        await runCmd('npm run import:fornecedores');
        await runCmd('npm run import:clientes');
        res.send(`<pre style="background:#111;color:#0f0;padding:20px;font-family:monospace;white-space:pre-wrap;">${logs.join('\n\n')}</pre>`);
    } catch (e) {
        res.status(500).send(`<pre style="color:red;">ERRO NO SETUP: ${e.message}</pre>`);
    }
});

app.get('/api/admin/run-migrations', (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('node scripts/force-migrations.js', (err, stdout, stderr) => {
            if (err) {
                return res.status(500).send('<pre>ERRO:\n' + stderr + '\n\nSTDOUT:\n' + stdout + '</pre>');
            }
            res.send('<pre>SUCESSO:\n' + stdout + '\n\nAVISOS:\n' + stderr + '</pre>');
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/run-import-clientes', (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('npm run import:clientes', (err, stdout, stderr) => {
            if (err) {
                return res.status(500).send('<pre>ERRO:\n' + stderr + '\n\nSTDOUT:\n' + stdout + '</pre>');
            }
            res.send('<pre>SUCESSO:\n' + stdout + '\n\nAVISOS:\n' + stderr + '</pre>');
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/run-import-fornecedores', (req, res) => {
    try {
        const { exec } = require('child_process');
        exec('npm run import:fornecedores', (err, stdout, stderr) => {
            if (err) {
                return res.status(500).send('<pre>ERRO:\n' + stderr + '\n\nSTDOUT:\n' + stdout + '</pre>');
            }
            res.send('<pre>SUCESSO:\n' + stdout + '\n\nAVISOS:\n' + stderr + '</pre>');
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// INJEÇÃO DAS ROTAS DO MÓDULO PCP E WHATSAPP (WA-AKG)
// ==========================================
app.use('/whatsapp-media', express.static(path.join(__dirname, 'data/whatsapp_media')));
app.use('/api/pcp', require('./src/routes/pcp')(pool, dbAvailable, memStore));
app.use('/api/whatsapp', require('./src/routes/whatsapp')(pool, dbAvailable, memStore));

// Endpoint de Ponto de Restauração (Rollback Checkpoint)
app.get('/api/sistema/ponto-restauracao', (req, res) => {
    res.json({
        status: 'success',
        tag: 'before-whatsapp',
        commit: 'dab8553',
        mensagem: 'Ponto de restauração registrado com sucesso antes da criação do Módulo WhatsApp (WA-AKG).',
        data_registro: '2026-10-04',
        comando_restauracao: 'git reset --hard before-whatsapp'
    });
});

if (require.main === module) {
    initDatabase().then(() => {
        app.listen(PORT, () => {
            console.log(`🌿 Servidor da ApexTech Metais rodando em http://localhost:${PORT}`);
            console.log(`📦 Modo de dados: ${dbAvailable ? 'PostgreSQL' : 'Memória (local)'}`);
            startEmailScheduler();
        });
    });
}

module.exports = { app, initDatabase, pool, gerarPdfRelatorioViaHeadless, generateRelatorioSemanas };

