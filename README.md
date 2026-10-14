# ControleEstoque

Sistema de controle de estoque e vendas de galões de água — 5 APIs .NET 10 (Minimal API + raw Npgsql) sobre PostgreSQL 16, orquestradas com Docker Compose.

Documentos de referência:

- [`REGRAS_DE_NEGOCIO.md`](REGRAS_DE_NEGOCIO.md) — regras de negócio completas
- [`PLANO_IMPLEMENTACAO.md`](PLANO_IMPLEMENTACAO.md) — arquitetura, APIs, sprints e regras críticas
- [`infra/postgres/init.sql`](infra/postgres/init.sql) — schema (ledger-first: saldos são views)

## Subir o ambiente

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

| Serviço | Porta | Responsabilidade |
|---|---|---|
| vendas-api | 5101 | Vendas, pagamentos, cupom fiscal, relatórios de faturamento |
| clientes-api | 5102 | Clientes, endereços, saldos de casco/sucata/fiado, pagar casco, entrega de sucata |
| estoque-api | 5103 | Marcas, produtos (com foto), estoque, abastecimento, baixa de casco |
| financeiro-api | 5104 | Caixa, despesas tipadas, fechamento com diárias, pagamento de fiado |
| rh-api | 5105 | Funcionários, cargos/permissões, conta corrente (vale/pagamento) |
| postgres | 5432 | Banco único `controle_estoque` (schema criado pelo init.sql) |

> O `init.sql` roda apenas na primeira criação do volume. Após alterar o schema: `docker compose -f infra/docker-compose.yml down -v && docker compose -f infra/docker-compose.yml up -d --build`.

## Smoke test (e2e)

Reproduz o fluxo completo de venda de água com troca de casco (walkthrough do plano):

```bash
bash tools/smoke/controle-estoque-smoke.sh
```

## Build e testes (sem SDK local — via container)

```bash
docker run --rm -v "$PWD:/src" -v ce-nuget:/root/.nuget/packages -w /src \
  mcr.microsoft.com/dotnet/sdk:10.0 sh -c '
    for t in src/*/[A-Z]*.Tests/*.csproj; do dotnet test "$t" --nologo -v q || exit 1; done'
```

## Estrutura

```
src/
├── shared/       Results (exceções controladas), Contracts, Telemetry, Hosting (middlewares)
├── estoque/      \
├── clientes/      \  cada contexto: API / Contracts / Domain / Hosting / Repository / Tests
├── vendas/        /  (sem referências cruzadas entre contextos — banco único compartilhado)
├── financeiro/   /
└── rh/          /
infra/            docker-compose, Dockerfile.api parametrizado, init.sql
tools/smoke/      smoke test bash
```

Regras críticas de implementação (leia antes de mexer em Vendas/Cascos): Seção 6 do [`PLANO_IMPLEMENTACAO.md`](PLANO_IMPLEMENTACAO.md).
