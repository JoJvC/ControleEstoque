import { Routes } from '@angular/router';

export const RH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./rh-page').then((m) => m.RhPage),
  },
];
