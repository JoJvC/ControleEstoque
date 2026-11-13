import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Select } from './select';

@Component({
  imports: [Select],
  template: `
    <ce-select [opcoes]="opcoes" />
    <ce-select [opcoes]="opcoes" [id]="'com-id'" rotulo="Forma" />
  `,
})
class Host {
  readonly opcoes = [{ value: 'A', label: 'A' }];
}

describe('Select', () => {
  it('sem id não renderiza o atributo; com id e rótulo, renderiza', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [semId, comId] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('select'),
    );

    expect(semId.hasAttribute('id')).toBe(false);
    expect(semId.hasAttribute('aria-label')).toBe(false);
    expect(comId.id).toBe('com-id');
    expect(comId.getAttribute('aria-label')).toBe('Forma');
  });
});
