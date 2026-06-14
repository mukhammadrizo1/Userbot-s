import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TelegramService } from '../../core/services/telegram.service';

@Component({
  selector: 'app-spy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Spy Module</h1>
          <p class="page-subtitle">AI-powered surveillance and lead capture</p>
        </div>
        <button class="btn btn-primary" (click)="showCreateModal = true">
          ➕ New Spy Ticket
        </button>
      </div>

      <!-- Tickets List -->
      <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 16px;">
        <div *ngFor="let ticket of tickets" class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px;">{{ ticket.name }}</h3>
            <span [class]="'badge badge-' + (ticket.status === 'RUNNING' ? 'success' : 'error')">
              {{ ticket.status }}
            </span>
          </div>
          
          <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">
            <strong>Keywords:</strong> {{ ticket.keywords }}
          </div>
          <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
            <strong>Captured Leads:</strong> {{ ticket._count?.capturedLeads || 0 }}
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-secondary" (click)="viewLeads(ticket)">👀 View Leads</button>
            <button class="btn btn-sm btn-secondary" *ngIf="ticket.status === 'RUNNING'" (click)="toggleStatus(ticket, 'PAUSED')">⏸ Pause</button>
            <button class="btn btn-sm btn-success" *ngIf="ticket.status !== 'RUNNING'" (click)="toggleStatus(ticket, 'RUNNING')">▶ Resume</button>
            <button class="btn btn-sm btn-danger" (click)="deleteTicket(ticket)">🗑 Delete</button>
          </div>
        </div>
      </div>

      <!-- Create Ticket Modal -->
      <div class="modal-overlay" *ngIf="showCreateModal" (click)="closeModal($event, 'create')">
        <div class="modal" style="max-width: 500px;">
          <div class="modal-header">
            <h3 class="modal-title">Create Spy Ticket</h3>
            <button class="modal-close" (click)="showCreateModal = false">✕</button>
          </div>
          
          <div class="form-group">
            <label class="form-label">Ticket Name</label>
            <input class="form-input" [(ngModel)]="newTicket.name" placeholder="e.g. Freelance Jobs Tracker">
          </div>
          
          <div class="form-group">
            <label class="form-label">Keywords (Pipe | separated)</label>
            <input class="form-input" [(ngModel)]="newTicket.keywords" placeholder="e.g. need a dev | hiring | looking for">
          </div>
          
          <div class="form-group">
            <label class="form-label">AI Prompt</label>
            <textarea class="form-input" [(ngModel)]="newTicket.aiPrompt" rows="3" placeholder="Context for the AI. Example: This message is looking to hire a web developer."></textarea>
            <small style="color: var(--text-muted);">"Answer with strictly one word: 'Yes' or 'No'." is automatically appended.</small>
          </div>
          
          <div class="form-group">
            <label class="form-label">Auto-Reply Message (Optional)</label>
            <textarea class="form-input" [(ngModel)]="newTicket.autoReplyMessage" rows="3" placeholder="If matched, auto-send this message to the user..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Target Groups</label>
            <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 8px;">
               <div *ngFor="let g of availableGroups" style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                 <input type="checkbox" [checked]="newTicket.targetGroups.includes(g.id)" (change)="toggleTargetGroup(g.id)">
                 <span>{{ g.title }}</span>
               </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showCreateModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="createTicket()">Create Ticket</button>
          </div>
        </div>
      </div>

      <!-- Leads Modal -->
      <div class="modal-overlay" *ngIf="showLeadsModal" (click)="closeModal($event, 'leads')">
        <div class="modal" style="max-width: 800px; width: 90%;">
          <div class="modal-header">
            <h3 class="modal-title">Captured Leads: {{ selectedTicket?.name }}</h3>
            <button class="modal-close" (click)="showLeadsModal = false">✕</button>
          </div>
          
          <div style="max-height: 60vh; overflow-y: auto;">
             <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                    <th style="padding: 12px 8px;">User</th>
                    <th style="padding: 12px 8px;">Group</th>
                    <th style="padding: 12px 8px;">Message</th>
                    <th style="padding: 12px 8px;">Auto-Replied</th>
                    <th style="padding: 12px 8px;">Captured At</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let lead of leads" style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px 8px;">
                      {{ lead.user.firstName }} {{ lead.user.lastName }}<br>
                      <small style="color: var(--accent-secondary)">{{ lead.user.username ? '@'+lead.user.username : lead.user.telegramId }}</small>
                    </td>
                    <td style="padding: 12px 8px;">{{ lead.group.title }}</td>
                    <td style="padding: 12px 8px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" [title]="lead.message.messageText">
                      {{ lead.message.messageText }}
                    </td>
                    <td style="padding: 12px 8px;">
                       <span [class]="'badge badge-' + (lead.autoReplySent ? 'success' : 'secondary')">{{ lead.autoReplySent ? 'Yes' : 'No' }}</span>
                    </td>
                    <td style="padding: 12px 8px;">{{ lead.capturedAt | date:'short' }}</td>
                  </tr>
                  <tr *ngIf="leads.length === 0">
                    <td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">No leads captured yet.</td>
                  </tr>
                </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SpyComponent implements OnInit {
  tickets: any[] = [];
  leads: any[] = [];
  availableGroups: any[] = [];
  
  showCreateModal = false;
  showLeadsModal = false;
  selectedTicket: any = null;

  newTicket = {
    name: '',
    keywords: '',
    aiPrompt: '',
    autoReplyMessage: '',
    targetGroups: [] as string[]
  };

  constructor(private api: ApiService, private telegram: TelegramService) {}

  ngOnInit() {
    this.loadTickets();
    this.loadGroups();
  }

  loadTickets() {
    this.api.getSpyTickets().subscribe(res => this.tickets = res.tickets || []);
  }

  loadGroups() {
    this.api.getGroups(1, 1000).subscribe(res => this.availableGroups = res.groups || []);
  }

  toggleTargetGroup(id: string) {
    const idx = this.newTicket.targetGroups.indexOf(id);
    if (idx === -1) {
      this.newTicket.targetGroups.push(id);
    } else {
      this.newTicket.targetGroups.splice(idx, 1);
    }
  }

  createTicket() {
    if (!this.newTicket.name || !this.newTicket.keywords || !this.newTicket.aiPrompt) return;
    
    this.api.createSpyTicket(this.newTicket).subscribe({
      next: () => {
        this.telegram.hapticFeedback('success');
        this.showCreateModal = false;
        this.loadTickets();
        this.newTicket = { name: '', keywords: '', aiPrompt: '', autoReplyMessage: '', targetGroups: [] };
      },
      error: () => this.telegram.hapticFeedback('error')
    });
  }

  toggleStatus(ticket: any, status: string) {
    this.api.updateSpyTicketStatus(ticket.id, status).subscribe(() => this.loadTickets());
  }

  deleteTicket(ticket: any) {
    this.telegram.showConfirm('Delete this ticket?').then(confirmed => {
      if (confirmed) {
        this.api.deleteSpyTicket(ticket.id).subscribe(() => this.loadTickets());
      }
    });
  }

  viewLeads(ticket: any) {
    this.selectedTicket = ticket;
    this.api.getCapturedLeads(ticket.id).subscribe(res => {
      this.leads = res.leads || [];
      this.showLeadsModal = true;
    });
  }

  closeModal(event: MouseEvent, type: string) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      if (type === 'create') this.showCreateModal = false;
      if (type === 'leads') this.showLeadsModal = false;
    }
  }
}
