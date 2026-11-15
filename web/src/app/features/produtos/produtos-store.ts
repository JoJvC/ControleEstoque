import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import { ProdutoResponse } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { MarcasStore } from './marcas-store';
import {
  FormProduto,
  LinhaMarca,
  NOME_MARCA_GENERICA,
  SEM_MARCA,
  linhaAlterada,
  marcaGenericaDe,
  montarMarca,
  montarProduto,
} from './produto-form-modelo';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class ProdutosStore {
  private readonly api = inject(EstoqueApi);
  private readonly marcasStore = inject(MarcasStore);

  private readonly produtosInterno = signal<ProdutoResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');

  /** Produto já gravado por um salvar que falhou depois; o próximo salvar faz PUT e não duplica. */
  private parcial: ProdutoResponse | null = null;

  readonly produtos = this.produtosInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();

  carregar(): void {
    this.statusInterno.set('loading');
    this.api.listarProdutos().subscribe({
      next: (produtos) => {
        this.produtosInterno.set(produtos);
        this.statusInterno.set('ok');
      },
      error: () => this.statusInterno.set('error'),
    });
  }

  /** Esquece o produto de um salvar que falhou; a página chama ao abrir o formulário. */
  reiniciar(): void {
    this.parcial = null;
  }

  /**
   * Grava produto, associações e fotos, nesta ordem. Lança ApiError — a página trata
   * (inline). Se algo falhar depois do produto criado, o próximo salvar faz PUT.
   */
  async salvar(form: FormProduto): Promise<ProdutoResponse> {
    const genericaId = form.linhas.some((l) => l.marcaId === SEM_MARCA)
      ? await this.resolverGenerica()
      : null;
    const id = form.id ?? this.parcial?.id ?? null;
    const request = montarProduto(form);

    let resposta = this.parcial?.id === id ? this.parcial : null;
    const pmIds = new Map<number, string>();
    const gravar = async (linhas: LinhaMarca[]): Promise<void> => {
      for (const linha of linhas) {
        const req = montarMarca(linha, form.tipo, genericaId);
        const pmId =
          linha.produtoMarcaId ?? resposta?.marcas.find((m) => m.marcaId === req.marcaId)?.id;
        if (pmId === undefined) {
          resposta = await firstValueFrom(this.api.adicionarMarca(resposta!.id, req));
          this.parcial = resposta;
          pmIds.set(linha.chave, resposta.marcas.find((m) => m.marcaId === req.marcaId)!.id);
        } else {
          pmIds.set(linha.chave, pmId);
          if (linha.produtoMarcaId === null || linhaAlterada(linha, form.tipo)) {
            resposta = await firstValueFrom(this.api.atualizarMarca(id!, pmId, req));
            this.parcial = resposta;
          }
        }
      }
    };

    // Descartável não aceita associação com casco específico: ao trocar o tipo de um produto
    // salvo, as associações salvas mudam antes do produto.
    const antes =
      id !== null && form.tipo === 'DESCARTAVEL'
        ? form.linhas.filter((l) => l.produtoMarcaId !== null)
        : [];
    await gravar(antes);

    const produto =
      id === null
        ? await firstValueFrom(this.api.criarProduto(request))
        : await firstValueFrom(this.api.atualizarProduto(id, request));
    resposta = produto;
    this.parcial = produto;
    await gravar(form.linhas.filter((l) => !antes.includes(l)));

    for (const linha of form.linhas) {
      if (linha.foto !== null) {
        await firstValueFrom(
          this.api.enviarFotoMarca(produto.id, pmIds.get(linha.chave)!, linha.foto),
        );
      }
    }

    this.parcial = null;
    this.carregar();
    return resposta!;
  }

  /** Acha a 'Genérica' sem diferenciar maiúsculas/acentos; cria uma vez se faltar. */
  private async resolverGenerica(): Promise<string> {
    const existente = marcaGenericaDe(this.marcasStore.marcas());
    if (existente !== null) {
      return existente.id;
    }
    try {
      return (await this.marcasStore.criar(NOME_MARCA_GENERICA)).id;
    } catch (erro: unknown) {
      if (erro instanceof ApiError && erro.status === 409) {
        // lista local velha: outra tela criou a 'Genérica' antes
        const achada = marcaGenericaDe(await firstValueFrom(this.api.listarMarcas()));
        if (achada !== null) {
          return achada.id;
        }
      }
      throw erro;
    }
  }
}
