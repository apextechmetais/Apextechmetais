CREATE TABLE IF NOT EXISTS pedidos_venda (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL,
    cliente_id INT,
    cliente_nome_avulso VARCHAR(255),
    data_emissao DATE DEFAULT CURRENT_DATE,
    data_entrega DATE,
    status VARCHAR(50) DEFAULT 'Rascunho',
    condicao_pagamento VARCHAR(100),
    observacoes TEXT,
    desconto_pct NUMERIC(10,2) DEFAULT 0,
    frete NUMERIC(10,2) DEFAULT 0,
    total_itens NUMERIC(12,2) DEFAULT 0,
    total_geral NUMERIC(12,2) DEFAULT 0,
    criado_por VARCHAR(100),
    criado_por_perfil VARCHAR(100),
    aprovado_por VARCHAR(100),
    data_aprovacao TIMESTAMP,
    endereco_entrega TEXT,
    responsavel_recebimento VARCHAR(255),
    tipo_frete VARCHAR(100),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos_venda_itens (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos_venda(id) ON DELETE CASCADE,
    material_id INT,
    descricao VARCHAR(255) NOT NULL,
    unidade VARCHAR(20) DEFAULT 'kg',
    quantidade NUMERIC(12,3) NOT NULL,
    preco_unitario NUMERIC(12,4) NOT NULL,
    desconto_item NUMERIC(10,2) DEFAULT 0,
    total_item NUMERIC(12,2) NOT NULL
);
