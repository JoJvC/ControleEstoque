# ControleEstoque — Plano de Implementação do Front-end

**Insumos:** `REGRAS_DE_NEGOCIO.md` (domínio) + `PLANO_IMPLEMENTACAO.md` Seção 4 (contratos HTTP) + APIs já implementadas em `src/` (fonte de verdade dos shapes: projetos `*.Contracts`).
**Alvo:** Angular na versão estável mais recente (v21+ — confirmar com `npm create @angular@latest` no kickoff), Atomic Design, **mobile-first**, preparado para empacotamento futuro via **Capacitor**.
**Público:** modelos executores (Opus/Sonnet) implementando sprint a sprint no Claude Code.

> **Leia a Seção 8 (Regras Críticas de UI) antes de escrever qualquer tela de Venda, Casco ou Fiado.** Em conflito entre seu julgamento e a Seção 8, a Seção 8 vence — e ela apenas espelha a Seção 6 do plano do backend.

---

## 1. Decisões de Stack (obrigatórias, não renegociáveis)

| Aspecto | Decisão |
|---|---|
| Framework | Angular estável mais recente (v21+). Standalone components (padrão), **signals** para estado, control flow nativo (`@if/@for/@defer`), change detection **zoneless** (padrão em apps novos) |
| Localização | `web/` na raiz do repositório (irmão de `src/` e `infra/`) |
| Prefixo de seletor | `ce-` (ControleEstoque) |
| Nomenclatura de arquivos | Style guide atual do Angular: sem sufixo de tipo (`venda-form.ts`, classe `VendaForm`) — como o `ng generate` gera por padrão |
| Estado | Serviços com signals (stores por feature, `providedIn: 'root'` só para core). **Proibido**: NgRx clássico, estado em `BehaviorSubject` |
| HTTP | `provideHttpClient` + interceptors funcionais. RxJS apenas na camada HTTP; componentes consomem signals |
| Formulários | **Typed Reactive Forms** (Signal Forms ainda experimentais — não usar) |
| UI kit | **Nenhum framework visual** (sem Material/PrimeNG/Ionic). Design system próprio via Atomic Design + tokens CSS. **Permitido**: `@angular/cdk` (overlay, a11y, dialog — headless) |
| Estilo | SCSS + CSS custom properties (tokens). Sem Tailwind |
| Ícones | SVG inline via componente atom `ce-icon` (sprite próprio, sem font-icons) |
| Testes | Vitest (runner padrão do Angular novo) para unidade/componente; Playwright para smoke e2e |
| Lint/format | ESLint (`angular-eslint`) + Prettier, ambos no CI |
| i18n | pt-BR único. Dinheiro sempre via `Intl.NumberFormat('pt-BR', { currency: 'BRL' })` encapsulado em pipe próprio `cePreco`; datas via pipe nativo com locale pt-BR |
| SSR | **Não usar** (SPA estático — requisito do Capacitor) |
| PWA | `@angular/pwa` na sprint de qualidade (degrau natural para o Capacitor) |
| Proibido | SSR/prerender, zone.js, bibliotecas de UI prontas, moment.js, lodash, estado global fora de stores, `any` (strict mode total) |

---

## 2. Pré-requisitos no Backend (gaps a resolver na Sprint F1)

A API hoje **não tem CORS nem gateway** — o browser não consegue falar com 5 portas distintas. E **não existe autenticação** (nenhum endpoint de login/JWT; permissões existem só como dados em `cargos`/`cargo_permissoes`).

1. **Gateway reverso (nginx) no `infra/docker-compose.yml`** — serviço novo `gateway` na porta `8080`, roteando por prefixo e **encaminhando o restante do path** (os endpoints reais começam em `/v1/...`):

   | Prefixo público | Upstream |
   |---|---|
   | `/api/vendas/` | `vendas-api:8080/` |
   | `/api/clientes/` | `clientes-api:8080/` |
   | `/api/estoque/` | `estoque-api:8080/` |
   | `/api/financeiro/` | `financeiro-api:8080/` |
   | `/api/rh/` | `rh-api:8080/` |

   O gateway também servirá o build do front em `/` (sprint de qualidade). CORS habilitado no gateway para `capacitor://localhost` e `https://localhost` (origens do Capacitor iOS/Android) — para o front web servido pelo próprio gateway, CORS nem é necessário.
2. **Autenticação real é feature futura do backend.** MVP do front: **seleção de operador** (funcionário ativo escolhido numa tela inicial, persistido via `StorageService`) — ele alimenta `funcionarioId` nas vendas e o permissionamento de UI (Seção 9). A arquitetura (interceptor + guard + store) já nasce pronta para trocar por login/JWT sem refatorar features.
3. **Relatórios moram na API do contexto dono** — o front precisa rotear cada relatório para a base certa (tabela na Seção 5.2).

---

## 3. Arquitetura Angular + Atomic Design

### 3.1 Estrutura de diretórios

```
web/
├── src/
│   ├── app/
│   │   ├── core/                    ← singleton, sem UI
│   │   │   ├── api/                 ← 1 client por contexto + models TS espelhando *.Contracts
│   │   │   │   ├── vendas-api.ts
│   │   │   │   ├── clientes-api.ts
│   │   │   │   ├── estoque-api.ts
│   │   │   │   ├── financeiro-api.ts
│   │   │   │   ├── rh-api.ts
│   │   │   │   └── models/          ← interfaces/types por contexto (venda.ts, cliente.ts…)
│   │   │   ├── config/              ← AppConfig carregado em runtime (provideAppInitializer)
│   │   │   ├── http/                ← interceptors: apiError, correlationId, loading
│   │   │   ├── operator/            ← OperatorStore (funcionário logado) + guard
│   │   │   ├── permissions/         ← PermissionService + diretiva *cePermissao
│   │   │   └── platform/            ← abstrações p/ Capacitor: StorageService, MediaService, PrintService
│   │   ├── ui/                      ← DESIGN SYSTEM (Atomic Design, 100% apresentacional)
│   │   │   ├── atoms/               ← ce-button, ce-input, ce-icon, ce-badge, ce-spinner…
│   │   │   ├── molecules/           ← ce-form-field, ce-search-box, ce-money-input, ce-stepper…
│   │   │   └── organisms/           ← ce-data-list, ce-bottom-nav, ce-app-header, ce-sheet…
│   │   ├── layouts/                 ← TEMPLATES do Atomic Design: shell-layout (nav), blank-layout
│   │   ├── features/                ← PAGES: uma pasta por contexto, lazy-loaded
│   │   │   ├── home/
│   │   │   ├── vendas/              ← pages/ + componentes e store locais da feature
│   │   │   ├── clientes/
│   │   │   ├── estoque/
│   │   │   ├── financeiro/
│   │   │   ├── rh/
│   │   │   └── relatorios/
│   │   ├── app.routes.ts            ← lazy por feature (loadChildren)
│   │   └── app.config.ts
│   ├── styles/
│   │   ├── tokens.scss              ← custom properties (cor, espaço, tipo, raio, sombra)
│   │   ├── reset.scss
│   │   └── mixins.scss              ← breakpoints (min-width!), safe-area, touch-target
│   ├── environments/
│   └── public/config.json           ← apiBaseUrl em runtime (web: "/api"; app: URL absoluta)
├── proxy.conf.json                  ← dev: /api/* → gateway (ou portas 5101–5105 direto)
├── playwright.config.ts
└── package.json
```

### 3.2 Mapeamento Atomic Design → Angular

| Nível | Onde | Regra dura |
|---|---|---|
| **Átomos** | `ui/atoms/` | Sem dependência entre si além de tokens. Só `input()`/`output()`/`model()`. Zero HTTP, zero store, zero roteamento |
| **Moléculas** | `ui/molecules/` | Compõem apenas átomos. Mesmas restrições |
| **Organismos** | `ui/organisms/` | Compõem átomos/moléculas; podem ter estado interno de UI (aberto/fechado, página atual). Dados **sempre** via `input()`; ações **sempre** via `output()`. Zero HTTP, zero store |
| **Templates** | `layouts/` | Estrutura de página (shell com navegação, slots via `<router-outlet>`/`ng-content`) |
| **Páginas** | `features/*/pages/` | Únicas que injetam stores/API clients e fazem wiring de dados para os organismos |

*Erro típico a evitar: organismo injetando `HttpClient` ou store — se precisar de dados, a página busca e passa por input.*

### 3.3 Camada de dados

- **1 API client por contexto** (`VendasApi`, `ClientesApi`, …): métodos tipados, 1 método por endpoint, retornam `Observable<T>` — nada além de HTTP aqui.
- **Models TS espelhados manualmente dos records C#** em `src/<contexto>/ControleEstoque.<Contexto>.Contracts/` (fonte de verdade). Campos em camelCase (System.Text.Json padrão). Dinheiro = `number`, datas = `string` ISO.
- **1 store por feature** (ex.: `VendaStore`): signals privados + `computed` públicos, métodos assíncronos que chamam o client e atualizam o estado. Estado de requisição padronizado: `status: 'idle' | 'loading' | 'ok' | 'error'`.
- **Erros**: interceptor converte `ApiErrorEnvelope { code, message, traceId }` em `ApiError` tipado; mapa `code → mensagem pt-BR` central (ex.: `ESTOQUE_INSUFICIENTE → "Estoque insuficiente para o produto."`). 422/404 viram toast/inline; 500 vira toast genérico com traceId visível para suporte.
- **Correlation**: interceptor injeta `X-Correlation-Id` (uuid v4) em toda chamada.
- **Saldos e totais nunca são calculados/persistidos localmente** — sempre re-consultados do servidor após cada operação de escrita (ver Regra Crítica 8.6).

---

## 4. Design System (tokens + inventário mínimo)

### 4.1 Tokens (`styles/tokens.scss`)

- **Cores semânticas**: `--ce-primary` (ação), `--ce-success` (pago/positivo), `--ce-warning` (parcial/alerta estoque), `--ce-danger` (pendente/débito), `--ce-surface`, `--ce-text`, `--ce-text-muted`, `--ce-border`. Estrutura pronta para dark mode (não implementar no MVP).
- **Espaçamento**: escala de 4px (`--ce-space-1` a `--ce-space-8`).
- **Tipografia**: system font stack; escala `--ce-font-sm/md/lg/xl`; números tabulares (`font-variant-numeric: tabular-nums`) em qualquer coluna de dinheiro/quantidade.
- **Toque**: `--ce-touch-target: 44px` — altura mínima de todo elemento interativo.
- **Safe area**: mixins usando `env(safe-area-inset-*)` (obrigatório no shell e na bottom-nav — requisito Capacitor/iOS).

### 4.2 Inventário mínimo

| Nível | Componentes |
|---|---|
| Átomos | `ce-button` (primary/ghost/danger, loading), `ce-icon`, `ce-input`, `ce-select`, `ce-checkbox`, `ce-badge` (status), `ce-spinner`, `ce-avatar`, `ce-divider`, `ce-skeleton` |
| Moléculas | `ce-form-field` (label+controle+erro), `ce-money-input` (máscara BRL, centavos), `ce-quantity-stepper` (− n +, alvo de toque grande), `ce-search-box` (debounce), `ce-list-item` (linha tocável com slots), `ce-empty-state`, `ce-toast`, `ce-confirm-dialog`, `ce-saldo-chip` (rótulo+valor com cor semântica) |
| Organismos | `ce-app-header` (título, voltar, ações), `ce-bottom-nav` (5 slots), `ce-data-list` (lista paginada com pull-state, empty, skeleton), `ce-sheet` (bottom sheet mobile / dialog desktop — via CDK overlay), `ce-produto-card` (foto, nome, marca, preço ref.), `ce-pagamento-lista` (N formas + soma + faltante), `ce-item-venda-card` (item do carrinho com desconto) |

### 4.3 Mobile-first (regras de layout)

- Todo SCSS escrito **mobile primeiro**; media queries **somente `min-width`** (breakpoints: 600px, 960px).
- Navegação: `ce-bottom-nav` fixa no mobile; ≥960px vira sidebar (mesmo componente, CSS diferente — não duplicar).
- Listas viram tabelas apenas em ≥960px, e dentro de contêiner com `overflow-x: auto`.
- Ações primárias de página ao alcance do polegar (barra inferior/FAB), nunca somente no header.
- Formulários longos em etapas (stepper vertical) no mobile — em especial o PDV (Seção 6).

---

## 5. Integração com a API

### 5.1 Configuração de base URL

`public/config.json` carregado via `provideAppInitializer` **antes** do bootstrap das features:

```json
{ "apiBaseUrl": "/api" }
```

- **Web (dev)**: `proxy.conf.json` aponta `/api/vendas` → `http://localhost:5101` etc. (ou para o gateway, se de pé).
- **Web (prod)**: gateway serve front e API na mesma origem — `/api` relativo.
- **Capacitor (futuro)**: build copia um `config.json` com URL absoluta (`https://servidor/api`). Nenhum código muda — só o arquivo.

### 5.2 Roteamento de contexto (o front PRECISA saber quem é dono de cada endpoint)

| Recurso | Base | Observação |
|---|---|---|
| Vendas, pagamentos, cupom fiscal | `/api/vendas` | |
| Relatórios: faturamento, vendas-por-funcionario | `/api/vendas` | |
| Clientes, endereços, saldos, cascos (devolução/conversão), sucatas | `/api/clientes` | |
| Relatórios: cascos, sucata | `/api/clientes` | |
| Marcas, produtos, foto, estoque, movimentos, abastecimentos, baixas de casco | `/api/estoque` | |
| Relatório: estoque | `/api/estoque` | |
| Caixas, despesas, fechamento, tipos-despesa | `/api/financeiro` | |
| **Pagamento de fiado** (`POST /v1/clientes/{id}/fiado/pagamentos`) | `/api/financeiro` | ⚠️ rota começa com `/clientes` mas é da API Financeiro |
| Relatórios: caixa, fiado | `/api/financeiro` | |
| Cargos, funcionários, conta-corrente, vales, pagamentos | `/api/rh` | |
| Relatório: conta-funcionarios | `/api/rh` | |

### 5.3 Foto de produto

- Upload: `POST /v1/produtos/{id}/foto` multipart (jpg/png ≤ 5MB) — no front, sempre via `MediaService` (Seção 10), nunca `<input type="file">` direto no componente.
- Exibição: `GET /v1/produtos/{id}/foto` como `src` da imagem (com fallback para placeholder no `ce-produto-card`).

---

## 6. Mapa de Navegação e Telas

### 6.1 Bottom-nav (5 slots)

| Slot | Rota | Conteúdo |
|---|---|---|
| **Início** | `/home` | Dashboard do dia: status do caixa, vendas do dia, alertas de estoque mínimo, atalhos |
| **Vender** (destaque central) | `/vendas/nova` | PDV — tela core do sistema |
| **Clientes** | `/clientes` | Busca, cadastro, saldos, casco/sucata/fiado |
| **Caixa** | `/financeiro/caixa` | Caixa do dia, despesas, fechamento |
| **Mais** | `/mais` | Estoque, cadastros (produtos/marcas), RH, relatórios, troca de operador |

### 6.2 Telas por feature (todas lazy)

- **Vendas**: `nova` (PDV), `lista` (filtros cliente/período, paginada), `detalhe/:id` (itens, pagamentos, saldos gerados, ações: editar, adicionar pagamento, emitir cupom), `editar/:id` (mesmo form do PDV pré-carregado; bloqueado com aviso se cupom já emitido — `VENDA_JA_FATURADA`).
- **Clientes**: lista com busca; detalhe com **3 saldos independentes** (`GET /saldos`: cascos, sucata entregue, fiado) como `ce-saldo-chip`s distintos; endereços (N); ações: **Pagar Casco** (sheet com 2 modos: devolução física / conversão em valor), **Entregar Sucata** (com conversão em crédito opcional), **Receber Fiado** (pagamento de dívida via API Financeiro).
- **Estoque**: visão atual (`vw_estoque_atual` — destaque `AbaixoMinimo` com `--ce-warning`), abastecimento (form com N itens, tipo de frete, custo), ajuste manual, **baixa de casco por quebra** (quantidade, motivo, ≥1 responsável obrigatório).
- **Cadastros**: produtos (tipo, marca — obrigatória se AGUA/GALAO_COMPLETO —, categoria e tamanho livres, preço de referência, estoque mínimo, foto), marcas.
- **Financeiro**: caixa do dia (abrir com saldo inicial; 409 = já aberto → carregar existente), lançar despesa (tipo obrigatório), **fechamento** (checklist de funcionários que trabalharam → diárias; resumo entradas/saídas/saldo), tipos de despesa.
- **RH**: funcionários (CRUD, diária), cargos (CRUD com permissões; **ADM travado na UI** — badge "nativo", sem editar/excluir), conta-corrente (extrato, saldo, lançar vale, lançar pagamento).
- **Relatórios**: hub com cards → cada relatório com filtros de período/produto onde aplicável, resultado em cards no mobile / tabela no desktop.

### 6.3 PDV — anatomia da tela core (mobile, etapas)

```
[1. Cliente]    busca/seleção + endereço de entrega (se houver N, escolher)
[2. Itens]      catálogo com ce-produto-card (foto + preço de referência)
                → ao tocar: sheet com quantidade (stepper), preço unitário
                  (PRÉ-PREENCHIDO com referência, LIVREMENTE editável),
                  desconto opcional (valor|percentual + MOTIVO obrigatório)
[3. Cascos]     visível apenas se houver item de ÁGUA no carrinho:
                ┌──────────────────────────────────────────────┐
                │ Cascos devolvidos agora:  [toggle "todos na   │
                │ hora"] → preenche devolvidos = qtd de água,   │
                │ campo continua EDITÁVEL                       │
                │ Sucata entregue: [stepper]  ⓘ "não abate o    │
                │ débito de casco"                              │
                └──────────────────────────────────────────────┘
[4. Pagamento]  ce-pagamento-lista: N formas (PIX, crédito, débito,
                dinheiro, outro), cada uma com valor; mostra ao vivo:
                Total | Pago | "Vai para fiado: R$ X" (destaque --ce-warning)
[5. Revisão]    totais, saldo de casco resultante, confirmar
Pós-registro:   tela de sucesso com StatusPagamento, SaldoCascoCliente,
                atalho "Emitir cupom fiscal"
```

---

## 7. Sequência de Implementação (Sprints)

Cada sprint termina com `ng build` + `ng test` verdes e lint limpo. Não iniciar sprint N+1 com pendências na N.

### Sprint F1 — Fundação ✅ (concluída em 2026-07-07; Angular 22)
- [x] Backend: gateway nginx no `infra/docker-compose.yml` (Seção 2, item 1) + CORS p/ origens Capacitor
- [x] Workspace Angular em `web/` (strict, zoneless, SCSS, roteamento), ESLint + Prettier, `.editorconfig`
- [x] `styles/`: tokens, reset, mixins (breakpoints min-width, safe-area, touch-target)
- [x] `core/config`: `AppConfig` via `public/config.json` + `provideAppInitializer`; `proxy.conf.json`
- [x] `core/http`: interceptors `correlationId` e `apiError` (envelope → `ApiError` + mapa de mensagens pt-BR)
- [x] `core/platform`: `StorageService` (impl. localStorage), abstrações `MediaService`/`PrintService`
- [x] `core/operator`: `OperatorStore` + tela de seleção de operador (lista `GET /v1/funcionarios`) + guard que exige operador para navegar
- [x] `layouts/shell-layout`: header + bottom-nav (mobile) / sidebar (desktop); rotas lazy placeholder das 7 features
- **Critério de aceite:** app sobe no celular (rede local), seleciona operador, navega pelas 5 abas; chamada real a `/api/rh/v1/funcionarios` passando pelo proxy; erro 500 simulado exibe toast com traceId. *(Verificado via HTTP: gateway 8080 roteando + CORS preflight 204; proxy 4200 → RH 200; envelope de erro com traceId retornando; a ação "Simular erro de API (dev)" fica em /mais.)*

### Sprint F2 — Design System ✅ (concluída em 2026-07-07)
- [x] Átomos e moléculas do inventário 4.2 (com testes de componente dos comportamentos: máscara do `ce-money-input`, limites do `ce-quantity-stepper`, debounce do `ce-search-box`)
- [x] Organismos: `ce-app-header`, `ce-bottom-nav` (definitivos), `ce-data-list`, `ce-sheet-shell` + `SheetService`/`ConfirmDialog` (CDK Dialog em core/overlay), `ce-toast` container (F1)
- [x] Rota dev `/dev/ui` (registrada só em dev mode) exibindo todos os componentes — substituto leve de Storybook
- [x] Extra: pipe `cePreco` (BRL) e sprite `ce-icon` com 24 ícones
- **Critério de aceite:** `/dev/ui` renderiza o inventário completo; nenhum componente de `ui/` importa `HttpClient` ou store (verificável por grep). *(Verificado: grep limpo; 27 testes verdes.)*

### Sprint F3 — Cadastros (Marcas, Produtos, Clientes) ✅ (concluída em 2026-07-08)
- [x] `estoque-api.ts` + `clientes-api.ts` + models espelhados dos Contracts
- [x] Marcas: lista + criação (409 nome duplicado → erro inline)
- [x] Produtos: lista com filtros (tipo/marca/categoria), form com validação espelhada (marca obrigatória p/ AGUA/GALAO_COMPLETO), upload de foto via `MediaService`, `ce-produto-card` com foto real
- [x] Clientes: busca paginada, form, endereços (N por cliente)
- **Critério de aceite:** cadastrar marca → produto com foto → cliente com 2 endereços, tudo pelo celular, e visualizar o produto com foto no catálogo. *(Verificado via HTTP no gateway 8080 e no proxy 4200: marca criada + 409 `MARCA_DUPLICADA`; produto AGUA com marca; upload multipart de foto → `fotoUrl` preenchida e `GET /foto` 200 image/png; cliente com 2 endereços — `GET` retorna ambos com principal correto; busca paginada por nome OK. Saldos/ações do cliente ficam na F6, como planejado.)*

### Sprint F4 — Estoque ✅ (concluída em 2026-07-08)
- [x] Visão de estoque atual com badge de alerta (`AbaixoMinimo`)
- [x] Abastecimento: form N itens (produto, quantidade, custo unitário), tipo de frete, custo total
- [x] Ajuste manual de movimento; baixa de casco por quebra (validação: ≥1 responsável; 422 `ESTOQUE_INSUFICIENTE` tratado inline)
- **Critério de aceite:** abastecer → ver saldos subirem; baixar casco → CASCO desce e SUCATA sobe na mesma tela. *(Verificado via HTTP no gateway: abastecimento de 10 águas + 5 cascos subiu AGUA 15→25 e CASCO 13→18; baixa de 2 cascos com 1 responsável desceu CASCO 18→16 e subiu SUCATA 1→3 — a tela `/estoque` lista ambos e recarrega do servidor após cada escrita. Erros conferidos: 400 `RESPONSAVEL_OBRIGATORIO`, 422 `ESTOQUE_INSUFICIENTE`, 400 `QUANTIDADE_INVALIDA` — todos no mapa pt-BR e exibidos inline nos sheets. Ajuste manual −1 confirmado. Ações da página em barra sticky acima da bottom-nav, ao alcance do polegar.)*

### Sprint F5 — PDV e Vendas (core do sistema)
- [ ] `vendas-api.ts` + models; `VendaStore`
- [ ] PDV completo (Seção 6.3), incluindo: seção de cascos condicionada a item de ÁGUA; toggle "devolvidos na hora" (preenche e mantém editável); desconto por item com motivo obrigatório (validação client-side espelhando `DESCONTO_SEM_MOTIVO`); pagamentos N formas com faltante→fiado explícito; bloqueio client-side de `SUM(pagamentos) > total`
- [ ] Lista de vendas (filtros + paginação) e detalhe
- [ ] Edição de venda (mesmo form pré-carregado; `VENDA_JA_FATURADA` → tela somente leitura com aviso)
- [ ] Pagamento pós-venda (sheet no detalhe; 422 `PAGAMENTO_EXCEDE_SALDO` inline)
- [ ] Cupom fiscal: emitir (409 já emitido → mostrar existente) e visualizar via `PrintService` (impl. web: `window.print` de view formatada)
- **Critério de aceite:** walkthrough 7 do plano do backend reproduzido inteiro pela UI no celular: venda de 5 águas, 3 cascos devolvidos, 1 sucata, R$ 200 em PIX → tela de sucesso mostra PARCIAL, fiado R$ 50, saldo de casco 2.

### Sprint F6 — Casco, Sucata e Fiado (operações do cliente)
- [ ] Detalhe do cliente com os 3 saldos (chips independentes e visualmente distintos)
- [ ] Pagar Casco — sheet com 2 modos: devolução física (quantidade) | conversão em valor (quantidade + valor unitário; 422 `CONVERSAO_MAIOR_QUE_SALDO` inline)
- [ ] Entregar Sucata avulsa (quantidade + conversão em crédito opcional), com o aviso fixo "não abate débito de casco"
- [ ] Receber Fiado (valor + forma; 422 `PAGAMENTO_EXCEDE_SALDO`) — via `financeiro-api.ts`
- [ ] Extratos (se endpoint disponível) ou saldos recarregados pós-operação
- **Critério de aceite:** sequência mista (devolução → conversão → sucata com crédito → pagamento de fiado) termina com os 3 chips batendo com `GET /saldos`.

### Sprint F7 — Financeiro (Caixa)
- [ ] Caixa do dia: abrir (409 → carrega o existente), resumo ao vivo (entradas, despesas, diárias, saldo parcial)
- [ ] Despesas: form com tipo obrigatório (combo de `GET /v1/tipos-despesa` + cadastro rápido)
- [ ] Fechamento: checklist de funcionários que trabalharam (falta = desmarcar), confirmação com resumo, estado FECHADO bloqueia novas despesas (422 `CAIXA_FECHADO`/`CAIXA_JA_FECHADO` tratados)
- **Critério de aceite:** dia simulado inteiro pela UI (abrir → vender no PDV → despesa → fechar com 2 diárias) e resumo final correto.

### Sprint F8 — RH e Permissionamento
- [ ] Funcionários: CRUD com valor de diária; conta-corrente (extrato, saldo, vale, pagamento — 422 `PAGAMENTO_EXCEDE_SALDO`)
- [ ] Cargos: CRUD com editor de permissões granulares; ADM exibido como nativo e travado (422 `CARGO_NATIVO` nunca deve ser alcançável pela UI)
- [ ] `PermissionService`: permissões do cargo do operador; diretiva estrutural `*cePermissao="'vendas.registrar'"` escondendo ações; guard de rota por permissão; curinga `*` do ADM
- [ ] Aplicar `*cePermissao` retroativamente nas ações sensíveis (registrar/editar venda, fechar caixa, editar estoque, relatórios, cadastros)
- **Critério de aceite:** operador com cargo restrito não vê nem acessa (por URL direta) telas fora de suas permissões; ciclo diária→vale→pagamento fecha o saldo na tela.

### Sprint F9 — Relatórios e Home
- [ ] Hub de relatórios + 8 telas (Seção 5.2), filtros de período/produto, cards mobile / tabela desktop com `overflow-x: auto`
- [ ] Home/dashboard: caixa do dia (status), total vendido hoje, alertas de estoque mínimo, atalhos
- **Critério de aceite:** relatório de faturamento por período e produto confere com as vendas registradas nas sprints anteriores.

### Sprint F10 — Qualidade e prontidão Capacitor
- [ ] `@angular/pwa` (manifest, ícones, service worker com estratégia network-first para `/api`)
- [ ] Gateway servindo o build do front em `/` (compose completo: `docker compose up` → sistema inteiro em uma porta)
- [ ] Playwright: smoke e2e do fluxo crítico (operador → PDV → venda parcial → caixa) rodando contra o compose, viewport mobile
- [ ] Auditoria da Seção 10 (checklist Capacitor) — corrigir violações (uso direto de `window`/`localStorage` fora de `core/platform`, etc.)
- [ ] Performance: budgets no `angular.json` (initial ≤ 500kb), `@defer` em relatórios/gráficos, a11y pass (labels, foco, contraste dos tokens)
- [ ] `web/README.md`: setup em ≤ 5 comandos
- **Critério de aceite:** `docker compose up` do zero + smoke Playwright verde; Lighthouse mobile ≥ 90 em performance e a11y na home e no PDV.

---

## 8. Regras Críticas de UI

**As 8 regras que modelos executores mais erram construindo estas telas. Em dúvida, esta seção vence.**

1. **Casco normal ≠ sucata — nunca no mesmo campo, nunca somados.** São dois inputs, dois chips de saldo, duas cores. Toda tela que registra sucata exibe o aviso de que **não abate** o débito de casco. *Erro típico: um campo único "vasilhames devolvidos".*

2. **"Devolvidos na hora" é atalho, não trava.** O toggle preenche `cascosDevolvidos = quantidade de água vendida`, mas o campo **continua editável** (casos parciais). Desligar o toggle não zera o que o usuário digitou.

3. **Preço de referência é sugestão.** O campo preço vem pré-preenchido e livremente editável; a UI **nunca** bloqueia venda por preço diferente da referência, nem recarrega o preço do servidor ao calcular exibição de total.

4. **Desconto por item, motivo obrigatório.** O desconto fica no item (não no total) e o form não submete sem motivo. Exibir total bruto, desconto e líquido separados.

5. **Faltante vira fiado — e o usuário precisa ver isso.** Na tela de pagamento, `total − SUM(pagamentos)` aparece ao vivo como "Vai para fiado: R$ X" em cor de alerta. Soma dos pagamentos acima do total é bloqueada no client (espelho do 400 `PAGAMENTO_EXCEDE_TOTAL`).

6. **Servidor é a fonte de verdade de saldos e status.** Cálculos locais servem só para feedback ao vivo; após qualquer escrita, a tela exibe o que o **response** trouxe (`statusPagamento`, `saldoCascoCliente`, `novoSaldoFiado`…) e re-consulta `GET /saldos` ao voltar ao cliente. Nunca manter contador local de estoque/casco/fiado.

7. **Fiado é dinheiro; saldo de casco é contagem.** Chips e telas nunca convertem casco em R$ automaticamente — a conversão é uma **ação explícita** (Pagar Casco → conversão em valor). *Erro típico: mostrar "dívida total" somando fiado + casco×preço.*

8. **Componente de `ui/` não fala com o mundo.** Átomo/molécula/organismo com `HttpClient`, store ou `Router` injetado é defeito de arquitetura, mesmo que funcione. Dados entram por `input()`, intenções saem por `output()` — a página faz o resto.

---

## 9. Permissionamento no Front (MVP sem auth de backend)

- `OperatorStore` guarda o funcionário selecionado (id, nome, cargo + permissões) via `StorageService`; troca de operador em `/mais`.
- `PermissionService.has('vendas.registrar')`: `true` se o cargo tem a permissão ou o curinga `*` (ADM).
- Diretiva `*cePermissao` (esconder ação) + `permissaoGuard(...)` (bloquear rota). UI esconde **e** guarda bloqueia — os dois, sempre.
- **Limitação documentada:** sem auth no backend, isso é UX, não segurança. Quando o backend ganhar login/JWT: trocar a tela de seleção por login, `OperatorStore` passa a ler o token, adicionar interceptor `Authorization` — features não mudam.

---

## 10. Checklist de Prontidão para Capacitor

Auditar na Sprint F10 (e respeitar desde a F1):

- [ ] **SPA estático puro** — sem SSR/prerender; `ng build` gera `browser/` servível de filesystem
- [ ] **`config.json` em runtime** — trocar a base da API sem rebuild (app aponta para URL absoluta)
- [ ] **CORS no gateway** para `capacitor://localhost` (iOS) e `https://localhost` (Android)
- [ ] **`StorageService`** é o único ponto que toca `localStorage` → futura impl. `@capacitor/preferences`
- [ ] **`MediaService`** é o único ponto de seleção de imagem (web: `<input type="file">`) → futura impl. `@capacitor/camera`
- [ ] **`PrintService`** é o único ponto de impressão (cupom) → futura impl. via plugin/share
- [ ] **Zero `window`/`document`/`navigator` diretos** fora de `core/platform` (usar `inject(DOCUMENT)` lá dentro)
- [ ] **Safe areas** aplicadas no shell (`viewport-fit=cover` no index.html + `env(safe-area-inset-*)`)
- [ ] **Touch targets ≥ 44px** em todo elemento interativo (token + lint visual no `/dev/ui`)
- [ ] **Sem hover como única affordance** — todo estado hover tem equivalente de foco/ativo
- [ ] Passo futuro documentado no `web/README.md`: `npm i @capacitor/core @capacitor/cli && npx cap init && npx cap add android` apontando `webDir` para o build

---

## 11. Instrução de handoff para o modelo executor

> Implemente a Sprint FN do `PLANO_FRONTEND.md`. Os shapes de request/response vêm dos projetos `*.Contracts` em `src/` (fonte de verdade — não invente campos). Siga as decisões da Seção 1, o mapeamento Atomic da Seção 3.2 e as regras da Seção 8 — em conflito entre seu julgamento e a Seção 8, a Seção 8 vence. Toda tela nasce mobile-first (Seção 4.3) e respeita o checklist Capacitor (Seção 10). Ao final: `ng build`, `ng test` e lint verdes, e o critério de aceite da sprint demonstrado no viewport mobile (390×844).
