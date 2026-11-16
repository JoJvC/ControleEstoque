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
-- RETORNAVEL  = vendido em vasilhame que volta (empréstimo de casco ao cliente).
--               Aponta um tipo de casco GENÉRICO (produtos.tipo_casco_id); a
--               associação produto+marca pode apontar um casco ESPECÍFICO, que vence.
-- DESCARTAVEL = estoque simples, sem casco e sem retorno. Qualquer produto novo
--               que a loja queira vender (carvão, copos, tampas, gelo etc.)
--               é cadastrado como DESCARTAVEL — a categoria de exibição fica
--               no campo produtos.categoria.
CREATE TYPE tipo_produto AS ENUM ('RETORNAVEL', 'DESCARTAVEL');

CREATE TYPE tipo_movimento_estoque AS ENUM
    ('ENTRADA_ABASTECIMENTO', 'SAIDA_VENDA', 'DEVOLUCAO_CLIENTE',
     'ENTRADA_SUCATA', 'BAIXA_QUEBRA', 'AJUSTE');

-- Situação do casco no estoque físico, por tipo de casco (guardado por IF para poder repetir).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'situacao_casco') THEN
        CREATE TYPE situacao_casco AS ENUM ('VAZIO', 'SUCATA');
    END IF;
END
$$;

-- CREDITO_CLIENTE: usa o crédito do cliente (saldo positivo); não é dinheiro que entra no caixa.
CREATE TYPE forma_pagamento AS ENUM
    ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'OUTRO', 'CREDITO_CLIENTE');
-- Volumes antigos (o tipo já existe sem o rótulo); no-op quando o rótulo já está no CREATE TYPE.
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'CREDITO_CLIENTE';

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
     'CREDITO_CONVERSAO_SUCATA',-- sucata entregue convertida em crédito
     'PAGAMENTO',               -- baixa por pagamento do cliente
     'DEBITO_USO_CREDITO',      -- crédito do cliente usado como forma de pagamento da venda
     'CREDITO_SOBRA_VENDA');    -- pagamento acima do total da venda: a sobra vira crédito do cliente
ALTER TYPE tipo_lancamento_fiado ADD VALUE IF NOT EXISTS 'DEBITO_USO_CREDITO';
ALTER TYPE tipo_lancamento_fiado ADD VALUE IF NOT EXISTS 'CREDITO_SOBRA_VENDA';

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

-- Permissões granulares por tela/ação (ex: 'vendas.registrar', 'caixa.fechar', 'caixa.reabrir', 'vendas.cancelar').
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
    deleted_at    TIMESTAMPTZ,
    CONSTRAINT chk_funcionarios_valor_diaria_nao_negativo CHECK (valor_diaria >= 0)
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

-- Marcas cadastráveis; cada produto tem N marcas (produto_marcas).
CREATE TABLE marcas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL UNIQUE,
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES funcionarios(id),
    updated_at  TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);

-- Tipo de casco (vasilhame): cadastro próprio, com estoque de vazios e de sucata por tipo
-- (movimentos_estoque_casco). marca_id NULL = casco genérico; preenchido = casco específico da marca.
-- Sucata só entra em tipo que aceita (regra de domínio; sem trigger).
CREATE TABLE IF NOT EXISTS tipos_casco (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             TEXT NOT NULL,
    marca_id         UUID REFERENCES marcas(id),
    preco_vasilhame  NUMERIC(19,2) NOT NULL DEFAULT 0 CHECK (preco_vasilhame >= 0),
    aceita_sucata    BOOLEAN NOT NULL DEFAULT FALSE,
    created_by       UUID REFERENCES funcionarios(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by       UUID REFERENCES funcionarios(id),
    updated_at       TIMESTAMPTZ,
    deleted_at       TIMESTAMPTZ
);

-- Produto = item com categoria, tamanho e tipo. Marca, preço de referência, estoque, estoque mínimo
-- e foto ficam na associação produto+marca (produto_marcas). Retornável aponta um casco genérico.
CREATE TABLE produtos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo           tipo_produto NOT NULL,
    nome           TEXT NOT NULL,
    categoria      TEXT,          -- agrupamento livre de exibição/relatório (ex: 'Carvão', 'Copos', 'Gelo')
    tamanho        TEXT,          -- livre: '20L', '10L', '200ml', '5kg' etc.
    tipo_casco_id  UUID REFERENCES tipos_casco(id), -- casco genérico (validação de domínio); só RETORNAVEL tem
    created_by     UUID REFERENCES funcionarios(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by     UUID REFERENCES funcionarios(id),
    updated_at     TIMESTAMPTZ,
    deleted_at     TIMESTAMPTZ,
    CONSTRAINT chk_produtos_casco_conforme_tipo CHECK ((tipo = 'RETORNAVEL') = (tipo_casco_id IS NOT NULL))
);

CREATE INDEX idx_produtos_tipo ON produtos(tipo) WHERE deleted_at IS NULL;

-- Associação produto+marca (N marcas por produto). Preço de referência é apenas base: o preço efetivo
-- é definido em cada venda. tipo_casco_id preenchido = casco específico, que vence o genérico do produto.
CREATE TABLE IF NOT EXISTS produto_marcas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id        UUID NOT NULL REFERENCES produtos(id),
    marca_id          UUID NOT NULL REFERENCES marcas(id),
    tipo_casco_id     UUID REFERENCES tipos_casco(id),
    preco_referencia  NUMERIC(19,2) NOT NULL DEFAULT 0 CHECK (preco_referencia >= 0),
    estoque_minimo    INT NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0), -- alerta por produto+marca; 0 = sem alerta
    foto_url          TEXT,          -- caminho/URL da foto (upload via API)
    created_by        UUID REFERENCES funcionarios(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by        UUID REFERENCES funcionarios(id),
    updated_at        TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_marcas_produto_marca
    ON produto_marcas(produto_id, marca_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_produto_marcas_marca ON produto_marcas(marca_id) WHERE deleted_at IS NULL;

-- Ledger de estoque: saldo = SUM(quantidade) por produto+marca. Quantidade é assinada
-- (+entrada / -saída). Casco vazio e sucata têm razão próprio (movimentos_estoque_casco).
CREATE TABLE movimentos_estoque (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_marca_id  UUID NOT NULL REFERENCES produto_marcas(id),
    tipo              tipo_movimento_estoque NOT NULL,
    quantidade        INT NOT NULL CHECK (quantidade <> 0),
    venda_id          UUID,  -- FK adicionada após criação de vendas
    abastecimento_id  UUID, -- FK adicionada após criação de abastecimentos
    observacao        TEXT,
    created_by        UUID REFERENCES funcionarios(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_mov_estoque_produto_marca ON movimentos_estoque(produto_marca_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mov_estoque_venda         ON movimentos_estoque(venda_id)         WHERE venda_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- ABASTECIMENTO
-- ----------------------------------------------------------------------------

CREATE TABLE abastecimentos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data            DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_frete      tipo_frete NOT NULL,
    custo_total     NUMERIC(19,2) NOT NULL DEFAULT 0, -- legado: sem escrita nem leitura (custo vem de itens, cascos e frete)
    frete           NUMERIC(19,2), -- NULL = custo pendente; lançado no momento 2
    funcionario_id  UUID REFERENCES funcionarios(id), -- motorista quando frete PROPRIO
    observacao      TEXT,
    created_by      UUID REFERENCES funcionarios(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES funcionarios(id),
    updated_at      TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

-- Itens do abastecimento: produto+marca, cada um no seu estoque.
CREATE TABLE abastecimento_itens (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abastecimento_id UUID NOT NULL REFERENCES abastecimentos(id),
    produto_marca_id UUID NOT NULL REFERENCES produto_marcas(id),
    quantidade       INT NOT NULL CHECK (quantidade > 0),
    custo_unitario   NUMERIC(19,2) -- NULL = custo pendente; lançado no momento 2
);

CREATE INDEX idx_abast_itens_abastecimento ON abastecimento_itens(abastecimento_id);

-- Cascos vazios da carga, por tipo de casco (custo opcional, conta como unidade no rateio do frete).
CREATE TABLE IF NOT EXISTS abastecimento_cascos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abastecimento_id UUID NOT NULL REFERENCES abastecimentos(id),
    tipo_casco_id    UUID NOT NULL REFERENCES tipos_casco(id),
    quantidade       INT NOT NULL CHECK (quantidade > 0),
    custo_unitario   NUMERIC(19,2) CHECK (custo_unitario >= 0)
);

CREATE INDEX IF NOT EXISTS idx_abast_cascos_abastecimento ON abastecimento_cascos(abastecimento_id);

-- Abastecimento em dois momentos: o frete e o custo unitário passam a ser opcionais (bancos já existentes).
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS frete NUMERIC(19,2);
ALTER TABLE abastecimento_itens ALTER COLUMN custo_unitario DROP NOT NULL;
ALTER TABLE abastecimento_itens ALTER COLUMN custo_unitario DROP DEFAULT;

ALTER TABLE movimentos_estoque
    ADD CONSTRAINT fk_mov_estoque_abastecimento
    FOREIGN KEY (abastecimento_id) REFERENCES abastecimentos(id);

-- Valores não negativos (acompanham a validação de domínio); guarda por nome para rodar mais de uma vez.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_abastecimentos_custo_total_nao_negativo') THEN
        ALTER TABLE abastecimentos ADD CONSTRAINT chk_abastecimentos_custo_total_nao_negativo CHECK (custo_total >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_abastecimento_itens_custo_unitario_nao_negativo') THEN
        ALTER TABLE abastecimento_itens ADD CONSTRAINT chk_abastecimento_itens_custo_unitario_nao_negativo CHECK (custo_unitario >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_abastecimentos_frete_nao_negativo') THEN
        ALTER TABLE abastecimentos ADD CONSTRAINT chk_abastecimentos_frete_nao_negativo CHECK (frete >= 0);
    END IF;
END
$$;

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
    total_desconto       NUMERIC(19,2) NOT NULL DEFAULT 0, -- descontos dos itens + desconto_sucata
    desconto_sucata      NUMERIC(19,2) NOT NULL DEFAULT 0, -- parte do total_desconto vinda da sucata entregue
    total_liquido        NUMERIC(19,2) NOT NULL DEFAULT 0,
    status_pagamento     status_pagamento_venda NOT NULL DEFAULT 'PENDENTE',
    observacao           TEXT,
    created_by           UUID REFERENCES funcionarios(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by           UUID REFERENCES funcionarios(id),
    updated_at           TIMESTAMPTZ,
    deleted_at           TIMESTAMPTZ,
    CONSTRAINT chk_vendas_totais_nao_negativos
        CHECK (total_bruto >= 0 AND total_desconto >= 0 AND total_liquido >= 0)
);

-- Cancelamento de venda (soft delete): quem cancelou e quando.
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelada_por UUID REFERENCES funcionarios(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelada_em  TIMESTAMPTZ;

CREATE INDEX idx_vendas_cliente     ON vendas(cliente_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_vendas_funcionario ON vendas(funcionario_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendas_data        ON vendas(data)           WHERE deleted_at IS NULL;

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS desconto_sucata NUMERIC(19,2) NOT NULL DEFAULT 0;

-- Desconto é por item, manual (valor ou percentual), com motivo obrigatório.
CREATE TABLE venda_itens (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id         UUID NOT NULL REFERENCES vendas(id),
    produto_marca_id UUID NOT NULL REFERENCES produto_marcas(id),
    tipo_casco_id    UUID REFERENCES tipos_casco(id), -- casco resolvido (o específico da marca vence); NULL em descartável
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

CREATE INDEX idx_venda_itens_venda         ON venda_itens(venda_id)         WHERE deleted_at IS NULL;
CREATE INDEX idx_venda_itens_produto_marca ON venda_itens(produto_marca_id) WHERE deleted_at IS NULL;

-- Vasilhame vendido como item próprio, por tipo de casco (no máximo um por tipo e venda, regra de domínio).
-- quantidade_abatida = vasilhames cobertos pelo crédito de galão do cliente (modo ABATER_CREDITO): não são cobrados.
-- total = (quantidade - quantidade_abatida) * preco_unitario.
CREATE TABLE IF NOT EXISTS venda_vasilhames (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id           UUID NOT NULL REFERENCES vendas(id),
    tipo_casco_id      UUID NOT NULL REFERENCES tipos_casco(id),
    quantidade         INT NOT NULL CHECK (quantidade > 0),
    quantidade_abatida INT NOT NULL DEFAULT 0 CHECK (quantidade_abatida >= 0 AND quantidade_abatida <= quantidade),
    preco_unitario     NUMERIC(19,2) NOT NULL CHECK (preco_unitario >= 0),
    modo               TEXT NOT NULL DEFAULT 'ABATER_CREDITO' CHECK (modo IN ('ABATER_CREDITO', 'COMPRAR', 'CONVERTER_CASCO')),
    total              NUMERIC(19,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_venda_vasilhames_venda ON venda_vasilhames(venda_id) WHERE deleted_at IS NULL;

-- Sucata entregue na venda: valor por unidade e por tipo, que vira desconto da venda (vendas.desconto_sucata).
-- NÃO entra em entregas_sucata_cliente nem em vw_sucata_entregue_cliente; o estoque de sucata da loja
-- recebe a entrada em movimentos_estoque_casco.
CREATE TABLE IF NOT EXISTS venda_sucatas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id       UUID NOT NULL REFERENCES vendas(id),
    tipo_casco_id  UUID NOT NULL REFERENCES tipos_casco(id),
    quantidade     INT NOT NULL CHECK (quantidade > 0),
    valor_unitario NUMERIC(19,2) NOT NULL CHECK (valor_unitario >= 0),
    total          NUMERIC(19,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_venda_sucatas_venda ON venda_sucatas(venda_id) WHERE deleted_at IS NULL;

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
-- CASCO NORMAL — LEDGER POR CLIENTE E TIPO DE CASCO
-- (o saldo de casco é por cliente e tipo de casco; sucata NUNCA entra aqui, vai para
-- entregas_sucata_cliente, na seção abaixo; venda de água só empresta casco normal)
-- ----------------------------------------------------------------------------

CREATE TABLE movimentos_casco_cliente (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id  UUID NOT NULL REFERENCES clientes(id),
    venda_id    UUID REFERENCES vendas(id), -- NULL = movimentação avulsa
    tipo_casco_id UUID NOT NULL REFERENCES tipos_casco(id),
    tipo        tipo_movimento_casco NOT NULL,
    quantidade  INT NOT NULL CHECK (quantidade > 0),
    created_by  UUID REFERENCES funcionarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mov_casco_cliente ON movimentos_casco_cliente(cliente_id, tipo_casco_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_mov_casco_venda   ON movimentos_casco_cliente(venda_id)   WHERE venda_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- SUCATA — REGISTRO POR CLIENTE
-- (não é débito; entrega NÃO abate saldo de casco normal)
-- ----------------------------------------------------------------------------

CREATE TABLE entregas_sucata_cliente (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id       UUID NOT NULL REFERENCES clientes(id),
    venda_id         UUID REFERENCES vendas(id), -- NULL = entrega avulsa
    tipo_casco_id    UUID NOT NULL REFERENCES tipos_casco(id),
    quantidade       INT NOT NULL CHECK (quantidade > 0),
    valor_conversao  NUMERIC(19,2), -- NULL = não convertida em crédito no fiado
    created_by       UUID REFERENCES funcionarios(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sucata_cliente ON entregas_sucata_cliente(cliente_id, tipo_casco_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- BAIXA DE CASCO POR QUEBRA (estoque físico → sucata)
-- ----------------------------------------------------------------------------

CREATE TABLE baixas_casco (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_casco_id  UUID NOT NULL REFERENCES tipos_casco(id),
    quantidade     INT NOT NULL CHECK (quantidade > 0),
    motivo         TEXT,
    created_by     UUID REFERENCES funcionarios(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

-- Um ou mais funcionários responsáveis pela quebra.
CREATE TABLE baixa_casco_responsaveis (
    baixa_id        UUID NOT NULL REFERENCES baixas_casco(id),
    funcionario_id  UUID NOT NULL REFERENCES funcionarios(id),
    PRIMARY KEY (baixa_id, funcionario_id)
);

-- Ledger de estoque de casco por tipo e situação: saldo = SUM(quantidade). Quantidade é assinada.
-- Quebra: -VAZIO (BAIXA_QUEBRA) e, se o tipo aceita sucata, +SUCATA (ENTRADA_SUCATA) do mesmo tipo.
CREATE TABLE IF NOT EXISTS movimentos_estoque_casco (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_casco_id   UUID NOT NULL REFERENCES tipos_casco(id),
    situacao        situacao_casco NOT NULL,
    tipo            tipo_movimento_estoque NOT NULL,
    quantidade      INT NOT NULL CHECK (quantidade <> 0),
    baixa_casco_id  UUID REFERENCES baixas_casco(id),
    abastecimento_id UUID REFERENCES abastecimentos(id),
    venda_id        UUID REFERENCES vendas(id), -- devolução e sucata da venda; o replay da edição apaga por aqui
    observacao      TEXT,
    created_by      UUID REFERENCES funcionarios(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

ALTER TABLE movimentos_estoque_casco ADD COLUMN IF NOT EXISTS abastecimento_id UUID REFERENCES abastecimentos(id);
ALTER TABLE movimentos_estoque_casco ADD COLUMN IF NOT EXISTS venda_id UUID REFERENCES vendas(id);

CREATE INDEX IF NOT EXISTS idx_mov_estoque_casco_tipo
    ON movimentos_estoque_casco(tipo_casco_id, situacao) WHERE deleted_at IS NULL;

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

-- Recebimento de fiado (FIFO): a linha de venda_pagamentos gerada por ele aponta o lancamento PAGAMENTO de origem,
-- para o caixa e os relatórios contarem o dinheiro uma vez só (pelo lançamento, não pela linha da venda).
ALTER TABLE venda_pagamentos ADD COLUMN IF NOT EXISTS lancamento_fiado_id UUID REFERENCES lancamentos_fiado(id);
CREATE INDEX IF NOT EXISTS idx_venda_pagamentos_lancamento_fiado
    ON venda_pagamentos (lancamento_fiado_id) WHERE lancamento_fiado_id IS NOT NULL;

-- Forma do recebimento de fiado: o pagamento sem venda em aberto (ou a sobra que vira crédito) não gera linha em
-- venda_pagamentos, então a forma fica no próprio lançamento (detalhe do caixa). NULL nas linhas anteriores.
ALTER TABLE lancamentos_fiado ADD COLUMN IF NOT EXISTS forma forma_pagamento;

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

-- Fechamento automático à meia-noite (America/Sao_Paulo): o caixa continua FECHADO (vendas e fiado comparam o texto),
-- fechado_por fica NULL e as diárias esperam o lançamento posterior.
ALTER TABLE caixas ADD COLUMN IF NOT EXISTS fechado_pelo_sistema BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE caixas ADD COLUMN IF NOT EXISTS diarias_pendentes BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_caixas_pendentes_so_sistema') THEN
        ALTER TABLE caixas ADD CONSTRAINT ck_caixas_pendentes_so_sistema
            CHECK (NOT diarias_pendentes OR fechado_pelo_sistema);
    END IF;
END
$$;

-- Reabertura do caixa fechado: uma linha por reabertura (quem, quando, motivo). O caixa reaberto só fecha à mão.
CREATE TABLE IF NOT EXISTS caixa_reaberturas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caixa_id     UUID NOT NULL REFERENCES caixas(id),
    reaberto_por UUID NOT NULL REFERENCES funcionarios(id),
    reaberto_em  TIMESTAMPTZ NOT NULL,
    motivo       TEXT NOT NULL CHECK (length(btrim(motivo)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_caixa_reaberturas_caixa ON caixa_reaberturas(caixa_id);

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
    created_by       UUID REFERENCES funcionarios(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_caixa_despesas_caixa ON caixa_despesas(caixa_id) WHERE deleted_at IS NULL;

-- Abastecimento não lança mais despesa no caixa (a FK sem nome cai junto com a coluna).
ALTER TABLE caixa_despesas DROP COLUMN IF EXISTS abastecimento_id;

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

-- Uma diária por funcionário em cada caixa: o reenvio do fechamento não duplica. VALE e PAGAMENTO podem repetir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lanc_func_diaria_caixa
    ON lancamentos_funcionario(caixa_id, funcionario_id) WHERE tipo = 'DIARIA' AND deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- VIEWS DE SALDO (fonte de verdade = ledgers acima)
-- ----------------------------------------------------------------------------

-- Estoque atual por produto+marca + flag de alerta de mínimo
-- (alerta só com mínimo > 0 e quantidade < mínimo; quantidade = mínimo não alerta).
CREATE OR REPLACE VIEW vw_estoque_atual AS
SELECT pm.id AS produto_marca_id,
       p.id AS produto_id,
       p.tipo,
       p.nome,
       ma.id AS marca_id,
       ma.nome AS marca,
       p.categoria,
       p.tamanho,
       COALESCE(SUM(m.quantidade), 0)                     AS quantidade,
       pm.estoque_minimo,
       (pm.estoque_minimo > 0 AND COALESCE(SUM(m.quantidade), 0) < pm.estoque_minimo) AS abaixo_minimo
FROM produto_marcas pm
JOIN produtos p  ON p.id  = pm.produto_id AND p.deleted_at IS NULL
JOIN marcas   ma ON ma.id = pm.marca_id
LEFT JOIN movimentos_estoque m
       ON m.produto_marca_id = pm.id AND m.deleted_at IS NULL
WHERE pm.deleted_at IS NULL
GROUP BY pm.id, p.id, ma.id;

-- Saldo de casco por tipo e situação (vazios e sucata de cada tipo de casco).
CREATE OR REPLACE VIEW vw_estoque_casco AS
SELECT tc.id AS tipo_casco_id,
       tc.nome,
       tc.marca_id,
       ma.nome AS marca,
       tc.aceita_sucata,
       COALESCE(SUM(m.quantidade) FILTER (WHERE m.situacao = 'VAZIO'), 0)  AS vazios,
       COALESCE(SUM(m.quantidade) FILTER (WHERE m.situacao = 'SUCATA'), 0) AS sucata
FROM tipos_casco tc
LEFT JOIN marcas ma ON ma.id = tc.marca_id
LEFT JOIN movimentos_estoque_casco m
       ON m.tipo_casco_id = tc.id AND m.deleted_at IS NULL
WHERE tc.deleted_at IS NULL
GROUP BY tc.id, ma.nome;

-- Saldo de casco NORMAL por cliente e tipo de casco (positivo = cliente deve cascos à loja).
-- Cliente sem movimento aparece com tipo_casco_id NULL.
CREATE VIEW vw_saldo_casco_cliente AS
SELECT c.id AS cliente_id,
       c.nome,
       m.tipo_casco_id,
       COALESCE(SUM(CASE m.tipo
           WHEN 'EMPRESTIMO'      THEN  m.quantidade
           WHEN 'DEVOLUCAO'       THEN -m.quantidade
           WHEN 'CONVERSAO_VALOR' THEN -m.quantidade
       END), 0) AS saldo_cascos
FROM clientes c
LEFT JOIN movimentos_casco_cliente m
       ON m.cliente_id = c.id AND m.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, m.tipo_casco_id;

-- Total de sucata entregue por cliente e tipo de casco (registro, não débito).
CREATE VIEW vw_sucata_entregue_cliente AS
SELECT c.id AS cliente_id,
       c.nome,
       e.tipo_casco_id,
       COALESCE(SUM(e.quantidade), 0) AS total_entregue
FROM clientes c
LEFT JOIN entregas_sucata_cliente e
       ON e.cliente_id = c.id AND e.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, e.tipo_casco_id;

-- Saldo de fiado por cliente. saldo_devedor = débitos − créditos de sucata − pagamentos − sobras de venda
-- (positivo = cliente deve). saldo = −saldo_devedor (negativo = fiado, positivo = crédito).
CREATE OR REPLACE VIEW vw_saldo_fiado_cliente AS
SELECT c.id AS cliente_id,
       c.nome,
       COALESCE(SUM(CASE l.tipo
           WHEN 'DEBITO_VENDA'             THEN  l.valor
           WHEN 'DEBITO_USO_CREDITO'       THEN  l.valor
           WHEN 'CREDITO_CONVERSAO_SUCATA' THEN -l.valor
           WHEN 'PAGAMENTO'                THEN -l.valor
           WHEN 'CREDITO_SOBRA_VENDA'      THEN -l.valor
       END), 0) AS saldo_devedor,
       -COALESCE(SUM(CASE l.tipo
           WHEN 'DEBITO_VENDA'             THEN  l.valor
           WHEN 'DEBITO_USO_CREDITO'       THEN  l.valor
           WHEN 'CREDITO_CONVERSAO_SUCATA' THEN -l.valor
           WHEN 'PAGAMENTO'                THEN -l.valor
           WHEN 'CREDITO_SOBRA_VENDA'      THEN -l.valor
       END), 0) AS saldo
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

INSERT INTO tipos_despesa (nome) VALUES
    ('Abastecimento'), ('Diária de funcionário'), ('Manutenção'), ('Outros');

COMMIT;
