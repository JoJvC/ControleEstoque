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

        // ---- Foto do produto ----------------------------------------------
        app.MapPost("/v1/produtos/{id:guid}/foto", async (
            Guid id, IFormFile foto, IProdutoService produtos, CancellationToken cancellationToken) =>
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
            var fotoUrl = await produtos.SalvarFotoAsync(id, stream, extension, cancellationToken);
            return Results.Ok(new FotoResponse(fotoUrl));
        }).DisableAntiforgery();

        app.MapGet("/v1/produtos/{id:guid}/foto", async (
            Guid id, IProdutoService produtos, CancellationToken cancellationToken) =>
        {
            var foto = await produtos.AbrirFotoAsync(id, cancellationToken);
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
            await estoque.AjustarAsync(request.ProdutoId, request.Quantidade, request.Observacao, cancellationToken);
            return Results.Created("/v1/estoque", null);
        });

        // ---- Abastecimento -------------------------------------------------
        app.MapPost("/v1/abastecimentos", async (
            CreateAbastecimentoRequest request,
            IAbastecimentoService abastecimentos,
            CancellationToken cancellationToken) =>
        {
            var itens = (request.Itens ?? [])
                .Select(i => new AbastecimentoItem(i.ProdutoId, i.Quantidade, i.CustoUnitario))
                .ToList();
            var id = await abastecimentos.RegistrarAsync(
                new NovoAbastecimento(
                    request.TipoFrete, request.CustoTotal, request.FuncionarioId, request.Observacao, itens),
                cancellationToken);
            return Results.Created($"/v1/abastecimentos/{id}", new CreatedResponse(id));
        });

        // ---- Baixa de casco (quebra) ---------------------------------------
        app.MapPost("/v1/estoque/cascos/baixas", async (
            CreateBaixaCascoRequest request, IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            var id = await estoque.BaixarCascoAsync(
                new NovaBaixaCasco(request.Quantidade, request.Motivo, request.ResponsaveisIds ?? []),
                cancellationToken);
            return Results.Created($"/v1/estoque/cascos/baixas/{id}", new CreatedResponse(id));
        });

        // ---- Relatório ------------------------------------------------------
        app.MapGet("/v1/relatorios/estoque", async (
            IEstoqueService estoque, CancellationToken cancellationToken) =>
        {
            var itens = await estoque.ObterEstoqueAsync(cancellationToken);
            return Results.Ok(new
            {
                Itens = itens.Select(EstoqueItemResponse.From),
                AlertasEstoqueMinimo = itens.Where(i => i.AbaixoMinimo).Select(EstoqueItemResponse.From)
            });
        });

        return app;
    }

    private static Produto ToProduto(Guid id, CreateProdutoRequest request) => new(
        id, request.Tipo, request.Nome, request.MarcaId, null, request.Categoria,
        request.Tamanho, null, request.PrecoReferencia, request.EstoqueMinimo);
}
