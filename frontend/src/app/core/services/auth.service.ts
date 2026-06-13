// src/app/core/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
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
      tap(res => {
        console.log('Registration response:', res);
        this.storeUser(res);
      }),
      catchError(this.handleError)
    );
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, data).pipe(
      tap(res => this.storeUser(res)),
      catchError(this.handleError)
    );
  }

  socialLogin(provider: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/social-login`, { provider }).pipe(
      tap(res => this.storeUser(res)),
      catchError(this.handleError)
    );
  }

  checkEmailAvailability(email: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.API}/check-email?email=${email}`).pipe(
      catchError(this.handleError)
    );
  }

  // ============ OTP Methods for WhatsApp/SMS ============
  
  sendOTP(phoneNumber: string): Observable<any> {
    console.log('Sending OTP to:', phoneNumber);
    return this.http.post(`${this.API}/send-otp`, { phoneNumber }).pipe(
      tap(res => console.log('OTP send response:', res)),
      catchError(this.handleError)
    );
  }

  verifyOTP(phoneNumber: string, otpCode: string): Observable<any> {
    console.log('Verifying OTP for:', phoneNumber);
    return this.http.post(`${this.API}/verify-otp`, { phoneNumber, otpCode }).pipe(
      tap(res => console.log('OTP verify response:', res)),
      catchError(this.handleError)
    );
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.API}/profile`).pipe(
      catchError(this.handleError)
    );
  }

  logout(): void {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('selected_city');
    this.currentUserSubject.next(null);
    this.selectedCitySubject.next(null);
    this.router.navigate(['/auth/login']);
  }

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
    console.error('API Error Details:', error);
    
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