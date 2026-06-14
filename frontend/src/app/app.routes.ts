import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'accounts',
    loadComponent: () => import('./features/accounts/accounts.component').then(m => m.AccountsComponent),
  },
  {
    path: 'users',
    loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent),
  },
  {
    path: 'groups',
    loadComponent: () => import('./features/groups/groups.component').then(m => m.GroupsComponent),
  },
  {
    path: 'broadcast',
    loadComponent: () => import('./features/broadcast/broadcast.component').then(m => m.BroadcastComponent),
  },
  {
    path: 'categories',
    loadComponent: () => import('./features/categories/categories.component').then(m => m.CategoriesComponent),
  },
  {
    path: 'media',
    loadComponent: () => import('./features/media/media.component').then(m => m.MediaComponent),
  },
  {
    path: 'spy',
    loadComponent: () => import('./features/spy/spy.component').then(m => m.SpyComponent),
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.component').then(m => m.SearchComponent),
  },
  {
    path: 'scraper',
    loadComponent: () => import('./features/scraper/scraper.component').then(m => m.ScraperComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
