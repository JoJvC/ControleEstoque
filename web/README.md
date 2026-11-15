# ControleEstoque Web

Front Angular 22 (zoneless, PWA, mobile-first) do ControleEstoque. Fala com o gateway nginx em `/api/<contexto>/v1` (`public/config.json`).

## Setup

Com o compose da raiz no ar (gateway em `http://localhost:8080`):

```bash
git clone <repo> && cd <repo>/web
npm ci
npm start
```

`npm start` sobe o `ng serve` em `http://localhost:4200/`, com `proxy.conf.json` encaminhando `/api` ao gateway.

## Build

```bash
npm run build
```

Saída em `dist/controle-estoque-web/browser`. O gateway (`infra/Dockerfile.web`) serve essa pasta em `/`.

## PWA

O service worker (`ngsw-config.json`, network-first para `/api`) só roda no build de produção (`npm run build`), não no `ng serve`.

## Testes unitários

```bash
npm test
```

Vitest via `ng test`. Também: `npm run lint` e `npm run format:check`.

## Aparência e telas (design Depósito)

Quatro temas: Oceano, Uva, Carvão e Noite. **Automático** é o padrão: Oceano no claro e Noite no escuro do aparelho. A escolha fica em Mais › Aparência. Tokens, tipografia (Sora e Figtree) e ícones em [`DESIGN.md`](DESIGN.md).

Telas no design novo ([`DESIGN.md` §5](DESIGN.md)): `/home`, `/vendas` (lista, `/vendas/nova`), `/clientes`, `/produtos`, `/marcas`, `/estoque`, `/financeiro/caixa`, `/relatorios`, `/rh`, `/rh/funcionarios`, `/rh/cargos`, `/mais`, `/mais/aparencia` e a seleção de operador `/operador`.

## Testes e2e (Playwright)

Smoke em viewport 390×844, pela UI, com 10 testes:

- seleção de operador: `/home` sem operador redireciona para `/operador`; escolher o funcionário leva a `/home` e grava `ce.operador`;
- navegação: com o operador selecionado, visita cada rota migrada (`/rh`, `/rh/funcionarios`, `/rh/cargos`, `/clientes`, `/produtos`, `/marcas`, `/estoque`, `/financeiro/caixa`, `/vendas`, `/relatorios`, `/mais`, `/mais/aparencia`) e confere o título;
- venda em uma tela: operador → PDV (cliente, produto, preço e desconto, Cobrar, PIX parcial, Confirmar venda) → "Venda registrada" com "Parcial" → caixa com as entradas somadas;
- Repetir: depois de uma venda, escolhe o mesmo cliente em `/vendas/nova` e "Repetir última venda" traz o item ao carrinho;
- Clientes: bottom-nav → busca → detalhe com "Vender" e "Repetir última venda";
- reposição: "Repor <produto>" no Acabando da Home abre `/estoque/abastecimento` com o produto; registra a entrada e confere o estoque pela API;
- Caixa: botão do caixa na Home → estado "Aberto" e ações; abre o fechamento e cancela, sem fechar o caixa;
- Relatórios: Mais → Relatórios → Vendas por período (com "Por dia" ou o estado vazio);
- troca de operador: Mais → "Trocar operador" → outro funcionário e `ce.operador` atualizado;
- temas: em `/mais/aparencia`, clique em Oceano, Uva, Carvão e Noite (`aria-checked` e `data-tema` no `<html>`), seta do teclado, persistência depois do reload (`ce.tema`) e volta ao Automático.

Rodar no host, a partir da raiz do repositório:

```bash
docker compose -f infra/docker-compose.yml up -d --build   # gateway na porta 8080
cd web
npm ci
npx playwright install chromium
npm run e2e
```

- Outra porta ou host: `E2E_BASE_URL=http://localhost:9090 npm run e2e`.
- O spec cria os próprios dados pela API (cargo, operadores, cliente, marca, produto, abastecimento), com sufixo único por execução; pode ser repetido.
- O cargo criado pelo spec recebe as permissões que as rotas exigem: `vendas.registrar`, `rh.gerir`, `relatorios.ver`, `clientes.cadastrar`, `estoque.editar`, `estoque.custos` e `caixa.fechar`.
- Exige o caixa do dia aberto ou inexistente (abre um se faltar); com o caixa de hoje fechado o teste falha. Rode em base limpa. O teste de Caixa abre o fechamento e cancela: não fecha o caixa do dia, para o smoke rodar de novo no mesmo dia.

## Capacitor (passo futuro)

Ainda não instalado. Para empacotar:

```bash
npm i @capacitor/core @capacitor/cli && npx cap init && npx cap add android
```

Aponte `webDir` do `capacitor.config` para `dist/controle-estoque-web/browser`. Checklist em `PLANO_FRONTEND.md` §10.
