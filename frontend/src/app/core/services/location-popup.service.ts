import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LocationPopupService {
  private showPopupSubject = new BehaviorSubject<boolean>(false);
  showPopup$ = this.showPopupSubject.asObservable();

  show(): void {
    this.showPopupSubject.next(true);
  }

  hide(): void {
    this.showPopupSubject.next(false);
  }
}