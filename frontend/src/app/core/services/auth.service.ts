import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../models/models';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<AuthResponse | null>(this.getStoredUser());
  currentUser$ = this.currentUserSubject.asObservable();
  
  // Location subject for storing selected city
  private selectedCitySubject = new BehaviorSubject<string | null>(this.getStoredCity());
  selectedCity$ = this.selectedCitySubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, data).pipe(
      tap(res => this.storeUser(res))
    );
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, data).pipe(
      tap(res => this.storeUser(res))
    );
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.API}/profile`);
  }

  // UPDATED: Clear selected city on logout
  logout(): void {
    localStorage.removeItem('auth_user');
    // Clear selected city on logout so popup shows again on next login
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

  // =====================================================
  // City/Location Management Methods
  // =====================================================
  
  // Set the selected city
  setSelectedCity(city: string): void {
    localStorage.setItem('selected_city', city);
    this.selectedCitySubject.next(city);
  }

  // Get the selected city
  getSelectedCity(): string | null {
    return this.getStoredCity();
  }

  // Clear the selected city
  clearSelectedCity(): void {
    localStorage.removeItem('selected_city');
    this.selectedCitySubject.next(null);
  }

  // Check if user has selected a city
  hasSelectedCity(): boolean {
    return this.getStoredCity() !== null;
  }

  // Get stored city from localStorage
  private getStoredCity(): string | null {
    return localStorage.getItem('selected_city');
  }

  // =====================================================
  // Private Helper Methods
  // =====================================================

  private storeUser(res: AuthResponse): void {
    localStorage.setItem('auth_user', JSON.stringify(res));
    this.currentUserSubject.next(res);
  }

  private getStoredUser(): AuthResponse | null {
    const stored = localStorage.getItem('auth_user');
    return stored ? JSON.parse(stored) : null;
  }
}