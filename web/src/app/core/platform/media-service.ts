/**
 * Único ponto do app que seleciona imagem (foto de produto) e gera preview.
 * Impl. web: input file + createObjectURL; impl. nativa futura: @capacitor/camera.
 */
export abstract class MediaService {
  abstract pickImage(): Promise<File | null>;
  abstract previewUrl(file: File): string;
}
