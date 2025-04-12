import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router 
} from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminAuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isAuthenticated = this.authService.isAuthenticated();
    const isAdmin = this.authService.isAdmin();
    
    console.log('AdminAuthGuard checking access:', { 
      isAuthenticated, 
      isAdmin,
      currentUser: this.authService.getCurrentUser()
    });
    
    if (isAuthenticated && isAdmin) {
      return true;
    }
    
    // User is not authenticated or not an admin
    console.warn('Unauthorized access attempt to admin page');
    this.router.navigate(['/login']);
    return false;
  }
}
