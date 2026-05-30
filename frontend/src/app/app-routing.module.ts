import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'events', pathMatch: 'full' },
  {
    path: 'events',
    loadChildren: () => import('./features/events/events.module').then(m => m.EventsModule)
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
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
