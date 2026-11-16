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
  -d '{"nome":"Vendedor Smoke '"$RANDOM"'","permissoes":["vendas.registrar","estoque.custos"]}' | jq -r .id)
FUNC_ID=$(curl -fsS -X POST "$RH/v1/funcionarios" -H "Content-Type: application/json" \
  -d '{"nome":"Funcionário Smoke","cargoId":"'"$CARGO_ID"'","valorDiaria":80}' | jq -r .id)
echo "OK  funcionario=$FUNC_ID"

echo "=== Smoke: Clientes — cadastro ==="
CLI_ID=$(curl -fsS -X POST "$CLIENTES/v1/clientes" -H "Content-Type: application/json" \
  -d '{"nome":"Cliente Smoke"}' | jq -r .id)
echo "OK  cliente=$CLI_ID"

echo "=== Smoke: Estoque — marca, tipo de casco, produto retornável, associação, abastecimento ==="
MARCA_ID=$(curl -fsS -X POST "$ESTOQUE/v1/marcas" -H "Content-Type: application/json" \
  -d '{"nome":"Marca Smoke '"$RANDOM"'"}' | jq -r .id)
CASCO_ID=$(curl -fsS -X POST "$ESTOQUE/v1/tipos-casco" -H "Content-Type: application/json" \
  -d '{"nome":"Casco 20L Smoke '"$RANDOM"'","precoVasilhame":30,"aceitaSucata":true}' | jq -r .id)
PRODUTO_ID=$(curl -fsS -X POST "$ESTOQUE/v1/produtos" -H "Content-Type: application/json" \
  -d '{"tipo":"RETORNAVEL","nome":"Água Smoke 20L","tamanho":"20L","tipoCascoId":"'"$CASCO_ID"'"}' | jq -r .id)
PM_ID=$(curl -fsS -X POST "$ESTOQUE/v1/produtos/$PRODUTO_ID/marcas" -H "Content-Type: application/json" \
  -d '{"marcaId":"'"$MARCA_ID"'","precoReferencia":50,"estoqueMinimo":5}' \
  | jq -r --arg marca "$MARCA_ID" '.marcas[] | select(.marcaId == $marca) | .id')
ABAST_ID=$(curl -fsS -X POST "$ESTOQUE/v1/abastecimentos" -H "Content-Type: application/json" \
  -d '{"tipoFrete":"PROPRIO","funcionarioId":"'"$FUNC_ID"'","itens":[{"produtoMarcaId":"'"$PM_ID"'","quantidade":20}],"cascos":[{"tipoCascoId":"'"$CASCO_ID"'","quantidade":10}]}' | jq -r .id)
echo "OK  produto=$PRODUTO_ID marca=$MARCA_ID (associação $PM_ID) abastecido (20 un) + 10 cascos vazios do tipo $CASCO_ID"

echo "=== Smoke: Abastecimento momento 1 fica pendente; momento 2 aceita custo 0 e frete 0 ==="
curl -fsS "$ESTOQUE/v1/abastecimentos/custos-pendentes?funcionarioId=$FUNC_ID" \
  | jq -e --arg id "$ABAST_ID" 'map(select(.id == $id)) | length == 1' > /dev/null
DETALHE=$(curl -fsS "$ESTOQUE/v1/abastecimentos/$ABAST_ID?funcionarioId=$FUNC_ID")
echo "$DETALHE" | jq -e '.custoPendente == true and .frete == null' > /dev/null
CUSTOS_BODY=$(echo "$DETALHE" | jq -c --arg func "$FUNC_ID" \
  '{funcionarioId: $func, frete: 0, itens: [.itens[] | {id, custoUnitario: 0}], cascos: [.cascos[] | {id, custoUnitario: 0}]}')
curl -fsS -X PUT "$ESTOQUE/v1/abastecimentos/$ABAST_ID/custos" -H "Content-Type: application/json" -d "$CUSTOS_BODY" \
  | jq -e '.custoPendente == false and .custoTotal == 0' > /dev/null
curl -fsS "$ESTOQUE/v1/abastecimentos/custos-pendentes?funcionarioId=$FUNC_ID" \
  | jq -e --arg id "$ABAST_ID" 'map(select(.id == $id)) | length == 0' > /dev/null
echo "OK  carga $ABAST_ID saiu dos pendentes com custo 0"

echo "=== Smoke: Financeiro — abrir caixa ==="
CAIXA_ID=$(curl -fsS -X POST "$FINANCEIRO/v1/caixas" -H "Content-Type: application/json" \
  -d '{"saldoInicial":100}' | jq -r .id)
echo "OK  caixa=$CAIXA_ID"

echo "=== Smoke: Venda 4.1 — 5 un. (troca), devolve 3 cascos, entrega 1 sucata, pix 200 ==="
VENDA_BODY='{"clienteId":"'"$CLI_ID"'","funcionarioId":"'"$FUNC_ID"'","itens":[{"produtoId":"'"$PRODUTO_ID"'","marcaId":"'"$MARCA_ID"'","quantidade":5,"precoUnitario":50,"pagouVasilhame":false}],"pagamentos":[{"forma":"PIX","valor":200}],"cascosDevolvidos":[{"tipoCascoId":"'"$CASCO_ID"'","quantidade":3}],"sucataEntregue":[{"tipoCascoId":"'"$CASCO_ID"'","quantidade":1}]}'
VENDA=$(curl -fsS -X POST "$VENDAS/v1/vendas" -H "Content-Type: application/json" -d "$VENDA_BODY")
VENDA_ID=$(echo "$VENDA" | jq -r .id)
echo "$VENDA" | jq -e '.statusPagamento == "PARCIAL" and .saldoFiadoGerado == 50 and .saldoCascoCliente == 2' > /dev/null
echo "$VENDA" | jq -e --arg tipo "$CASCO_ID" '.saldoCascoClientePorTipo | length == 1 and .[0].tipoCascoId == $tipo and .[0].saldo == 2' > /dev/null
echo "OK  venda=$VENDA_ID (PARCIAL, fiado 50, saldo casco 2 no tipo $CASCO_ID)"

echo "=== Smoke: detalhe da venda (marca, casco do item, devolução e sucata por tipo) ==="
curl -fsS "$VENDAS/v1/vendas/$VENDA_ID" | jq -e --arg marca "$MARCA_ID" --arg tipo "$CASCO_ID" '
  .itens[0].marcaId == $marca and .itens[0].tipoCascoId == $tipo and .itens[0].pagouVasilhame == false
  and .cascosDevolvidos == [{"tipoCascoId": $tipo, "quantidade": 3}]
  and .sucataEntregue == [{"tipoCascoId": $tipo, "quantidade": 1}]' > /dev/null
echo "OK  detalhe confere"

echo "=== Smoke: estoque de cascos do tipo (10 da carga + 3 devolvidos = 13 vazios, 1 sucata) ==="
curl -fsS "$ESTOQUE/v1/estoque/cascos" \
  | jq -e --arg tipo "$CASCO_ID" '.[] | select(.tipoCascoId == $tipo) | .vazios == 13 and .sucata == 1' > /dev/null
echo "OK  vazios 13, sucata 1"

echo "=== Smoke: edição da venda (replay) não duplica os efeitos de casco ==="
EDICAO=$(curl -fsS -X PUT "$VENDAS/v1/vendas/$VENDA_ID" -H "Content-Type: application/json" -d "$VENDA_BODY")
echo "$EDICAO" | jq -e '.saldoCascoCliente == 2 and .saldoFiadoGerado == 50' > /dev/null
curl -fsS "$ESTOQUE/v1/estoque/cascos" \
  | jq -e --arg tipo "$CASCO_ID" '.[] | select(.tipoCascoId == $tipo) | .vazios == 13 and .sucata == 1' > /dev/null
echo "OK  replay manteve saldo de casco 2, vazios 13 e sucata 1"

echo "=== Smoke: saldos do cliente (casco 2 / sucata 1 / fiado 50) ==="
curl -fsS "$CLIENTES/v1/clientes/$CLI_ID/saldos" \
  | jq -e '.saldoCascos == 2 and .sucataEntregue == 1 and .saldoFiado == 50' > /dev/null
echo "OK  saldos conferem — sucata NÃO abateu o débito de casco"

echo "=== Smoke: cupom fiscal + bloqueio de edição ==="
curl -fsS -X POST "$VENDAS/v1/vendas/$VENDA_ID/cupom-fiscal" | jq -e '.numero' > /dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$VENDAS/v1/vendas/$VENDA_ID" \
  -H "Content-Type: application/json" \
  -d '{"clienteId":"'"$CLI_ID"'","funcionarioId":"'"$FUNC_ID"'","itens":[{"produtoId":"'"$PRODUTO_ID"'","marcaId":"'"$MARCA_ID"'","quantidade":1,"precoUnitario":50,"pagouVasilhame":false}],"pagamentos":[],"cascosDevolvidos":[],"sucataEntregue":[]}')
[ "$CODE" = "422" ] || { echo "FALHOU: edição pós-cupom devia dar 422, veio $CODE"; exit 1; }
echo "OK  edição pós-cupom bloqueada (422)"

echo "=== Smoke: crédito do cliente — pagamento acima do devido vira crédito (saldo -50 + 150 = 100) ==="
curl -fsS -X POST "$FINANCEIRO/v1/clientes/$CLI_ID/fiado/pagamentos" -H "Content-Type: application/json" \
  -d '{"valor":150,"forma":"PIX"}' > /dev/null
curl -fsS "$CLIENTES/v1/clientes/$CLI_ID/saldos" | jq -e '.saldo == 100 and .creditoDisponivel == 100' > /dev/null
echo "OK  crédito disponível 100"

echo "=== Smoke: Venda 2 — pagou o vasilhame (2 x (50 + 30) = 160), crédito 100 + pix 60 ==="
VENDA2=$(curl -fsS -X POST "$VENDAS/v1/vendas" -H "Content-Type: application/json" \
  -d '{"clienteId":"'"$CLI_ID"'","funcionarioId":"'"$FUNC_ID"'","itens":[{"produtoId":"'"$PRODUTO_ID"'","marcaId":"'"$MARCA_ID"'","quantidade":2,"precoUnitario":50,"pagouVasilhame":true}],"pagamentos":[{"forma":"CREDITO_CLIENTE","valor":100},{"forma":"PIX","valor":60}],"cascosDevolvidos":[],"sucataEntregue":[]}')
echo "$VENDA2" | jq -e '.totalLiquido == 160 and .statusPagamento == "PAGA" and .saldoFiadoGerado == 0 and .saldoCascoCliente == 2' > /dev/null
curl -fsS "$CLIENTES/v1/clientes/$CLI_ID/saldos" | jq -e '.saldo == 0 and .creditoDisponivel == 0 and .saldoCascos == 2' > /dev/null
echo "OK  venda paga com crédito; linha com vasilhame pago não empresta casco (saldo de casco segue 2)"

echo "=== Smoke: crédito acima do disponível é recusado (CREDITO_INSUFICIENTE) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$VENDAS/v1/vendas" -H "Content-Type: application/json" \
  -d '{"clienteId":"'"$CLI_ID"'","funcionarioId":"'"$FUNC_ID"'","itens":[{"produtoId":"'"$PRODUTO_ID"'","marcaId":"'"$MARCA_ID"'","quantidade":1,"precoUnitario":50,"pagouVasilhame":false}],"pagamentos":[{"forma":"CREDITO_CLIENTE","valor":50}],"cascosDevolvidos":[],"sucataEntregue":[]}')
[ "$CODE" = "422" ] || { echo "FALHOU: crédito sem saldo devia dar 422, veio $CODE"; exit 1; }
echo "OK  crédito sem saldo recusado (422)"

echo "=== Smoke: fechamento de caixa com diária editada (100 em vez dos 80 cadastrados) ==="
FECHAMENTO=$(curl -fsS -X POST "$FINANCEIRO/v1/caixas/$CAIXA_ID/fechamento" \
  -H "Content-Type: application/json" -d '{"diarias":[{"funcionarioId":"'"$FUNC_ID"'","valor":100}]}')
echo "$FECHAMENTO" | jq -e '.diariasLancadas == 1' > /dev/null
echo "OK  caixa fechado: $(echo "$FECHAMENTO" | jq -c .)"

echo "=== Smoke: conta corrente do funcionário (diária editada 100 creditada) ==="
curl -fsS "$RH/v1/funcionarios/$FUNC_ID/conta-corrente" | jq -e '.saldoAPagar == 100' > /dev/null
echo "OK  saldo do funcionário = 100"

echo ""
echo "=== Smoke: PASSED ==="
