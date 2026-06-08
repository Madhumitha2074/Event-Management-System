// frontend/src/app/features/seat-selection/seat-selection.module.ts

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { SeatSelectionComponent } from './seat-selection.component';

const routes: Routes = [
  { path: '', component: SeatSelectionComponent }
];

@NgModule({
  declarations: [
    SeatSelectionComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class SeatSelectionModule { }