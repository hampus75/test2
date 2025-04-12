import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  title = 'Map Explorer';
  isVisible = false;
  private hideTimeout: any = null;
  
  // Show the navbar
  showNavbar(): void {
    this.isVisible = true;
    // Clear any pending timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
  
  // Hide the navbar with a delay to give user time to interact
  hideNavbarWithDelay(): void {
    this.hideTimeout = setTimeout(() => {
      this.isVisible = false;
    }, 1000); // 1 second delay
  }
}
