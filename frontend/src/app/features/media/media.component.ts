import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TelegramService } from '../../core/services/telegram.service';

@Component({
  selector: 'app-media',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Media Assets</h1>
          <p class="page-subtitle">Upload images/videos for your broadcasts (stored in a private Telegram channel)</p>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 class="card-title">Upload New Media</h3>
        </div>
        <div class="upload-area" 
             [class.dragover]="isDragOver" 
             (dragover)="onDragOver($event)" 
             (dragleave)="onDragLeave($event)" 
             (drop)="onDrop($event)"
             (click)="fileInput.click()">
          <input type="file" #fileInput style="display: none" (change)="onFileSelected($event)">
          <div class="upload-icon">☁️</div>
          <div style="font-weight: 600; margin-bottom: 4px;">Click or drag file to upload</div>
          <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Max size: 50MB. Images, Videos, or Docs.</div>
          
          <div *ngIf="selectedFile" style="margin-top: 16px; color: var(--accent-primary);">
            Selected: {{ selectedFile.name }} ({{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB)
          </div>
        </div>

        <div class="form-group" style="margin-top: 16px;" *ngIf="selectedFile">
          <label class="form-label">Caption (Optional)</label>
          <input class="form-input" [(ngModel)]="uploadCaption" placeholder="Optional text caption...">
        </div>

        <button *ngIf="selectedFile" class="btn btn-primary" style="margin-top: 16px; width: 100%;" (click)="upload()" [disabled]="isUploading">
          <span *ngIf="isUploading" class="spinner" style="margin-right: 8px;"></span>
          {{ isUploading ? 'Uploading to Telegram...' : 'Confirm Upload' }}
        </button>
      </div>

      <div class="grid-3">
        <div *ngFor="let m of media" class="media-card card">
          <div class="media-preview" [class.no-preview]="!m.mimeType.startsWith('image/')">
            <span *ngIf="!m.mimeType.startsWith('image/')">📄 {{ m.mimeType.split('/')[1] | uppercase }}</span>
            <div *ngIf="m.mimeType.startsWith('image/')" class="img-placeholder">🖼️ Image</div>
          </div>
          <div class="media-info">
            <div class="media-name" [title]="m.fileName">{{ m.fileName }}</div>
            <div class="media-meta">{{ (m.fileSize / 1024).toFixed(0) }} KB • {{ m.createdAt | date:'shortDate' }}</div>
            <div *ngIf="m.caption" class="media-caption">{{ m.caption }}</div>
          </div>
          <div class="media-actions">
            <button class="btn btn-secondary btn-sm" (click)="copyFileId(m.fileId)" style="flex: 1;">Copy ID</button>
            <button class="btn btn-danger btn-sm" (click)="deleteMedia(m)">🗑</button>
          </div>
        </div>
      </div>
      
      <div *ngIf="media.length === 0" class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>No media assets</h3>
      </div>
    </div>
  `,
  styles: [`
    .upload-area {
      border: 2px dashed var(--border-color);
      border-radius: var(--radius-lg);
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all var(--transition-fast);
      background: var(--bg-input);
    }
    .upload-area:hover, .upload-area.dragover {
      border-color: var(--accent-primary);
      background: rgba(108, 99, 255, 0.05);
    }
    .upload-icon { font-size: 32px; margin-bottom: 12px; }

    .media-card { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
    .media-preview {
      height: 120px;
      background: var(--bg-input);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-weight: 600;
      border: 1px solid var(--border-color);
    }
    .img-placeholder { font-size: 24px; }
    .media-name { font-weight: 600; font-size: var(--font-size-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .media-meta { font-size: var(--font-size-xs); color: var(--text-muted); }
    .media-caption { font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px; font-style: italic; }
    .media-actions { display: flex; gap: 8px; margin-top: auto; }
  `]
})
export class MediaComponent implements OnInit {
  media: any[] = [];
  selectedFile: File | null = null;
  uploadCaption = '';
  isUploading = false;
  isDragOver = false;

  constructor(private api: ApiService, private telegram: TelegramService) {}

  ngOnInit(): void {
    this.loadMedia();
  }

  loadMedia(): void {
    this.api.getMedia(1, 50).subscribe(d => this.media = d.media || []);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) this.selectedFile = file;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files.length) {
      this.selectedFile = event.dataTransfer.files[0];
    }
  }

  upload(): void {
    if (!this.selectedFile) return;
    this.isUploading = true;
    
    this.api.uploadMedia(this.selectedFile, this.uploadCaption).subscribe({
      next: () => {
        this.isUploading = false;
        this.selectedFile = null;
        this.uploadCaption = '';
        this.loadMedia();
        this.telegram.hapticFeedback('success');
      },
      error: (err) => {
        this.isUploading = false;
        this.telegram.showAlert('Upload failed: ' + (err.error?.error || 'Unknown error'));
      }
    });
  }

  copyFileId(id: string): void {
    navigator.clipboard.writeText(id).then(() => {
      this.telegram.hapticFeedback('success');
    });
  }

  deleteMedia(m: any): void {
    if (confirm(`Delete ${m.fileName}?`)) {
      this.api.deleteMedia(m.id).subscribe(() => this.loadMedia());
    }
  }
}
