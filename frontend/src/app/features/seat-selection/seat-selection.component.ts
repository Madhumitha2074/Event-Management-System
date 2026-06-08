// frontend/src/app/features/seat-selection/seat-selection.component.ts

import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-seat-selection',
  template: `
    <div class="event-container">
      <div class="header">
        <div class="logo-area">
          <h1>🎬 EventBook</h1>
        </div>
        <div class="nav-links">
          <a routerLink="/events">Events</a>
          <a routerLink="/bookings">My Bookings</a>
        </div>
      </div>

      <div class="main-grid">
        <!-- LEFT: SEAT MAP -->
        <div class="left-col">
          <div class="seat-map-container">
            <div class="screen-wrapper">
              <div class="screen">🎦 SCREEN / STAGE</div>
            </div>

            <div class="seat-legend">
              <div class="legend-item"><div class="seat-demo available"></div><span>Available</span></div>
              <div class="legend-item"><div class="seat-demo selected"></div><span>Selected</span></div>
              <div class="legend-item"><div class="seat-demo booked"></div><span>Booked</span></div>
            </div>

            <div class="seat-grid">
              <div *ngFor="let row of rows" class="seat-row">
                <div class="row-label">{{ row }}</div>
                <div *ngFor="let seatNum of seatNumbers" class="seat-wrapper">
                  <div class="seat" 
                       [class.available]="!isSeatBooked(row + seatNum) && !isSeatSelected(row + seatNum)"
                       [class.selected]="isSeatSelected(row + seatNum)"
                       [class.booked]="isSeatBooked(row + seatNum)"
                       (click)="toggleSeat(row + seatNum)">
                    {{ seatNum }}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="seat-info">
              <span>🪑 {{ selectedCount }} seats selected</span>
              <span>💺 Max {{ maxSelection }} seats per booking</span>
              <span>✨ Click to select/deselect</span>
            </div>
          </div>
        </div>

        <!-- RIGHT: BOOKING DETAILS -->
        <div class="right-col">
          <div class="booking-sidebar">
            <h3>🎟️ AI Awareness Session</h3>
            <p class="event-meta">Madhu · Velammal Bodhi Campus</p>
            <div class="price-summary">₹{{ pricePerSeat }} <span class="per-seat">per seat</span></div>
            
            <div><strong>Selected Seats</strong></div>
            <div class="selected-seats-list">
              <div *ngIf="selectedCount === 0">— None —</div>
              <div *ngFor="let seat of getSelectedSeatsArray()" class="seat-tag">
                {{ seat }}
                <span class="remove-seat" (click)="removeSeat(seat)">✕</span>
              </div>
            </div>
            
            <div><strong>Total Amount</strong></div>
            <div class="total-amount">₹{{ totalAmount }}</div>

            <div *ngIf="selectedCount > 0" class="attendee-section">
              <div class="attendee-title">📝 Attendee Details</div>
              
              <div *ngFor="let attendee of getAttendeeFormsArray(); let i = index" class="attendee-card">
                <div class="seat-badge">{{ attendee.seat }}</div>
                <div class="form-group">
                  <label>Full Name</label>
                  <input type="text" [(ngModel)]="attendee.name" name="name_{{i}}" class="form-control" required>
                </div>
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" [(ngModel)]="attendee.email" name="email_{{i}}" class="form-control" required>
                </div>
              </div>
              
              <button type="button" class="btn-pay" (click)="onSubmit(getAttendeeFormsArray())">
                Proceed to Pay 💳
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .event-container {
      max-width: 1300px;
      margin: 0 auto;
      background: white;
      border-radius: 2.5rem;
      box-shadow: 0 25px 45px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }

    .header {
      padding: 1.5rem 2rem;
      background: #ffffff;
      border-bottom: 1px solid #eef2f6;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: 1rem;
    }

    .logo-area h1 {
      font-size: 1.8rem;
      font-weight: 700;
      background: linear-gradient(135deg, #1e2f3f, #2c4c6c);
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      margin: 0;
    }

    .nav-links {
      display: flex;
      gap: 2rem;
      font-weight: 500;
    }

    .nav-links a {
      text-decoration: none;
      color: #3a5a78;
      font-size: 1rem;
      transition: 0.2s;
      padding-bottom: 4px;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }

    .nav-links a:hover {
      color: #1f6392;
    }

    .main-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      padding: 2rem;
    }

    .left-col {
      flex: 2.5;
      min-width: 300px;
    }

    .right-col {
      flex: 1.2;
      min-width: 260px;
    }

    .seat-map-container {
      background: #1a1a2e;
      border-radius: 1.5rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .screen-wrapper {
      text-align: center;
      margin-bottom: 2rem;
    }

    .screen {
      background: linear-gradient(180deg, #2d2d44 0%, #1a1a2e 100%);
      color: #aaa;
      padding: 0.75rem;
      border-radius: 0.75rem;
      font-size: 0.85rem;
      font-weight: 500;
      letter-spacing: 2px;
      width: 80%;
      margin: 0 auto;
      border: 1px solid #3a3a55;
    }

    .seat-legend {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #ccc;
    }

    .seat-demo {
      width: 28px;
      height: 28px;
      border-radius: 8px 8px 12px 12px;
    }

    .seat-demo.available {
      background: #3b82f6;
      border: 1px solid #60a5fa;
    }

    .seat-demo.selected {
      background: #10b981;
      border: 1px solid #34d399;
    }

    .seat-demo.booked {
      background: #5a5a70;
      border: 1px solid #6b6b89;
    }

    .seat-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      overflow-x: auto;
    }

    .seat-row {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      flex-wrap: nowrap;
      align-items: center;
    }

    .row-label {
      width: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: #aaa;
      font-size: 0.8rem;
    }

    .seat {
      width: 38px;
      height: 38px;
      border-radius: 10px 10px 14px 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .seat.available {
      background: #3b82f6;
      color: white;
      cursor: pointer;
    }

    .seat.available:hover {
      transform: scale(1.05);
      background: #2563eb;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
    }

    .seat.selected {
      background: #10b981;
      color: white;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.5);
    }

    .seat.booked {
      background: #5a5a70;
      color: #aaa;
      cursor: not-allowed;
      text-decoration: line-through;
    }

    .seat-info {
      background: #f8fafd;
      border-radius: 1rem;
      padding: 1rem;
      margin-top: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }

    .booking-sidebar {
      background: #f8fafd;
      border-radius: 1.5rem;
      padding: 1.5rem;
      position: sticky;
      top: 1rem;
    }

    .event-meta {
      font-size: 0.8rem;
      color: #4a627a;
      margin-bottom: 1rem;
    }

    .price-summary {
      font-size: 1.5rem;
      font-weight: 700;
      color: #126e46;
      margin: 1rem 0;
    }

    .per-seat {
      font-size: 0.9rem;
      font-weight: 400;
    }

    .selected-seats-list {
      min-height: 60px;
      margin: 1rem 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .seat-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #10b981;
      color: white;
      padding: 0.3rem 0.7rem;
      border-radius: 20px;
      font-size: 0.8rem;
    }

    .remove-seat {
      cursor: pointer;
      font-weight: bold;
      opacity: 0.8;
    }

    .remove-seat:hover {
      opacity: 1;
    }

    .total-amount {
      font-size: 1.8rem;
      font-weight: 800;
      color: #1e2f3f;
      margin: 0.5rem 0 1rem;
    }

    .attendee-section {
      margin-top: 1rem;
      border-top: 1px solid #dce5ec;
      padding-top: 1rem;
    }

    .attendee-title {
      font-weight: 600;
      margin-bottom: 0.8rem;
    }

    .attendee-card {
      background: white;
      border-radius: 1rem;
      padding: 0.8rem;
      margin-bottom: 0.8rem;
      border: 1px solid #e2edf2;
    }

    .seat-badge {
      display: inline-block;
      background: #1f6392;
      color: white;
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      font-size: 0.7rem;
      margin-bottom: 0.5rem;
    }

    .form-group {
      margin-bottom: 0.6rem;
    }

    .form-group label {
      display: block;
      font-size: 0.7rem;
      font-weight: 500;
      color: #5b7f9b;
      margin-bottom: 0.2rem;
    }

    .form-control {
      width: 100%;
      padding: 0.5rem 0.8rem;
      border-radius: 2rem;
      border: 1px solid #cbd5e1;
      font-size: 0.85rem;
    }

    .form-control:focus {
      outline: none;
      border-color: #1f6392;
    }

    .btn-pay {
      width: 100%;
      background: #f84464;
      color: white;
      border: none;
      padding: 0.8rem;
      border-radius: 3rem;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: 0.2s;
      margin-top: 0.5rem;
    }

    .btn-pay:hover {
      background: #e02e4e;
      transform: scale(0.98);
    }

    @media (max-width: 800px) {
      .seat {
        width: 30px;
        height: 30px;
        font-size: 0.6rem;
      }
      .row-label {
        width: 30px;
      }
      .main-grid {
        padding: 1rem;
      }
    }
  `]
})
export class SeatSelectionComponent implements OnInit {
  // Configuration
  rows: string[] = ['A', 'B', 'C', 'D', 'E', 'F'];
  seatNumbers: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  pricePerSeat: number = 100;
  maxSelection: number = 6;
  
  // Data
  bookedSeats: Set<string> = new Set();
  selectedSeats: Set<string> = new Set();
  
  // UI helpers
  selectedCount: number = 0;
  totalAmount: number = 0;

  ngOnInit(): void {
    // Pre-booked seats (simulating database)
    const preBooked = ['A3', 'A4', 'B5', 'B6', 'C2', 'C3', 'D7', 'D8', 'E9', 'F1', 'F2'];
    preBooked.forEach(seat => this.bookedSeats.add(seat));
    
    this.updateUI();
  }

  isSeatBooked(seatId: string): boolean {
    return this.bookedSeats.has(seatId);
  }

  isSeatSelected(seatId: string): boolean {
    return this.selectedSeats.has(seatId);
  }

  toggleSeat(seatId: string): void {
    if (this.isSeatBooked(seatId)) return;
    
    if (this.isSeatSelected(seatId)) {
      this.selectedSeats.delete(seatId);
    } else {
      if (this.selectedSeats.size >= this.maxSelection) {
        alert(`⚠️ You can select only ${this.maxSelection} seats per booking.`);
        return;
      }
      this.selectedSeats.add(seatId);
    }
    
    this.updateUI();
  }

  updateUI(): void {
    this.selectedCount = this.selectedSeats.size;
    this.totalAmount = this.selectedCount * this.pricePerSeat;
  }

  getSelectedSeatsArray(): string[] {
    return Array.from(this.selectedSeats).sort();
  }

  removeSeat(seatId: string): void {
    if (this.selectedSeats.has(seatId)) {
      this.selectedSeats.delete(seatId);
      this.updateUI();
    }
  }

  getAttendeeFormsArray(): { seat: string; name: string; email: string }[] {
    return this.getSelectedSeatsArray().map(seat => ({
      seat: seat,
      name: '',
      email: ''
    }));
  }

  onSubmit(attendeeData: any[]): void {
    // Validate all attendees
    for (let i = 0; i < attendeeData.length; i++) {
      if (!attendeeData[i].name) {
        alert(`Please enter name for seat ${attendeeData[i].seat}`);
        return;
      }
      if (!attendeeData[i].email || !attendeeData[i].email.includes('@')) {
        alert(`Please enter valid email for seat ${attendeeData[i].seat}`);
        return;
      }
    }
    
    // Confirm booking
    const seats = this.getSelectedSeatsArray();
    const total = this.totalAmount;
    
    alert(`🎉 Booking Confirmed!\n━━━━━━━━━━━━━━━━\n🎬 AI Awareness Session\n📍 Velammal Bodhi Campus\n📅 Jun 9, 2026 · 5:21 PM\n\n🎫 Seats: ${seats.join(', ')}\n💰 Total: ₹${total}\n\n📧 Tickets sent to all emails.`);
    
    // Mark as booked and clear selection
    seats.forEach(seat => {
      this.bookedSeats.add(seat);
      this.selectedSeats.delete(seat);
    });
    
    this.updateUI();
  }
}