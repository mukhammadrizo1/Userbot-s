import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TelegramService } from './telegram.service';

/**
 * Core API Service
 *
 * Handles all HTTP communication with the backend.
 * Automatically attaches the Telegram initData header for authentication.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private telegram: TelegramService
  ) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    if (this.telegram.initData) {
      headers = headers.set('x-telegram-init-data', this.telegram.initData);
    } else {
      // Dev bypass
      headers = headers.set('x-dev-bypass', 'true');
    }

    return headers;
  }

  private getUploadHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    if (this.telegram.initData) {
      headers = headers.set('x-telegram-init-data', this.telegram.initData);
    } else {
      headers = headers.set('x-dev-bypass', 'true');
    }
    return headers;
  }

  // ─── DASHBOARD ──────────────────────────────────
  getDashboard(): Observable<any> {
    return this.http.get(`${this.baseUrl}/dashboard`, { headers: this.getHeaders() });
  }

  // ─── ACCOUNTS ───────────────────────────────────
  getAccounts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/accounts`, { headers: this.getHeaders() });
  }

  getAccount(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/accounts/${id}`, { headers: this.getHeaders() });
  }

  addAccount(phone: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/accounts/add`, { phone }, { headers: this.getHeaders() });
  }

  verifyAccount(id: string, code: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/accounts/${id}/verify`, { code }, { headers: this.getHeaders() });
  }

  submit2FA(id: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/accounts/${id}/2fa`, { password }, { headers: this.getHeaders() });
  }

  connectAccount(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/accounts/${id}/connect`, {}, { headers: this.getHeaders() });
  }

  disconnectAccount(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/accounts/${id}/disconnect`, {}, { headers: this.getHeaders() });
  }

  removeAccount(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/accounts/${id}`, { headers: this.getHeaders() });
  }

  getAccountDialogs(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/accounts/${id}/dialogs`, { headers: this.getHeaders() });
  }

  // ─── USERS ──────────────────────────────────────
  getUsers(page = 1, limit = 20, search = '', categoryId = ''): Observable<any> {
    let url = `${this.baseUrl}/users?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId) url += `&categoryId=${categoryId}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getUser(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/${id}`, { headers: this.getHeaders() });
  }

  getUserFull(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/${id}/full`, { headers: this.getHeaders() });
  }

  addUser(input: string, accountId?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/add`, { input, accountId }, { headers: this.getHeaders() });
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${id}`, { headers: this.getHeaders() });
  }

  updateUserNotes(id: string, notes: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/users/${id}/notes`, { notes }, { headers: this.getHeaders() });
  }

  // ─── GROUPS ─────────────────────────────────────
  getGroups(page = 1, limit = 20, search = '', categoryId = ''): Observable<any> {
    let url = `${this.baseUrl}/groups?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId) url += `&categoryId=${categoryId}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  getGroup(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/groups/${id}`, { headers: this.getHeaders() });
  }

  getGroupFull(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/groups/${id}/full`, { headers: this.getHeaders() });
  }

  addGroup(input: string, accountId?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/groups/add`, { input, accountId }, { headers: this.getHeaders() });
  }

  deleteGroup(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/groups/${id}`, { headers: this.getHeaders() });
  }

  getGroupMembers(id: string, page = 1): Observable<any> {
    return this.http.get(`${this.baseUrl}/groups/${id}/members?page=${page}`, { headers: this.getHeaders() });
  }

  scrapeGroup(id: string, accountId?: string, limit = 200): Observable<any> {
    return this.http.post(`${this.baseUrl}/groups/${id}/scrape`, { accountId, limit }, { headers: this.getHeaders() });
  }

  toggleGroupMonitor(id: string, isMonitored: boolean): Observable<any> {
    return this.http.patch(`${this.baseUrl}/groups/${id}/monitor`, { isMonitored }, { headers: this.getHeaders() });
  }

  // ─── CATEGORIES ─────────────────────────────────
  getCategories(): Observable<any> {
    return this.http.get(`${this.baseUrl}/categories`, { headers: this.getHeaders() });
  }

  createCategory(name: string, color?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/categories`, { name, color }, { headers: this.getHeaders() });
  }

  updateCategory(id: string, data: { name?: string; color?: string }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/categories/${id}`, data, { headers: this.getHeaders() });
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/categories/${id}`, { headers: this.getHeaders() });
  }

  assignCategoryToUser(categoryId: string, userId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/categories/${categoryId}/assign/user`, { userId }, { headers: this.getHeaders() });
  }

  removeCategoryFromUser(categoryId: string, userId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/categories/${categoryId}/assign/user/${userId}`, { headers: this.getHeaders() });
  }

  assignCategoryToGroup(categoryId: string, groupId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/categories/${categoryId}/assign/group`, { groupId }, { headers: this.getHeaders() });
  }

  removeCategoryFromGroup(categoryId: string, groupId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/categories/${categoryId}/assign/group/${groupId}`, { headers: this.getHeaders() });
  }

  // ─── BROADCAST ──────────────────────────────────
  getBroadcasts(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${this.baseUrl}/broadcast?page=${page}&limit=${limit}`, { headers: this.getHeaders() });
  }

  getBroadcast(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/broadcast/${id}`, { headers: this.getHeaders() });
  }

  validateBroadcast(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/broadcast/validate`, data, { headers: this.getHeaders() });
  }

  createBroadcast(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/broadcast`, data, { headers: this.getHeaders() });
  }

  pauseBroadcast(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/broadcast/${id}/pause`, {}, { headers: this.getHeaders() });
  }

  resumeBroadcast(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/broadcast/${id}/resume`, {}, { headers: this.getHeaders() });
  }

  cancelBroadcast(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/broadcast/${id}/cancel`, {}, { headers: this.getHeaders() });
  }

  getBroadcastLogs(id: string, page = 1, status = ''): Observable<any> {
    let url = `${this.baseUrl}/broadcast/${id}/logs?page=${page}`;
    if (status) url += `&status=${status}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // ─── MEDIA ──────────────────────────────────────
  getMedia(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${this.baseUrl}/media?page=${page}&limit=${limit}`, { headers: this.getHeaders() });
  }

  uploadMedia(file: File, caption?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    return this.http.post(`${this.baseUrl}/media/upload`, formData, { headers: this.getUploadHeaders() });
  }

  getMediaUrl(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/media/${id}/url`, { headers: this.getHeaders() });
  }

  deleteMedia(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/media/${id}`, { headers: this.getHeaders() });
  }

  // ─── SPY MODULE ─────────────────────────────────
  getSpyTickets(): Observable<any> {
    return this.http.get(`${this.baseUrl}/spy/tickets`, { headers: this.getHeaders() });
  }

  createSpyTicket(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/spy/tickets`, data, { headers: this.getHeaders() });
  }

  updateSpyTicketStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/spy/tickets/${id}/status`, { status }, { headers: this.getHeaders() });
  }

  deleteSpyTicket(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/spy/tickets/${id}`, { headers: this.getHeaders() });
  }

  getCapturedLeads(ticketId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/spy/tickets/${ticketId}/leads`, { headers: this.getHeaders() });
  }

  deleteCapturedLead(leadId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/spy/leads/${leadId}`, { headers: this.getHeaders() });
  }

  // ─── SCRAPER ────────────────────────────────────
  startScraperJob(data: { targetGroups: any[]; limitPerGroup: number; accountId?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/scraper/start`, data, { headers: this.getHeaders() });
  }

  // ─── SEARCH & HISTORY ───────────────────────────
  searchMessages(query: any): Observable<any> {
    let params = new URLSearchParams();
    Object.keys(query).forEach(k => { if(query[k]) params.append(k, query[k]) });
    return this.http.get(`${this.baseUrl}/search?${params.toString()}`, { headers: this.getHeaders() });
  }

  getUserHistory(userId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/search/user-history/${userId}`, { headers: this.getHeaders() });
  }
}
