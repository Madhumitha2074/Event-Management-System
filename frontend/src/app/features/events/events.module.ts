import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { EventListComponent } from './event-list/event-list.component';
import { EventDetailComponent } from './event-detail/event-detail.component';
import { SeatMapComponent } from './seat-map/seat-map.component';  // Import SeatMapComponent

const routes: Routes = [
  { path: '', component: EventListComponent },
  { path: ':id', component: EventDetailComponent }
];

@NgModule({
  declarations: [
    EventListComponent, 
    EventDetailComponent,
    SeatMapComponent  // Add SeatMapComponent here
  ],
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule.forChild(routes)],
  exports: [SeatMapComponent]  // Export if needed in other modules
})
export class EventsModule {}