import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { OrganizerDashboardComponent } from './organizer-dashboard/organizer-dashboard.component';
import { EventFormComponent } from './event-form/event-form.component';
import { AttendeesComponent } from './attendees/attendees.component';

const routes: Routes = [
  { path: '', component: OrganizerDashboardComponent },
  { path: 'events/new', component: EventFormComponent },
  { path: 'events/:id/edit', component: EventFormComponent },
  { path: 'events/:id/attendees', component: AttendeesComponent }
];

@NgModule({
  declarations: [OrganizerDashboardComponent, EventFormComponent, AttendeesComponent],
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule.forChild(routes)]
})
export class OrganizerModule {}
