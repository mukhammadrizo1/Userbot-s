import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Groups</h1>
          <p class="page-subtitle">Manage target groups and scrape participants</p>
        </div>
        <button class="btn btn-primary" (click)="showAddModal = true">➕ Add Group</button>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header" style="margin-bottom: 0;">
          <div style="display: flex; gap: 12px; width: 100%; max-width: 600px;">
            <input class="form-input" placeholder="Search groups by title or username..."
                   [(ngModel)]="searchQuery" (keyup.enter)="loadGroups()">
            <select class="form-select" [(ngModel)]="selectedCategory" (change)="loadGroups()" style="max-width: 200px;">
              <option value="">All Categories</option>
              <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
            </select>
            <button class="btn btn-secondary" (click)="loadGroups()">Search</button>
          </div>
        </div>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Group Info</th>
              <th>Categories</th>
              <th>Members (Scraped/Total)</th>
              <th>Monitor</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="groups.length === 0">
              <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                No groups found. Add a group to start scraping.
              </td>
            </tr>
            <tr *ngFor="let group of groups">
              <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="group-avatar" style="width: 36px; height: 36px; font-size: 14px;">
                    {{ (group.title || '?')[0] }}
                  </div>
                  <div>
                    <div style="font-weight: 600;">{{ group.title }}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                      {{ group.username ? '@' + group.username : group.telegramId }}
                      • {{ group.type }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <span *ngFor="let cat of group.categories" class="badge badge-neutral"
                        [style.border-color]="cat.color">{{ cat.name }}</span>
                </div>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="progress-bar" style="width: 60px; height: 6px;">
                    <div class="progress-bar-fill" 
                         [style.width.%]="group.memberCount ? Math.min((group.dbMemberCount / group.memberCount) * 100, 100) : 0"></div>
                  </div>
                  <span style="font-size: var(--font-size-sm);">
                    {{ group.dbMemberCount || 0 }} / {{ group.memberCount || '?' }}
                  </span>
                </div>
              </td>
              <td>
                <label class="switch">
                  <input type="checkbox" [checked]="group.isMonitored" (change)="toggleMonitor(group, $event)">
                  <span class="slider round"></span>
                </label>
              </td>
              <td>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-primary btn-sm" (click)="openScrapeModal(group)" title="Scrape Participants">
                    Scrape
                  </button>
                  <button class="btn btn-secondary btn-icon" (click)="openEditModal(group)" title="Edit Group">✎</button>
                  <button class="btn btn-danger btn-icon" (click)="deleteGroup(group)" title="Delete Group">🗑</button>
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

      <!-- Add Group Modal -->
      <div class="modal-overlay" *ngIf="showAddModal" (click)="closeModal($event, 'add')">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Add Group</h3>
            <button class="modal-close" (click)="showAddModal = false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">Username, URL, or ID</label>
            <input class="form-input" [(ngModel)]="newGroupInput" placeholder="@groupname or https://t.me/groupname">
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
            <button class="btn btn-primary" (click)="addGroup()" [disabled]="!newGroupInput">Add Group</button>
          </div>
        </div>
      </div>

      <!-- Scrape Group Modal -->
      <div class="modal-overlay" *ngIf="showScrapeModal" (click)="closeModal($event, 'scrape')">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Scrape Participants</h3>
            <button class="modal-close" (click)="showScrapeModal = false">✕</button>
          </div>
          <div *ngIf="scrapingGroup">
            <p style="margin-bottom: 16px;">Scrape members from <strong>{{ scrapingGroup.title }}</strong>?</p>
            <div class="form-group">
              <label class="form-label">Limit</label>
              <input type="number" class="form-input" [(ngModel)]="scrapeLimit" placeholder="200" min="1" max="10000">
              <span style="font-size: var(--font-size-xs); color: var(--text-muted);">Max members to fetch in this batch.</span>
            </div>
            <div class="form-group" style="margin-top: 12px;">
              <label class="form-label">Account to use</label>
              <select class="form-select" [(ngModel)]="resolverAccountId">
                <option value="">Auto</option>
                <option *ngFor="let acc of accounts" [value]="acc.id">{{ acc.phone }}</option>
              </select>
            </div>
            <div *ngIf="scrapeResult" style="margin-top: 16px; padding: 12px; background: rgba(0, 230, 118, 0.1); border-radius: var(--radius-sm); color: var(--color-success);">
              {{ scrapeResult }}
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showScrapeModal = false">Close</button>
            <button class="btn btn-primary" (click)="startScrape()" [disabled]="isScraping">
              <span *ngIf="isScraping" class="spinner" style="margin-right: 8px;"></span>
              {{ isScraping ? 'Scraping...' : 'Start Scrape' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Group Modal (Categories) -->
      <div class="modal-overlay" *ngIf="showEditModal" (click)="closeModal($event, 'edit')">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Edit Group Categories</h3>
            <button class="modal-close" (click)="showEditModal = false">✕</button>
          </div>
          <div *ngIf="editingGroup">
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
                <span *ngFor="let cat of editingGroup.categories" class="badge badge-neutral" style="display: flex; align-items: center; gap: 4px;">
                  {{ cat.name }}
                  <span style="cursor: pointer; color: var(--color-error);" (click)="removeCategory(cat.id)">✕</span>
                </span>
                <span *ngIf="editingGroup.categories?.length === 0" style="color: var(--text-muted); font-size: var(--font-size-xs);">No categories</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" (click)="showEditModal = false">Done</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .group-avatar {
      border-radius: var(--radius-md);
      background: var(--accent-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }

    /* Switch toggle styles */
    .switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
    }
    .switch input { 
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--bg-card-hover);
      transition: .4s;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
    }
    input:checked + .slider {
      background-color: var(--color-success);
    }
    input:checked + .slider:before {
      transform: translateX(18px);
    }
    .slider.round {
      border-radius: 22px;
    }
    .slider.round:before {
      border-radius: 50%;
    }
  `]
})
export class GroupsComponent implements OnInit {
  groups: any[] = [];
  categories: any[] = [];
  accounts: any[] = [];
  Math = Math;
  
  page = 1;
  limit = 20;
  totalPages = 1;
  
  searchQuery = '';
  selectedCategory = '';
  
  showAddModal = false;
  newGroupInput = '';
  resolverAccountId = '';

  showScrapeModal = false;
  scrapingGroup: any = null;
  scrapeLimit = 200;
  isScraping = false;
  scrapeResult = '';

  showEditModal = false;
  editingGroup: any = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadAccounts();
    this.loadGroups();
  }

  loadGroups(): void {
    this.api.getGroups(this.page, this.limit, this.searchQuery, this.selectedCategory).subscribe({
      next: (data) => {
        this.groups = data.groups || [];
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
      this.loadGroups();
    }
  }

  addGroup(): void {
    if (!this.newGroupInput) return;
    this.api.addGroup(this.newGroupInput, this.resolverAccountId || undefined).subscribe({
      next: () => {
        this.showAddModal = false;
        this.newGroupInput = '';
        this.loadGroups();
      }
    });
  }

  deleteGroup(group: any): void {
    if (confirm(`Are you sure you want to delete ${group.title}?`)) {
      this.api.deleteGroup(group.id).subscribe(() => this.loadGroups());
    }
  }

  toggleMonitor(group: any, event: any): void {
    const isMonitored = event.target.checked;
    this.api.toggleGroupMonitor(group.id, isMonitored).subscribe({
      next: () => group.isMonitored = isMonitored,
      error: () => event.target.checked = !isMonitored // revert
    });
  }

  openScrapeModal(group: any): void {
    this.scrapingGroup = group;
    this.scrapeResult = '';
    this.showScrapeModal = true;
  }

  startScrape(): void {
    if (!this.scrapingGroup) return;
    this.isScraping = true;
    this.scrapeResult = '';
    
    this.api.scrapeGroup(this.scrapingGroup.id, this.resolverAccountId || undefined, this.scrapeLimit).subscribe({
      next: (res) => {
        this.isScraping = false;
        this.scrapeResult = res.message;
        this.loadGroups(); // refresh to show new member count
      },
      error: (err) => {
        this.isScraping = false;
        this.scrapeResult = 'Error: ' + (err.error?.error || 'Failed to scrape');
      }
    });
  }

  openEditModal(group: any): void {
    this.editingGroup = group;
    this.showEditModal = true;
  }

  assignCategory(categoryId: string): void {
    if (!categoryId || !this.editingGroup) return;
    this.api.assignCategoryToGroup(categoryId, this.editingGroup.id).subscribe({
      next: () => {
        this.api.getGroup(this.editingGroup.id).subscribe(data => {
          this.editingGroup.categories = data.group.categories;
          this.loadGroups();
        });
      }
    });
  }

  removeCategory(categoryId: string): void {
    if (!this.editingGroup) return;
    this.api.removeCategoryFromGroup(categoryId, this.editingGroup.id).subscribe({
      next: () => {
        this.editingGroup.categories = this.editingGroup.categories.filter((c: any) => c.id !== categoryId);
        this.loadGroups();
      }
    });
  }

  closeModal(event: MouseEvent, type: 'add' | 'scrape' | 'edit'): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      if (type === 'add') this.showAddModal = false;
      if (type === 'scrape') this.showScrapeModal = false;
      if (type === 'edit') this.showEditModal = false;
    }
  }
}
