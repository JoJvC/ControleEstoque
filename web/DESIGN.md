# Design "Depósito" — refatoração visual do front (Fase 3)

Aprovado pelo usuário em 2026-11-14, a partir do canvas de design (v3 com a fonte da v2).
Escopo: só visual e experiência. Regras de negócio, contratos de API e a Seção 8 do PLANO_FRONTEND.md continuam valendo e vencem qualquer conflito.

## 1. Princípios
- O app pensa como um depósito: água em galões, cascos que voltam, descartáveis (gelo, carvão, copos…) por categoria.
  Galão, casco e nível de água aparecem só onde a regra de casco vale (tipo AGUA). GALAO_COMPLETO não gera débito de casco. DESCARTAVEL agrupa pela `categoria`.
- Número primeiro: valor grande (fonte de títulos), rótulo pequeno em cima.
- Ação principal embaixo, ao alcance do polegar, em barra fixa (altura 56–58 px). Alvos de toque ≥ 44 px.
- Cor é significado: casco, sucata, fiado e pago têm cor própria, igual em todos os temas.
- Casco ≠ sucata ≠ fiado: campos, chips e cores separados; nunca somados nem convertidos (Seção 8, regras 1 e 7).
- Números agregados (totais do dia, cascos na rua, fiado a receber) vêm do servidor. O front não soma saldos (regra 6). Se a API não oferece, fatia própria de backend.

## 2. Tipografia
- Títulos e números: **Sora** 600/700/800, `font-variant-numeric: tabular-nums` em valores.
- Texto, rótulos e campos: **Figtree** 400/500/600/700. Base 16 px (sem zoom no iOS).
- Fontes empacotadas no app (pacotes `@fontsource/sora` e `@fontsource/figtree`), não Google Fonts: o PWA tem de funcionar offline.

## 3. Temas
Escolha em Mais › Aparência, guardada por aparelho via StorageService: **Automático** (padrão: Oceano; Noite quando o aparelho está em modo escuro), Oceano, Uva, Carvão, Noite.
O tema troca só topo, ação e superfícies. Implementar como `[data-tema]` no `<html>` redefinindo as custom properties de tokens.scss.

| token | Oceano | Uva | Carvão | Noite (escuro) |
|---|---|---|---|---|
| topo (cabeçalho/hero) | #062A3F | #2E1065 | #1F2226 | #050E15 |
| topo-cartao | #0E3A55 | #43198F | #33373D | #0E2A3B |
| destaque (nível, trilho de etapas) | #4CC9E8 | #C4B5FD | #F5B942 | #4CC9E8 |
| acao | #08769C | #6D28D9 | #2F3338 | #4CC9E8 |
| texto-sobre-acao | #FFFFFF | #FFFFFF | #FFFFFF | #03202C |
| acao-suave | #E3F3F8 | #EDE9FE | #ECEDEF | #0E2A3B |
| acao-texto (link) | #08769C | #6D28D9 | #2F3338 | #7DD8EE |
| chao (fundo) | #F2F8FA | #F6F5FB | #F4F4F2 | #07141C |
| superficie (cartão) | #FFFFFF | #FFFFFF | #FFFFFF | #0E2230 |
| texto | #0B2533 | #1E1537 | #1A1C1F | #E6F2F6 |
| texto-mudo | #4B6170 | #5B5570 | #575C63 | #9DB5C2 |
| linha | #E1ECF0 | #E7E4F0 | #E4E4E1 | #1D3A4C |
| borda (campos) | #C6DCE4 | #CFC9E0 | #CACBC7 | #2D4D61 |

Cores com função (iguais nos temas claros; versão clara no Noite):

| função | claro | suave | Noite | Noite suave |
|---|---|---|---|---|
| casco | #0B6E63 | #DDF2EE | #4FD1BE | #0D3A35 |
| sucata | #5B6472 | #ECEEF1 | #AAB3BF | #232C36 |
| fiado / alerta | #C2410C | #FFEDE3 | #FB923C | #3A1F10 |
| pago | #15803D | #E3F5EA | #4ADE80 | #0F2E1C |
| água (ícone) | #08769C + nível #4CC9E8 | #E3F3F8 | #4CC9E8 | #0E2A3B |

Contraste: todo par texto/fundo ≥ 4,5:1 (≥ 3:1 em texto ≥ 24 px e no anel de foco). Estender o spec de contraste existente (core/a11y) a todos os temas.
Forma: raio 12–14 px em campos/botões, 18–22 px em cartões; cartões sem sombra, separados por fundo. Sem gradientes.

## 4. Ícones (sprite do ce-icon)
galao (água), galao-completo (galão com selo de check), casco (galão vazio contornado), sucata (galão com rachadura), casco-na-rua (galão tracejado),
gelo (cubo), carvao (saco com chama), copo, caixa (categoria desconhecida, fallback). O ícone de descartável sai da `categoria` (normalizada, sem acento); categoria sem ícone usa `caixa`.

## 5. Telas (celular primeiro; desktop ≥ 960 px)
- **Shell**: celular com bottom-nav (Hoje, Clientes, Vender ao centro em destaque, Estoque, Mais); desktop com menu lateral no `topo` do tema.
  Topo das telas principais com o fundo `topo` e uma onda (SVG) na transição para o `chao`.
- **Venda (PDV)**: manter as etapas atuais (Cliente → Itens → Cascos → Pagamento → Revisão → sucesso), com trilho de etapas nomeadas no topo e "N de M".
  A etapa Cascos só aparece quando há AGUA no carrinho. Cliente escolhido fica fixo no topo com chips de casco e fiado.
  Itens: filtro por categoria em pílulas, linha por produto com ícone, estoque, preço, link "preço e desconto" (desconto por item com motivo, regra 4) e contador −/+.
  Cascos: atalho "Devolveu todos na hora" (preenche, campo segue editável; regra 2), contador de cascos, linha ao vivo "Fica N casco na rua" (feedback local, regra 6), sucata em cartão separado com o aviso "Sucata não abate o débito de casco".
  Pagamento: total grande, forma em botões, valor com atalhos Tudo / Metade / Tudo fiado, "Vai para fiado" ao vivo em cor de fiado (regra 5), novo saldo de fiado do cliente.
  Sucesso: status (Paga/Parcial/Pendente) e saldos que o response trouxe.
  Desktop: PDV numa tela só (produtos à esquerda, venda à direita).
- **Hoje (home)**: hero no `topo` com vendido hoje e saídas por categoria; botão Nova venda; cartões Cascos na rua (borda tracejada casco) e Fiado a receber; "Acabando" com itens abaixo do mínimo de qualquer categoria.
- **Cliente**: cascos com ele (galões tracejados), fiado, sucata e histórico; ações Recolher cascos, Receber fiado, Vender.
- **Estoque**: Água como galões com nível e linha tracejada do mínimo; vasilhames (cascos vazios, sucata, galão completo) em chips; descartáveis por categoria em barras com marca do mínimo.
  A barra cheia é o maior estoque do grupo (só exibição). O destaque de abaixo do mínimo vem do servidor (`abaixoMinimo`/`alertasEstoqueMinimo`). Botão "Chegou mercadoria" (abastecimento).
- **Caixa, Relatórios, RH, cadastros**: aplicar tokens, fontes, cartões e barra de ação fixa; relatórios mantêm cards no celular e tabela no desktop.
- **Mais › Aparência**: seletor de tema com prévia.

## 6. Fora de escopo (sugestões futuras)
Entregas (status a entregar/entregue), caderneta do fiado com extrato de lançamentos, consumo médio por cliente.
