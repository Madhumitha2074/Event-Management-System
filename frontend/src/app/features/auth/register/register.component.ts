import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  template: `
    <div class="min-vh-100 d-flex align-items-center" style="background: linear-gradient(135deg,#6c5ce7,#fd79a8);">
      <div class="container py-5">
        <div class="row justify-content-center">
          <div class="col-md-6">
            <div class="card shadow-lg border-0 rounded-4">
              <div class="card-body p-5">
                <div class="text-center mb-4">
                  <i class="fas fa-user-plus fa-3x text-primary"></i>
                  <h3 class="fw-bold mt-2">Create Account</h3>
                </div>
                <form [formGroup]="form" (ngSubmit)="onSubmit()">
                  <div class="mb-3">
                    <label class="form-label">Full Name</label>
                    <input class="form-control" formControlName="name" placeholder="John Doe">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" formControlName="email" placeholder="your@email.com">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Phone (optional)</label>
                    <input class="form-control" formControlName="phone" placeholder="+1 234 567 8900">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Password</label>
                    <input type="password" class="form-control" formControlName="password" placeholder="Min 6 characters">
                  </div>
                  <div class="mb-4">
                    <label class="form-label">I want to</label>
                    <select class="form-select" formControlName="role">
                      <option [value]="0">Browse & Book Events</option>
                      <option [value]="1">Organize Events</option>
                    </select>
                  </div>
                  <button class="btn btn-primary w-100 py-2" type="submit" [disabled]="loading">
                    <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                    Create Account
                  </button>
                </form>
                <p class="text-center mt-3 mb-0">Already have an account? <a routerLink="/auth/login">Sign In</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegisterComponent implements OnInit {
  form!: FormGroup;
  loading = false;

  constructor(private fb: FormBuilder, private authService: AuthService,
              private router: Router, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: [0, Validators.required]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.authService.register(this.form.value).subscribe({
      next: () => { this.toastr.success('Account created!'); this.router.navigate(['/']); },
      error: (err) => { this.toastr.error(err.error?.message || 'Registration failed.'); this.loading = false; }
    });
  }
}
