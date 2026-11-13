import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TextInput } from './text-input';

@Component({
  imports: [TextInput],
  template: `
    <ce-input />
    <ce-input [id]="'com-id'" />
  `,
})
class Host {}

describe('TextInput', () => {
  it('sem id não renderiza o atributo; com id, renderiza', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [semId, comId] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('input'),
    );

    expect(semId.hasAttribute('id')).toBe(false);
    expect(comId.id).toBe('com-id');
  });
});
