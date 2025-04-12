import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-account-creation',
  templateUrl: './account-creation.component.html',
  styleUrls: ['./account-creation.component.css']
})
export class AccountCreationComponent implements OnInit {
  accountForm: FormGroup;
  isSubmitting = false;
  showSuccessMessage = false;
  showErrorMessage = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    this.accountForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      name: ['', Validators.required],
      role: ['user', Validators.required]
    }, { 
      validator: this.checkPasswords 
    });
    
    // Ensure we start with loading state set to false
    this.isSubmitting = false;
  }

  ngOnInit(): void {
    // Explicitly force reset all loading states at component initialization
    this.isSubmitting = false;
    this.authService.resetLoadingState();
    
    // Create a safety timeout to fix potential race conditions
    setTimeout(() => {
      this.isSubmitting = false;
      console.log('Safety timeout: Reset account creation loading state');
    }, 500);
    
    // Subscribe to loading and error states from auth service
    this.authService.loading$.subscribe(loading => {
      console.log('Auth service loading state changed:', loading);
      this.isSubmitting = loading;
    });
    
    this.authService.error$.subscribe(error => {
      if (error) {
        this.showErrorMessage = true;
        this.errorMessage = error;
      } else {
        this.showErrorMessage = false;
      }
    });
  }

  // Add public method to check admin status
  public isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  // Custom validator to check if passwords match
  checkPasswords(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return password === confirmPassword ? null : { notMatching: true };
  }

  onSubmit(): void {
    console.log('Form submission attempted');
    
    // Check if the form has already been submitted
    if (this.isSubmitting) {
      console.log('Submission already in progress, ignoring');
      return;
    }
    
    if (this.accountForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.accountForm.controls).forEach(key => {
        const control = this.accountForm.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    // Check if passwords match
    if (this.accountForm.hasError('notMatching')) {
      this.errorMessage = 'Passwords do not match';
      this.showErrorMessage = true;
      return;
    }
    
    // Manually track our own submission state
    this.isSubmitting = true;
    console.log('Starting account creation, setting loading state');
    this.showSuccessMessage = false;
    
    const { email, password, name, role } = this.accountForm.value;
    
    console.log('Submitting account creation for:', email);
    
    // Set a safety timeout to reset loading state if the service doesn't respond
    const safetyTimer = setTimeout(() => {
      console.log('Account creation safety timeout triggered - resetting loading state');
      this.isSubmitting = false;
    }, 10000);
    
    this.authService.createAccount(email, password, name, role).subscribe({
      next: response => {
        clearTimeout(safetyTimer);
        console.log('Account creation response:', response);
        
        if (response.success) {
          this.showSuccessMessage = true;
          this.successMessage = response.message || 'Account created successfully!';
          this.accountForm.reset({ role: 'user' });
        } else {
          this.showErrorMessage = true;
          this.errorMessage = response.message || 'Failed to create account';
        }
        
        // Always ensure loading state is reset
        this.isSubmitting = false;
      },
      error: err => {
        clearTimeout(safetyTimer);
        console.error('Account creation error:', err);
        this.showErrorMessage = true;
        this.errorMessage = err.message || 'An unexpected error occurred';
        this.isSubmitting = false;
      },
      complete: () => {
        clearTimeout(safetyTimer);
        console.log('Account creation request completed');
        this.isSubmitting = false;
      }
    });
  }
}