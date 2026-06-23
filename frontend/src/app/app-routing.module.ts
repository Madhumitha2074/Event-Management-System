import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'events', pathMatch: 'full' },
  {
    path: 'events',
    loadChildren: () => import('./features/events/events.module').then(m => m.EventsModule)
    // ✅ NO AuthGuard on events route - it should be public
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'bookings',
    loadChildren: () => import('./features/bookings/bookings.module').then(m => m.BookingsModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'organizer',
    loadChildren: () => import('./features/organizer/organizer.module').then(m => m.OrganizerModule),
    canActivate: [AuthGuard],
    data: { roles: ['Organizer', 'Admin'] }
  },
  // ✅ Seat Selection Route
  {
    path: 'seat-selection',
    loadChildren: () => import('./features/seat-selection/seat-selection.module').then(m => m.SeatSelectionModule)
  },
  // ✅ Wildcard route - redirect to home
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }