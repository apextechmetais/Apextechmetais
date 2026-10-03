/**
 * Normaliza os dados brutos de um cliente vindos do Excel
 * de acordo com as regras de negócio especificadas.
 */

function cleanPhone(phoneRaw) {
    if (!phoneRaw) return null;
    const s = String(phoneRaw).trim();
    if (/^\(\s*\)\s*-\s*$/.test(s) || /^\(\s*\)\s*-$/.test(s)) return null;
    if (s.indexOf('(  )     -     ') !== -1) return null;
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
    
    if (dateRaw instanceof Date) {
        return dateRaw.toISOString().split('T')[0];
    }

    const s = String(dateRaw).trim();
    if (/^\s*\/\s*\/\s*$/.test(s)) return null;
    if (s.indexOf('  /  /    ') !== -1) return null;

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

function normalizeCliente(row) {
    const codigo = parseInteger(row.codigo, null);
    if (codigo === null) {
        return { valid: false, reason: "Código nulo ou inválido", data: row };
    }

    const clienteNome = cleanString(row.cliente);
    if (!clienteNome) {
        return { valid: false, reason: "Nome do cliente vazio", data: row };
    }

    return {
        valid: true,
        data: {
            codigo: codigo,
            nome: clienteNome,
            fantasia: cleanString(row.fantasia),
            telefone1: cleanPhone(row.telefone1),
            telefone2: cleanPhone(row.telefone2),
            dias: parseInteger(row.dias, 0),
            ultima_saida: cleanDate(row.ultima_sai),
            endereco: cleanString(row.endereco),
            numero: cleanString(row.numero),
            bairro: cleanString(row.bairro),
            cidade: cleanString(row.cidade),
            uf: cleanString(row.uf),
            pais: cleanString(row.pais),
            cep: cleanCep(row.cep),
            cnpj: cleanCnpj(row.cnpj),
            ie: cleanString(row.ie),
            cpf: cleanCpf(row.cpf),
            rg: cleanString(row.rg),
            tipo_cliente: cleanString(row.tipo_cliente),
            contato_comercial: cleanString(row.contato_comercial),
            contato_financeiro: cleanString(row.contato_financeiro),
            status: cleanString(row.status) || 'ATIVO',
            email: cleanString(row.email),
            usuario_cadastro: cleanString(row.usuario_cadastro),
            ultimo_alterou: cleanString(row.ultimo_alterou),
            vendedor: cleanString(row.vendedor),
            atualizado: cleanDate(row.atualizado),
            filial: cleanString(row.filial)
        }
    };
}

module.exports = { normalizeCliente };
