import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';


@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/auth/login']);
      return false;
    }
    const roles: string[] = route.data['roles'] ?? [];
    if (roles.length && !roles.includes(this.authService.currentUser?.role ?? '')) {
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}
