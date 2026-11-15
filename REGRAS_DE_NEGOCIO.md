# Sistema de Controle de Estoque e Vendas de Galões de Água

## 1. Visão Geral do Sistema
Descrição do propósito do sistema, que controla o estoque de galões de água, descartáveis, cascos, vendas e custos, com gestão de funcionários e permissões.

## 2. Entidades Principais
- **Clientes**: Cadastro de clientes.
- **Produtos**: Item de venda com nome, categoria, tamanho (ex: 20L, 10L, 200ml, 5kg) e **tipo**: **RETORNÁVEL** (vendido em vasilhame que volta, com casco) ou **DESCARTÁVEL** (estoque simples, sem casco e sem retorno; **qualquer produto que a loja queira vender e que não envolva casco, ex: carvão, gelo, copos, é cadastrado e tratado como descartável**). Cada produto tem **N marcas** (associação produto+marca): é na associação que ficam o **preço de referência** (o preço final é sempre definido no momento da venda, ver regra em 5), o **estoque**, o **estoque mínimo** e a **foto**. O **estoque geral** do produto é a soma do estoque das marcas (produto sem marca associada tem 0). O produto retornável aponta um **tipo de casco genérico**; a associação produto+marca pode apontar um **tipo de casco específico**, que vence o genérico.
- **Marcas**: Cadastro próprio de marcas, associadas aos produtos (N por produto). Toda associação tem marca; produto sem marca própria usa uma marca cadastrada (ex: 'Genérica').
- **Tipos de casco**: Cadastro próprio de vasilhames, com **nome**, **preço do vasilhame** e se **aceita sucata**. Casco **genérico** não tem marca; casco **específico** é de uma marca. Cada tipo tem estoque próprio de **vazios** e de **sucata** (sucata só nos tipos que aceitam).
- **Estoque**: Quantidades por produto+marca (razão de lançamentos) e, separado, o estoque de cascos por tipo de casco (vazios e sucata). O estoque geral do produto é a soma das marcas.
- **Vendas**: Registro de cada venda, podendo conter N itens (produtos diferentes e/ou marcas diferentes de galão na mesma venda), vinculada a cliente, funcionário responsável, formas de pagamento e entrega. Pode ser editada após o registro (itens, pagamentos, desconto, devolução) e permite emissão de cupom fiscal.
- **Pagamentos**: Uma venda pode ter N formas de pagamento simultâneas (pix, cartão de crédito, cartão de débito, dinheiro, etc.), cada uma com valor próprio lançado. A soma dos valores define quanto da venda já foi pago; o que faltar compõe o fiado do cliente. Uma das formas é o **crédito do cliente** (saldo positivo na conta corrente), limitado ao crédito disponível.
- **Caixa**: Controle de entradas e saídas (despesas do dia categorizadas por tipo) e lançamento da diária de funcionários no fechamento diário; a diária credita a conta corrente do funcionário e não sai do caixa.
- **Funcionários**: Cadastro dos funcionários, vinculação às vendas, diária fixa.
- **Conta Corrente do Funcionário**: Controle de remuneração — diárias lançadas, vales (adiantamentos) tirados, pagamentos realizados (normalmente semanais) e saldo.
- **Conta Corrente de Casco do Cliente**: Saldo de cascos (vasilhames) que o cliente está devendo à loja, decorrente exclusivamente de vendas de produtos retornáveis (o descartável não gera retorno e a venda nunca empresta sucata).
- **Registro de Sucata do Cliente**: Quantidade de vasilhames sucata (quebrados) entregues pelo cliente à loja ao longo do tempo. **Não é um débito** — é um recebimento independente, que não abate o saldo de casco do cliente.
- **Conta Corrente do Cliente (Fiado)**: Saldo único em dinheiro do cliente, calculado no servidor a partir dos lançamentos: **negativo = fiado** (o cliente deve) e **positivo = crédito** (a loja deve ao cliente). Reúne os débitos de casco convertidos em valor, a conversão em valor de sucata entregue, o saldo pendente de vendas ainda não totalmente pagas, os pagamentos do cliente e o uso de crédito em vendas.

## 3. Fluxos de Negócio
### 3.1 Cadastro de Clientes
- Inserção de dados do cliente (nome, contato, histórico de compra).
- Cliente pode ter mais de um endereço cadastrado, usado para entrega, e tem exatamente um endereço **principal** enquanto houver endereço. O primeiro endereço ativo vira principal automaticamente; marcar outro como principal desmarca o anterior; remover o principal promove o mais antigo dos que sobram; o principal não é desmarcado direto, só marcando outro. Remover endereço é soft delete.

### 3.2 Cadastro de Produtos e Marcas
- Cadastro de marcas (entidade própria), associadas aos produtos.
- Cadastro de produtos: nome, categoria, tamanho (ex: 20L, 10L, 200ml) e tipo **RETORNÁVEL** ou **DESCARTÁVEL**. Retornável exige um tipo de casco genérico (sem marca); descartável não tem casco.
- Cada produto tem N marcas (associação produto+marca; marca obrigatória e única por produto). A associação guarda o preço de referência, o estoque mínimo e a foto; o estoque é o saldo dos lançamentos da associação. A associação pode apontar um tipo de casco específico (da mesma marca, só em produto retornável), que vence o genérico do produto.
- Cadastro de tipos de casco: nome, preço do vasilhame e se aceita sucata; genérico (sem marca) ou específico (de uma marca).
- Produtos sem regra de casco (ex: carvão, gelo, copos) são cadastrados como descartáveis, com uma categoria livre para agrupamento.
- Cada associação produto+marca pode ter uma foto cadastrada.

### 3.3 Controle de Estoque
- Entrada e saída por produto+marca, incluindo abastecimento (frete terceirizado ou caminhão/funcionário próprio da loja) e ajuste manual. O estoque geral do produto é a soma do estoque das marcas, calculado pelo servidor.
- **Alerta de estoque mínimo**: por produto+marca, quando a quantidade é menor que o estoque mínimo e só se o mínimo for maior que 0 (quantidade igual ao mínimo não alerta; mínimo 0 nunca alerta).
- Cascos têm estoque próprio por tipo de casco, de vazios e de sucata (ver 3.6).

### 3.4 Registro de Vendas
- Uma venda pode conter N itens; cada item é um produto+marca (a associação precisa estar ativa), retornável ou descartável, combinados livremente na mesma venda.
- Vinculação ao cliente, funcionário responsável e valor (definido no ato da venda, usando o preço de referência apenas como base).
- **Tela de venda (PDV)**: a lista de produtos tem uma linha por produto+marca ("Nome — Marca"). A seção de cascos mostra só os tipos de casco das linhas retornáveis do carrinho (devolução por tipo; sucata só nos tipos que aceitam, sempre separada da devolução). "Pagou o vasilhame" é uma opção por linha retornável, desmarcada por padrão (troca ou empréstimo). A busca procura por nome, marca ou categoria e oferece sugestões; escolher uma sugestão filtra a lista por ela.
- **Edição pós-registro**: a venda pode ser editada depois de registrada (itens, pagamentos, desconto, devoluções de casco/sucata).
- **Cupom fiscal**: o sistema permite emitir cupom fiscal referente à venda.
- **Formas de pagamento**: uma venda pode ter N formas de pagamento simultâneas (pix, cartão de crédito, cartão de débito, dinheiro, etc.), cada uma com valor lançado individualmente. O que não for coberto pela soma dos pagamentos vira pendência (fiado) na conta corrente do cliente.
- **Crédito do cliente como forma de pagamento**: a forma "Crédito do cliente" conta como valor pago da venda, mas **não é dinheiro recebido**: não entra nas entradas do caixa, no recebido do dia nem no recebido do faturamento. A soma dessa forma não pode passar do **crédito disponível** do cliente (o saldo, quando positivo); acima disso a venda é recusada (`CREDITO_INSUFICIENTE`) e nada é gravado. O uso gera um lançamento de débito (`DEBITO_USO_CREDITO`) na conta do cliente. Na edição da venda, o uso de crédito da própria venda não conta contra o limite. Com a venda já registrada, o pagamento posterior não aceita essa forma (`FORMA_NAO_PERMITIDA`): o crédito já abate o fiado no saldo.
- **Desconto**: pode ser inserido no ato da venda ou em uma edição posterior, sempre com um motivo. O desconto é aplicado por item (produto), digitado manualmente (valor ou percentual); o sistema recalcula o total da venda automaticamente.
- **Casco do item**: o tipo de casco de cada linha retornável é resolvido pelo sistema (o específico da associação vence o genérico do produto); descartável não tem casco e não movimenta casco. A linha retornável é, por padrão, uma **troca**: a quantidade vendida é emprestada no tipo da linha e gera débito de casco do cliente nesse tipo.
- **Pagou o vasilhame**: a linha retornável pode ser marcada como "pagou o vasilhame" (em descartável, a venda é recusada). O valor bruto do item passa a ser quantidade × preço unitário + quantidade × preço do vasilhame do tipo de casco resolvido; o preço do vasilhame vem do cadastro do tipo (relido a cada edição), nunca da requisição, e fica gravado no item. Desconto e total do item seguem a regra normal, aplicados sobre esse bruto. A linha não gera débito de casco.
- **Devolução e sucata na venda**: no registro (ou edição) da venda, a devolução de cascos e a entrega de sucata são informadas por tipo de casco e só valem para o tipo resolvido de alguma linha retornável da venda (troca ou vasilhame pago); outro tipo é recusado. A devolução abate o débito de casco do cliente naquele tipo e dá entrada no estoque de vazios do tipo; se for maior que o emprestado, vira crédito (saldo negativo do tipo). A sucata é apenas registro (por cliente e tipo, mais a entrada no estoque de sucata do tipo, ver 3.6), só em tipo que aceita sucata (senão a venda é recusada), e não abate o débito de casco. Venda recusada não grava nada.
- **Status de pagamento**: a venda só é considerada **paga** quando a soma dos pagamentos lançados cobre integralmente o valor total da venda (já com desconto aplicado). Enquanto isso, permanece parcial/pendente, e a diferença compõe o saldo de fiado do cliente.

### 3.5 Controle de Caixa
- No fechamento do caixa do dia, é lançada a diária de cada funcionário que trabalhou (não há controle de presença separado — a presença/falta é considerada diretamente no lançamento da diária no fechamento). Entram na lista todos os funcionários ativos, inclusive os sem diária cadastrada. A diária de cada um vem pré-preenchida com a cadastrada e pode ser ajustada naquele fechamento (hora extra ou atraso), sem alterar o cadastro. Valor 0 não gera lançamento; valor negativo é recusado (`DIARIA_INVALIDA`).
- Diária lançada não é paga imediatamente: ela alimenta a conta corrente do funcionário (ver 3.8), sendo o pagamento normalmente consolidado semanalmente.
- Registro das vendas (entradas) e despesas (saídas; as diárias de funcionários não entram nas saídas do caixa). O caixa **não** recebe custo de abastecimento automático: abastecimento pago com dinheiro do caixa é lançado como despesa comum, na categoria 'Abastecimento'.
- Cada despesa lançada no caixa deve ter um **tipo de despesa** associado, para permitir análise por categoria.
- Fechamento do caixa no final do dia com saldo consolidado.

### 3.6 Gestão de Cascos e Sucata (Galão Quebrado)
O vasilhame é controlado por **tipo de casco** (nome, preço do vasilhame, aceita sucata). Cada tipo tem estoque físico de **vazios** e de **sucata**, separados. O casco do item é o específico da associação produto+marca, se houver; senão, o genérico do produto (o específico vence). **Produto descartável não tem casco e não gera retorno.** A venda só empresta e cobra débito de casco de produto retornável — nunca de sucata. **Sucata** (vasilhame quebrado) tem estoque físico por tipo e registro por cliente próprios, alimentados por entregas do cliente (avulsas ou no ato de uma venda) e por baixas de casco quebrado; essas entregas são **independentes** do saldo de casco e **não abatem** o débito de casco do cliente.

- **Venda de produto retornável**: o casco do item usado para entregar o produto continua sendo da loja (emprestado). **Gera débito de casco** para o cliente, a menos que ele devolva vazio(s) no ato ou depois.
- **Venda de produto descartável**: não tem casco e não gera retorno nem débito.

Controles envolvidos:
- **Entrada no estoque**: o abastecimento dá entrada por produto+marca. O estoque de **vazios** de cada tipo de casco é alimentado pela carga do abastecimento (cascos vazios por tipo), por lançamento (ajuste) e pelas devoluções dos clientes. Sucata normalmente não vem do abastecimento — entra por entrega do cliente, por ajuste ou por baixa de casco quebrado.
- **Estoque físico de vazios e de sucata, por tipo de casco**: controlados separadamente. Sucata **só** nos tipos que aceitam sucata: entrada ou ajuste de sucata em tipo que não aceita é recusado. Deve existir uma função de **baixa de casco** por tipo para registrar perdas (quebra), atribuída a um ou mais funcionários responsáveis — o casco baixado sai do estoque de vazios do tipo e, **só se o tipo aceita sucata**, passa a compor o estoque de sucata do mesmo tipo; se não aceita, apenas sai do vazio. Sem vazio suficiente no tipo, a baixa é recusada.
- **Saldo de casco por cliente e tipo de casco**: quantos cascos de cada tipo cada cliente está devendo à loja (apenas por vendas de produtos retornáveis). Não há limite de cascos por cliente.
- **Registro de sucata por cliente e tipo de casco**: quantidade de sucata de cada tipo que cada cliente já entregou à loja — não é um débito, apenas um recebimento registrado, independente do saldo de casco.
- **Venda de produto retornável — registro da devolução**: a venda registra a quantidade de cheios vendidos e a quantidade de vazios devolvidos pelo cliente naquele momento como campos independentes (não precisam ser iguais). Para o caso comum (troca direta, tudo devolvido), a tela de venda tem a opção "Devolveu todos na hora", que **trava** a devolução de cada tipo na quantidade vendida em troca daquele tipo (sem edição, e acompanha o carrinho); desmarcar libera o campo, a partir do valor que tinha, para os casos parciais. A diferença (vendido − devolvido) ajusta o saldo de casco do cliente: gera débito se devolveu menos, gera crédito se devolveu mais (abatendo débito de vendas anteriores). Se o cliente entregar sucata na mesma ocasião, essa quantidade é lançada à parte no registro de sucata e **não** abate o débito de casco.
- **Pagar Casco**: funcionalidade para quitar o débito de casco do cliente, de duas formas possíveis:
  - **Devolução física**: cliente devolve o(s) casco(s) vazio(s) de um tipo (no ato da venda ou avulsa, sem compra associada), abatendo o débito daquele tipo e dando entrada no estoque físico de vazios do mesmo tipo.
  - **Conversão em valor**: ao invés de devolver fisicamente, o débito de casco de um tipo é convertido em cobrança em dinheiro, lançando a venda do casco vazio pelo **preço do vasilhame do tipo** (quantidade × preço; tipo sem preço de vasilhame não converte), que migra a pendência para a conta corrente financeira (fiado) do cliente. A quantidade convertida é limitada ao saldo do cliente naquele tipo.
- **Entrega de Sucata**: cliente entrega vasilhame(s) quebrado(s) de um tipo de casco à loja (avulso ou junto de uma venda), dando entrada no estoque físico de sucata do tipo e no registro de sucata do cliente. Só é aceita em tipo que aceita sucata. A loja pode, a seu critério, converter essa entrega em valor (crédito ao cliente na conta corrente/fiado); a conversão soma ao saldo e, se não houver fiado a abater, vira crédito.

### 3.7 Abastecimento
- Registro de abastecimento do estoque da loja, que pode ser feito via frete terceirizado ou com caminhão/funcionário próprio da loja.
- O abastecimento pode trazer galão completo (casco + água) e/ou casco vazio separadamente, cada um dando entrada no respectivo estoque (produto+marca e vazios por tipo de casco).
- **Dois momentos**: (1) a carga é lançada só com quantidades, por produto+marca e cascos vazios por tipo, sem valor; (2) quem tem a permissão `estoque.custos` lança o custo unitário de cada linha (produtos e cascos; zero é válido) e o frete da carga. Não há campo de custo total: o servidor calcula total = soma(quantidade × custo unitário) + frete.
- **Custo pendente**: a carga com frete ou algum custo unitário faltando fica pendente e aparece na listagem de cargas pendentes, até o custo ser completado. Carga anterior a esta regra aparece pendente até o frete ser informado.
- **Custo da unidade** (base do lucro) = custo unitário + frete ÷ total de unidades da carga; o casco vazio conta como unidade no rateio.
- O custo do abastecimento não é vinculado ao caixa.

### 3.8 Conta Corrente de Funcionários
- Cada diária lançada no fechamento de caixa (ver 3.5) credita a conta corrente do funcionário.
- Funcionário pode solicitar **vale** (adiantamento), lançado como débito na conta corrente.
- Pagamento ao funcionário (normalmente semanal) é lançado como baixa na conta corrente.
- Saldo da conta corrente = diárias creditadas − vales − pagamentos realizados.

### 3.9 Conta Corrente de Clientes (Fiado)
- Vendas cujo total de pagamentos não cobre o valor integral (ver 3.4) e conversões de débito de casco normal em valor geram lançamentos de débito na conta corrente do cliente. Entregas de sucata, se a loja optar por convertê-las em valor, geram lançamento de crédito.
- Pagamentos do cliente (à vista de dívida antiga, parcelas) são lançados como baixa na conta corrente. O pagamento pode ser **maior que o devido** (ou feito sem dívida): o valor inteiro é lançado e o excedente vira **crédito** do cliente. O pagamento avulso é dinheiro recebido e entra nas entradas do caixa.
- **Saldo** (único, em dinheiro) = −(débitos − créditos − pagamentos), com débitos = vendas não totalmente pagas + conversões de casco em valor + uso de crédito em vendas; créditos = conversões de sucata em valor. **Negativo = fiado; positivo = crédito.** O servidor calcula o saldo; a tela não soma saldos guardados. O saldo devedor (o inverso) segue exposto ao lado, com o mesmo sentido de antes.
- **Crédito disponível** = o saldo quando positivo, senão zero. Origens do crédito: pagamento acima do devido e sucata convertida em valor.
- **Fiado a receber** (agregado da tela Hoje) soma só os saldos negativos (em valor absoluto); créditos de outros clientes não abatem.
- Esta conta é independente do saldo físico de casco normal e do registro de sucata (ver 3.6) — só recebe lançamento quando há conversão explícita em valor.

## 4. Casos de Uso
### 4.1 Fluxo de Venda de Produto Retornável com Troca de Casco
- Cliente recebe N cheios de um produto+marca retornável; o casco do tipo resolvido (o específico da marca vence o genérico do produto) fica emprestado, N unidades. Cliente devolve M vazios desse tipo (M pode ser menor, igual ou maior que N; a tela trava M = N com a opção "Devolveu todos na hora", que só existe na tela: a API recebe só as quantidades por tipo). Sistema registra o empréstimo e a devolução por tipo, ajusta o saldo de casco do cliente no tipo pela diferença (débito se M < N, crédito se M > N) e dá entrada de M no estoque de vazios do tipo. Se o cliente entregar sucata junto, ela é lançada à parte no registro de sucata, sem abater o débito de casco.

### 4.2 Fluxo de Venda com Pagamento do Vasilhame
- Cliente compra o produto+marca retornável e paga o vasilhame (linha marcada como "pagou o vasilhame"): o item soma ao valor a quantidade × preço do vasilhame do tipo de casco resolvido, e a linha não gera débito de casco. O preço do vasilhame vem do cadastro do tipo e fica gravado no item. Em produto descartável não há vasilhame e a marcação é recusada. Troca e vasilhame pago podem coexistir na mesma venda, em linhas diferentes: só a troca empresta casco.

### 4.3 Fluxo de Devolução de Cascos e Entrega de Sucata na Venda
- Na própria venda o cliente pode devolver cascos vazios e entregar sucata, sempre por tipo de casco e só de tipo resolvido de alguma linha retornável da venda (troca ou vasilhame pago); outro tipo é recusado. Devolução: abate o saldo do cliente no tipo (acima do emprestado vira crédito) e dá entrada no estoque de vazios do tipo. Sucata: só em tipo que aceita sucata (senão recusa); registra a entrega do cliente no tipo e dá entrada no estoque de sucata do tipo, sem abater o saldo de casco. O casco vazio não é mais um item vendável: o débito de casco se quita por devolução física ou conversão em valor (4.6 e 4.8).

### 4.4 Fluxo de Venda de Descartáveis
- Registro de venda de descartáveis, vinculado ao caixa.

### 4.5 Venda com Múltiplos Itens
- Uma única venda combina, por exemplo, produtos retornáveis de marcas (e tipos de casco) diferentes, em troca ou com o vasilhame pago, e descartáveis, cada item com seu produto+marca e valor. Devolução e sucata são informadas por tipo de casco, uma vez para a venda toda.

### 4.6 Pagar Casco (Devolução Física)
- Cliente devolve casco(s) normal(is) vazio(s) de um tipo — no ato de uma venda de água ou avulso, sem compra associada — abatendo seu débito de casco normal daquele tipo e dando entrada no estoque físico de vazios do tipo.

### 4.7 Baixa de Casco por Quebra
- Registro de perda (quebra) de casco de um tipo, atribuída a um ou mais funcionários responsáveis; o casco sai do estoque de vazios do tipo e, se o tipo aceita sucata, passa a compor a sucata do mesmo tipo (se não aceita, só sai do vazio). Sem vazio suficiente no tipo, a baixa é recusada.

### 4.8 Pagar Casco (Conversão em Débito Financeiro)
- Débito de casco normal de um cliente em um tipo é convertido em valor, pelo preço do vasilhame do tipo e até o saldo do cliente naquele tipo, lançando a venda do casco vazio, que passa a compor a conta corrente (fiado) do cliente, ao invés de aguardar devolução física.

### 4.9 Entrega de Sucata
- Cliente entrega vasilhame(s) quebrado(s) à loja, avulso ou junto de uma venda, dando entrada no estoque de sucata do tipo (que deve aceitar sucata) e no registro de sucata do cliente por tipo — sem abater o débito de casco normal. A loja pode, a seu critério, converter a entrega em valor (crédito na conta corrente/fiado).

### 4.10 Venda a Prazo / Fiado
- Venda registrada com pagamento a prazo, gerando débito na conta corrente do cliente; pagamentos futuros baixam esse saldo. Pagamento acima do devido gera crédito, que pode pagar parte (ou todo) de uma venda futura na forma "Crédito do cliente", até o crédito disponível (`CREDITO_INSUFICIENTE` acima disso).

### 4.11 Fechamento de Caixa
- Ao final do dia, lançamento das diárias dos funcionários que trabalharam (creditando a conta corrente de cada um; o valor de cada diária pode ser ajustado só naquele fechamento, sem alterar o cadastro; valor 0 não lança e negativo é recusado), total de vendas, despesas do dia e saldo final.

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
- **Preço**: cada produto+marca possui um preço de referência (na associação), mas o preço efetivo é sempre definido no momento da venda. Não existe tabela fixa de preço por categoria de cliente (atacado/varejo) — os valores variam conforme acordos individuais feitos com cada cliente.
- **Venda com múltiplos itens**: uma venda pode conter N produtos, incluindo múltiplas marcas de galão na mesma venda.
- **Edição de venda**: a venda pode ser editada após o registro (itens, pagamentos, desconto, devoluções de casco/sucata).
- **Cupom fiscal**: o sistema permite emitir cupom fiscal referente à venda.
- **Pagamento**: uma venda pode ter N formas de pagamento simultâneas (pix, cartão de crédito, cartão de débito, dinheiro, etc.), cada uma com valor lançado individualmente.
- **Status de pagamento**: a venda só é considerada **paga** quando a soma dos pagamentos cobre integralmente o valor total (já com desconto aplicado); enquanto não cobrir, fica parcial/pendente e a diferença compõe o fiado do cliente.
- **Desconto**: aplicado por item (produto), digitado manualmente (valor ou percentual) no ato ou na edição da venda, sempre com motivo obrigatório; o sistema recalcula o total automaticamente.
- **Fiado**: é uma pendência financeira separada do débito físico de casco normal e do registro de sucata; só há lançamento em fiado quando a venda não é totalmente paga, quando um débito de casco normal é explicitamente convertido em valor, ou quando uma entrega de sucata é convertida em crédito (que soma ao saldo do cliente). Não há limite de fiado por cliente — fica a critério de quem lança a venda. O uso de crédito, ao contrário, tem limite: o crédito disponível do cliente.
- **Tipo de produto**: todo produto é **RETORNÁVEL** (vendido em vasilhame que volta, com tipo de casco) ou **DESCARTÁVEL** (sem casco). Retornável exige um tipo de casco genérico; descartável não pode ter casco, nem genérico nem específico.
- **Descartáveis**: controle de estoque simples (entrada/saída) por produto+marca, sem casco, sem retorno e sem débito de casco; tamanhos livres. Qualquer produto novo sem regra de casco (ex: carvão, gelo) é cadastrado e tratado como descartável, com categoria livre para agrupamento.
- **Marca**: cadastro próprio. Cada produto tem N marcas (associação produto+marca); a marca é obrigatória e única dentro do produto. Não existe associação sem marca: produto sem marca própria usa uma marca cadastrada (ex: 'Genérica'). No cadastro de produto, a opção 'Sem marca' usa a marca 'Genérica' (criada na primeira vez, se não existir) e a lista e o detalhe exibem a 'Genérica' como 'sem marca'.
- **Foto de produto**: cada associação produto+marca pode ter uma foto cadastrada, exibida nas telas de venda e catálogo.
- **Endereço**: cliente pode ter múltiplos endereços cadastrados para entrega; exatamente um é o principal (regras 1 a 4 acima, aplicadas pelo `ClienteService`); não há controle de rota ou status de entrega no sistema.
- **Tipo de casco**: cadastro próprio com nome, preço do vasilhame (≥ 0) e se aceita sucata. **Genérico** não tem marca; **específico** tem marca. O produto retornável aponta um casco genérico; a associação produto+marca pode apontar um casco específico, só em produto retornável e da mesma marca da associação. O casco do item é o específico da associação, se houver; senão, o genérico do produto — **o específico vence**. Descartável não tem casco e não gera retorno. Um tipo de casco em uso (apontado por produto ou associação) não troca de marca, e um tipo com saldo de sucata não deixa de aceitar sucata.
- **Casco x sucata**: a venda de produto retornável **só** empresta e gera débito de casco — sucata nunca é emprestada nem gera débito pela venda. Sucata é somente entregue pelo cliente à loja (avulsa ou junto de uma venda) ou vem de casco quebrado, em estoque físico (por tipo de casco) e registro por cliente próprios, totalmente independentes do saldo de casco.
- **Casco — sem limite**: não há limite de cascos emprestados por cliente.
- **Estoque — abastecimento**: dá entrada por produto+marca e, por tipo de casco, nos vazios da carga; o ajuste de vazios por tipo continua existindo à parte. Sucata normalmente não vem do abastecimento; entra por entrega do cliente, por ajuste (só em tipo que aceita sucata) ou por baixa de casco quebrado.
- **Produto descartável não gera retorno**: a venda de descartável não empresta casco nem gera débito de casco.
- **Casco — venda de produto retornável GERA débito**: o casco do item usado para entregar o produto continua sendo da loja; se o cliente não devolver (total ou parcialmente) no ato, o saldo faltante vira débito dele. A venda registra quantidade vendida e quantidade devolvida como campos independentes (não precisam ser iguais); a diferença gera débito (devolveu menos) ou crédito (devolveu mais, abatendo saldo anterior). A tela de venda tem a opção "Devolveu todos na hora": marcada, trava o devolvido de cada tipo no vendido em troca daquele tipo; desmarcada, o campo fica editável para casos parciais. Se o cliente entregar sucata junto, ela é lançada à parte e **não** abate esse débito.
- **Pagar Casco**: função para quitar débito de casco do cliente, com duas formas: devolução física do vazio (no ato da venda ou avulsa) ou conversão em débito financeiro (lançando a venda do casco vazio, migrando a pendência para a conta corrente/fiado do cliente).
- **Entrega de Sucata**: cliente entrega vasilhame(s) quebrado(s) à loja (avulso ou junto de uma venda), dando entrada no estoque de sucata e no registro de sucata do cliente, sem qualquer efeito sobre o débito de casco; a loja pode, a seu critério, converter a entrega em valor (crédito na conta corrente/fiado).
- **Casco/sucata — estoque físico e quebra**: cada tipo de casco tem estoque de vazios e de sucata separados. Sucata só existe em tipo que **aceita sucata**: entrada ou ajuste de sucata em tipo que não aceita é recusado. Perdas por quebra são lançadas via função de baixa, por tipo de casco, atribuída a um ou mais funcionários responsáveis: o casco sai do estoque de vazios do tipo (sem vazio suficiente no tipo, a baixa é recusada) e **só entra na sucata do mesmo tipo se ele aceita sucata**; se não aceita, apenas sai do vazio.
- **Caixa**: a diária dos funcionários é lançada no fechamento do caixa do dia, considerando quem trabalhou (falta = diária não lançada); o valor é o cadastrado, ajustável por pessoa naquele fechamento (hora extra/atraso), sem mudar o cadastro, e vale 0 = sem lançamento, negativo = recusado; vira crédito na conta corrente do funcionário, não é paga diretamente no caixa.
- **Caixa — despesas**: cada despesa (saída) lançada no caixa deve ter um tipo/categoria associado.
- **Conta corrente de funcionário**: diárias creditadas, vales debitados; pagamento normalmente feito de uma vez por semana, baixando o saldo acumulado.
- **Conta corrente de cliente (fiado)**: soma débitos de vendas não totalmente pagas e de conversões de casco normal em valor, menos créditos de conversões de sucata; pagamentos do cliente baixam o saldo.
- **Estoque**: alerta de estoque mínimo configurável por produto+marca (na associação): alerta quando a quantidade é **menor** que o mínimo e **só se o mínimo for maior que 0** (quantidade igual ao mínimo não alerta; mínimo 0 nunca alerta). O estoque geral do produto é a soma do estoque das marcas, calculado pelo servidor.
- **Abastecimento**: pode ser via frete terceirizado ou caminhão/funcionário próprio da loja; lançado em dois momentos (quantidades; depois custo unitário e frete, com `estoque.custos`), com custo pendente enquanto faltar valor e custo da unidade com o frete rateado entre todas as unidades da carga (cascos incluídos). Não gera despesa automática no caixa; pago com dinheiro do caixa, é despesa comum na categoria 'Abastecimento'.
- **Permissões**: sistema 100% configurável. Existe um cargo nativo (ADM) com acesso total; demais cargos são criados livremente pelo usuário, com permissões granulares atribuíveis, e vinculados aos funcionários.

## 6. Relatórios e Indicadores
- Relatório de Vendas por funcionário.
- Relatório de Faturamento por período e/ou por produto.
- Relatório de Estoque (por produto+marca; cascos vazios e sucata por tipo de casco; e alertas de estoque mínimo por produto+marca).
- Relatório de Caixa (incluindo diárias lançadas e despesas por tipo).
- Relatório de Conta Corrente de Clientes (fiado, conversões de casco/sucata, saldo devedor).
- Relatório de Saldo de Casco Normal por Cliente (emprestados, débitos pendentes).
- Relatório de Sucata Entregue por Cliente (quantidade recebida, histórico) — independente do saldo de casco normal.
- Relatório de Conta Corrente de Funcionários (diárias, vales, pagamentos, saldo a pagar).
- Relatório de Lucro por produto+marca no período (exige `estoque.custos`): receita líquida de desconto (`total_item`), com o vasilhame pago separado em `receitaVasilhame` (= `total_item` × (quantidade × preço do vasilhame) ÷ bruto do item) e a receita do produto = `total_item` − vasilhame, sem custo do vasilhame; custo dos produtos pela média ponderada do custo unitário das cargas com custo completo até a data da venda; frete rateado à parte (frete ÷ unidades da carga, cascos incluídos); lucro = receita do produto − custo − frete. Venda sem carga completa até a data fica com custo pendente (receita e quantidade contam; custo, frete e lucro ficam vazios e fora dos totais).

## 7. Permissionamento
- Sistema de permissões 100% configurável, baseado em cargos (roles) customizáveis.
- **ADM**: cargo nativo do sistema, com acesso total (não editável/removível).
- **Cargos customizados**: criados livremente pelo usuário, com permissões granulares definidas por tela/ação (ex: registrar venda, editar venda, fechar caixa, editar estoque, ver relatórios, cadastrar cliente, etc.).
- Cada funcionário é vinculado a um cargo, que define suas permissões no sistema.
- `estoque.custos`: ver e lançar custos do abastecimento (detalhe, cargas pendentes e lançamento de custo/frete). O backend confere pelo cargo do funcionário informado na requisição (query ou corpo); sem a permissão (ou `*`) responde 403 `PERMISSAO_NEGADA`.