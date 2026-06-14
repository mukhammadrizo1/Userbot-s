import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TelegramService } from './core/services/telegram.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Sidebar Navigation -->
    <aside class="sidebar" [class.open]="sidebarOpen">
      <div class="sidebar-logo">
        <h2>⚡ UserBot</h2>
        <span>Management Platform</span>
      </div>
      <nav class="sidebar-nav">
        <a class="nav-item" routerLink="/dashboard" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">📊</span> Dashboard
        </a>
        <a class="nav-item" routerLink="/accounts" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">🔑</span> Accounts
        </a>
        <a class="nav-item" routerLink="/users" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">👥</span> Users
        </a>
        <a class="nav-item" routerLink="/groups" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">💬</span> Groups
        </a>
        <a class="nav-item" routerLink="/broadcast" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">📡</span> Broadcast
        </a>
        <a class="nav-item" routerLink="/categories" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">🏷️</span> Categories
        </a>
        <a class="nav-item" routerLink="/media" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">🖼️</span> Media
        </a>
        <a class="nav-item" routerLink="/spy" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">🕵️</span> Spy
        </a>
        <a class="nav-item" routerLink="/scraper" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">🕸️</span> Scraper
        </a>
        <a class="nav-item" routerLink="/search" routerLinkActive="active" (click)="closeSidebar()">
          <span class="nav-icon">🔍</span> Search
        </a>
      </nav>
      <div class="sidebar-footer" *ngIf="telegram.user">
        <div class="user-info">
          <span class="user-avatar">{{ telegram.user.first_name[0] }}</span>
          <div>
            <div class="user-name">{{ telegram.user.first_name }}</div>
            <div class="user-handle">{{ telegram.user.username ? '@' + telegram.user.username : 'Admin' }}</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile header bar -->
    <header class="mobile-header">
      <button class="hamburger" (click)="toggleSidebar()">☰</button>
      <span class="mobile-title">⚡ UserBot</span>
    </header>

    <!-- Overlay for mobile sidebar -->
    <div class="sidebar-overlay" *ngIf="sidebarOpen" (click)="closeSidebar()"></div>

    <!-- Main Content -->
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    :host { display: block; }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid var(--border-color);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--accent-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: white;
    }

    .user-name {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }

    .user-handle {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      z-index: 99;
    }

    .hamburger {
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 24px;
      cursor: pointer;
      padding: 4px;
    }

    .mobile-title {
      font-weight: 700;
      font-size: var(--font-size-lg);
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 99;
    }

    @media (max-width: 768px) {
      .mobile-header { display: flex; }
      .sidebar-overlay { display: block; }
      .main-content { padding-top: 72px !important; }
    }
  `]
})
export class AppComponent implements OnInit {
  sidebarOpen = false;

  constructor(
    public telegram: TelegramService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.telegram.initialize();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.telegram.hapticImpact('light');
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }
}
