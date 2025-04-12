import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Define a simple route interface to replace StravaRoute
interface Route {
  id: number;
  name: string;
  description?: string;
  distance: number;
  elevation_gain: number;
}

@Component({
  selector: 'app-route-explorer',
  templateUrl: './route-explorer.component.html',
  styleUrls: ['./route-explorer.component.css']
})
export class RouteExplorerComponent implements OnInit {
  publicRoutes: Route[] = [];
  starredRoutes: Route[] = [];
  isLoadingPublic = false;
  isLoadingStarred = false;
  searchControl = new FormControl('');
  currentPage = 1;
  routesPerPage = 10;
  totalRoutes = 0;
  searchKeyword = '';
  
  constructor() {}

  ngOnInit(): void {
    // Load some sample routes
    this.loadSampleRoutes();
    
    this.searchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchKeyword = value || '';
      this.currentPage = 1;
      this.searchPublicRoutes();
    });
  }
  
  loadSampleRoutes(): void {
    // Sample routes for demonstration
    const sampleRoutes: Route[] = [
      {
        id: 1,
        name: 'Central Park Loop',
        description: 'A scenic route around Central Park',
        distance: 10000, // 10km in meters
        elevation_gain: 150
      },
      {
        id: 2,
        name: 'Downtown Circuit',
        description: 'Urban route through downtown',
        distance: 5000, // 5km in meters
        elevation_gain: 50
      },
      {
        id: 3,
        name: 'Riverside Trail',
        description: 'Peaceful route along the river',
        distance: 8000, // 8km in meters
        elevation_gain: 100
      }
    ];
    
    this.publicRoutes = sampleRoutes;
    this.totalRoutes = sampleRoutes.length;
    
    // Initialize some starred routes
    this.starredRoutes = [sampleRoutes[0]];
  }
  
  loadStarredRoutes(): void {
    // In a real app, this would load from a service/API
    this.isLoadingStarred = true;
    
    // Simulate API call
    setTimeout(() => {
      this.isLoadingStarred = false;
    }, 500);
  }
  
  searchPublicRoutes(): void {
    this.isLoadingPublic = true;
    
    // Filter routes based on search keyword
    if (this.searchKeyword) {
      const keyword = this.searchKeyword.toLowerCase();
      
      // Filter the sample routes by keyword
      setTimeout(() => {
        this.publicRoutes = this.publicRoutes.filter(route => 
          route.name.toLowerCase().includes(keyword) || 
          (route.description && route.description.toLowerCase().includes(keyword))
        );
        this.totalRoutes = this.publicRoutes.length;
        this.isLoadingPublic = false;
      }, 500);
    } else {
      // Reset to all routes if no search keyword
      this.loadSampleRoutes();
      setTimeout(() => {
        this.isLoadingPublic = false;
      }, 500);
    }
  }
  
  onPageChange(page: number): void {
    this.currentPage = page;
    this.searchPublicRoutes();
  }
  
  starRoute(route: Route): void {
    // Add to starred routes if not already there
    if (!this.starredRoutes.find(r => r.id === route.id)) {
      this.starredRoutes = [...this.starredRoutes, route];
    }
  }
  
  unstarRoute(route: Route): void {
    // Remove from starred routes
    this.starredRoutes = this.starredRoutes.filter(r => r.id !== route.id);
  }
  
  isRouteStarred(routeId: number): boolean {
    return this.starredRoutes.some(route => route.id === routeId);
  }
}
