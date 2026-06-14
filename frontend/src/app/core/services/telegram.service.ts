import { Injectable } from '@angular/core';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
          };
          auth_date: number;
          hash: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          isVisible: boolean;
          isActive: boolean;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          isVisible: boolean;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme: 'light' | 'dark';
        viewportHeight: number;
        viewportStableHeight: number;
        isExpanded: boolean;
        platform: string;
        version: string;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

/**
 * Service that wraps the Telegram Web App SDK.
 * Provides typed access to initData, user info, theme, and UI controls.
 */
@Injectable({ providedIn: 'root' })
export class TelegramService {
  private webApp = window.Telegram?.WebApp;

  get isAvailable(): boolean {
    return !!this.webApp;
  }

  get initData(): string {
    return this.webApp?.initData || '';
  }

  get user() {
    // Return hardcoded user for local testing when not in Telegram Web App
    return this.webApp?.initDataUnsafe?.user || { 
      id: 8536522745, 
      first_name: 'Local', 
      last_name: 'Tester' 
    };
  }

  get colorScheme(): 'light' | 'dark' {
    return this.webApp?.colorScheme || 'dark';
  }

  get platform(): string {
    return this.webApp?.platform || 'unknown';
  }

  initialize(): void {
    if (this.webApp) {
      this.webApp.ready();
      this.webApp.expand();
      this.webApp.setHeaderColor('#1a1a2e');
      this.webApp.setBackgroundColor('#1a1a2e');
    }
  }

  hapticFeedback(type: 'success' | 'error' | 'warning'): void {
    this.webApp?.HapticFeedback?.notificationOccurred(type);
  }

  hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    this.webApp?.HapticFeedback?.impactOccurred(style);
  }

  showAlert(message: string): void {
    if (this.webApp) {
      this.webApp.showAlert(message);
    } else {
      alert(message);
    }
  }

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.webApp) {
        this.webApp.showConfirm(message, (confirmed) => resolve(!!confirmed));
      } else {
        resolve(confirm(message));
      }
    });
  }

  showBackButton(callback: () => void): void {
    if (this.webApp) {
      this.webApp.BackButton.show();
      this.webApp.BackButton.onClick(callback);
    }
  }

  hideBackButton(): void {
    this.webApp?.BackButton?.hide();
  }
}
