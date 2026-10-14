import { DOCUMENT, Injectable, inject } from '@angular/core';

import { MediaService } from './media-service';

/** Impl. web: <input type="file"> programático. App nativo trocará por @capacitor/camera. */
@Injectable()
export class WebMediaService extends MediaService {
  private readonly document = inject(DOCUMENT);

  override pickImage(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = this.document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png';
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  override previewUrl(file: File): string {
    return URL.createObjectURL(file);
  }
}

export function provideMedia() {
  return { provide: MediaService, useClass: WebMediaService };
}
