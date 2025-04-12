import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IpAuthGuard implements CanActivate {
  private clientIp: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    // For development on localhost, we'll automatically allow access
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }

    // If we already know the IP, check it
    if (this.clientIp) {
      return this.checkIpAuthorization(this.clientIp);
    }

    // Otherwise, get the IP first
    return this.getClientIp().pipe(
      map(ip => {
        this.clientIp = ip;
        return this.checkIpAuthorization(ip);
      }),
      catchError(err => {
        console.error('Error determining client IP:', err);
        this.router.navigate(['/']);
        return of(false);
      })
    );
  }

  private getClientIp(): Observable<string> {
    // In a real application, you would need a backend endpoint to provide this
    // For demo, we'll use a public API that returns the client's IP
    return this.http.get<{ip: string}>('https://api.ipify.org?format=json').pipe(
      map(response => response.ip),
      catchError(err => {
        console.error('Error fetching IP:', err);
        // Fall back to localhost for demo purposes
        return of('127.0.0.1');
      })
    );
  }

  private checkIpAuthorization(ip: string): boolean {
    const isAuthorized = environment.authorizedIps.includes(ip);
    
    if (!isAuthorized) {
      console.warn(`Access denied for IP: ${ip}`);
      this.router.navigate(['/']);
    }
    
    return isAuthorized;
  }
} 