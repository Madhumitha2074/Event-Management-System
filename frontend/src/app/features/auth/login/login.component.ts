import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  template: `
    <div class="min-vh-100 d-flex align-items-center" style="background: linear-gradient(135deg,#6c5ce7,#a29bfe);">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-md-5">
            <div class="card shadow-lg border-0 rounded-4">
              <div class="card-body p-5">
                <div class="text-center mb-4">
                  <i class="fas fa-ticket-alt fa-3x text-primary"></i>
                  <h3 class="fw-bold mt-2">Welcome Back</h3>
                  <p class="text-muted">Sign in to your account</p>
                </div>
                <form [formGroup]="form" (ngSubmit)="onSubmit()">
                  <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" formControlName="email" placeholder="your@email.com">
                    <div *ngIf="form.get('email')?.touched && form.get('email')?.invalid" class="text-danger small">Valid email is required.</div>
                  </div>
                  <div class="mb-4">
                    <label class="form-label">Password</label>
                    <input type="password" class="form-control" formControlName="password" placeholder="Password">
                    <div *ngIf="form.get('password')?.touched && form.get('password')?.invalid" class="text-danger small">Password is required.</div>
                  </div>
                  <button class="btn btn-primary w-100 py-2" type="submit" [disabled]="loading">
                    <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                    Sign In
                  </button>
                </form>
                <p class="text-center mt-3 mb-0">Don't have an account? <a routerLink="/auth/register">Register</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  loading = false;

  constructor(private fb: FormBuilder, private authService: AuthService,
              private router: Router, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.authService.login(this.form.value).subscribe({
      next: () => { this.toastr.success('Login successful!'); this.router.navigate(['/']); },
      error: (err) => { this.toastr.error(err.error?.message || 'Login failed.'); this.loading = false; }
    });
  }
}
