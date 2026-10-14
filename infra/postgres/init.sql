-- ============================================================================
-- ControleEstoque — Schema PostgreSQL 16
-- Sistema de Controle de Estoque e Vendas de Galões de Água
--
-- Fonte de verdade contábil: tabelas de LANÇAMENTO (ledger). Saldos são
-- calculados por views — nunca armazenados como coluna mutável isolada.
-- Todas as tabelas têm soft delete (deleted_at) e auditoria básica.
-- Executar: psql -U postgres -d controle_estoque -f init.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

-- O tipo determina o COMPORTAMENTO do produto no sistema, não a natureza dele:
-- AGUA           = refil (empresta casco normal ao cliente — gera débito)
-- GALAO_COMPLETO = casco + água vendidos como propriedade do cliente (sem débito)
-- CASCO          = casco normal vazio (item de estoque e de venda avulsa)
-- SUCATA         = vasilhame quebrado (nunca emprestado; só entra por entrega
--                  do cliente ou baixa de casco normal)
-- DESCARTAVEL    = estoque simples, sem regra de casco. Qualquer produto novo
--                  que a loja queira vender (carvão, copos, tampas, gelo etc.)
--                  é cadastrado como DESCARTAVEL — a categoria de exibição fica
--                  no campo produtos.categoria.
CREATE TYPE tipo_produto AS ENUM
    ('AGUA', 'GALAO_COMPLETO', 'CASCO', 'SUCATA', 'DESCARTAVEL');

CREATE TYPE tipo_movimento_estoque AS ENUM
    ('ENTRADA_ABASTECIMENTO', 'SAIDA_VENDA', 'DEVOLUCAO_CLIENTE',
     'ENTRADA_SUCATA', 'BAIXA_QUEBRA', 'AJUSTE');

CREATE TYPE forma_pagamento AS ENUM
    ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'OUTRO');

-- Venda só é PAGA quando a soma dos pagamentos cobre o total líquido.
CREATE TYPE status_pagamento_venda AS ENUM ('PENDENTE', 'PARCIAL', 'PAGA');

CREATE TYPE tipo_desconto AS ENUM ('VALOR', 'PERCENTUAL');

-- Ledger de casco NORMAL por cliente (sucata NÃO passa por aqui).
CREATE TYPE tipo_movimento_casco AS ENUM
    ('EMPRESTIMO',       -- venda de água: cheios entregues
     'DEVOLUCAO',        -- vazios devolvidos (na venda ou avulso)
     'CONVERSAO_VALOR'); -- débito de casco convertido em cobrança no fiado

CREATE TYPE tipo_lancamento_fiado AS ENUM
    ('DEBITO_VENDA',            -- parte não paga de uma venda
     'DEBITO_CONVERSAO_CASCO',  -- conversão de débito de casco em valor
     'CREDITO_CONVERSAO_SUCATA',-- sucata entregue convertida em crédito
     'PAGAMENTO');              -- baixa por pagamento do cliente

CREATE TYPE tipo_lancamento_funcionario AS ENUM ('DIARIA', 'VALE', 'PAGAMENTO');

CREATE TYPE tipo_frete AS ENUM ('TERCEIRIZADO', 'PROPRIO');

CREATE TYPE status_caixa AS ENUM ('ABERTO', 'FECHADO');

-- ----------------------------------------------------------------------------
-- RH / PERMISSIONAMENTO
-- ----------------------------------------------------------------------------

CREATE TABLE cargos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL UNIQUE,
    nativo      BOOLEAN NOT NULL DEFAULT FALSE, -- ADM: não editável/removível
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID,
    updated_at  TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);

-- Permissões granulares por tela/ação (ex: 'vendas.registrar', 'caixa.fechar').
CREATE TABLE cargo_permissoes (
    cargo_id    UUID NOT NULL REFERENCES cargos(id),
    permissao   TEXT NOT NULL,
    PRIMARY KEY (cargo_id, permissao)
);

CREATE TABLE funcionarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT NOT NULL,
    telefone      TEXT,
    cargo_id      UUID NOT NULL REFERENCES cargos(id),
    valor_diaria  NUMERIC(19,2) NOT NULL DEFAULT 0, -- diária fixa do funcionário
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    UUID,
    updated_at    TIMESTAMPTZ,
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_funcionarios_cargo ON funcionarios(cargo_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- CLIENTES
-- ----------------------------------------------------------------------------

CREATE TABLE clientes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    telefone    TEXT,
    observacoes TEXT,
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES funcionarios(id),
    updated_at  TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_clientes_nome ON clientes(nome) WHERE deleted_at IS NULL;

-- Cliente pode ter N endereços; a venda referencia um deles (sem rota/status).
CREATE TABLE cliente_enderecos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id  UUID NOT NULL REFERENCES clientes(id),
    logradouro  TEXT NOT NULL,
    numero      TEXT,
    bairro      TEXT,
    complemento TEXT,
    referencia  TEXT,
    principal   BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES funcionarios(id),
    updated_at  TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_cliente_enderecos_cliente ON cliente_enderecos(cliente_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- PRODUTOS E ESTOQUE
-- ----------------------------------------------------------------------------

-- Marcas cadastráveis (água e também descartáveis que tenham marca).
CREATE TABLE marcas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL UNIQUE,
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES funcionarios(id),
    updated_at  TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);

-- Preço de referência é apenas base: o preço efetivo é definido em cada venda.
CREATE TABLE produtos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo              tipo_produto NOT NULL,
    nome              TEXT NOT NULL,
    marca_id          UUID REFERENCES marcas(id), -- obrigatória p/ AGUA/GALAO_COMPLETO (validação de domínio); livre p/ demais
    categoria         TEXT,          -- agrupamento livre de exibição/relatório (ex: 'Carvão', 'Copos', 'Gelo')
    tamanho           TEXT,          -- livre: '20L', '10L', '200ml', '5kg' etc.
    foto_url          TEXT,          -- caminho/URL da foto do produto (upload via API)
    preco_referencia  NUMERIC(19,2) NOT NULL DEFAULT 0,
    estoque_minimo    INT NOT NULL DEFAULT 0, -- alerta configurável por produto
    created_by        UUID REFERENCES funcionarios(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        UUID REFERENCES funcionarios(id),
    updated_at        TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_produtos_tipo  ON produtos(tipo)     WHERE deleted_at IS NULL;
CREATE INDEX idx_produtos_marca ON produtos(marca_id) WHERE deleted_at IS NULL;

-- Ledger de estoque: saldo = SUM(quantidade). Quantidade é assinada
-- (+entrada / -saída). Casco normal vazio e sucata são produtos como os demais.
CREATE TABLE movimentos_estoque (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id   UUID NOT NULL REFERENCES produtos(id),
    tipo         tipo_movimento_estoque NOT NULL,
    quantidade   INT NOT NULL CHECK (quantidade <> 0),
    venda_id     UUID,  -- FK adicionada após criação de vendas
    abastecimento_id UUID, -- FK adicionada após criação de abastecimentos
    observacao   TEXT,
    created_by   UUID REFERENCES funcionarios(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX idx_mov_estoque_produto ON movimentos_estoque(produto_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mov_estoque_venda   ON movimentos_estoque(venda_id)   WHERE venda_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- ABASTECIMENTO
-- ----------------------------------------------------------------------------

CREATE TABLE abastecimentos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data            DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_frete      tipo_frete NOT NULL,
    custo_total     NUMERIC(19,2) NOT NULL DEFAULT 0, -- vinculado ao caixa como despesa
    funcionario_id  UUID REFERENCES funcionarios(id), -- motorista quando frete PROPRIO
    observacao      TEXT,
    created_by      UUID REFERENCES funcionarios(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES funcionarios(id),
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

-- Itens do abastecimento: galão completo e/ou casco vazio, cada um no seu estoque.
CREATE TABLE abastecimento_itens (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abastecimento_id UUID NOT NULL REFERENCES abastecimentos(id),
    produto_id       UUID NOT NULL REFERENCES produtos(id),
    quantidade       INT NOT NULL CHECK (quantidade > 0),
    custo_unitario   NUMERIC(19,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_abast_itens_abastecimento ON abastecimento_itens(abastecimento_id);

ALTER TABLE movimentos_estoque
    ADD CONSTRAINT fk_mov_estoque_abastecimento
    FOREIGN KEY (abastecimento_id) REFERENCES abastecimentos(id);

-- ----------------------------------------------------------------------------
-- VENDAS
-- ----------------------------------------------------------------------------

CREATE TABLE vendas (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id),
    funcionario_id       UUID NOT NULL REFERENCES funcionarios(id),
    endereco_entrega_id  UUID REFERENCES cliente_enderecos(id),
    data                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Totais desnormalizados por conveniência; recalculados pelo serviço a
    -- cada edição a partir de venda_itens (fonte de verdade).
    total_bruto          NUMERIC(19,2) NOT NULL DEFAULT 0,
    total_desconto       NUMERIC(19,2) NOT NULL DEFAULT 0,
    total_liquido        NUMERIC(19,2) NOT NULL DEFAULT 0,
    status_pagamento     status_pagamento_venda NOT NULL DEFAULT 'PENDENTE',
    observacao           TEXT,
    created_by           UUID REFERENCES funcionarios(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by           UUID REFERENCES funcionarios(id),
    updated_at           TIMESTAMPTZ,
    deleted_at           TIMESTAMPTZ
);

CREATE INDEX idx_vendas_cliente     ON vendas(cliente_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_vendas_funcionario ON vendas(funcionario_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendas_data        ON vendas(data)           WHERE deleted_at IS NULL;

-- Desconto é por item, manual (valor ou percentual), com motivo obrigatório.
CREATE TABLE venda_itens (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id         UUID NOT NULL REFERENCES vendas(id),
    produto_id       UUID NOT NULL REFERENCES produtos(id),
    quantidade       INT NOT NULL CHECK (quantidade > 0),
    preco_unitario   NUMERIC(19,2) NOT NULL CHECK (preco_unitario >= 0),
    desconto_tipo    tipo_desconto,
    desconto_valor   NUMERIC(19,2) CHECK (desconto_valor IS NULL OR desconto_valor >= 0),
    motivo_desconto  TEXT,
    total_item       NUMERIC(19,2) NOT NULL DEFAULT 0, -- calculado pelo sistema
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    -- desconto e motivo andam juntos: ou ambos presentes, ou nenhum
    CONSTRAINT chk_desconto_com_motivo CHECK (
        (desconto_tipo IS NULL AND desconto_valor IS NULL AND motivo_desconto IS NULL)
        OR
        (desconto_tipo IS NOT NULL AND desconto_valor IS NOT NULL AND motivo_desconto IS NOT NULL)
    )
);

CREATE INDEX idx_venda_itens_venda   ON venda_itens(venda_id)   WHERE deleted_at IS NULL;
CREATE INDEX idx_venda_itens_produto ON venda_itens(produto_id) WHERE deleted_at IS NULL;

-- N formas de pagamento por venda, cada uma com valor próprio.
CREATE TABLE venda_pagamentos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id    UUID NOT NULL REFERENCES vendas(id),
    forma       forma_pagamento NOT NULL,
    valor       NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    data        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_venda_pagamentos_venda ON venda_pagamentos(venda_id) WHERE deleted_at IS NULL;

-- Numeração sequencial dos cupons fiscais.
CREATE SEQUENCE cupom_fiscal_seq;

-- Cupom fiscal emitido a partir da venda.
CREATE TABLE cupons_fiscais (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id    UUID NOT NULL REFERENCES vendas(id),
    numero      TEXT NOT NULL,
    emitido_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload     JSONB, -- dados enviados/recebidos do emissor fiscal
    created_by  UUID REFERENCES funcionarios(id),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_cupons_venda ON cupons_fiscais(venda_id) WHERE deleted_at IS NULL;

ALTER TABLE movimentos_estoque
    ADD CONSTRAINT fk_mov_estoque_venda
    FOREIGN KEY (venda_id) REFERENCES vendas(id);

-- ----------------------------------------------------------------------------
-- CASCO NORMAL — LEDGER POR CLIENTE
-- (sucata NUNCA entra aqui; venda de água só empresta casco normal)
-- ----------------------------------------------------------------------------

CREATE TABLE movimentos_casco_cliente (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id  UUID NOT NULL REFERENCES clientes(id),
    venda_id    UUID REFERENCES vendas(id), -- NULL = movimentação avulsa
    tipo        tipo_movimento_casco NOT NULL,
    quantidade  INT NOT NULL CHECK (quantidade > 0),
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_mov_casco_cliente ON movimentos_casco_cliente(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mov_casco_venda   ON movimentos_casco_cliente(venda_id)   WHERE venda_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- SUCATA — REGISTRO POR CLIENTE
-- (não é débito; entrega NÃO abate saldo de casco normal)
-- ----------------------------------------------------------------------------

CREATE TABLE entregas_sucata_cliente (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id       UUID NOT NULL REFERENCES clientes(id),
    venda_id         UUID REFERENCES vendas(id), -- NULL = entrega avulsa
    quantidade       INT NOT NULL CHECK (quantidade > 0),
    valor_conversao  NUMERIC(19,2), -- NULL = não convertida em crédito no fiado
    created_by       UUID REFERENCES funcionarios(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_sucata_cliente ON entregas_sucata_cliente(cliente_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- BAIXA DE CASCO POR QUEBRA (estoque físico → sucata)
-- ----------------------------------------------------------------------------

CREATE TABLE baixas_casco (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quantidade  INT NOT NULL CHECK (quantidade > 0),
    motivo      TEXT,
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- Um ou mais funcionários responsáveis pela quebra.
CREATE TABLE baixa_casco_responsaveis (
    baixa_id        UUID NOT NULL REFERENCES baixas_casco(id),
    funcionario_id  UUID NOT NULL REFERENCES funcionarios(id),
    PRIMARY KEY (baixa_id, funcionario_id)
);

-- ----------------------------------------------------------------------------
-- FINANCEIRO — FIADO (conta corrente do cliente)
-- ----------------------------------------------------------------------------

CREATE TABLE lancamentos_fiado (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id  UUID NOT NULL REFERENCES clientes(id),
    venda_id    UUID REFERENCES vendas(id),
    tipo        tipo_lancamento_fiado NOT NULL,
    valor       NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    observacao  TEXT,
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_fiado_cliente ON lancamentos_fiado(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_fiado_venda   ON lancamentos_fiado(venda_id)   WHERE venda_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- FINANCEIRO — CAIXA
-- ----------------------------------------------------------------------------

CREATE TABLE caixas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data            DATE NOT NULL UNIQUE, -- um caixa por dia
    status          status_caixa NOT NULL DEFAULT 'ABERTO',
    saldo_inicial   NUMERIC(19,2) NOT NULL DEFAULT 0,
    -- Consolidados preenchidos no fechamento (derivados de vendas + despesas):
    total_entradas  NUMERIC(19,2),
    total_saidas    NUMERIC(19,2),
    saldo_final     NUMERIC(19,2),
    fechado_em      TIMESTAMPTZ,
    fechado_por     UUID REFERENCES funcionarios(id),
    created_by      UUID REFERENCES funcionarios(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES funcionarios(id),
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

-- Tipos de despesa cadastráveis (categorização obrigatória de cada despesa).
CREATE TABLE tipos_despesa (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL UNIQUE,
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE caixa_despesas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caixa_id         UUID NOT NULL REFERENCES caixas(id),
    tipo_despesa_id  UUID NOT NULL REFERENCES tipos_despesa(id),
    valor            NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    descricao        TEXT,
    abastecimento_id UUID REFERENCES abastecimentos(id), -- custo de abastecimento
    created_by       UUID REFERENCES funcionarios(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_caixa_despesas_caixa ON caixa_despesas(caixa_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- RH — CONTA CORRENTE DO FUNCIONÁRIO
-- (diária creditada no fechamento do caixa; NÃO é paga na hora)
-- ----------------------------------------------------------------------------

CREATE TABLE lancamentos_funcionario (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id  UUID NOT NULL REFERENCES funcionarios(id),
    caixa_id        UUID REFERENCES caixas(id), -- preenchido quando DIARIA
    tipo            tipo_lancamento_funcionario NOT NULL,
    valor           NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    observacao      TEXT,
    created_by      UUID REFERENCES funcionarios(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_lanc_func_funcionario ON lancamentos_funcionario(funcionario_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lanc_func_caixa       ON lancamentos_funcionario(caixa_id)       WHERE caixa_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- VIEWS DE SALDO (fonte de verdade = ledgers acima)
-- ----------------------------------------------------------------------------

-- Estoque atual por produto + flag de alerta de mínimo.
CREATE VIEW vw_estoque_atual AS
SELECT p.id AS produto_id,
       p.tipo,
       p.nome,
       ma.nome AS marca,
       p.categoria,
       p.tamanho,
       COALESCE(SUM(m.quantidade), 0)                     AS quantidade,
       p.estoque_minimo,
       COALESCE(SUM(m.quantidade), 0) <= p.estoque_minimo AS abaixo_minimo
FROM produtos p
LEFT JOIN marcas ma ON ma.id = p.marca_id
LEFT JOIN movimentos_estoque m
       ON m.produto_id = p.id AND m.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, ma.nome;

-- Saldo de casco NORMAL por cliente (positivo = cliente deve cascos à loja).
CREATE VIEW vw_saldo_casco_cliente AS
SELECT c.id AS cliente_id,
       c.nome,
       COALESCE(SUM(CASE m.tipo
           WHEN 'EMPRESTIMO'      THEN  m.quantidade
           WHEN 'DEVOLUCAO'       THEN -m.quantidade
           WHEN 'CONVERSAO_VALOR' THEN -m.quantidade
       END), 0) AS saldo_cascos
FROM clientes c
LEFT JOIN movimentos_casco_cliente m
       ON m.cliente_id = c.id AND m.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- Total de sucata entregue por cliente (registro, não débito).
CREATE VIEW vw_sucata_entregue_cliente AS
SELECT c.id AS cliente_id,
       c.nome,
       COALESCE(SUM(e.quantidade), 0) AS total_entregue
FROM clientes c
LEFT JOIN entregas_sucata_cliente e
       ON e.cliente_id = c.id AND e.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- Saldo devedor de fiado por cliente
-- (débitos − créditos de sucata − pagamentos; positivo = cliente deve).
CREATE VIEW vw_saldo_fiado_cliente AS
SELECT c.id AS cliente_id,
       c.nome,
       COALESCE(SUM(CASE l.tipo
           WHEN 'DEBITO_VENDA'             THEN  l.valor
           WHEN 'DEBITO_CONVERSAO_CASCO'   THEN  l.valor
           WHEN 'CREDITO_CONVERSAO_SUCATA' THEN -l.valor
           WHEN 'PAGAMENTO'                THEN -l.valor
       END), 0) AS saldo_devedor
FROM clientes c
LEFT JOIN lancamentos_fiado l
       ON l.cliente_id = c.id AND l.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- Saldo a pagar por funcionário (diárias − vales − pagamentos).
CREATE VIEW vw_saldo_funcionario AS
SELECT f.id AS funcionario_id,
       f.nome,
       COALESCE(SUM(CASE l.tipo
           WHEN 'DIARIA'    THEN  l.valor
           WHEN 'VALE'      THEN -l.valor
           WHEN 'PAGAMENTO' THEN -l.valor
       END), 0) AS saldo_a_pagar
FROM funcionarios f
LEFT JOIN lancamentos_funcionario l
       ON l.funcionario_id = f.id AND l.deleted_at IS NULL
WHERE f.deleted_at IS NULL
GROUP BY f.id;

-- ----------------------------------------------------------------------------
-- SEEDS MÍNIMOS
-- ----------------------------------------------------------------------------

INSERT INTO cargos (nome, nativo) VALUES ('ADM', TRUE);

INSERT INTO cargo_permissoes (cargo_id, permissao)
SELECT id, '*' FROM cargos WHERE nome = 'ADM';

-- Produtos estruturais (casco genérico e sucata — sem marca).
INSERT INTO produtos (tipo, nome, preco_referencia) VALUES
    ('CASCO',  'Casco vazio 20L', 0),
    ('SUCATA', 'Galão sucata',    0);

INSERT INTO tipos_despesa (nome) VALUES
    ('Abastecimento'), ('Diária de funcionário'), ('Manutenção'), ('Outros');

COMMIT;
