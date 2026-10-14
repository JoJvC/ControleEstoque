using ControleEstoque.Estoque.Domain;

namespace ControleEstoque.Estoque.Repository;

/// <summary>
/// Armazena fotos de produto em volume local (montado no container).
/// O banco guarda apenas o caminho relativo (produtos.foto_url).
/// </summary>
public sealed class LocalDiskFotoStorage : IFotoStorage
{
    private readonly string mediaPath;

    public LocalDiskFotoStorage(string mediaPath) => this.mediaPath = mediaPath;

    public async Task<string> SaveAsync(
        Guid produtoId, Stream content, string extension, CancellationToken cancellationToken)
    {
        var directory = Path.Combine(mediaPath, "produtos");
        Directory.CreateDirectory(directory);

        var fileName = $"{produtoId}{extension}";
        var fullPath = Path.Combine(directory, fileName);
        await using var file = File.Create(fullPath);
        await content.CopyToAsync(file, cancellationToken);

        return $"produtos/{fileName}";
    }

    public Task<(Stream Content, string ContentType)?> OpenAsync(
        string fotoUrl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var fullPath = Path.Combine(mediaPath, fotoUrl.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(fullPath))
        {
            return Task.FromResult<(Stream, string)?>(null);
        }

        var contentType = Path.GetExtension(fullPath).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            _ => "image/jpeg"
        };

        Stream stream = File.OpenRead(fullPath);
        return Task.FromResult<(Stream, string)?>((stream, contentType));
    }
}
