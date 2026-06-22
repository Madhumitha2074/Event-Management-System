import { Component, OnInit, OnDestroy } from '@angular/core';
import { ConfirmationService, ConfirmationOptions } from '../../../core/services/confirmation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirmation-dialog',
  template: `
    <div class="confirmation-overlay" *ngIf="show" (click)="onOverlayClick($event)">
      <div class="confirmation-dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <div class="dialog-icon" *ngIf="options?.icon">
            <i [class]="options?.icon || 'fas fa-exclamation-circle'"></i>
          </div>
          <h5 class="dialog-title">{{ options?.title || 'Confirm Action' }}</h5>
          <button class="btn-close" (click)="cancel()">&times;</button>
        </div>
        
        <div class="dialog-body">
          <p>{{ options?.message || 'Are you sure?' }}</p>
        </div>
        
        <div class="dialog-footer">
          <button class="btn btn-secondary" (click)="cancel()">
            {{ options?.cancelText || 'Cancel' }}
          </button>
          <button class="btn" [ngClass]="options?.confirmButtonClass || 'btn-danger'" (click)="confirm()">
            {{ options?.confirmText || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirmation-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .confirmation-dialog {
      background: white;
      border-radius: 20px;
      width: 90%;
      max-width: 450px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #eef2f6;
      background: #fafbfc;
    }

    .dialog-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #fff5f5;
      color: #dc3545;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .dialog-title {
      margin: 0;
      font-weight: 700;
      font-size: 1.1rem;
      color: #2d3748;
      flex: 1;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
      padding: 0 4px;
      line-height: 1;
    }

    .btn-close:hover {
      opacity: 1;
    }

    .dialog-body {
      padding: 24px;
    }

    .dialog-body p {
      margin: 0;
      font-size: 1rem;
      color: #4a5568;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #eef2f6;
      background: #fafbfc;
    }

    .btn {
      padding: 8px 24px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 0.85rem;
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
    }

    .btn-secondary:hover {
      background: #cbd5e0;
      transform: translateY(-1px);
    }

    .btn-danger {
      background: linear-gradient(135deg, #dc3545, #c82333);
      color: white;
    }

    .btn-danger:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
    }

    .btn-primary {
      background: linear-gradient(135deg, #6c5ce7, #5a4bd1);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(108, 92, 231, 0.4);
    }

    @media (max-width: 480px) {
      .confirmation-dialog {
        width: 95%;
        max-width: 100%;
        margin: 16px;
      }

      .dialog-header {
        padding: 16px 20px;
      }

      .dialog-body {
        padding: 20px;
      }

      .dialog-footer {
        padding: 12px 20px;
        flex-direction: column-reverse;
      }

      .btn {
        padding: 10px;
        width: 100%;
      }
    }
  `]
})
export class ConfirmationDialogComponent implements OnInit, OnDestroy {
  show = false;
  options: ConfirmationOptions | null = null;
  private subscription: Subscription | null = null;

  constructor(private confirmationService: ConfirmationService) {
    console.log('✅ ConfirmationDialogComponent constructor called');
  }

  ngOnInit(): void {
    console.log('✅ ConfirmationDialogComponent ngOnInit - subscribing');
    this.subscription = this.confirmationService.confirmation$.subscribe((options) => {
      console.log('📢 Dialog received event:', options);
      this.options = options;
      this.show = true;
    });
  }

  confirm(): void {
    console.log('🟢 Confirm clicked');
    this.show = false;
    this.confirmationService.confirmAction();
  }

  cancel(): void {
    console.log('🔴 Cancel clicked');
    this.show = false;
    this.confirmationService.cancelAction();
  }

  onOverlayClick(event: MouseEvent): void {
    console.log('🔄 Overlay clicked');
    this.cancel();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}