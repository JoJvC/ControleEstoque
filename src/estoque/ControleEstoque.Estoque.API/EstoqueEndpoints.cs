using ControleEstoque.Estoque.Contracts;
using ControleEstoque.Estoque.Domain;
using ControleEstoque.Shared.Results;

namespace ControleEstoque.Estoque.API;

public static class EstoqueEndpoints
{
    public static WebApplication MapEstoqueEndpoints(this WebApplication app)
    {
        // ---- Marcas -------------------------------------------------------
        app.MapPost("/v1/marcas", async (
            CreateMarcaRequest request, IMarcaRepository marcas, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request.Nome))
            {
                throw new RequestValidationException("NOME_OBRIGATORIO", "Nome da marca é obrigatório.");
            }

            var marca = await marcas.CreateAsync(request.Nome.Trim(), cancellationToken);
            return Results.Created($"/v1/marcas/{marca.Id}", new MarcaResponse(marca.Id, marca.Nome));
        });

        app.MapGet("/v1/marcas", async (IMarcaRepository marcas, CancellationToken cancellationToken) =>
        {
            var lista = await marcas.ListAsync(cancellationToken);
            return Results.Ok(lista.Select(m => new MarcaResponse(m.Id, m.Nome)));
        });

        // ---- Tipos de casco -------------------------------------------------
        app.MapPost("/v1/tipos-casco", async (
            CreateTipoCascoRequest request, ITipoCascoService tiposCasco, CancellationToken cancellationToken) =>
        {
            var criado = await tiposCasco.CriarAsync(ToTipoCasco(Guid.Empty, request), cancellationToken);
            return Results.Created($"/v1/tipos-casco/{criado.Id}", TipoCascoResponse.From(criado));
        });

        app.MapPut("/v1/tipos-casco/{id:guid}", async (
            Guid id, CreateTipoCascoRequest request, ITipoCascoService tiposCasco,
            CancellationToken cancellationToken) =>
        {
            var atualizado = await tiposCasco.AtualizarAsync(ToTipoCasco(id, request), cancellationToken);
            return Results.Ok(TipoCascoResponse.From(atualizado));
        });

        app.MapGet("/v1/tipos-casco", async (ITipoCascoService tiposCasco, CancellationToken cancellationToken) =>
        {
            var lista = await tiposCasco.ListarAsync(cancellationToken);
            return Results.Ok(lista.Select(TipoCascoResponse.From));
        });

        // ---- Produtos -----------------------------------------------------
        app.MapPost("/v1/produtos", async (
            CreateProdutoRequest request, IProdutoService produtos, CancellationToken cancellationToken) =>
        {
            var criado = await produtos.CriarAsync(ToProduto(Guid.Empty, request), cancellationToken);
            return Results.Created($"/v1/produtos/{criado.Id}", ProdutoResponse.From(criado));
        });

        app.MapPut("/v1/produtos/{id:guid}", async (
            Guid id, CreateProdutoRequest request, IProdutoService produtos, CancellationToken cancellationToken) =>
        {
            var atualizado = await produtos.AtualizarAsync(ToProduto(id, request), cancellationToken);
            return Results.Ok(ProdutoResponse.From(atualizado));
        });

        app.MapGet("/v1/produtos/{id:guid}", async (
            Guid id, IProdutoService produtos, CancellationToken cancellationToken) =>
            Results.Ok(ProdutoResponse.From(await produtos.ObterAsync(id, cancellationToken))));

        app.MapGet("/v1/produtos", async (
            TipoProduto? tipo, Guid? marcaId, string? categoria,
            IProdutoService produtos, CancellationToken cancellationToken) =>
        {
            var lista = await produtos.ListarAsync(tipo, marcaId, categoria, cancellationToken);
            return Results.Ok(lista.Select(ProdutoResponse.From));
        });

        // ---- Associação produto+marca ----------------------------------------
        app.MapPost("/v1/produtos/{id:guid}/marcas", async (
            Guid id, CreateProdutoMarcaRequest request, IProdutoService produtos,
            CancellationToken cancellationToken) =>
        {
            var produto = await produtos.AdicionarMarcaAsync(id, ToProdutoMarca(Guid.Empty, request), cancellationToken);
            return Results.Created($"/v1/produtos/{id}", ProdutoResponse.From(produto));
        });

        app.MapPut("/v1/produtos/{id:guid}/marcas/{produtoMarcaId:guid}", async (
            Guid id, Guid produtoMarcaId, CreateProdutoMarcaRequest request, IProdutoService produtos,
            CancellationToken cancellationToken) =>
        {
            var produto = await produtos.AtualizarMarcaAsync(
                id, ToProdutoMarca(produtoMarcaId, request), cancellationToken);
            return Results.Ok(ProdutoResponse.From(produto));
        });

        // ---- Foto da associação produto+marca ------------------------------------
        app.MapPost("/v1/produtos/{id:guid}/marcas/{produtoMarcaId:guid}/foto", async (
            Guid id, Guid produtoMarcaId, IFormFile foto, IProdutoService produtos,
            CancellationToken cancellationToken) =>
        {
            const long maxBytes = 5 * 1024 * 1024;
            var extension = Path.GetExtension(foto.FileName).ToLowerInvariant();
            if (extension is not (".jpg" or ".jpeg" or ".png"))
            {
                throw new RequestValidationException("FOTO_FORMATO_INVALIDO", "Apenas jpg/jpeg/png são aceitos.");
            }

            if (foto.Length is 0 or > maxBytes)
            {
                throw new RequestValidationException("FOTO_TAMANHO_INVALIDO", "Foto deve ter entre 1 byte e 5MB.");
            }

            await using var stream = foto.OpenReadStream();
            var fotoUrl = await produtos.SalvarFotoAsync(id, produtoMarcaId, stream, extension, cancellationToken);
            return Results.Ok(new FotoResponse(fotoUrl));
        }).DisableAntiforgery();

        app.MapGet("/v1/produtos/{id:guid}/marcas/{produtoMarcaId:guid}/foto", async (
            Guid id, Guid produtoMarcaId, IProdutoService produtos, CancellationToken cancellationToken) =>
        {
            var foto = await produtos.AbrirFotoAsync(id, produtoMarcaId, cancellationToken);
            return foto is null
                ? Results.NotFound()
                : Results.Stream(foto.Value.Content, foto.Value.ContentType);
        });

        // ---- Estoque ------------------------------------------------------
        app.MapGet("/v1/estoque", async (IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            var itens = await estoque.ObterEstoqueAsync(cancellationToken);
            return Results.Ok(itens.Select(EstoqueItemResponse.From));
        });

        app.MapPost("/v1/estoque/movimentos", async (
            CreateMovimentoRequest request, IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            await estoque.AjustarAsync(
                request.ProdutoMarcaId, request.Quantidade, request.Observacao, cancellationToken);
            return Results.Created("/v1/estoque", null);
        });

        // ---- Abastecimento -------------------------------------------------
        app.MapPost("/v1/abastecimentos", async (
            CreateAbastecimentoRequest request,
            IAbastecimentoService abastecimentos,
            CancellationToken cancellationToken) =>
        {
            var itens = Validacao.SemNulos(request.Itens, "Itens")
                .Select(i => new AbastecimentoItem(i.ProdutoMarcaId, i.Quantidade))
                .ToList();
            var cascos = Validacao.SemNulos(request.Cascos, "Cascos")
                .Select(c => new AbastecimentoCasco(c.TipoCascoId, c.Quantidade))
                .ToList();
            var id = await abastecimentos.RegistrarAsync(
                new NovoAbastecimento(request.TipoFrete, request.FuncionarioId, request.Observacao, itens, cascos),
                cancellationToken);
            return Results.Created($"/v1/abastecimentos/{id}", new CreatedResponse(id));
        });

        // Rotas de custo exigem estoque.custos do funcionário informado (sem autenticação: query/corpo).
        app.MapGet("/v1/abastecimentos/custos-pendentes", async (
            Guid funcionarioId, IAbastecimentoService abastecimentos, CancellationToken cancellationToken) =>
        {
            var pendentes = await abastecimentos.ListarPendentesAsync(funcionarioId, cancellationToken);
            return Results.Ok(pendentes.Select(AbastecimentoPendenteResponse.From));
        });

        app.MapGet("/v1/abastecimentos/{id:guid}", async (
            Guid id, Guid funcionarioId, IAbastecimentoService abastecimentos,
            CancellationToken cancellationToken) =>
        {
            var detalhe = await abastecimentos.ObterAsync(id, funcionarioId, cancellationToken);
            return Results.Ok(AbastecimentoDetalheResponse.From(detalhe));
        });

        app.MapPut("/v1/abastecimentos/{id:guid}/custos", async (
            Guid id, LancarCustosAbastecimentoRequest request, IAbastecimentoService abastecimentos,
            CancellationToken cancellationToken) =>
        {
            var itens = Validacao.SemNulos(request.Itens, "Itens")
                .Select(l => new CustoLinha(l.Id, l.CustoUnitario)).ToList();
            var cascos = Validacao.SemNulos(request.Cascos, "Cascos")
                .Select(l => new CustoLinha(l.Id, l.CustoUnitario)).ToList();
            var detalhe = await abastecimentos.LancarCustosAsync(
                id, new LancamentoCustos(request.FuncionarioId, request.Frete, itens, cascos), cancellationToken);
            return Results.Ok(AbastecimentoDetalheResponse.From(detalhe));
        });

        // ---- Cascos: saldo, ajuste e baixa (quebra) por tipo -----------------
        app.MapGet("/v1/estoque/cascos", async (IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            var cascos = await estoque.ObterEstoqueCascosAsync(cancellationToken);
            return Results.Ok(cascos.Select(EstoqueCascoResponse.From));
        });

        app.MapPost("/v1/estoque/cascos/movimentos", async (
            CreateMovimentoCascoRequest request, IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            await estoque.AjustarCascoAsync(
                request.TipoCascoId, request.Situacao, request.Quantidade, request.Motivo, cancellationToken);
            return Results.Created("/v1/estoque/cascos", null);
        });

        app.MapPost("/v1/estoque/cascos/baixas", async (
            CreateBaixaCascoRequest request, IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            var id = await estoque.BaixarCascoAsync(
                new NovaBaixaCasco(
                    request.TipoCascoId, request.Quantidade, request.Motivo ?? MotivoBaixaCasco.QUEBRADO,
                    request.Observacao, request.ResponsaveisIds ?? []),
                cancellationToken);
            return Results.Created($"/v1/estoque/cascos/baixas/{id}", new CreatedResponse(id));
        });

        // ---- Relatório ------------------------------------------------------
        app.MapGet("/v1/relatorios/estoque", async (
            IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            var itens = await estoque.ObterEstoqueAsync(cancellationToken);
            var cascos = await estoque.ObterEstoqueCascosAsync(cancellationToken);
            return Results.Ok(new
            {
                Itens = itens.Select(EstoqueItemResponse.From),
                AlertasEstoqueMinimo = itens.Where(i => i.AbaixoMinimo).Select(EstoqueItemResponse.From),
                Cascos = cascos.Select(EstoqueCascoResponse.From)
            });
        });

        // Exige estoque.custos do funcionário informado, como as rotas de custo do abastecimento.
        app.MapGet("/v1/relatorios/lucro", async (
            DateOnly? inicio, DateOnly? fim, Guid funcionarioId, ILucroService lucro,
            CancellationToken cancellationToken) =>
        {
            Validacao.Periodo(inicio, fim);
            var relatorio = await lucro.ObterAsync(inicio, fim, funcionarioId, cancellationToken);
            return Results.Ok(RelatorioLucroResponse.From(relatorio));
        });

        return app;
    }

    private static TipoCasco ToTipoCasco(Guid id, CreateTipoCascoRequest request) => new(
        id, request.Nome?.Trim() ?? string.Empty, request.MarcaId, null, request.PrecoVasilhame, request.AceitaSucata);

    private static Produto ToProduto(Guid id, CreateProdutoRequest request) => new(
        id, request.Tipo, request.Nome, request.Categoria, request.Tamanho, request.TipoCascoId, []);

    private static ProdutoMarca ToProdutoMarca(Guid id, CreateProdutoMarcaRequest request) => new(
        id, request.MarcaId, null, request.PrecoReferencia, request.EstoqueMinimo, 0, null, request.TipoCascoId);
}
