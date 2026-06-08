// src/app/features/events/seat-map/seat-map.component.ts
// ============================================================
// STANDALONE seat map — used inside event-detail component
// ============================================================

import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, ChangeDetectionStrategy
} from '@angular/core';
import {
  EventSeat, SeatSection, SeatRow, SeatTier, SEAT_TIER_COLORS
} from '../../../core/models/models';

export interface SeatSelection {
  seat: EventSeat;
  selected: boolean;
}

@Component({
  selector: 'app-seat-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seat-map-wrap">

      <!-- Legend -->
      <div class="seat-legend">
        <div class="legend-item">
          <span class="legend-dot available"></span> Available
        </div>
        <div class="legend-item">
          <span class="legend-dot booked"></span> Booked
        </div>
        <div class="legend-item">
          <span class="legend-dot selected"></span> Selected
        </div>
        <div class="legend-item" *ngFor="let tier of tierOrder">
          <span class="legend-dot tier-dot"
                [style.background]="tierColors[tier].bg"
                [style.border-color]="tierColors[tier].border"></span>
          {{ tier }} — ₹{{ tierPrice(tier) }}
        </div>
      </div>

      <!-- Stage -->
      <div class="stage-bar">
        <span>🎭 STAGE / SCREEN</span>
      </div>

      <!-- Sections -->
      <div class="sections-wrap">
        <div class="seat-section" *ngFor="let section of sections">

          <div class="section-header"
               [style.background]="tierColors[section.tier].bg"
               [style.color]="tierColors[section.tier].text">
            <span class="section-title">{{ section.tier }}</span>
            <span class="section-price">₹{{ section.pricePerSeat }} / seat</span>
          </div>

          <div class="rows-wrap">
            <div class="seat-row" *ngFor="let row of section.rows">
              <span class="row-label">{{ row.rowLabel }}</span>

              <div class="seats-in-row">
                <button
                  *ngFor="let seat of row.seats"
                  class="seat-btn"
                  [class.seat-booked]="seat.isBooked"
                  [class.seat-selected]="isSelected(seat.id)"
                  [class.seat-available]="!seat.isBooked && !isSelected(seat.id)"
                  [disabled]="seat.isBooked"
                  [title]="seatTooltip(seat)"
                  (click)="toggleSeat(seat)"
                  [style.--tier-bg]="tierColors[section.tier].bg"
                  [style.--tier-border]="tierColors[section.tier].border">
                  {{ seatLabel(seat.seatNumber) }}
                </button>
              </div>

              <span class="row-label">{{ row.rowLabel }}</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Selection summary -->
      <div class="selection-summary" *ngIf="selectedSeats.length > 0">
        <div class="summary-chips">
          <span class="chip" *ngFor="let s of selectedSeats">
            {{ s.seatNumber }}
            <span class="chip-tier">({{ s.tier }})</span>
            <button class="chip-remove" (click)="toggleSeat(s)">✕</button>
          </span>
        </div>
        <div class="summary-total">
          <span>{{ selectedSeats.length }} seat(s) selected</span>
          <span class="total-price">Total: ₹{{ totalPrice | number:'1.2-2' }}</span>
        </div>
      </div>

      <div class="no-selection" *ngIf="selectedSeats.length === 0">
        Click seats above to select them
      </div>

    </div>
  `,
  styles: [`
    /* ── Wrap ──────────────────────────────────────────────── */
    .seat-map-wrap {
      font-family: 'Segoe UI', sans-serif;
      user-select: none;
    }

    /* ── Legend ─────────────────────────────────────────────── */
    .seat-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      padding: 10px 14px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #444;
      font-weight: 500;
    }
    .legend-dot {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 2px solid transparent;
      display: inline-block;
    }
    .legend-dot.available { background: #e9ecef; border-color: #adb5bd; }
    .legend-dot.booked    { background: #dc3545; border-color: #b02a37; }
    .legend-dot.selected  { background: #6c5ce7; border-color: #4a3ab5; }
    .legend-dot.tier-dot  { border-width: 2px; }

    /* ── Stage ───────────────────────────────────────────────── */
    .stage-bar {
      background: linear-gradient(90deg, #343a40, #495057);
      color: #f8f9fa;
      text-align: center;
      padding: 10px;
      border-radius: 8px 8px 0 0;
      font-size: 0.85rem;
      letter-spacing: 0.1em;
      font-weight: 600;
      margin-bottom: 0;
    }

    /* ── Sections ────────────────────────────────────────────── */
    .sections-wrap {
      border: 1px solid #dee2e6;
      border-top: none;
      border-radius: 0 0 8px 8px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .seat-section { border-top: 1px solid #dee2e6; }
    .seat-section:first-child { border-top: none; }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 16px;
      font-weight: 700;
      font-size: 0.82rem;
      letter-spacing: 0.06em;
    }
    .section-title { text-transform: uppercase; }
    .section-price { font-weight: 500; font-size: 0.8rem; opacity: 0.85; }

    /* ── Rows ────────────────────────────────────────────────── */
    .rows-wrap { padding: 12px 8px; background: #fff; }
    .seat-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .row-label {
      width: 22px;
      text-align: center;
      font-size: 0.7rem;
      font-weight: 700;
      color: #6c757d;
    }
    .seats-in-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px;
    }

    /* ── Seat button ─────────────────────────────────────────── */
    .seat-btn {
      width: 28px;
      height: 28px;
      border-radius: 5px;
      border: 2px solid #adb5bd;
      background: #e9ecef;
      font-size: 0.58rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
      color: #495057;
      line-height: 1;
    }
    .seat-btn:hover:not(:disabled) {
      transform: scale(1.15);
      border-color: var(--tier-border, #6c5ce7);
      background: var(--tier-bg, #e9ecef);
      z-index: 1;
    }
    .seat-btn.seat-booked {
      background: #dc3545 !important;
      border-color: #b02a37 !important;
      color: #fff !important;
      cursor: not-allowed;
      opacity: 0.7;
    }
    .seat-btn.seat-selected {
      background: #6c5ce7 !important;
      border-color: #4a3ab5 !important;
      color: #fff !important;
      transform: scale(1.1);
      box-shadow: 0 0 0 3px rgba(108,92,231,0.25);
    }
    .seat-btn:disabled { pointer-events: none; }

    /* ── Summary ─────────────────────────────────────────────── */
    .selection-summary {
      background: #f0eeff;
      border: 1px solid #d0c6ff;
      border-radius: 10px;
      padding: 12px 16px;
    }
    .summary-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #6c5ce7;
      color: #fff;
      border-radius: 20px;
      padding: 3px 10px 3px 12px;
      font-size: 0.78rem;
      font-weight: 600;
    }
    .chip-tier { opacity: 0.7; font-weight: 400; }
    .chip-remove {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 0 2px;
      font-size: 0.8rem;
      opacity: 0.7;
      line-height: 1;
    }
    .chip-remove:hover { opacity: 1; }
    .summary-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.88rem;
      color: #444;
      font-weight: 500;
    }
    .total-price {
      font-size: 1.1rem;
      font-weight: 800;
      color: #6c5ce7;
    }
    .no-selection {
      text-align: center;
      padding: 12px;
      color: #adb5bd;
      font-size: 0.85rem;
      font-style: italic;
    }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 480px) {
      .seat-btn { width: 22px; height: 22px; font-size: 0.5rem; }
      .seats-in-row { gap: 3px; }
    }
  `]
})
export class SeatMapComponent implements OnChanges {

  @Input() seats: EventSeat[] = [];
  @Input() maxSelectable = 10;

  @Output() selectionChange = new EventEmitter<EventSeat[]>();

  sections: SeatSection[]     = [];
  selectedIds  = new Set<number>();
  selectedSeats: EventSeat[]  = [];
  tierOrder: SeatTier[]       = ['Premium', 'Ordinary', 'Economy'];
  tierColors                  = SEAT_TIER_COLORS;

  get totalPrice(): number {
    return this.selectedSeats.reduce((sum, s) => sum + s.price, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['seats']) {
      this.buildSections();
      // Clear selection when seats reload
      this.selectedIds.clear();
      this.selectedSeats = [];
    }
  }

  buildSections(): void {
    const map = new Map<SeatTier, Map<string, EventSeat[]>>();

    for (const seat of this.seats) {
      const tier = seat.tier as SeatTier;
      if (!map.has(tier)) map.set(tier, new Map());

      // Extract row label from seatNumber e.g. "P-A3" → "A"
      const rowLabel = seat.seatNumber.split('-')[1]?.replace(/\d+/g, '') ?? '?';
      const rowMap = map.get(tier)!;
      if (!rowMap.has(rowLabel)) rowMap.set(rowLabel, []);
      rowMap.get(rowLabel)!.push(seat);
    }

    this.sections = this.tierOrder
      .filter(tier => map.has(tier))
      .map(tier => {
        const rowMap = map.get(tier)!;
        const rows: SeatRow[] = Array.from(rowMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([rowLabel, seats]) => ({
            rowLabel,
            tier,
            seats: seats.sort((a, b) => {
              const aNum = parseInt(a.seatNumber.replace(/\D/g, ''), 10);
              const bNum = parseInt(b.seatNumber.replace(/\D/g, ''), 10);
              return aNum - bNum;
            })
          }));

        const pricePerSeat = rows[0]?.seats[0]?.price ?? 0;
        return { tier, rows, pricePerSeat };
      });
  }

  toggleSeat(seat: EventSeat): void {
    if (seat.isBooked) return;

    if (this.selectedIds.has(seat.id)) {
      this.selectedIds.delete(seat.id);
      this.selectedSeats = this.selectedSeats.filter(s => s.id !== seat.id);
    } else {
      if (this.selectedSeats.length >= this.maxSelectable) {
        return; // silently cap at max
      }
      this.selectedIds.add(seat.id);
      this.selectedSeats = [...this.selectedSeats, seat];
    }

    this.selectionChange.emit([...this.selectedSeats]);
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  seatLabel(seatNumber: string): string {
    // "P-A3" → "A3"
    return seatNumber.split('-')[1] ?? seatNumber;
  }

  seatTooltip(seat: EventSeat): string {
    if (seat.isBooked) return `${seat.seatNumber} — Booked`;
    return `${seat.seatNumber} | ${seat.tier} | ₹${seat.price}`;
  }

  tierPrice(tier: SeatTier): number {
    const section = this.sections.find(s => s.tier === tier);
    return section?.pricePerSeat ?? 0;
  }
}