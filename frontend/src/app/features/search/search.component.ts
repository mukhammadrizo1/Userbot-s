import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Global OSINT Search</h1>
          <p class="page-subtitle">Search across all scraped messages and monitored groups</p>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px; display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;">
        <div class="form-group" style="flex: 2; min-width: 300px; margin-bottom: 0;">
          <label class="form-label">Keyword / Regex</label>
          <input class="form-input" [(ngModel)]="filters.q" placeholder="e.g. bitcoin | crypto">
        </div>
        
        <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
          <label class="form-label">From Date</label>
          <input class="form-input" type="date" [(ngModel)]="filters.startDate">
        </div>

        <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom: 0;">
          <label class="form-label">To Date</label>
          <input class="form-input" type="date" [(ngModel)]="filters.endDate">
        </div>

        <button class="btn btn-primary" (click)="search()" style="height: 42px;">🔍 Search</button>
      </div>

      <!-- Results Table -->
      <div class="card" *ngIf="messages.length > 0 || hasSearched">
        <h3 style="margin-top: 0;">Results ({{ total }} found)</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color);">
                <th style="padding: 12px 8px;">Date</th>
                <th style="padding: 12px 8px;">User</th>
                <th style="padding: 12px 8px;">Group</th>
                <th style="padding: 12px 8px;">Message</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let msg of messages" style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 12px 8px; white-space: nowrap;">{{ msg.sentAt | date:'short' }}</td>
                <td style="padding: 12px 8px;">
                  {{ msg.user?.firstName }} {{ msg.user?.lastName }}<br>
                  <small style="color: var(--accent-secondary)">{{ msg.user?.username ? '@'+msg.user.username : msg.user?.telegramId }}</small>
                </td>
                <td style="padding: 12px 8px;">{{ msg.group?.title }}</td>
                <td style="padding: 12px 8px; max-width: 400px;">
                  <div style="max-height: 100px; overflow-y: auto; font-family: monospace; font-size: 13px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">
                    {{ msg.messageText }}
                  </div>
                </td>
              </tr>
              <tr *ngIf="messages.length === 0">
                <td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted);">No messages found.</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-top: 16px;" *ngIf="total > limit">
           <button class="btn btn-secondary btn-sm" [disabled]="page === 1" (click)="page = page - 1; search()">Previous</button>
           <span>Page {{ page }}</span>
           <button class="btn btn-secondary btn-sm" [disabled]="page * limit >= total" (click)="page = page + 1; search()">Next</button>
        </div>
      </div>
    </div>
  `
})
export class SearchComponent implements OnInit {
  filters: any = { q: '', startDate: '', endDate: '' };
  messages: any[] = [];
  total = 0;
  page = 1;
  limit = 20;
  hasSearched = false;

  constructor(private api: ApiService) {}

  ngOnInit() {}

  search() {
    this.hasSearched = true;
    this.api.searchMessages({ ...this.filters, page: this.page, limit: this.limit }).subscribe(res => {
      this.messages = res.messages || [];
      this.total = res.total || 0;
    });
  }
}
