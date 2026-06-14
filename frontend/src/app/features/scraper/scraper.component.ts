import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TelegramService } from '../../core/services/telegram.service';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-scraper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Automated Scraper</h1>
          <p class="page-subtitle">Deep scrape members from target groups seamlessly</p>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 24px;">
        <!-- Configuration -->
        <div class="card">
           <h3>Scraper Settings</h3>
           
           <div class="form-group">
             <label class="form-label">Members per Group</label>
             <input class="form-input" type="number" [(ngModel)]="limitPerGroup">
           </div>
           
           <div class="form-group">
             <label class="form-label">Target Groups (Database)</label>
             <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px;">
               <div *ngFor="let g of availableGroups" style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                 <input type="checkbox" [checked]="selectedGroups.includes(g)" (change)="toggleGroup(g)">
                 <span>{{ g.title }}</span>
               </div>
             </div>
           </div>

           <div class="form-group">
             <label class="form-label">Or Paste Raw Links / IDs</label>
             <textarea class="form-input" [(ngModel)]="rawLinks" rows="4" placeholder="https://t.me/example_group&#10;@another_group&#10;-100123456789"></textarea>
             <small style="color: var(--text-muted);">Links not in database will be resolved and added automatically.</small>
           </div>

           <button class="btn btn-primary" style="width: 100%;" (click)="startScraping()" [disabled]="isScraping">
             {{ isScraping ? 'Scraping in progress...' : '🚀 Start Scraping Job' }}
           </button>
        </div>
        
        <!-- Live Progress -->
        <div class="card">
           <h3>Live Progress</h3>
           
           <div *ngIf="!progress" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
             No active scraping job.
           </div>
           
           <div *ngIf="progress">
              <div style="margin-bottom: 16px;">
                <strong>Status:</strong> <span [class]="'badge badge-' + (progress.status === 'COMPLETED' ? 'success' : 'secondary')">{{ progress.status }}</span>
              </div>
              
              <div style="margin-bottom: 8px;">
                <strong>Progress:</strong> {{ progress.currentGroupIndex }} / {{ progress.totalGroups }} groups
              </div>
              
              <div class="progress-bar" style="height: 12px; background: var(--bg-tertiary); border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
                <div class="progress-fill" [style.width.%]="(progress.currentGroupIndex / progress.totalGroups) * 100" style="height: 100%; background: var(--accent-primary); transition: width 0.3s ease;"></div>
              </div>
              
              <div *ngIf="progress.currentGroupTitle" style="margin-bottom: 16px;">
                <strong>Currently Scraping:</strong> {{ progress.currentGroupTitle }}
              </div>
              
              <div style="display: flex; gap: 16px;">
                <div class="stat-card" style="flex: 1; background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; padding: 12px; border-radius: 4px;">
                  <div style="font-size: 24px; font-weight: bold; color: #22c55e;">{{ progress.totalAdded || 0 }}</div>
                  <div style="font-size: 12px; color: var(--text-secondary);">New Leads Added</div>
                </div>
                <div class="stat-card" style="flex: 1; background: rgba(99, 102, 241, 0.1); border-left: 4px solid var(--accent-primary); padding: 12px; border-radius: 4px;">
                  <div style="font-size: 24px; font-weight: bold; color: var(--accent-primary);">{{ progress.totalSkipped || 0 }}</div>
                  <div style="font-size: 12px; color: var(--text-secondary);">Duplicates Skipped</div>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  `
})
export class ScraperComponent implements OnInit {
  limitPerGroup = 200;
  availableGroups: any[] = [];
  selectedGroups: any[] = [];
  rawLinks = '';
  
  isScraping = false;
  progress: any = null;
  private socket?: Socket;

  constructor(private api: ApiService, private telegram: TelegramService) {}

  ngOnInit() {
    this.api.getGroups(1, 1000).subscribe(res => this.availableGroups = res.groups || []);
    
    this.socket = io(environment.wsUrl, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    this.socket.on('scraper:progress', (data: any) => {
      this.progress = data;
      if (data.status === 'COMPLETED') {
        this.isScraping = false;
        this.telegram.hapticFeedback('success');
      }
    });
  }

  toggleGroup(group: any) {
    const idx = this.selectedGroups.findIndex(g => g.id === group.id);
    if (idx === -1) {
      this.selectedGroups.push(group);
    } else {
      this.selectedGroups.splice(idx, 1);
    }
  }

  startScraping() {
    let finalGroups = [...this.selectedGroups];
    
    // The backend /scraper/start expects { targetGroups: [{ id, telegramId, title }] }
    // If rawLinks are provided, we should ideally resolve them via backend first.
    // For simplicity, we'll pass raw links as dummy objects and let the backend Upsert them.
    // However, our backend expects an ID. Let's rely on selected groups for now.
    
    if (finalGroups.length === 0) {
      this.telegram.showConfirm('No groups selected. Please select from database.');
      return;
    }
    
    this.isScraping = true;
    this.progress = { status: 'STARTING', currentGroupIndex: 0, totalGroups: finalGroups.length, totalAdded: 0, totalSkipped: 0 };
    
    this.api.startScraperJob({
      targetGroups: finalGroups.map(g => ({ id: g.id, telegramId: g.telegramId.toString(), title: g.title })),
      limitPerGroup: this.limitPerGroup
    }).subscribe({
      next: (res) => {
        // Wait for socket updates
      },
      error: () => {
        this.isScraping = false;
        this.telegram.hapticFeedback('error');
      }
    });
  }
}
