// src/app/core/services/notification.service.ts
import { Injectable } from '@angular/core';

export interface NotificationOptions {
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private defaultDuration = 5000;

  showSuccess(message: string, options?: NotificationOptions): void {
    this.show(message, 'success', options);
  }

  showError(message: string, options?: NotificationOptions): void {
    this.show(message, 'error', options);
  }

  showWarning(message: string, options?: NotificationOptions): void {
    this.show(message, 'warning', options);
  }

  showInfo(message: string, options?: NotificationOptions): void {
    this.show(message, 'info', options);
  }

  private show(message: string, type: string, options?: NotificationOptions): void {
    // For now, use console and alert
    console.log(`[${type.toUpperCase()}]:`, message);
    
    // You can replace this with a proper toast notification system
    // For example, using Angular Material Snackbar or ngx-toastr
    
    // Temporary solution - show in console only
    // Remove alert in production
    if (type === 'error') {
      alert(`Error: ${message}`);
    }
  }
}