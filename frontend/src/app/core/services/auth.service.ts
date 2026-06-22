import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { 
  tap, 
  catchError, 
  map, 
  mergeMap,
  concatMap,
  switchMap,
  finalize,
  shareReplay,
  distinctUntilChanged,
  retry,
  timeout
} from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthResponse, User, RegisterRequest, LoginRequest } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<AuthResponse | null>(this.getStoredUser());
  currentUser$ = this.currentUserSubject.asObservable();
  
  private selectedCitySubject = new BehaviorSubject<string | null>(this.getStoredCity());
  selectedCity$ = this.selectedCitySubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * ✅ UPDATED: Register with mergeMap for sequential operations
   */
  register(data: any): Observable<AuthResponse> {
    const payload = {
      name: data.name?.trim(),
      email: data.email?.toLowerCase()?.trim(),
      phoneNumber: data.phoneNumber || '',
      password: data.password,
      role: typeof data.role === 'number' ? data.role : (data.role === 'user' ? 0 : 1),
      acceptTerms: true,
      phoneVerified: data.phoneVerified || false,
      acceptedTermsAt: new Date().toISOString()
    };
    
    console.log('Sending registration request to:', `${this.API}/register`);
    console.log('Registration payload:', payload);
    
    return this.http.post<AuthResponse>(`${this.API}/register`, payload).pipe(
      timeout(30000),
      retry(2),
      // ✅ Use mergeMap to handle response and side effects
      mergeMap(res => {
        this.storeUser(res);
        return [res];
      }),
      tap(res => {
        console.log('Registration response:', res);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Login with switchMap for cancellation
   */
  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, data).pipe(
      timeout(30000),
      retry(2),
      // ✅ Use switchMap to cancel previous login attempts
      switchMap(res => {
        this.storeUser(res);
        return [res];
      }),
      tap(res => console.log('Login successful for:', res.email)),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Social login with mergeMap
   */
  socialLogin(provider: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/social-login`, { provider }).pipe(
      timeout(30000),
      retry(2),
      mergeMap(res => {
        this.storeUser(res);
        return [res];
      }),
      tap(res => console.log(`Social login successful with ${provider}`)),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Check email availability with map
   */
  checkEmailAvailability(email: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.API}/check-email?email=${email}`).pipe(
      timeout(15000),
      retry(2),
      // ✅ Use map to transform response
      map(isAvailable => isAvailable),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Send OTP with timeout and retry
   */
  sendOTP(phoneNumber: string): Observable<any> {
    console.log('Sending OTP to:', phoneNumber);
    return this.http.post(`${this.API}/send-otp`, { phoneNumber }).pipe(
      timeout(30000),
      retry(2),
      tap(res => console.log('OTP send response:', res)),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Verify OTP with timeout and retry
   */
  verifyOTP(phoneNumber: string, otpCode: string): Observable<any> {
    console.log('Verifying OTP for:', phoneNumber);
    return this.http.post(`${this.API}/verify-otp`, { phoneNumber, otpCode }).pipe(
      timeout(30000),
      retry(2),
      tap(res => console.log('OTP verify response:', res)),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Get profile with mergeMap for data transformation
   */
  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.API}/profile`).pipe(
      timeout(30000),
      retry(2),
      mergeMap(user => {
        // Transform or enrich user data if needed
        return [user];
      }),
      tap(user => console.log('Profile loaded for:', user.email)),
      catchError(this.handleError)
    );
  }

  /**
   * ✅ UPDATED: Logout - now calls performLogout()
   */
  logout(): void {
    console.log('🔴 Logging out user...');
    this.performLogout();
  }

  /**
   * ✅ ENHANCED: Logout with confirmation
   * Returns an Observable that emits true when logout is completed
   * Can be used for complex flows where you need to wait for logout completion
   * 
   * @param confirmationService - The ConfirmationService instance
   * @returns Observable<boolean> - Emits true when logout is complete
   * 
   * Usage:
   * ```
   * authService.logoutWithConfirmation(this.confirmationService).subscribe({
   *   next: () => {
   *     console.log('Logout completed, redirecting...');
   *     this.router.navigate(['/']);
   *   },
   *   error: (err) => console.error('Logout error:', err)
   * });
   * ```
   */
  logoutWithConfirmation(confirmationService: any): Observable<boolean> {
    return new Observable<boolean>(observer => {
      confirmationService.confirm({
        title: 'Logout Confirmation',
        message: 'Are you sure you want to logout?\n\nYou will need to login again to access your bookings and profile.',
        confirmText: 'Yes, Logout',
        cancelText: 'Cancel',
        confirmButtonClass: 'btn-danger',
        icon: 'fas fa-sign-out-alt'
      }).subscribe({
        next: (confirmed: boolean) => {
          if (confirmed) {
            console.log('✅ User confirmed logout');
            try {
              this.performLogout();
              observer.next(true);
              observer.complete();
            } catch (error) {
              console.error('❌ Error during logout:', error);
              observer.error(error);
            }
          } else {
            console.log('❌ User cancelled logout');
            observer.next(false);
            observer.complete();
          }
        },
        error: (err: any) => {
          console.error('❌ Confirmation dialog error:', err);
          observer.error(err);
        }
      });
    });
  }

  /**
   * ✅ NEW: Perform actual logout
   * This is called after user confirms logout in the confirmation dialog
   */
  performLogout(): void {
    console.log('🔴 Performing logout...');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('selected_city');
    this.currentUserSubject.next(null);
    this.selectedCitySubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  // ============ Getters ============

  get currentUser(): AuthResponse | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  get isOrganizer(): boolean {
    return this.currentUser?.role === 'Organizer' || this.currentUser?.role === 'Admin';
  }

  get token(): string | null {
    return this.currentUser?.token ?? null;
  }

  /**
   * Get the current user's role
   * Returns 'Admin', 'Organizer', or 'User'
   */
  getRole(): string {
    if (this.currentUserSubject.value) {
      return this.currentUserSubject.value.role || 'User';
    }
    
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        return user.role || 'User';
      } catch (e) {
        console.error('Error parsing stored user:', e);
        return 'User';
      }
    }
    
    return 'User';
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: string): boolean {
    return this.getRole() === role;
  }

  /**
   * Check if user is Admin
   */
  isAdmin(): boolean {
    return this.getRole() === 'Admin';
  }

  /**
   * Check if user is Organizer
   */
  isOrganizerOnly(): boolean {
    return this.getRole() === 'Organizer';
  }

  // ============ City Selection Methods ============

  setSelectedCity(city: string): void {
    localStorage.setItem('selected_city', city);
    this.selectedCitySubject.next(city);
  }

  getSelectedCity(): string | null {
    return this.getStoredCity();
  }

  clearSelectedCity(): void {
    localStorage.removeItem('selected_city');
    this.selectedCitySubject.next(null);
  }

  hasSelectedCity(): boolean {
    return this.getStoredCity() !== null;
  }

  // ============ Private Helper Methods ============

  private getStoredCity(): string | null {
    return localStorage.getItem('selected_city');
  }

  private storeUser(res: AuthResponse): void {
    localStorage.setItem('auth_user', JSON.stringify(res));
    this.currentUserSubject.next(res);
  }

  private getStoredUser(): AuthResponse | null {
    const stored = localStorage.getItem('auth_user');
    return stored ? JSON.parse(stored) : null;
  }

  private handleError(error: any): Observable<never> {
    console.error('❌ API Error Details:', error);
    
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.error && typeof error.error === 'object') {
      if (error.error.message) {
        errorMessage = error.error.message;
      } else if (error.error.errors) {
        const validationErrors = Object.values(error.error.errors).flat();
        errorMessage = validationErrors.join(', ');
      } else {
        errorMessage = JSON.stringify(error.error);
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    const enhancedError = {
      ...error,
      message: errorMessage
    };
    
    return throwError(() => enhancedError);
  }
}