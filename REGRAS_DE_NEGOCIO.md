# Sistema de Controle de Estoque e Vendas de Galões de Água

## 1. Visão Geral do Sistema
Descrição do propósito do sistema, que controla o estoque de galões de água, descartáveis, cascos, vendas e custos, com gestão de funcionários e permissões.

## 2. Entidades Principais
- **Clientes**: Cadastro de clientes.
- **Produtos**: Galões de água (por marca, tamanho — ex: 20L e 10L), descartáveis e cascos. Cada produto tem um **preço de referência**, mas o preço final é sempre definido no momento da venda (ver regra em 5), e pode ter **foto** cadastrada. Descartáveis têm controle de estoque simples (entrada/saída), sem regras especiais, com marcas e tamanhos livres; **qualquer outro produto que a loja queira vender e que não envolva casco (ex: carvão, gelo) é cadastrado e tratado como descartável**. O casco é genérico (não há diferenciação por marca) e é emprestado/vendido apenas como **normal**; a **sucata** (quebrado) é uma categoria separada, sem empréstimo — só entra no fluxo por entrega do cliente ou quebra de casco normal.
- **Marcas**: Cadastro próprio de marcas (obrigatória para água/galão completo; opcional para descartáveis), referenciadas pelos produtos.
- **Estoque**: Controle das quantidades de produtos, incluindo cascos físicos (quantidade de cascos normais vazios/cheios na loja) e o estoque de sucata, controlados separadamente.
- **Vendas**: Registro de cada venda, podendo conter N itens (produtos diferentes e/ou marcas diferentes de galão na mesma venda), vinculada a cliente, funcionário responsável, formas de pagamento e entrega. Pode ser editada após o registro (itens, pagamentos, desconto, devolução) e permite emissão de cupom fiscal.
- **Pagamentos**: Uma venda pode ter N formas de pagamento simultâneas (pix, cartão de crédito, cartão de débito, dinheiro, etc.), cada uma com valor próprio lançado. A soma dos valores define quanto da venda já foi pago; o que faltar compõe o fiado do cliente.
- **Caixa**: Controle de entradas e saídas, incluindo diária de funcionários lançada no fechamento diário e despesas do dia categorizadas por tipo.
- **Funcionários**: Cadastro dos funcionários, vinculação às vendas, diária fixa.
- **Conta Corrente do Funcionário**: Controle de remuneração — diárias lançadas, vales (adiantamentos) tirados, pagamentos realizados (normalmente semanais) e saldo.
- **Conta Corrente de Casco do Cliente**: Saldo de cascos normais (vasilhames) que o cliente está devendo à loja, decorrente exclusivamente de vendas de água (a venda de água só empresta casco normal — nunca sucata).
- **Registro de Sucata do Cliente**: Quantidade de galões sucata (quebrados) entregues pelo cliente à loja ao longo do tempo. **Não é um débito** — é um recebimento independente, que não abate o saldo de casco normal do cliente.
- **Conta Corrente do Cliente (Fiado)**: Saldo devedor financeiro do cliente, incluindo débitos de casco convertidos em valor, eventual conversão em valor de sucata entregue, e o saldo pendente de vendas ainda não totalmente pagas.

## 3. Fluxos de Negócio
### 3.1 Cadastro de Clientes
- Inserção de dados do cliente (nome, contato, histórico de compra).
- Cliente pode ter mais de um endereço cadastrado, usado para entrega.

### 3.2 Cadastro de Produtos e Marcas
- Cadastro de marcas de água (entidade própria), vinculadas aos produtos.
- Inserção de galões (marca, tamanho — 20L, 10L —, preço de referência), descartáveis (marcas e tamanhos livres) e casco (genérico, sem variação por marca).
- Produtos sem regra de casco (ex: carvão, gelo, copos) são cadastrados livremente e tratados pelo sistema como descartáveis, com uma categoria livre para agrupamento.
- Cada produto pode ter uma foto cadastrada.

### 3.3 Controle de Estoque
- Entrada e saída de produtos, incluindo abastecimento (frete terceirizado ou caminhão/funcionário próprio da loja).

### 3.4 Registro de Vendas
- Uma venda pode conter N itens: água (por marca), galão completo, casco avulso e/ou descartáveis, combinados livremente na mesma venda.
- Vinculação ao cliente, funcionário responsável e valor (definido no ato da venda, usando o preço de referência apenas como base).
- **Edição pós-registro**: a venda pode ser editada depois de registrada (itens, pagamentos, desconto, devoluções de casco/sucata).
- **Cupom fiscal**: o sistema permite emitir cupom fiscal referente à venda.
- **Formas de pagamento**: uma venda pode ter N formas de pagamento simultâneas (pix, cartão de crédito, cartão de débito, dinheiro, etc.), cada uma com valor lançado individualmente. O que não for coberto pela soma dos pagamentos vira pendência (fiado) na conta corrente do cliente.
- **Desconto**: pode ser inserido no ato da venda ou em uma edição posterior, sempre com um motivo. O desconto é aplicado por item (produto), digitado manualmente (valor ou percentual); o sistema recalcula o total da venda automaticamente.
- **Devolução na venda**: no registro (ou edição) da venda é possível informar quantos cascos normais foram devolvidos (abate o débito de casco normal) e, independentemente, quanta sucata o cliente entregou (apenas registro, ver 3.6) — a entrega de sucata não abate o débito de casco normal.
- **Status de pagamento**: a venda só é considerada **paga** quando a soma dos pagamentos lançados cobre integralmente o valor total da venda (já com desconto aplicado). Enquanto isso, permanece parcial/pendente, e a diferença compõe o saldo de fiado do cliente.

### 3.5 Controle de Caixa
- No fechamento do caixa do dia, é lançada a diária de cada funcionário que trabalhou (não há controle de presença separado — a presença/falta é considerada diretamente no lançamento da diária no fechamento).
- Diária lançada não é paga imediatamente: ela alimenta a conta corrente do funcionário (ver 3.8), sendo o pagamento normalmente consolidado semanalmente.
- Registro das vendas (entradas) e despesas (saídas, incluindo diárias de funcionários e custos de abastecimento).
- Cada despesa lançada no caixa deve ter um **tipo de despesa** associado, para permitir análise por categoria.
- Fechamento do caixa no final do dia com saldo consolidado.

### 3.6 Gestão de Cascos e Sucata (Galão Quebrado)
A loja só empresta e cobra débito de **casco normal** — a venda de água nunca gera empréstimo ou débito de sucata. **Sucata** (vasilhame quebrado) tem estoque físico e registro por cliente próprios, alimentados apenas por entregas do cliente (avulsas ou no ato de uma venda) e por baixas de casco normal quebrado; essas entregas são **independentes** do saldo de casco normal e **não abatem** o débito de casco normal do cliente.

- **Venda de galão completo** (sempre com casco normal): o casco é vendido junto com a água, como propriedade do cliente. **Não gera débito** — não há expectativa de devolução.
- **Venda de água** (sempre com casco normal): o casco usado para entregar a água continua sendo da loja (emprestado). **Gera débito de casco normal** para o cliente, a menos que ele devolva vazio(s) no ato ou depois.

Controles envolvidos:
- **Entrada no estoque**: o abastecimento pode trazer unidades de **galão completo** (casco + água) e/ou **casco vazio** separadamente. Sucata normalmente não vem do abastecimento — entra no estoque por entrega do cliente ou por baixa de casco normal quebrado.
- **Estoque físico de vazios**: o estoque de casco normal vazio é alimentado pelo abastecimento e pelas devoluções dos clientes na venda de água. O estoque de sucata é alimentado por entregas avulsas do cliente e por cascos normais baixados por quebra. Ambos são controlados separadamente. Deve existir uma função de **baixa de casco** para registrar perdas (quebra), atribuída a um ou mais funcionários responsáveis — o casco baixado passa a compor o estoque de sucata.
- **Saldo de casco por cliente**: quantos cascos normais cada cliente está devendo à loja (apenas por vendas de água, nunca por galão completo). Não há limite de cascos por cliente.
- **Registro de sucata por cliente**: quantidade de sucata que cada cliente já entregou à loja — não é um débito, apenas um recebimento registrado, independente do saldo de casco normal.
- **Venda de água — registro da devolução**: a venda registra a quantidade de cheios vendidos e a quantidade de vazios (casco normal) devolvidos pelo cliente naquele momento como campos independentes (não precisam ser iguais). Para o caso comum (troca direta, tudo devolvido), a tela de venda deve ter uma opção rápida do tipo "cascos devolvidos na hora" que preenche a devolução igual à quantidade vendida, mas o valor continua editável para os casos parciais. A diferença (vendido − devolvido) ajusta o saldo de casco normal do cliente: gera débito se devolveu menos, gera crédito se devolveu mais (abatendo débito de vendas anteriores). Se o cliente entregar sucata na mesma ocasião, essa quantidade é lançada à parte no registro de sucata e **não** abate o débito de casco normal.
- **Pagar Casco**: funcionalidade para quitar o débito de casco normal do cliente, de duas formas possíveis:
  - **Devolução física**: cliente devolve o(s) casco(s) normal(is) vazio(s) (no ato da venda ou avulsa, sem compra associada), abatendo o débito e dando entrada no estoque físico de vazios.
  - **Conversão em valor**: ao invés de devolver fisicamente, o débito de casco normal é convertido em cobrança em dinheiro, lançando a venda do casco vazio, que migra a pendência para a conta corrente financeira (fiado) do cliente.
- **Entrega de Sucata**: cliente entrega vasilhame(s) quebrado(s) à loja (avulso ou junto de uma venda), dando entrada no estoque físico de sucata e no registro de sucata do cliente. A loja pode, a seu critério, converter essa entrega em valor (crédito ao cliente na conta corrente/fiado).

### 3.7 Abastecimento
- Registro de abastecimento do estoque da loja, que pode ser feito via frete terceirizado ou com caminhão/funcionário próprio da loja.
- O abastecimento pode trazer galão completo (casco + água) e/ou casco vazio separadamente, cada um dando entrada no respectivo estoque.
- Vinculação do custo do abastecimento (terceirizado ou próprio) ao estoque e ao caixa.

### 3.8 Conta Corrente de Funcionários
- Cada diária lançada no fechamento de caixa (ver 3.5) credita a conta corrente do funcionário.
- Funcionário pode solicitar **vale** (adiantamento), lançado como débito na conta corrente.
- Pagamento ao funcionário (normalmente semanal) é lançado como baixa na conta corrente.
- Saldo da conta corrente = diárias creditadas − vales − pagamentos realizados.

### 3.9 Conta Corrente de Clientes (Fiado)
- Vendas cujo total de pagamentos não cobre o valor integral (ver 3.4) e conversões de débito de casco normal em valor geram lançamentos de débito na conta corrente do cliente. Entregas de sucata, se a loja optar por convertê-las em valor, geram lançamento de crédito.
- Pagamentos do cliente (à vista de dívida antiga, parcelas) são lançados como baixa na conta corrente.
- Saldo da conta corrente = débitos (vendas não totalmente pagas + conversões de casco em valor) − créditos (conversões de sucata em valor) − pagamentos realizados.
- Esta conta é independente do saldo físico de casco normal e do registro de sucata (ver 3.6) — só recebe lançamento quando há conversão explícita em valor.

## 4. Casos de Uso
### 4.1 Fluxo de Venda de Água com Troca de Casco
- Cliente recebe N cheios (sempre casco normal) e devolve M vazios (M pode ser menor, igual ou maior que N; opção rápida "cascos devolvidos na hora" preenche M = N). Sistema registra as duas quantidades, ajusta o saldo de casco normal do cliente pela diferença (débito se M < N, crédito se M > N) e atualiza o estoque físico de cascos vazios. Se o cliente entregar sucata junto, ela é lançada à parte no registro de sucata, sem abater o débito de casco normal.

### 4.2 Fluxo de Venda de Galão Completo
- Cliente recebe água + casco como propriedade definitiva, sem gerar débito de casco. Unidade sai do estoque de galão completo.

### 4.3 Fluxo de Venda de Cascos Separados
- Venda exclusiva de casco (vazio), registro no caixa.

### 4.4 Fluxo de Venda de Descartáveis
- Registro de venda de descartáveis, vinculado ao caixa.

### 4.5 Venda com Múltiplos Itens
- Uma única venda combina, por exemplo, água de marcas diferentes, casco avulso e descartáveis, cada item com seu produto e valor.

### 4.6 Pagar Casco (Devolução Física)
- Cliente devolve casco(s) normal(is) vazio(s) — no ato de uma venda de água ou avulso, sem compra associada — abatendo seu débito de casco normal e dando entrada no estoque físico de vazios.

### 4.7 Baixa de Casco por Quebra
- Registro de perda (quebra) de casco normal no estoque físico, atribuída a um ou mais funcionários responsáveis; o casco baixado passa a compor o estoque de sucata.

### 4.8 Pagar Casco (Conversão em Débito Financeiro)
- Débito de casco normal de um cliente é convertido em valor lançando a venda do casco vazio, que passa a compor a conta corrente (fiado) do cliente, ao invés de aguardar devolução física.

### 4.9 Entrega de Sucata
- Cliente entrega vasilhame(s) quebrado(s) à loja, avulso ou junto de uma venda, dando entrada no estoque de sucata e no registro de sucata do cliente — sem abater o débito de casco normal. A loja pode, a seu critério, converter a entrega em valor (crédito na conta corrente/fiado).

### 4.10 Venda a Prazo / Fiado
- Venda registrada com pagamento a prazo, gerando débito na conta corrente do cliente; pagamentos futuros baixam esse saldo.

### 4.11 Fechamento de Caixa
- Ao final do dia, lançamento das diárias dos funcionários que trabalharam (creditando a conta corrente de cada um), total de vendas, despesas do dia e saldo final.

### 4.12 Vale e Pagamento de Funcionário
- Funcionário solicita vale (adiantamento), debitado da conta corrente; pagamento semanal consolidado baixa o saldo acumulado de diárias.

### 4.13 Edição de Venda Pós-Registro
- Uma venda já registrada é reaberta para ajuste de itens, pagamentos, desconto ou devoluções/entregas de casco/sucata, recalculando totais e saldos afetados.

### 4.14 Emissão de Cupom Fiscal
- A partir de uma venda, o sistema emite o respectivo cupom fiscal.

### 4.15 Desconto na Venda
- No ato ou na edição da venda, é aplicado um desconto (valor ou percentual) sobre um ou mais itens, com motivo registrado; o sistema recalcula o total da venda automaticamente.

### 4.16 Venda com Múltiplas Formas de Pagamento
- Uma venda é paga combinando, por exemplo, pix + cartão de débito + dinheiro, cada forma com seu valor lançado; o sistema soma os valores para apurar quanto da venda foi quitado e o que resta como fiado.

### 4.17 Registro de Despesa no Caixa
- No fechamento (ou durante) o caixa do dia, é lançada uma despesa com seu respectivo tipo/categoria, além de valor e descrição.

### 4.18 Relatório de Faturamento por Período e/ou Produto
- Emissão de relatório de faturado filtrando por intervalo de datas e/ou por produto específico.

## 5. Regras de Negócio
- **Preço**: cada produto possui um preço de referência, mas o preço efetivo é sempre definido no momento da venda. Não existe tabela fixa de preço por categoria de cliente (atacado/varejo) — os valores variam conforme acordos individuais feitos com cada cliente.
- **Venda com múltiplos itens**: uma venda pode conter N produtos, incluindo múltiplas marcas de galão na mesma venda.
- **Edição de venda**: a venda pode ser editada após o registro (itens, pagamentos, desconto, devoluções de casco/sucata).
- **Cupom fiscal**: o sistema permite emitir cupom fiscal referente à venda.
- **Pagamento**: uma venda pode ter N formas de pagamento simultâneas (pix, cartão de crédito, cartão de débito, dinheiro, etc.), cada uma com valor lançado individualmente.
- **Status de pagamento**: a venda só é considerada **paga** quando a soma dos pagamentos cobre integralmente o valor total (já com desconto aplicado); enquanto não cobrir, fica parcial/pendente e a diferença compõe o fiado do cliente.
- **Desconto**: aplicado por item (produto), digitado manualmente (valor ou percentual) no ato ou na edição da venda, sempre com motivo obrigatório; o sistema recalcula o total automaticamente.
- **Fiado**: é uma pendência financeira separada do débito físico de casco normal e do registro de sucata; só há lançamento em fiado quando a venda não é totalmente paga, quando um débito de casco normal é explicitamente convertido em valor, ou quando uma entrega de sucata é convertida em crédito. Não há limite de crédito/fiado por cliente — fica a critério de quem lança a venda.
- **Descartáveis**: controle de estoque simples (entrada/saída), sem regras especiais de troca ou débito; marcas e tamanhos livres. Qualquer produto novo sem regra de casco (ex: carvão, gelo) é cadastrado e tratado como descartável, com categoria livre para agrupamento.
- **Marca**: cadastro próprio; obrigatória para água e galão completo, opcional para os demais produtos.
- **Foto de produto**: cada produto pode ter uma foto cadastrada, exibida nas telas de venda e catálogo.
- **Endereço**: cliente pode ter múltiplos endereços cadastrados para entrega; não há controle de rota ou status de entrega no sistema.
- **Casco normal x sucata**: a venda de água **só** empresta e gera débito de casco normal — sucata nunca é emprestada nem gera débito pela venda. Sucata é somente entregue pelo cliente à loja (avulsa ou junto de uma venda), em estoque físico e registro por cliente próprios, totalmente independentes do saldo de casco normal.
- **Casco normal — sem limite**: não há limite de cascos normais emprestados por cliente.
- **Estoque — abastecimento de casco**: pode entrar como unidade de galão completo (casco + água) ou como casco vazio separado. Sucata normalmente não vem do abastecimento; entra no estoque por entrega do cliente ou por baixa de casco normal quebrado.
- **Casco normal — venda de galão completo NÃO gera débito**: o casco é vendido como propriedade do cliente, sem expectativa de devolução.
- **Casco normal — venda de água GERA débito**: o casco usado para entregar a água continua sendo da loja; se o cliente não devolver (total ou parcialmente) no ato, o saldo faltante vira débito dele. A venda registra quantidade vendida e quantidade devolvida como campos independentes (não precisam ser iguais); a diferença gera débito (devolveu menos) ou crédito (devolveu mais, abatendo saldo anterior). A tela de venda deve ter uma opção rápida para marcar "cascos devolvidos na hora" (preenche devolvido = vendido), mantendo o campo editável para casos parciais. Se o cliente entregar sucata junto, ela é lançada à parte e **não** abate esse débito.
- **Pagar Casco**: função para quitar débito de casco normal do cliente, com duas formas: devolução física do vazio (no ato da venda ou avulsa) ou conversão em débito financeiro (lançando a venda do casco vazio, migrando a pendência para a conta corrente/fiado do cliente).
- **Entrega de Sucata**: cliente entrega vasilhame(s) quebrado(s) à loja (avulso ou junto de uma venda), dando entrada no estoque de sucata e no registro de sucata do cliente, sem qualquer efeito sobre o débito de casco normal; a loja pode, a seu critério, converter a entrega em valor (crédito na conta corrente/fiado).
- **Casco/sucata — estoque físico e quebra**: casco normal vazio e sucata são controlados como itens de estoque físico separados; perdas por quebra de casco normal são lançadas via função de baixa, atribuída a um ou mais funcionários responsáveis, e o casco baixado passa a compor o estoque de sucata.
- **Caixa**: a diária dos funcionários é lançada no fechamento do caixa do dia, considerando quem trabalhou (falta = diária não lançada); vira crédito na conta corrente do funcionário, não é paga diretamente no caixa.
- **Caixa — despesas**: cada despesa (saída) lançada no caixa deve ter um tipo/categoria associado.
- **Conta corrente de funcionário**: diárias creditadas, vales debitados; pagamento normalmente feito de uma vez por semana, baixando o saldo acumulado.
- **Conta corrente de cliente (fiado)**: soma débitos de vendas não totalmente pagas e de conversões de casco normal em valor, menos créditos de conversões de sucata; pagamentos do cliente baixam o saldo.
- **Estoque**: alerta de estoque mínimo configurável por produto.
- **Abastecimento**: pode ser via frete terceirizado ou caminhão/funcionário próprio da loja; custo é vinculado ao estoque e ao caixa.
- **Permissões**: sistema 100% configurável. Existe um cargo nativo (ADM) com acesso total; demais cargos são criados livremente pelo usuário, com permissões granulares atribuíveis, e vinculados aos funcionários.

## 6. Relatórios e Indicadores
- Relatório de Vendas por funcionário.
- Relatório de Faturamento por período e/ou por produto.
- Relatório de Estoque (incluindo cascos e sucata físicos e alertas de estoque mínimo).
- Relatório de Caixa (incluindo diárias lançadas e despesas por tipo).
- Relatório de Conta Corrente de Clientes (fiado, conversões de casco/sucata, saldo devedor).
- Relatório de Saldo de Casco Normal por Cliente (emprestados, débitos pendentes).
- Relatório de Sucata Entregue por Cliente (quantidade recebida, histórico) — independente do saldo de casco normal.
- Relatório de Conta Corrente de Funcionários (diárias, vales, pagamentos, saldo a pagar).

## 7. Permissionamento
- Sistema de permissões 100% configurável, baseado em cargos (roles) customizáveis.
- **ADM**: cargo nativo do sistema, com acesso total (não editável/removível).
- **Cargos customizados**: criados livremente pelo usuário, com permissões granulares definidas por tela/ação (ex: registrar venda, editar venda, fechar caixa, editar estoque, ver relatórios, cadastrar cliente, etc.).
- Cada funcionário é vinculado a um cargo, que define suas permissões no sistema.