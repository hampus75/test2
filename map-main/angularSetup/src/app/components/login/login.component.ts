import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  
  // Forgot password
  showForgotPassword = false;
  passwordResetSent = false;
  forgotPasswordEmail = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    console.log('Login component initializing');
    
    // Reset loading state
    this.isLoading = false;
    this.authService.resetLoadingState();
    
    // Subscribe to auth service errors
    this.authService.error$.subscribe(error => {
      this.errorMessage = error;
      if (error) {
        this.isLoading = false;
      }
    });
    
    // Check if already authenticated
    if (this.authService.isAuthenticated()) {
      console.log('User already authenticated, redirecting...');
      const user = this.authService.getCurrentUser();
      
      if (user?.role === 'admin') {
        this.router.navigate(['/admin']);
      } else if (user?.role === 'organizer') {
        this.router.navigate(['/events']);
      } else {
        this.router.navigate(['/']);
      }
    }
    
    // Populate from localStorage if available
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      this.loginForm.patchValue({ email: rememberedEmail, rememberMe: true });
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }
    
    const { email, password, rememberMe } = this.loginForm.value;
    
    console.log('Starting login process for:', email);
    this.isLoading = true;
    this.errorMessage = null;
    
    // Add a safety timeout with longer duration (30 seconds instead of 10)
    const safetyTimer = setTimeout(() => {
      console.log('Safety timeout triggered - login taking too long');
      this.isLoading = false;
      this.errorMessage = 'Login timed out. Please try again.';
    }, 30000);
    
    this.authService.login(email, password).subscribe({
      next: (response) => {
        console.log('Login response received:', response);
        clearTimeout(safetyTimer);
        
        if (response.success) {
          // If remember me is checked, store email
          if (rememberMe) {
            localStorage.setItem('rememberedEmail', email);
          } else {
            localStorage.removeItem('rememberedEmail');
          }
          
          console.log('Login successful, waiting for redirect...');
        } else {
          // Error handling
          console.error('Login failed:', response.message);
          this.isLoading = false;
          this.errorMessage = response.message || 'Login failed';
        }
      },
      error: (err) => {
        clearTimeout(safetyTimer);
        console.error('Login subscription error:', err);
        this.isLoading = false;
        this.errorMessage = typeof err === 'string' ? err : 
                           (err.message || 'An unexpected error occurred');
      },
      complete: () => {
        clearTimeout(safetyTimer);
        console.log('Login observable completed');
        this.isLoading = false;
      }
    });
  }
  
  toggleForgotPassword(): void {
    this.showForgotPassword = !this.showForgotPassword;
    this.passwordResetSent = false;
  }
  
  resetPassword(): void {
    if (!this.forgotPasswordEmail || !this.validateEmail(this.forgotPasswordEmail)) {
      this.errorMessage = 'Please enter a valid email address';
      return;
    }
    
    this.authService.resetPassword(this.forgotPasswordEmail).subscribe({
      next: (response) => {
        if (response.success) {
          this.passwordResetSent = true;
          this.errorMessage = null;
        } else {
          this.errorMessage = response.message;
        }
      }
    });
  }
  
  private validateEmail(email: string): boolean {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  }
}
