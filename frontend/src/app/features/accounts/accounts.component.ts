import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TelegramService } from '../../core/services/telegram.service';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Accounts</h1>
          <p class="page-subtitle">Manage your Telegram userbot sessions</p>
        </div>
        <button class="btn btn-primary" (click)="showAddModal = true">
          ➕ Add Account
        </button>
      </div>

      <!-- Accounts List -->
      <div *ngIf="accounts.length === 0 && !loading" class="empty-state">
        <div class="empty-icon">🔑</div>
        <h3>No accounts added yet</h3>
        <p>Add your first Telegram account to get started</p>
        <button class="btn btn-primary" style="margin-top: 16px" (click)="showAddModal = true">
          Add Your First Account
        </button>
      </div>

      <div *ngIf="loading" style="text-align:center; padding: 40px;">
        <div class="spinner" style="margin: 0 auto;"></div>
        <p style="margin-top: 12px; color: var(--text-muted);">Loading accounts...</p>
      </div>

      <div class="accounts-grid">
        <div *ngFor="let account of accounts" class="account-card card">
          <div class="account-header">
            <div class="account-avatar">{{ (account.firstName || account.phone || '?')[0] }}</div>
            <div class="account-info">
              <div class="account-name">{{ account.firstName || 'Unknown' }} {{ account.lastName || '' }}</div>
              <div class="account-phone">{{ account.phone }}</div>
              <div class="account-username" *ngIf="account.username">{{ '@' + account.username }}</div>
            </div>
            <span [class]="'badge badge-' + (account.status === 'CONNECTED' ? 'success' : 'error')">
              {{ account.status }}
            </span>
          </div>

          <div class="account-actions">
            <button *ngIf="account.status === 'DISCONNECTED'"
                    class="btn btn-success btn-sm"
                    (click)="connectAccount(account)">
              ▶ Connect
            </button>
            <button *ngIf="account.status === 'CONNECTED'"
                    class="btn btn-secondary btn-sm"
                    (click)="disconnectAccount(account)">
              ⏸ Disconnect
            </button>
            <button class="btn btn-danger btn-sm" (click)="removeAccount(account)">
              🗑 Remove
            </button>
          </div>
        </div>
      </div>

      <!-- Add Account Modal -->
      <div class="modal-overlay" *ngIf="showAddModal" (click)="closeModal($event)">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">{{ authStep === 'phone' ? 'Add Account' : authStep === 'code' ? 'Enter Code' : 'Enter 2FA Password' }}</h3>
            <button class="modal-close" (click)="showAddModal = false">✕</button>
          </div>

          <!-- Step 1: Phone Number -->
          <div *ngIf="authStep === 'phone'">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input class="form-input" [(ngModel)]="phoneInput" placeholder="+998 90 123 45 67" id="phone-input">
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="showAddModal = false">Cancel</button>
              <button class="btn btn-primary" (click)="submitPhone()" [disabled]="authLoading">
                <span *ngIf="authLoading" class="spinner"></span>
                Send Code
              </button>
            </div>
          </div>

          <!-- Step 2: Verification Code -->
          <div *ngIf="authStep === 'code'">
            <p style="color: var(--text-secondary); margin-bottom: 16px;">
              Enter the code sent to <strong>{{ phoneInput }}</strong>
            </p>
            <div class="form-group">
              <label class="form-label">Verification Code</label>
              <input class="form-input" [(ngModel)]="codeInput" placeholder="12345" id="code-input" maxlength="6">
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="authStep = 'phone'">Back</button>
              <button class="btn btn-primary" (click)="submitCode()" [disabled]="authLoading">
                <span *ngIf="authLoading" class="spinner"></span>
                Verify
              </button>
            </div>
          </div>

          <!-- Step 3: 2FA Password -->
          <div *ngIf="authStep === '2fa'">
            <p style="color: var(--text-secondary); margin-bottom: 16px;">
              Two-Factor Authentication is enabled. Enter your password.
            </p>
            <div class="form-group">
              <label class="form-label">2FA Password</label>
              <input class="form-input" type="password" [(ngModel)]="passwordInput" placeholder="Your 2FA password" id="2fa-input">
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="authStep = 'code'">Back</button>
              <button class="btn btn-primary" (click)="submit2FA()" [disabled]="authLoading">
                <span *ngIf="authLoading" class="spinner"></span>
                Authenticate
              </button>
            </div>
          </div>

          <p *ngIf="authError" style="color: var(--color-error); margin-top: 12px; font-size: var(--font-size-sm);">
            ⚠️ {{ authError }}
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }

    .account-card { cursor: default; }

    .account-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }

    .account-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--accent-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 20px;
      color: white;
      flex-shrink: 0;
    }

    .account-info { flex: 1; }

    .account-name {
      font-weight: 600;
      font-size: var(--font-size-md);
    }

    .account-phone {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    .account-username {
      font-size: var(--font-size-xs);
      color: var(--accent-secondary);
    }

  `]
})
export class AccountsComponent implements OnInit {
  accounts: any[] = [];
  loading = true;

  // Modal state
  showAddModal = false;
  authStep: 'phone' | 'code' | '2fa' = 'phone';
  authLoading = false;
  authError = '';

  phoneInput = '';
  codeInput = '';
  passwordInput = '';
  currentAccountId = '';

  constructor(
    private api: ApiService,
    private telegram: TelegramService
  ) {}

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading = true;
    this.api.getAccounts().subscribe({
      next: (data) => {
        this.accounts = data.accounts || [];
        this.loading = false;
      },
      error: () => {
        this.accounts = [];
        this.loading = false;
      },
    });
  }

  submitPhone(): void {
    if (!this.phoneInput.trim()) return;
    this.authLoading = true;
    this.authError = '';
    this.api.addAccount(this.phoneInput.trim()).subscribe({
      next: (data) => {
        this.currentAccountId = data.accountId;
        this.authStep = 'code';
        this.authLoading = false;
        this.telegram.hapticFeedback('success');
      },
      error: (err) => {
        this.authError = err.error?.error || 'Failed to send verification code';
        this.authLoading = false;
        this.telegram.hapticFeedback('error');
      },
    });
  }

  submitCode(): void {
    if (!this.codeInput.trim()) return;
    this.authLoading = true;
    this.authError = '';
    this.api.verifyAccount(this.currentAccountId, this.codeInput.trim()).subscribe({
      next: (data) => {
        if (data.needs2FA) {
          this.authStep = '2fa';
        } else {
          this.showAddModal = false;
          this.resetAuthForm();
          this.loadAccounts();
          this.telegram.hapticFeedback('success');
        }
        this.authLoading = false;
      },
      error: (err) => {
        this.authError = err.error?.error || 'Invalid verification code';
        this.authLoading = false;
        this.telegram.hapticFeedback('error');
      },
    });
  }

  submit2FA(): void {
    if (!this.passwordInput.trim()) return;
    this.authLoading = true;
    this.authError = '';
    this.api.submit2FA(this.currentAccountId, this.passwordInput).subscribe({
      next: () => {
        this.showAddModal = false;
        this.resetAuthForm();
        this.loadAccounts();
        this.telegram.hapticFeedback('success');
      },
      error: (err) => {
        this.authError = err.error?.error || 'Invalid 2FA password';
        this.authLoading = false;
        this.telegram.hapticFeedback('error');
      },
    });
  }

  connectAccount(account: any): void {
    this.api.connectAccount(account.id).subscribe({
      next: () => this.loadAccounts(),
      error: () => this.telegram.hapticFeedback('error'),
    });
  }

  disconnectAccount(account: any): void {
    this.api.disconnectAccount(account.id).subscribe({
      next: () => this.loadAccounts(),
      error: () => this.telegram.hapticFeedback('error'),
    });
  }

  async removeAccount(account: any): Promise<void> {
    const confirmed = await this.telegram.showConfirm(
      `Remove account ${account.phone}? This will disconnect the session.`
    );
    if (confirmed) {
      this.api.removeAccount(account.id).subscribe({
        next: () => this.loadAccounts(),
      });
    }
  }

  closeModal(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.showAddModal = false;
    }
  }

  private resetAuthForm(): void {
    this.authStep = 'phone';
    this.phoneInput = '';
    this.codeInput = '';
    this.passwordInput = '';
    this.authError = '';
    this.currentAccountId = '';
  }
}
