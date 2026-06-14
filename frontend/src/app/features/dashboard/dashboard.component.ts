import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Overview of your UserBot platform</p>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-icon">🔑</div>
          <div class="stat-value">{{ stats?.accounts?.connected || 0 }}/{{ stats?.accounts?.total || 0 }}</div>
          <div class="stat-label">Connected Accounts</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-value">{{ stats?.users || 0 }}</div>
          <div class="stat-label">Scraped Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💬</div>
          <div class="stat-value">{{ stats?.groups || 0 }}</div>
          <div class="stat-label">Monitored Groups</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📡</div>
          <div class="stat-value">{{ stats?.activeBroadcasts || 0 }}</div>
          <div class="stat-label">Active Broadcasts</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Recent Broadcasts -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Broadcasts</h3>
            <a routerLink="/broadcast" class="btn btn-secondary btn-sm">View All</a>
          </div>
          <div *ngIf="recentBroadcasts.length === 0" class="empty-state" style="padding: 30px;">
            <div class="empty-icon">📡</div>
            <h3>No broadcasts yet</h3>
            <p>Create your first broadcast to get started</p>
          </div>
          <div *ngFor="let job of recentBroadcasts" class="broadcast-item">
            <div class="broadcast-info">
              <span class="broadcast-name">{{ job.name || 'Broadcast #' + job.id.slice(0,6) }}</span>
              <span [class]="'badge badge-' + getStatusBadge(job.status)">{{ job.status }}</span>
            </div>
            <div class="broadcast-meta">
              <span>{{ job.sentCount || 0 }}/{{ job.totalTargets }} sent</span>
              <span>{{ job.createdAt | date:'short' }}</span>
            </div>
            <div class="progress-bar" style="margin-top: 8px;">
              <div class="progress-bar-fill" [style.width.%]="getProgress(job)"></div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Quick Actions</h3>
          </div>
          <div class="quick-actions">
            <a routerLink="/accounts" class="action-card">
              <span class="action-icon">➕</span>
              <span class="action-label">Add Account</span>
            </a>
            <a routerLink="/groups" class="action-card">
              <span class="action-icon">🔍</span>
              <span class="action-label">Scrape Group</span>
            </a>
            <a routerLink="/broadcast" class="action-card">
              <span class="action-icon">📨</span>
              <span class="action-label">New Broadcast</span>
            </a>
            <a routerLink="/media" class="action-card">
              <span class="action-icon">📎</span>
              <span class="action-label">Upload Media</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stat-card .stat-icon {
      font-size: 24px;
      margin-bottom: 4px;
    }

    .broadcast-item {
      padding: 14px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .broadcast-item:last-child { border-bottom: none; }

    .broadcast-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .broadcast-name {
      font-weight: 600;
      font-size: var(--font-size-sm);
    }

    .broadcast-meta {
      display: flex;
      justify-content: space-between;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .quick-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .action-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px 16px;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-normal);
      text-decoration: none;
      color: var(--text-primary);
    }

    .action-card:hover {
      border-color: var(--accent-primary);
      background: rgba(108, 99, 255, 0.08);
      transform: translateY(-2px);
      box-shadow: var(--shadow-glow);
    }

    .action-icon { font-size: 28px; }

    .action-label {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-secondary);
    }
  `]
})
export class DashboardComponent implements OnInit {
  stats: any = {};
  recentBroadcasts: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.api.getDashboard().subscribe({
      next: (data) => {
        this.stats = data.stats;
        this.recentBroadcasts = data.recentBroadcasts || [];
      },
      error: () => {
        // Use mock data for dev mode
        this.stats = {
          accounts: { total: 0, connected: 0 },
          users: 0,
          groups: 0,
          activeBroadcasts: 0,
        };
      },
    });
  }

  getProgress(job: any): number {
    if (!job.totalTargets) return 0;
    return ((job.sentCount + (job.failedCount || 0)) / job.totalTargets) * 100;
  }

  getStatusBadge(status: string): string {
    const map: Record<string, string> = {
      QUEUED: 'info',
      RUNNING: 'warning',
      PAUSED: 'neutral',
      COMPLETED: 'success',
      FAILED: 'error',
      CANCELLED: 'error',
    };
    return map[status] || 'neutral';
  }
}
