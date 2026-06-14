import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade">
      <div class="page-header">
        <div>
          <h1 class="page-title">Categories</h1>
          <p class="page-subtitle">Organize your users and groups into targetable segments</p>
        </div>
      </div>

      <div class="grid-2">
        <!-- Add Category Form -->
        <div class="card" style="height: fit-content;">
          <div class="card-header">
            <h3 class="card-title">Create Category</h3>
          </div>
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Category Name</label>
            <input class="form-input" [(ngModel)]="newCategory.name" placeholder="e.g., VIP Customers">
          </div>
          <div class="form-group" style="margin-bottom: 24px;">
            <label class="form-label">Badge Color (Optional)</label>
            <div style="display: flex; gap: 12px; align-items: center;">
              <input type="color" class="form-input" [(ngModel)]="newCategory.color" style="width: 60px; height: 40px; padding: 4px;">
              <span class="badge badge-neutral" [style.border-color]="newCategory.color" [style.color]="newCategory.color">
                Preview: {{ newCategory.name || 'Category' }}
              </span>
            </div>
          </div>
          <button class="btn btn-primary" style="width: 100%" (click)="createCategory()" [disabled]="!newCategory.name">
            Create Category
          </button>
        </div>

        <!-- Categories List -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Existing Categories</h3>
          </div>
          
          <div *ngIf="categories.length === 0" class="empty-state" style="padding: 20px;">
            <div class="empty-icon">🏷️</div>
            <h3>No categories yet</h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div *ngFor="let cat of categories" class="category-item">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="color-dot" [style.background-color]="cat.color || 'var(--text-muted)'"></div>
                <div>
                  <div style="font-weight: 600;">{{ cat.name }}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    {{ cat.userCount }} users • {{ cat.groupCount }} groups
                  </div>
                </div>
              </div>
              <button class="btn btn-danger btn-icon" (click)="deleteCategory(cat)">🗑</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .category-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: border-color var(--transition-fast);
    }
    .category-item:hover {
      border-color: var(--accent-primary);
    }
    .color-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
    }
  `]
})
export class CategoriesComponent implements OnInit {
  categories: any[] = [];
  newCategory = { name: '', color: '#6c63ff' };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.api.getCategories().subscribe(d => this.categories = d.categories || []);
  }

  createCategory(): void {
    if (!this.newCategory.name) return;
    this.api.createCategory(this.newCategory.name, this.newCategory.color).subscribe(() => {
      this.newCategory = { name: '', color: '#6c63ff' };
      this.loadCategories();
    });
  }

  deleteCategory(cat: any): void {
    if (confirm(`Delete category "${cat.name}"? This will remove it from all users and groups.`)) {
      this.api.deleteCategory(cat.id).subscribe(() => this.loadCategories());
    }
  }
}
