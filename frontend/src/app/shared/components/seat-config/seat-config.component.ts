import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-seat-config',
  templateUrl: './seat-config.component.html',
  styleUrls: ['./seat-config.component.css']
})
export class SeatConfigComponent implements OnInit, OnChanges {
  @Input() enabled = false;
  @Input() seatTiersArray!: FormArray;
  @Output() seatConfigChange = new EventEmitter<boolean>();
  @Output() tiersChanged = new EventEmitter<any[]>();

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    console.log('✅ SeatConfigComponent initialized');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['seatTiersArray']) {
      console.log('📋 seatTiersArray changed');
    }
  }

  toggleSeatConfig(event: any): void {
    const checked = event.target.checked;
    this.seatConfigChange.emit(checked);
  }

  addTier(existingTier?: any): void {
    if (!this.seatTiersArray) {
      console.error('❌ seatTiersArray is undefined!');
      return;
    }

    const tierForm = this.fb.group({
      tier: [existingTier?.tier || 'Ordinary', Validators.required],
      rows: [existingTier?.rows || 10, [Validators.required, Validators.min(1), Validators.max(50)]],
      seatsPerRow: [existingTier?.seatsPerRow || 10, [Validators.required, Validators.min(1), Validators.max(50)]],
      price: [existingTier?.price || 100, [Validators.required, Validators.min(0)]]
    });
    
    this.seatTiersArray.push(tierForm);
    this.tiersChanged.emit(this.seatTiersArray.value);
  }

  removeTier(index: number): void {
    if (!this.seatTiersArray) return;
    this.seatTiersArray.removeAt(index);
    this.tiersChanged.emit(this.seatTiersArray.value);
  }

  getTierSeatCount(index: number): number {
    if (!this.seatTiersArray || !this.seatTiersArray.at(index)) return 0;
    const tier = this.seatTiersArray.at(index);
    const rows = tier.get('rows')?.value || 0;
    const seatsPerRow = tier.get('seatsPerRow')?.value || 0;
    return rows * seatsPerRow;
  }

  getTotalSeats(): number {
    if (!this.seatTiersArray) return 0;
    let total = 0;
    for (let i = 0; i < this.seatTiersArray.length; i++) {
      total += this.getTierSeatCount(i);
    }
    return total;
  }

  getMinPrice(): number {
    if (!this.seatTiersArray || this.seatTiersArray.length === 0) return 0;
    let min = Infinity;
    for (let i = 0; i < this.seatTiersArray.length; i++) {
      const tier = this.seatTiersArray.at(i);
      const price = tier.get('price')?.value || 0;
      if (price < min) min = price;
    }
    return min === Infinity ? 0 : min;
  }

  getMaxPrice(): number {
    if (!this.seatTiersArray || this.seatTiersArray.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < this.seatTiersArray.length; i++) {
      const tier = this.seatTiersArray.at(i);
      const price = tier.get('price')?.value || 0;
      if (price > max) max = price;
    }
    return max;
  }
}