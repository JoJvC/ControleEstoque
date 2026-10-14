#!/bin/bash
# Smoke e2e: reproduz o walkthrough da Seção 7 do PLANO_IMPLEMENTACAO.md.
# Requisitos: curl, jq. Rodar após: docker compose -f infra/docker-compose.yml up -d --build
set -euo pipefail

VENDAS="${VENDAS_URL:-http://localhost:5101}"
CLIENTES="${CLIENTES_URL:-http://localhost:5102}"
ESTOQUE="${ESTOQUE_URL:-http://localhost:5103}"
FINANCEIRO="${FINANCEIRO_URL:-http://localhost:5104}"
RH="${RH_URL:-http://localhost:5105}"

echo "=== Smoke: health checks ==="
for url in "$VENDAS" "$CLIENTES" "$ESTOQUE" "$FINANCEIRO" "$RH"; do
  curl -fsS "$url/health" | grep -q "Healthy" && echo "OK  $url/health"
done

echo "=== Smoke: RH — cargo + funcionário ==="
CARGO_ID=$(curl -fsS -X POST "$RH/v1/cargos" -H "Content-Type: application/json" \
  -d '{"nome":"Vendedor Smoke '"$RANDOM"'","permissoes":["vendas.registrar"]}' | jq -r .id)
FUNC_ID=$(curl -fsS -X POST "$RH/v1/funcionarios" -H "Content-Type: application/json" \
  -d '{"nome":"Funcionário Smoke","cargoId":"'"$CARGO_ID"'","valorDiaria":80}' | jq -r .id)
echo "OK  funcionario=$FUNC_ID"

echo "=== Smoke: Clientes — cadastro ==="
CLI_ID=$(curl -fsS -X POST "$CLIENTES/v1/clientes" -H "Content-Type: application/json" \
  -d '{"nome":"Cliente Smoke"}' | jq -r .id)
echo "OK  cliente=$CLI_ID"

echo "=== Smoke: Estoque — marca, produto, abastecimento ==="
MARCA_ID=$(curl -fsS -X POST "$ESTOQUE/v1/marcas" -H "Content-Type: application/json" \
  -d '{"nome":"Marca Smoke '"$RANDOM"'"}' | jq -r .id)
AGUA_ID=$(curl -fsS -X POST "$ESTOQUE/v1/produtos" -H "Content-Type: application/json" \
  -d '{"tipo":"AGUA","nome":"Água Smoke 20L","marcaId":"'"$MARCA_ID"'","tamanho":"20L","precoReferencia":50,"estoqueMinimo":5}' | jq -r .id)
CASCO_ID=$(curl -fsS "$ESTOQUE/v1/produtos?tipo=CASCO" | jq -r '.[0].id')
curl -fsS -X POST "$ESTOQUE/v1/abastecimentos" -H "Content-Type: application/json" \
  -d '{"tipoFrete":"PROPRIO","custoTotal":100,"itens":[{"produtoId":"'"$AGUA_ID"'","quantidade":20,"custoUnitario":30},{"produtoId":"'"$CASCO_ID"'","quantidade":10,"custoUnitario":0}]}' > /dev/null
echo "OK  agua=$AGUA_ID abastecida (20 un) + 10 cascos vazios"

echo "=== Smoke: Financeiro — abrir caixa ==="
CAIXA_ID=$(curl -fsS -X POST "$FINANCEIRO/v1/caixas" -H "Content-Type: application/json" \
  -d '{"saldoInicial":100}' | jq -r .id)
echo "OK  caixa=$CAIXA_ID"

echo "=== Smoke: Venda 4.1 — 5 águas, devolve 3 cascos, entrega 1 sucata, pix 200 ==="
VENDA=$(curl -fsS -X POST "$VENDAS/v1/vendas" -H "Content-Type: application/json" \
  -d '{"clienteId":"'"$CLI_ID"'","funcionarioId":"'"$FUNC_ID"'","itens":[{"produtoId":"'"$AGUA_ID"'","quantidade":5,"precoUnitario":50}],"pagamentos":[{"forma":"PIX","valor":200}],"cascosDevolvidos":3,"cascosDevolvidosNaHora":false,"sucataEntregue":1}')
VENDA_ID=$(echo "$VENDA" | jq -r .id)
echo "$VENDA" | jq -e '.statusPagamento == "PARCIAL" and .saldoFiadoGerado == 50 and .saldoCascoCliente == 2' > /dev/null
echo "OK  venda=$VENDA_ID (PARCIAL, fiado 50, saldo casco 2)"

echo "=== Smoke: saldos do cliente (casco 2 / sucata 1 / fiado 50) ==="
curl -fsS "$CLIENTES/v1/clientes/$CLI_ID/saldos" \
  | jq -e '.saldoCascos == 2 and .sucataEntregue == 1 and .saldoFiado == 50' > /dev/null
echo "OK  saldos conferem — sucata NÃO abateu o débito de casco"

echo "=== Smoke: cupom fiscal + bloqueio de edição ==="
curl -fsS -X POST "$VENDAS/v1/vendas/$VENDA_ID/cupom-fiscal" | jq -e '.numero' > /dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$VENDAS/v1/vendas/$VENDA_ID" \
  -H "Content-Type: application/json" \
  -d '{"clienteId":"'"$CLI_ID"'","funcionarioId":"'"$FUNC_ID"'","itens":[{"produtoId":"'"$AGUA_ID"'","quantidade":1,"precoUnitario":50}],"pagamentos":[],"cascosDevolvidos":0,"cascosDevolvidosNaHora":false,"sucataEntregue":0}')
[ "$CODE" = "422" ] && echo "OK  edição pós-cupom bloqueada (422)"

echo "=== Smoke: fechamento de caixa com diária ==="
FECHAMENTO=$(curl -fsS -X POST "$FINANCEIRO/v1/caixas/$CAIXA_ID/fechamento" \
  -H "Content-Type: application/json" -d '{"diarias":[{"funcionarioId":"'"$FUNC_ID"'"}]}')
echo "$FECHAMENTO" | jq -e '.diariasLancadas == 1' > /dev/null
echo "OK  caixa fechado: $(echo "$FECHAMENTO" | jq -c .)"

echo "=== Smoke: conta corrente do funcionário (diária 80 creditada) ==="
curl -fsS "$RH/v1/funcionarios/$FUNC_ID/conta-corrente" | jq -e '.saldoAPagar == 80' > /dev/null
echo "OK  saldo do funcionário = 80"

echo ""
echo "=== Smoke: PASSED ==="
