// register.component.ts (corrected version)
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

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
  selectedContactMethod: 'email' | 'phone' = 'email';
  
  phoneOtpSent = false;
  phoneVerified = false;
  phoneOtpCode = '';
  simulatedOtp = '123456';
  timer = 60;
  timerInterval: any;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.setupConditionalValidation();
    this.setupPasswordStrengthListener();
    this.setupEmailValidationListener();
    this.setupPhoneValidationListener();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      name: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern('^[a-zA-Z\\s]+$')
      ]],
      email: [''],
      phoneNumber: [''],
      contactMethod: ['email', Validators.required],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.strongPasswordValidator()
      ]],
      confirmPassword: ['', Validators.required],
      role: [0, Validators.required],
      acceptTerms: [false]
    });
  }

  private setupConditionalValidation(): void {
    this.form.get('contactMethod')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(method => {
        this.selectedContactMethod = method;
        
        const emailControl = this.form.get('email');
        const phoneControl = this.form.get('phoneNumber');
        
        emailControl?.clearValidators();
        phoneControl?.clearValidators();
        
        if (method === 'email') {
          emailControl?.setValidators([Validators.required, Validators.email]);
          phoneControl?.setValidators([]);
          this.phoneVerified = false;
          this.phoneOtpSent = false;
          this.phoneOtpCode = '';
        } else {
          emailControl?.setValidators([]);
          phoneControl?.setValidators([Validators.required]);
          this.phoneOtpSent = false;
          this.phoneVerified = false;
          this.phoneOtpCode = '';
          this.timer = 60;
          if (this.timerInterval) {
            clearInterval(this.timerInterval);
          }
        }
        
        emailControl?.updateValueAndValidity();
        phoneControl?.updateValueAndValidity();
        this.form.updateValueAndValidity();
      });
  }

  private setupEmailValidationListener(): void {
    this.form.get('email')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(email => {
        if (email && this.form.get('email')?.valid && this.selectedContactMethod === 'email') {
          this.checkEmailAvailability(email);
        }
      });
  }

  private setupPhoneValidationListener(): void {
    this.form.get('phoneNumber')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(phone => {
        if (phone !== undefined && this.selectedContactMethod === 'phone') {
          if (this.phoneOtpSent || this.phoneVerified) {
            this.phoneOtpSent = false;
            this.phoneVerified = false;
            this.phoneOtpCode = '';
            if (this.timerInterval) {
              clearInterval(this.timerInterval);
            }
            this.timer = 60;
          }
          
          const isValid = /^[0-9]{10}$/.test(phone);
          
          if (phone && phone.length > 0 && !isValid) {
            this.form.get('phoneNumber')?.setErrors({ invalidPhone: true });
          } else if (isValid) {
            if (this.form.get('phoneNumber')?.hasError('invalidPhone')) {
              const { invalidPhone, ...errors } = this.form.get('phoneNumber')?.errors || {};
              this.form.get('phoneNumber')?.setErrors(Object.keys(errors).length ? errors : null);
            }
          }
        }
      });
  }

  isPhoneValid(): boolean {
    const phone = this.form.get('phoneNumber')?.value;
    return phone && /^[0-9]{10}$/.test(phone);
  }

  private checkEmailAvailability(email: string): void {
    this.authService.checkEmailAvailability(email).subscribe({
      next: (isAvailable) => {
        if (!isAvailable) {
          this.form.get('email')?.setErrors({ emailExists: true });
        } else {
          if (this.form.get('email')?.hasError('emailExists')) {
            const { emailExists, ...errors } = this.form.get('email')?.errors || {};
            this.form.get('email')?.setErrors(Object.keys(errors).length ? errors : null);
          }
        }
      },
      error: () => {
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
    
    if (score <= 3) return 'Weak';
    if (score < 5) return 'Medium';
    return 'Strong';
  }

  get f() { return this.form.controls; }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  sendPhoneOTP(): void {
    const phoneNumber = this.form.get('phoneNumber')?.value;
    
    if (!phoneNumber || phoneNumber === '') {
      this.toastr.error('Please enter a phone number', 'Validation Error');
      this.form.get('phoneNumber')?.markAsTouched();
      return;
    }
    
    if (!/^[0-9]+$/.test(phoneNumber)) {
      this.toastr.error('Phone number can only contain digits (0-9)', 'Validation Error');
      this.form.get('phoneNumber')?.setErrors({ invalidPhone: true });
      return;
    }
    
    if (phoneNumber.length !== 10) {
      this.toastr.error('Phone number must be exactly 10 digits', 'Validation Error');
      this.form.get('phoneNumber')?.setErrors({ invalidPhone: true });
      return;
    }

    this.loading = true;
    
    setTimeout(() => {
      this.loading = false;
      this.phoneOtpSent = true;
      this.startTimer();
      
      this.toastr.success(
        `Demo OTP sent to ${phoneNumber}. Use code: ${this.simulatedOtp}`,
        'OTP Sent (Demo Mode)',
        { timeOut: 10000 }
      );
      
      console.log(`[DEMO] OTP for ${phoneNumber}: ${this.simulatedOtp}`);
    }, 1000);
  }

  verifyPhoneOTP(): void {
    if (!this.phoneOtpCode || this.phoneOtpCode.length !== 6) {
      this.toastr.error('Please enter a valid 6-digit OTP');
      return;
    }
    
    if (!/^[0-9]+$/.test(this.phoneOtpCode)) {
      this.toastr.error('OTP can only contain digits (0-9)', 'Validation Error');
      return;
    }

    this.loading = true;
    
    setTimeout(() => {
      this.loading = false;
      
      if (this.phoneOtpCode === this.simulatedOtp) {
        this.phoneVerified = true;
        this.toastr.success('Phone number verified successfully!', 'Verified');
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
        }
      } else {
        this.toastr.error('Invalid OTP. Please try again. Demo OTP is: ' + this.simulatedOtp, 'Verification Failed');
      }
    }, 500);
  }

  private startTimer(): void {
    this.timer = 60;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      if (this.timer > 0) {
        this.timer--;
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  // FIXED: shouldShowError method with proper boolean return
  shouldShowError(controlName: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    return !!control.invalid && (control.touched || control.dirty || this.submitted);
  }

  // Helper method to clear errors
  clearFieldError(controlName: string): void {
    const control = this.form.get(controlName);
    if (control?.errors) {
      const { required, email, pattern, invalidPhone, ...otherErrors } = control.errors;
      control.setErrors(Object.keys(otherErrors).length ? otherErrors : null);
    }
  }

  onSubmit(): void {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
    
    this.submitted = true;
    
    const contactMethod = this.selectedContactMethod;
    
    // Validate Full Name first
    if (!this.form.get('name')?.value || this.form.get('name')?.value.trim() === '') {
      this.toastr.error('Full name is required', 'Validation Error');
      this.form.get('name')?.setErrors({ required: true });
      const nameField = document.querySelector('input[formControlName="name"]');
      nameField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (contactMethod === 'email') {
      const email = this.form.get('email')?.value;
      const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/;
      
      if (!email || email === '') {
        this.toastr.error('Email address is required', 'Validation Error');
        this.form.get('email')?.setErrors({ required: true });
        const emailField = document.querySelector('input[formControlName="email"]');
        emailField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!emailPattern.test(email)) {
        this.toastr.error('Please enter a valid email address (e.g., name@example.com)', 'Validation Error');
        this.form.get('email')?.setErrors({ email: true });
        const emailField = document.querySelector('input[formControlName="email"]');
        emailField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    } else if (contactMethod === 'phone') {
      const phone = this.form.get('phoneNumber')?.value;
      const phonePattern = /^[0-9]{10}$/;
      
      if (!phone || phone === '') {
        this.toastr.error('Phone number is required', 'Validation Error');
        this.form.get('phoneNumber')?.setErrors({ required: true });
        const phoneField = document.querySelector('input[formControlName="phoneNumber"]');
        phoneField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!phonePattern.test(phone)) {
        this.toastr.error('Please enter a valid 10-digit phone number (numbers only)', 'Validation Error');
        this.form.get('phoneNumber')?.setErrors({ invalidPhone: true });
        const phoneField = document.querySelector('input[formControlName="phoneNumber"]');
        phoneField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      
      if (!this.phoneVerified) {
        this.toastr.error('Please verify your phone number via OTP first', 'Verification Required');
        return;
      }
    }
    
    if (this.form.get('email')?.value && this.form.get('email')?.hasError('emailExists')) {
      this.toastr.error('An account with this email already exists. Please use a different email or login.', 'Email Already Exists');
      return;
    }
    
    const password = this.form.get('password')?.value;
    const confirmPassword = this.form.get('confirmPassword')?.value;
    
    if (password !== confirmPassword) {
      this.toastr.error('Passwords do not match!', 'Password Mismatch');
      const confirmField = document.querySelector('input[formControlName="confirmPassword"]');
      confirmField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (!this.isPasswordStrong()) {
      this.toastr.error('Password must contain uppercase, lowercase, number, and special character (!@#$%^&*)', 'Weak Password');
      const passwordField = document.querySelector('input[formControlName="password"]');
      passwordField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (!this.form.get('acceptTerms')?.value) {
      this.toastr.error('You must accept the terms and conditions', 'Validation Error');
      const termsCheckbox = document.querySelector('#terms');
      termsCheckbox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (this.form.get('role')?.invalid) {
      this.toastr.error('Please select your preference', 'Validation Error');
      const roleField = document.querySelector('select[formControlName="role"]');
      roleField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.loading = true;
    
    const formData = {
      name: this.form.get('name')?.value?.trim(),
      email: contactMethod === 'email' 
        ? this.form.get('email')?.value?.toLowerCase()?.trim()
        : `phone_${this.form.get('phoneNumber')?.value}@temp.com`,
      phoneNumber: this.form.get('phoneNumber')?.value || '',
      password: this.form.get('password')?.value,
      role: this.form.get('role')?.value,
      acceptTerms: true,
      phoneVerified: contactMethod === 'phone',
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
        console.error('Registration error:', error);
        
        if (error.status === 409) {
          this.toastr.error('An account with this email already exists. Please login instead.', 'Email Already Exists');
          this.form.get('email')?.setErrors({ emailExists: true });
        } else if (error.error?.message) {
          this.toastr.error(error.error.message, 'Registration Failed');
        } else {
          this.toastr.error('Registration failed. Please try again.', 'Registration Failed');
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}