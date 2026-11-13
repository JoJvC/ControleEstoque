import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { correlationIdInterceptor } from './correlation-id-interceptor';

describe('correlationIdInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([correlationIdInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('envia X-Correlation-Id com o valor de crypto.randomUUID', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
    client.get('/api/x').subscribe();
    const req = http.expectOne('/api/x');
    expect(req.request.headers.get('X-Correlation-Id')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    req.flush({});
  });

  it('requisições distintas recebem valores distintos', () => {
    client.get('/api/a').subscribe();
    client.get('/api/b').subscribe();
    const a = http.expectOne('/api/a');
    const b = http.expectOne('/api/b');
    const ida = a.request.headers.get('X-Correlation-Id');
    const idb = b.request.headers.get('X-Correlation-Id');
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(ida).toMatch(uuidV4);
    expect(idb).toMatch(uuidV4);
    expect(ida).not.toBe(idb);
    a.flush({});
    b.flush({});
  });

  it('substitui um X-Correlation-Id já presente (comportamento atual)', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('22222222-2222-4222-8222-222222222222');
    client.get('/api/x', { headers: { 'X-Correlation-Id': 'antigo' } }).subscribe();
    const req = http.expectOne('/api/x');
    expect(req.request.headers.get('X-Correlation-Id')).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    req.flush({});
  });
});
