import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TelegramService } from '../../core/services/telegram.service';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-broadcast',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Broadcast</h1>
          <p class="page-subtitle">Send mass messages smartly and safely</p>
        </div>
        <button class="btn btn-primary" (click)="showCreateModal = true">📨 New Broadcast</button>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header" style="margin-bottom: 0;">
          <h3 class="card-title">Broadcast History</h3>
        </div>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name / ID</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Timing Info</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="broadcasts.length === 0">
              <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                No broadcasts found. Create your first broadcast to get started!
              </td>
            </tr>
            <tr *ngFor="let b of broadcasts">
              <td>
                <div style="font-weight: 600;">{{ b.name || 'Broadcast #' + b.id.slice(0,6) }}</div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Via: {{ b.account?.phone }}</div>
              </td>
              <td>
                <span [class]="'badge badge-' + getStatusBadge(b.status)">{{ b.status }}</span>
                <div *ngIf="b.lastError" style="font-size: var(--font-size-xs); color: var(--color-warning); margin-top: 4px;">
                  ⚠️ {{ b.lastError.split(':')[0] }}
                </div>
              </td>
              <td style="min-width: 200px;">
                <div style="display: flex; justify-content: space-between; font-size: var(--font-size-xs); margin-bottom: 4px;">
                  <span>{{ b.sentCount }}/{{ b.totalTargets }} Sent</span>
                  <span style="color: var(--color-error);" *ngIf="b.failedCount > 0">{{ b.failedCount }} Failed</span>
                  <span style="color: var(--text-muted);" *ngIf="b.skippedCount > 0">{{ b.skippedCount }} Skipped</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-bar-fill" [style.width.%]="getProgress(b)"></div>
                </div>
              </td>
              <td style="font-size: var(--font-size-xs);">
                <div>Started: {{ b.startedAt ? (b.startedAt | date:'short') : '-' }}</div>
                <div>Delay: {{ b.delayMs }}ms (+{{ b.jitterMs }}ms)</div>
              </td>
              <td>
                <div style="display: flex; gap: 8px;">
                  <button *ngIf="b.status === 'RUNNING'" class="btn btn-secondary btn-icon" (click)="pause(b)" title="Pause">⏸</button>
                  <button *ngIf="b.status === 'PAUSED'" class="btn btn-success btn-icon" (click)="resume(b)" title="Resume">▶</button>
                  <button *ngIf="['QUEUED', 'RUNNING', 'PAUSED'].includes(b.status)" class="btn btn-danger btn-icon" (click)="cancel(b)" title="Cancel">⏹</button>
                  <button class="btn btn-secondary btn-icon" (click)="openLogsModal(b)" title="View Logs">📄</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;" *ngIf="totalPages > 1">
        <span style="color: var(--text-muted); font-size: var(--font-size-sm);">Showing page {{ page }} of {{ totalPages }}</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" [disabled]="page === 1" (click)="changePage(page - 1)">Previous</button>
          <button class="btn btn-secondary btn-sm" [disabled]="page === totalPages" (click)="changePage(page + 1)">Next</button>
        </div>
      </div>

      <!-- Create Broadcast Modal -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="closeModal($event, 'create')">
        <div class="modal" style="max-width: 600px;">
          <div class="modal-header">
            <h3 class="modal-title">New Broadcast</h3>
            <button class="modal-close" (click)="showCreateModal = false">✕</button>
          </div>
          
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Name (Optional)</label>
            <input class="form-input" [(ngModel)]="newBroadcast.name" placeholder="e.g., Winter Promo">
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Sender Account</label>
            <select class="form-select" [(ngModel)]="newBroadcast.accountId">
              <option *ngFor="let acc of accounts" [value]="acc.id">{{ acc.phone }} ({{ acc.firstName }})</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Target Audience</label>
            <div style="display: flex; gap: 12px;">
              <select class="form-select" [(ngModel)]="newBroadcast.targetType" style="flex: 1;">
                <option value="USERS">Users Only</option>
                <option value="GROUPS">Groups Only</option>
                <option value="MIXED">Both</option>
              </select>
              <select class="form-select" [(ngModel)]="targetCategoryId" style="flex: 2;">
                <option value="">All Categories</option>
                <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Message Text</label>
            <textarea class="form-textarea" [(ngModel)]="newBroadcast.messageText" placeholder="Enter your message... HTML tags are supported if enabled"></textarea>
          </div>

          <div class="grid-2" style="margin-bottom: 12px;">
            <div class="form-group">
              <label class="form-label">Parse Mode</label>
              <select class="form-select" [(ngModel)]="newBroadcast.parseMode">
                <option value="HTML">HTML</option>
                <option value="Markdown">Markdown</option>
                <option value="">None</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Media Asset (Optional)</label>
              <select class="form-select" [(ngModel)]="newBroadcast.mediaAssetId">
                <option value="">No Media</option>
                <option *ngFor="let m of media" [value]="m.fileId">{{ m.fileName }}</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 24px;">
            <label class="form-label">Deadline (Optional)</label>
            <input type="datetime-local" class="form-input" [(ngModel)]="newBroadcast.deadlineAt">
            <span style="font-size: var(--font-size-xs); color: var(--text-muted);">If set, the system will try to calculate a rate to finish by this time safely.</span>
          </div>

          <!-- Rate Preview -->
          <div *ngIf="validationResult" style="padding: 12px; background: var(--bg-input); border-radius: var(--radius-sm); margin-bottom: 24px; border: 1px solid var(--border-color);">
            <div style="font-weight: 600; margin-bottom: 8px;">Rate Calculation Preview</div>
            <div *ngIf="validationResult.accepted" style="color: var(--color-success); font-size: var(--font-size-sm);">
              ✅ {{ validationResult.message }}<br>
              Delay between messages: {{ validationResult.delayMs }}ms<br>
              Estimated completion: {{ (validationResult.delayMs * estimatedTargetCount) / 1000 / 60 | number:'1.0-0' }} minutes
            </div>
            <div *ngIf="!validationResult.accepted" style="color: var(--color-error); font-size: var(--font-size-sm);">
              ❌ {{ validationResult.message }}<br>
              Suggested deadline: {{ validationResult.suggestedDeadline | date:'short' }}
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showCreateModal = false">Cancel</button>
            <button class="btn btn-secondary" (click)="validate()">Calculate Rate</button>
            <button class="btn btn-primary" (click)="create()" [disabled]="!validationResult?.accepted || !newBroadcast.accountId || !newBroadcast.messageText">
              Launch Broadcast
            </button>
          </div>
        </div>
      </div>

      <!-- Logs Modal -->
      <div class="modal-overlay" *ngIf="showLogsModal" (click)="closeModal($event, 'logs')">
        <div class="modal" style="max-width: 800px; max-height: 80vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <h3 class="modal-title">Broadcast Logs</h3>
            <button class="modal-close" (click)="showLogsModal = false">✕</button>
          </div>
          
          <div style="margin-bottom: 16px; display: flex; gap: 12px;">
            <select class="form-select" [(ngModel)]="logsStatusFilter" (change)="loadLogs()">
              <option value="">All Statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped</option>
            </select>
          </div>

          <div class="table-wrapper" style="flex: 1; overflow-y: auto;">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Error Details</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let log of logs">
                  <td style="font-size: var(--font-size-xs);">{{ log.sentAt | date:'shortTime' }}</td>
                  <td>
                    <span *ngIf="log.targetUser">{{ log.targetUser.firstName }} (User)</span>
                    <span *ngIf="log.targetGroup">{{ log.targetGroup.title }} (Group)</span>
                  </td>
                  <td><span [class]="'badge badge-' + getStatusBadge(log.status)">{{ log.status }}</span></td>
                  <td style="font-size: var(--font-size-xs); color: var(--color-error);">{{ log.errorCode || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="modal-actions" style="margin-top: 16px;">
            <button class="btn btn-secondary" (click)="showLogsModal = false">Close</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [` `]
})
export class BroadcastComponent implements OnInit, OnDestroy {
  broadcasts: any[] = [];
  accounts: any[] = [];
  categories: any[] = [];
  media: any[] = [];
  
  page = 1;
  limit = 20;
  totalPages = 1;

  // Real-time socket
  private socket?: Socket;

  // Create Modal State
  showCreateModal = false;
  newBroadcast: any = {
    targetType: 'USERS',
    parseMode: 'HTML',
    messageText: '',
    accountId: '',
    mediaAssetId: ''
  };
  targetCategoryId = '';
  validationResult: any = null;
  estimatedTargetCount = 0;

  // Logs Modal State
  showLogsModal = false;
  viewingJobId = '';
  logs: any[] = [];
  logsStatusFilter = '';

  constructor(private api: ApiService, private telegram: TelegramService) {}

  ngOnInit(): void {
    this.loadData();
    this.setupSocket();
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.broadcasts.forEach(b => {
        this.socket?.emit('broadcast:unsubscribe', { jobId: b.id });
      });
      this.socket.disconnect();
    }
  }

  setupSocket(): void {
    this.socket = io(environment.wsUrl, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    this.socket.on('broadcast:progress', (data: any) => {
      const idx = this.broadcasts.findIndex(b => b.id === data.jobId);
      if (idx !== -1) {
        this.broadcasts[idx].sentCount = data.sent;
        this.broadcasts[idx].failedCount = data.failed;
        this.broadcasts[idx].skippedCount = data.skipped;
        this.broadcasts[idx].status = data.status;
      }
    });
  }

  loadData(): void {
    this.api.getAccounts().subscribe(d => this.accounts = d.accounts?.filter((a:any) => a.status === 'CONNECTED') || []);
    this.api.getCategories().subscribe(d => this.categories = d.categories || []);
    this.api.getMedia(1, 100).subscribe(d => this.media = d.media || []);
    this.loadBroadcasts();
  }

  loadBroadcasts(): void {
    this.api.getBroadcasts(this.page, this.limit).subscribe({
      next: (data) => {
        this.broadcasts = data.jobs || [];
        this.totalPages = data.pages || 1;
        
        // Subscribe to live updates for all visible broadcasts
        this.broadcasts.forEach(b => {
          if (['RUNNING', 'PAUSED', 'QUEUED'].includes(b.status)) {
            this.socket?.emit('broadcast:subscribe', { jobId: b.id });
          }
        });
      }
    });
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.page = newPage;
      this.loadBroadcasts();
    }
  }

  async validate(): Promise<void> {
    // 1. Fetch target IDs based on selection
    let targetIds: string[] = [];
    if (this.newBroadcast.targetType === 'USERS' || this.newBroadcast.targetType === 'MIXED') {
      const usersRes = await this.api.getUsers(1, 10000, '', this.targetCategoryId).toPromise();
      targetIds = targetIds.concat(usersRes.users.map((u:any) => u.id));
    }
    if (this.newBroadcast.targetType === 'GROUPS' || this.newBroadcast.targetType === 'MIXED') {
      const groupsRes = await this.api.getGroups(1, 10000, '', this.targetCategoryId).toPromise();
      targetIds = targetIds.concat(groupsRes.groups.map((g:any) => g.id));
    }

    if (targetIds.length === 0) {
      this.telegram.showAlert('No targets found for the selected criteria');
      return;
    }

    this.newBroadcast.targetIds = targetIds;
    this.estimatedTargetCount = targetIds.length;

    // 2. Validate rate
    this.api.validateBroadcast(this.newBroadcast).subscribe({
      next: (res) => {
        this.validationResult = res.rateInfo;
      },
      error: (err) => this.telegram.showAlert(err.error?.error || 'Validation failed')
    });
  }

  create(): void {
    if (!this.validationResult?.accepted) return;
    
    this.api.createBroadcast(this.newBroadcast).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.telegram.hapticFeedback('success');
        this.loadBroadcasts();
        
        // Reset form
        this.newBroadcast = { targetType: 'USERS', parseMode: 'HTML', messageText: '', accountId: '', mediaAssetId: '' };
        this.validationResult = null;
      },
      error: (err) => this.telegram.showAlert(err.error?.error || 'Failed to create broadcast')
    });
  }

  pause(b: any): void { this.api.pauseBroadcast(b.id).subscribe(() => this.loadBroadcasts()); }
  resume(b: any): void { this.api.resumeBroadcast(b.id).subscribe(() => this.loadBroadcasts()); }
  async cancel(b: any): Promise<void> {
    if (await this.telegram.showConfirm('Are you sure you want to cancel this broadcast?')) {
      this.api.cancelBroadcast(b.id).subscribe(() => this.loadBroadcasts());
    }
  }

  openLogsModal(b: any): void {
    this.viewingJobId = b.id;
    this.showLogsModal = true;
    this.loadLogs();
  }

  loadLogs(): void {
    if (!this.viewingJobId) return;
    this.api.getBroadcastLogs(this.viewingJobId, 1, this.logsStatusFilter).subscribe(d => this.logs = d.logs || []);
  }

  getProgress(job: any): number {
    if (!job.totalTargets) return 0;
    return ((job.sentCount + (job.failedCount || 0) + (job.skippedCount || 0)) / job.totalTargets) * 100;
  }

  getStatusBadge(status: string): string {
    const map: Record<string, string> = {
      QUEUED: 'info', RUNNING: 'warning', PAUSED: 'neutral',
      COMPLETED: 'success', FAILED: 'error', CANCELLED: 'error',
      SENT: 'success', SKIPPED: 'neutral'
    };
    return map[status] || 'neutral';
  }

  closeModal(event: MouseEvent, type: string): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      if (type === 'create') this.showCreateModal = false;
      if (type === 'logs') this.showLogsModal = false;
    }
  }
}
