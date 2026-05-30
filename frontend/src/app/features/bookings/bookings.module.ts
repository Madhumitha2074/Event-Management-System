import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { BookingListComponent } from './booking-list/booking-list.component';
import { BookingDetailComponent } from './booking-detail/booking-detail.component';

const routes: Routes = [
  { path: '', component: BookingListComponent },
  { path: ':id', component: BookingDetailComponent }
];

@NgModule({
  declarations: [BookingListComponent, BookingDetailComponent],
  imports: [CommonModule, RouterModule.forChild(routes)]
})
export class BookingsModule {}
