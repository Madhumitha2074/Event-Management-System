import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ConfirmationOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  cancelButtonClass?: string;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private confirmationSubject = new Subject<ConfirmationOptions>();
  private responseSubject = new Subject<boolean>();

  confirmation$: Observable<ConfirmationOptions> = this.confirmationSubject.asObservable();

  confirm(options: ConfirmationOptions): Observable<boolean> {
    console.log('🔔 ConfirmationService.confirm() called:', options);
    this.confirmationSubject.next(options);
    return this.responseSubject.asObservable();
  }

  confirmAction(): void {
    console.log('✅ User confirmed');
    this.responseSubject.next(true);
    this.responseSubject = new Subject<boolean>();
  }

  cancelAction(): void {
    console.log('❌ User cancelled');
    this.responseSubject.next(false);
    this.responseSubject = new Subject<boolean>();
  }
}