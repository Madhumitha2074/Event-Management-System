// register.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';


@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  loading = false;
  submitted = false;
  showPassword = false;
  showConfirmPassword = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.setupPasswordStrengthListener();
    this.setupEmailValidationListener();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      name: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern('^[a-zA-Z\\s]+$')
      ]],
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.pattern('^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$')
      ]],
      phoneNumber: [''],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.strongPasswordValidator()
      ]],
      confirmPassword: ['', Validators.required],
      role: [0, Validators.required],
      acceptTerms: [false]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  private setupEmailValidationListener(): void {
    // Check email availability in real-time
    this.form.get('email')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(email => {
        if (email && this.form.get('email')?.valid) {
          this.checkEmailAvailability(email);
        }
      });
  }

  private checkEmailAvailability(email: string): void {
    this.authService.checkEmailAvailability(email).subscribe({
      next: (isAvailable) => {
        if (!isAvailable) {
          this.form.get('email')?.setErrors({ emailExists: true });
        } else {
          // Clear the error if email becomes available
          if (this.form.get('email')?.hasError('emailExists')) {
            const { emailExists, ...errors } = this.form.get('email')?.errors || {};
            this.form.get('email')?.setErrors(Object.keys(errors).length ? errors : null);
          }
        }
      },
      error: () => {
        // Silently fail - don't block registration
        console.log('Email availability check failed');
      }
    });
  }

  strongPasswordValidator(): ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value || '';
      
      const hasMinLength = value.length >= 8;
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumber = /[0-9]/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      
      const isValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
      
      if (!isValid) {
        return {
          strongPassword: {
            minLength: hasMinLength,
            upperCase: hasUpperCase,
            lowerCase: hasLowerCase,
            number: hasNumber,
            specialChar: hasSpecialChar
          }
        };
      }
      return null;
    };
  }

  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    if (password && confirmPassword && password !== confirmPassword) {
      group.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  isPasswordStrong(): boolean {
    const password = this.form.get('password')?.value;
    if (!password) return false;
    
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
  }

  getPasswordRequirements() {
    const password = this.form.get('password')?.value || '';
    return {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
  }

  private setupPasswordStrengthListener(): void {
    this.form.get('password')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {});
  }

  getPasswordStrengthWidth(): string {
    const strength = this.passwordStrength;
    if (strength === 'Weak') return '33%';
    if (strength === 'Medium') return '66%';
    if (strength === 'Strong') return '100%';
    return '0%';
  }

  get passwordStrength(): string {
    const password = this.form.get('password')?.value;
    if (!password || password.length === 0) return '';
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= 8;
    const hasGoodLength = password.length >= 12;
    
    let score = 0;
    if (hasMinLength) score++;
    if (hasGoodLength) score++;
    if (hasUpperCase) score++;
    if (hasLowerCase) score++;
    if (hasNumber) score++;
    if (hasSpecialChar) score++;
    
    if (score <= 3) {
      return 'Weak';
    } else if (score < 5) {
      return 'Medium';
    } else {
      return 'Strong';
    }
  }

  get f() { return this.form.controls; }

  togglePasswordVisibility(field: string): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else if (field === 'confirm') {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    
    // Check for email exists error first
    if (this.form.get('email')?.hasError('emailExists')) {
      this.toastr.error('An account with this email already exists. Please use a different email or login.', 'Email Already Exists');
      return;
    }
    
    // Check for password mismatch
    if (this.form.hasError('passwordMismatch')) {
      this.toastr.error('Passwords do not match!', 'Password Mismatch');
      return;
    }
    
    // Check if password is strong enough
    if (!this.isPasswordStrong()) {
      this.toastr.error(
        'Password must contain uppercase, lowercase, number, and special character (!@#$%^&*)',
        'Weak Password'
      );
      return;
    }
    
    // Manually check terms and conditions
    if (!this.form.get('acceptTerms')?.value) {
      this.toastr.error('You must accept the terms and conditions', 'Validation Error');
      return;
    }
    
    // Check required fields
    if (!this.form.get('name')?.value) {
      this.toastr.error('Full name is required', 'Validation Error');
      return;
    }
    
    if (!this.form.get('email')?.value) {
      this.toastr.error('Email address is required', 'Validation Error');
      return;
    }
    
    if (!this.form.get('email')?.valid) {
      this.toastr.error('Please enter a valid email address', 'Validation Error');
      return;
    }
    
    if (!this.form.get('password')?.value) {
      this.toastr.error('Password is required', 'Validation Error');
      return;
    }
    
    if (this.form.get('role')?.invalid) {
      this.toastr.error('Please select your preference', 'Validation Error');
      return;
    }

    this.loading = true;
    
    const formData = {
      name: this.form.get('name')?.value?.trim(),
      email: this.form.get('email')?.value?.toLowerCase()?.trim(),
      phoneNumber: this.form.get('phoneNumber')?.value || '',
      password: this.form.get('password')?.value,
      role: this.form.get('role')?.value,
      acceptTerms: true,
      acceptedTermsAt: new Date().toISOString()
    };

    console.log('Submitting registration data:', formData);

    this.authService.register(formData).subscribe({
      next: (response) => {
        this.loading = false;
        this.toastr.success('Registration successful! Please login.', 'Success');
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        this.loading = false;
        console.error('Registration error details:', error);
        
        // Handle specific error cases
        if (error.status === 409 || error.error?.message?.includes('email already exists')) {
          this.toastr.error('An account with this email already exists. Please login instead.', 'Email Already Exists');
          this.form.get('email')?.setErrors({ emailExists: true });
        } else if (error.error?.message) {
          this.toastr.error(error.error.message, 'Registration Failed');
        } else if (error.message) {
          this.toastr.error(error.message, 'Registration Failed');
        } else {
          this.toastr.error('Registration failed. Please try again.', 'Registration Failed');
        }
      }
    });
  }

  socialLogin(provider: string): void {
    this.loading = true;
    this.authService.socialLogin(provider).subscribe({
      next: () => {
        this.toastr.success(`Logged in with ${provider}`);
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading = false;
        this.toastr.error(`${provider} login failed`);
      }
    });
  }

  resetForm(): void {
    this.form.reset({
      name: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      role: 0,
      acceptTerms: false
    });
    this.submitted = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}