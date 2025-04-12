import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth/auth.service';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {
  currentYear = new Date().getFullYear();
  isMenuOpen = false;
  
  // Modal states
  showModal = false;
  showSuccessModal = false;
  isSubmitting = false;
  
  // Login related properties - simplified
  isLoggedIn = false;
  currentUser: User | null = null;
  private authSubscription: Subscription | null = null;
  
  // Form group for the organizer application
  organizerForm: any; // Keep this for now since it's still used in the template
  
  // Array of background images
  backgroundImages = [
    'assets/images/cycling-background.jpg', 
    'assets/images/cycling-background.jpg', 
    'assets/images/cycling-background.jpg', 
    'assets/images/cycling-background.jpg'  
  ];
  
  // The currently selected background image
  currentBackgroundImage: string;
  
  // Interval ID for checking and removing the navbar
  private navbarCheckInterval: any;
  
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {
    // Select a random background image when component is created
    this.currentBackgroundImage = this.getRandomBackgroundImage();
  }

  ngOnInit(): void {
    // Simple initialization for the eBrevet homepage
    this.removeOriginalNavbar();
    
    // Subscribe to user changes for auth state
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });
  }
  
  ngAfterViewInit(): void {
    // Remove the navbar after view is initialized
    this.removeOriginalNavbar();
    
    // Set up an interval to keep checking and removing the navbar
    this.navbarCheckInterval = setInterval(() => {
      this.removeOriginalNavbar();
    }, 100); 
  }
  
  ngOnDestroy(): void {
    // Clear the interval when component is destroyed
    if (this.navbarCheckInterval) {
      clearInterval(this.navbarCheckInterval);
    }
    
    // Clean up subscriptions
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
  
  /**
   * Programmatically removes the original navbar elements from the DOM
   */
  private removeOriginalNavbar(): void {
    // Remove the headerless-navbar
    const headerlessNavbars = document.querySelectorAll('.headerless-navbar');
    headerlessNavbars.forEach(navbar => {
      if (navbar && navbar.parentNode) {
        navbar.parentNode.removeChild(navbar);
      }
    });
    
    // Remove the navbar-trigger
    const navbarTriggers = document.querySelectorAll('.navbar-trigger');
    navbarTriggers.forEach(trigger => {
      if (trigger && trigger.parentNode) {
        trigger.parentNode.removeChild(trigger);
      }
    });
  }
  
  /**
   * Selects a random background image from the array
   */
  getRandomBackgroundImage(): string {
    const randomIndex = Math.floor(Math.random() * this.backgroundImages.length);
    return this.backgroundImages[randomIndex];
  }
  
  // Keep the submit form function for the organizer form
  submitForm(): void {
    // Existing implementation
  }
  
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  // Navigation method
  navigateToEvents(): void {
    console.log('Navigating to events page...');
    this.router.navigate(['/events']);
  }
}
