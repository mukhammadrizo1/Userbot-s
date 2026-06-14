import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Users</h1>
          <p class="page-subtitle">Manage scraped targets and contacts</p>
        </div>
        <button class="btn btn-primary" (click)="showAddModal = true">➕ Add User</button>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header" style="margin-bottom: 0;">
          <div style="display: flex; gap: 12px; width: 100%; max-width: 600px;">
            <input class="form-input" placeholder="Search users by name or username..."
                   [(ngModel)]="searchQuery" (keyup.enter)="loadUsers()">
            <select class="form-select" [(ngModel)]="selectedCategory" (change)="loadUsers()" style="max-width: 200px;">
              <option value="">All Categories</option>
              <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
            </select>
            <button class="btn btn-secondary" (click)="loadUsers()">Search</button>
          </div>
        </div>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Categories</th>
              <th>Groups</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="users.length === 0">
              <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                No users found. Try adjusting your search or scrape a group first.
              </td>
            </tr>
            <tr *ngFor="let user of users">
              <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="account-avatar" style="width: 32px; height: 32px; font-size: 14px;">
                    {{ (user.firstName || '?')[0] }}
                  </div>
                  <div>
                    <div style="font-weight: 600;">{{ user.firstName }} {{ user.lastName }}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                      {{ user.username ? '@' + user.username : user.telegramId }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <span *ngFor="let cat of user.categories" class="badge badge-neutral"
                        [style.border-color]="cat.color">{{ cat.name }}</span>
                  <span *ngIf="user.categories?.length === 0" style="color: var(--text-muted); font-size: var(--font-size-xs)">None</span>
                </div>
              </td>
              <td>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary);">
                  <div *ngFor="let g of user.groups">{{ g.title }}</div>
                  <span *ngIf="user.groups?.length === 0">No groups</span>
                </div>
              </td>
              <td>
                <span *ngIf="user.isPremium" class="badge badge-warning" style="margin-right: 4px;">⭐ Premium</span>
                <span *ngIf="user.isBot" class="badge badge-info">🤖 Bot</span>
              </td>
              <td>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-secondary btn-icon" (click)="openHistoryModal(user)" title="View History">📜</button>
                  <button class="btn btn-secondary btn-icon" (click)="openEditModal(user)">✎</button>
                  <button class="btn btn-danger btn-icon" (click)="deleteUser(user)">🗑</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;" *ngIf="totalPages > 1">
        <span style="color: var(--text-muted); font-size: var(--font-size-sm);">
          Showing page {{ page }} of {{ totalPages }}
        </span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" [disabled]="page === 1" (click)="changePage(page - 1)">Previous</button>
          <button class="btn btn-secondary btn-sm" [disabled]="page === totalPages" (click)="changePage(page + 1)">Next</button>
        </div>
      </div>

      <!-- Add User Modal -->
      <div class="modal-overlay" *ngIf="showAddModal" (click)="closeModal($event, 'add')">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Add User</h3>
            <button class="modal-close" (click)="showAddModal = false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">Username, URL, or ID</label>
            <input class="form-input" [(ngModel)]="newUserInput" placeholder="@username or https://t.me/username">
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label class="form-label">Resolver Account (Optional)</label>
            <select class="form-select" [(ngModel)]="resolverAccountId">
              <option value="">Auto (Any connected account)</option>
              <option *ngFor="let acc of accounts" [value]="acc.id">{{ acc.phone }} ({{ acc.firstName }})</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showAddModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="addUser()" [disabled]="!newUserInput">Add User</button>
          </div>
        </div>
      </div>

      <!-- Edit User Modal (Categories & Notes) -->
      <div class="modal-overlay" *ngIf="showEditModal" (click)="closeModal($event, 'edit')">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Edit User</h3>
            <button class="modal-close" (click)="showEditModal = false">✕</button>
          </div>
          <div *ngIf="editingUser">
            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label">Admin Notes</label>
              <textarea class="form-textarea" [(ngModel)]="editingUserNotes" placeholder="Private notes about this user..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Assign Category</label>
              <div style="display: flex; gap: 8px;">
                <select class="form-select" #catSelect>
                  <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
                </select>
                <button class="btn btn-secondary" (click)="assignCategory(catSelect.value)">Assign</button>
              </div>
            </div>
            <div style="margin-top: 16px;">
              <label class="form-label">Current Categories</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                <span *ngFor="let cat of editingUser.categories" class="badge badge-neutral" style="display: flex; align-items: center; gap: 4px;">
                  {{ cat.name }}
                  <span style="cursor: pointer; color: var(--color-error);" (click)="removeCategory(cat.id)">✕</span>
                </span>
                <span *ngIf="editingUser.categories?.length === 0" style="color: var(--text-muted); font-size: var(--font-size-xs);">No categories</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showEditModal = false">Close</button>
            <button class="btn btn-primary" (click)="saveNotes()">Save Notes</button>
          </div>
        </div>
      </div>

      <!-- History Modal -->
      <div class="modal-overlay" *ngIf="showHistoryModal" (click)="closeModal($event, 'history')">
        <div class="modal" style="max-width: 800px; max-height: 85vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <h3 class="modal-title">User History: {{ historyUser?.firstName }}</h3>
            <button class="modal-close" (click)="showHistoryModal = false">✕</button>
          </div>
          <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
            <div>
              <h4 style="margin-top: 0;">Profile Changes (Telemetry)</h4>
              <div *ngIf="userHistory.length === 0" style="color: var(--text-muted); font-size: 14px;">No historical changes recorded.</div>
              <table *ngIf="userHistory.length > 0" style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                  <th>Date</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Username</th>
                </tr>
                <tr *ngFor="let h of userHistory" style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 4px;">{{ h.observedAt | date:'short' }}</td>
                  <td style="padding: 4px;">{{ h.firstName }}</td>
                  <td style="padding: 4px;">{{ h.lastName }}</td>
                  <td style="padding: 4px;">{{ h.username ? '@'+h.username : '-' }}</td>
                </tr>
              </table>
            </div>
            
            <div>
              <h4 style="margin-top: 0;">Message History</h4>
              <div *ngIf="userMessages.length === 0" style="color: var(--text-muted); font-size: 14px;">No messages scraped for this user.</div>
              <div *ngFor="let msg of userMessages" style="background: var(--bg-tertiary); padding: 8px; border-radius: 8px; margin-bottom: 8px;">
                 <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; display: flex; justify-content: space-between;">
                   <span>Group: {{ msg.group?.title }}</span>
                   <span>{{ msg.sentAt | date:'short' }}</span>
                 </div>
                 <div style="font-size: 14px; font-family: monospace;">{{ msg.messageText }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .account-avatar {
      border-radius: 50%;
      background: var(--accent-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
  `]
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  categories: any[] = [];
  accounts: any[] = [];
  
  page = 1;
  limit = 20;
  totalPages = 1;
  
  searchQuery = '';
  selectedCategory = '';
  
  showAddModal = false;
  newUserInput = '';
  resolverAccountId = '';

  showEditModal = false;
  editingUser: any = null;
  editingUserNotes = '';

  showHistoryModal = false;
  historyUser: any = null;
  userHistory: any[] = [];
  userMessages: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadAccounts();
    this.loadUsers();
  }

  loadUsers(): void {
    this.api.getUsers(this.page, this.limit, this.searchQuery, this.selectedCategory).subscribe({
      next: (data) => {
        this.users = data.users || [];
        this.totalPages = data.pages || 1;
      }
    });
  }

  loadCategories(): void {
    this.api.getCategories().subscribe(data => this.categories = data.categories || []);
  }

  loadAccounts(): void {
    this.api.getAccounts().subscribe(data => this.accounts = data.accounts?.filter((a: any) => a.status === 'CONNECTED') || []);
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.page = newPage;
      this.loadUsers();
    }
  }

  addUser(): void {
    if (!this.newUserInput) return;
    this.api.addUser(this.newUserInput, this.resolverAccountId || undefined).subscribe({
      next: () => {
        this.showAddModal = false;
        this.newUserInput = '';
        this.loadUsers();
      }
    });
  }

  deleteUser(user: any): void {
    if (confirm(`Are you sure you want to delete ${user.firstName}?`)) {
      this.api.deleteUser(user.id).subscribe(() => this.loadUsers());
    }
  }

  openEditModal(user: any): void {
    this.editingUser = user;
    this.editingUserNotes = user.notes || '';
    this.showEditModal = true;
  }

  openHistoryModal(user: any): void {
    this.historyUser = user;
    this.showHistoryModal = true;
    
    this.api.getUserHistory(user.id).subscribe(res => {
      this.userHistory = res.history || [];
    });
    
    this.api.searchMessages({ userId: user.id, limit: 100 }).subscribe(res => {
      this.userMessages = res.messages || [];
    });
  }

  saveNotes(): void {
    if (!this.editingUser) return;
    this.api.updateUserNotes(this.editingUser.id, this.editingUserNotes).subscribe({
      next: () => {
        this.editingUser.notes = this.editingUserNotes;
        this.showEditModal = false;
      }
    });
  }

  assignCategory(categoryId: string): void {
    if (!categoryId || !this.editingUser) return;
    this.api.assignCategoryToUser(categoryId, this.editingUser.id).subscribe({
      next: () => {
        this.api.getUser(this.editingUser.id).subscribe(data => {
          this.editingUser.categories = data.user.categories;
          this.loadUsers(); // refresh table
        });
      }
    });
  }

  removeCategory(categoryId: string): void {
    if (!this.editingUser) return;
    this.api.removeCategoryFromUser(categoryId, this.editingUser.id).subscribe({
      next: () => {
        this.editingUser.categories = this.editingUser.categories.filter((c: any) => c.id !== categoryId);
        this.loadUsers(); // refresh table
      }
    });
  }

  closeModal(event: MouseEvent, type: 'add' | 'edit' | 'history'): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      if (type === 'add') this.showAddModal = false;
      if (type === 'edit') this.showEditModal = false;
      if (type === 'history') this.showHistoryModal = false;
    }
  }
}
