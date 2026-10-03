/**
 * Normaliza os dados brutos de um fornecedor vindos do Excel
 * de acordo com as regras de negócio especificadas.
 */

function cleanPhone(phoneRaw) {
    if (!phoneRaw) return null;
    const s = String(phoneRaw).trim();
    // Verifica se é placeholder vazio
    if (/^\(\s*\)\s*-\s*$/.test(s) || /^\(\s*\)\s*-$/.test(s)) return null;
    if (s.indexOf('(  )     -     ') !== -1) return null;
    // Extrai apenas dígitos
    const digits = s.replace(/\D/g, '');
    if (!digits || digits.length < 8) return null;
    return digits;
}

function cleanCnpj(cnpjRaw) {
    if (!cnpjRaw) return null;
    const s = String(cnpjRaw).trim();
    if (/^\s*\.\s*\.\s*\/\s*-\s*$/.test(s)) return null;
    if (s.indexOf('  .   .   /    -  ') !== -1) return null;
    const digits = s.replace(/\D/g, '');
    if (!digits) return null;
    return digits;
}

function cleanCpf(cpfRaw) {
    if (!cpfRaw) return null;
    const s = String(cpfRaw).trim();
    if (/^\s*\.\s*\.\s*-\s*$/.test(s)) return null;
    if (s.indexOf('   .   .   -  ') !== -1) return null;
    const digits = s.replace(/\D/g, '');
    if (!digits) return null;
    return digits;
}

function cleanCep(cepRaw) {
    if (!cepRaw) return null;
    const s = String(cepRaw).trim();
    if (/^\s*\.\s*-\s*$/.test(s)) return null;
    if (s.indexOf('  .   -   ') !== -1) return null;
    const digits = s.replace(/\D/g, '');
    if (!digits) return null;
    return digits;
}

function cleanDate(dateRaw) {
    if (!dateRaw) return null;
    
    // Se for objeto Date do Excel
    if (dateRaw instanceof Date) {
        return dateRaw.toISOString().split('T')[0];
    }

    const s = String(dateRaw).trim();
    if (/^\s*\/\s*\/\s*$/.test(s)) return null;
    if (s.indexOf('  /  /    ') !== -1) return null;

    // Se for dd/mm/aaaa
    const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
        return match[3] + '-' + match[2] + '-' + match[1]; // yyyy-mm-dd
    }

    return null;
}

function parseInteger(val, defaultVal = 0) {
    if (val === null || val === undefined || String(val).trim() === '') return defaultVal;
    const parsed = parseInt(String(val).replace(/\D/g, ''), 10);
    return isNaN(parsed) ? defaultVal : parsed;
}

function cleanString(str) {
    if (str === null || str === undefined) return null;
    const trimmed = String(str).trim();
    return trimmed === '' ? null : trimmed;
}

function normalizeFornecedor(row) {
    const codfor = parseInteger(row.codfor, null);
    if (codfor === null) {
        return { valid: false, reason: "Codfor nulo ou inválido", data: row };
    }

    const fornecedorNome = cleanString(row.fornecedor);
    if (!fornecedorNome) {
        return { valid: false, reason: "Nome do fornecedor vazio", data: row };
    }

    return {
        valid: true,
        data: {
            codfor: codfor,
            nome: fornecedorNome,
            apelido: cleanString(row.apelido),
            fone1: cleanPhone(row.fone1),
            fone2: cleanPhone(row.fone2),
            whatsapp: cleanPhone(row.whatsapp),
            celular: cleanPhone(row.celular),
            tabela: cleanString(row.tabela),
            concorrente: cleanString(row.concorrente),
            status_ok: cleanString(row.ok),
            dias: parseInteger(row.dias, 0),
            ultima_entrega: cleanDate(row.ultima_ent),
            tipo_pessoa: cleanString(row.tp) ? String(row.tp).trim().toUpperCase() : null,
            data_cadastro: cleanDate(row.data_cad),
            endereco: cleanString(row.endereco),
            numero: cleanString(row.numero),
            complemento: cleanString(row.complemento),
            bairro: cleanString(row.bairro),
            cidade: cleanString(row.cidade),
            uf: cleanString(row.uf),
            cep: cleanCep(row.cep),
            cnpj: cleanCnpj(row.cnpj),
            ie: cleanString(row.ie),
            im: cleanString(row.im),
            rg: cleanString(row.rg),
            emissor: cleanString(row.emissor),
            cpf: cleanCpf(row.cpf),
            comprador: cleanString(row.comprador),
            email: cleanString(row.email),
            condicao_pagamento: cleanString(row.condicao),
            usuario_cadastro: cleanString(row.usuario_que_cadastrou),
            ultimo_alterou: cleanString(row.ultimo_a_alterar),
            dias_atraso: parseInteger(row.dias_em_atraso, 0),
            dias_previsao: parseInteger(row.dias_de_previsao, 0),
            filial: cleanString(row.filial)
        }
    };
}

module.exports = { normalizeFornecedor };
