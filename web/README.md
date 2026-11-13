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

## Testes e2e (Playwright)

Smoke do fluxo operador → PDV → venda com pagamento parcial → caixa, em viewport 390×844, pela UI. Precisa do compose no ar na porta 8080 (`docker compose -f infra/docker-compose.yml up -d --build`, na raiz).

```bash
npx playwright install chromium
npm run e2e
```

- Outra porta ou host: `E2E_BASE_URL=http://localhost:9090 npm run e2e`.
- O spec cria os próprios dados pela API (cargo, operador, cliente, produto, abastecimento), com sufixo único.
- Exige o caixa do dia aberto ou inexistente (abre um se faltar); com o caixa de hoje fechado o teste falha. Rode em base limpa.

## Capacitor (passo futuro)

Ainda não instalado. Para empacotar:

```bash
npm i @capacitor/core @capacitor/cli && npx cap init && npx cap add android
```

Aponte `webDir` do `capacitor.config` para `dist/controle-estoque-web/browser`. Checklist em `PLANO_FRONTEND.md` §10.
