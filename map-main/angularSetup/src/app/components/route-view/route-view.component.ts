import { Component, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import { GpxRoute } from '../../interfaces/route.interface';
import { MapUtilsService } from '../../services/map-utils.service';
import { GpxService } from '../../services/gpx.service';
import { RouteRendererService } from '../../services/route-renderer.service';

// Fix Leaflet's default icon path issues
L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.7.1/dist/images/';

@Component({
  selector: 'app-route-view',
  templateUrl: './route-view.component.html',
  styleUrls: ['./route-view.component.css']
})
export class RouteViewComponent implements OnInit, OnDestroy, AfterViewInit {
  private map!: L.Map;
  routeId: string | null = null;
  route: GpxRoute | null = null;
  isLoading = true;
  errorMessage: string | null = null;

  constructor(
    private ngZone: NgZone,
    private activatedRoute: ActivatedRoute,
    private mapUtils: MapUtilsService,
    private gpxService: GpxService,
    private routeRenderer: RouteRendererService
  ) {}

  ngOnInit() {
    // Get route ID from URL
    this.activatedRoute.paramMap.subscribe(params => {
      this.routeId = params.get('id');
      this.loadRoute();
    });
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    // Check if map container exists
    const mapElement = document.getElementById('route-map');
    if (!mapElement) {
      console.error('Map container element not found');
      return;
    }

    // Initialize the map
    this.map = L.map('route-map', {
      center: [59.3293, 18.0686], // Default center, will be updated when route loads
      zoom: 13,
      zoomControl: true
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // Add scale control
    L.control.scale().addTo(this.map);
    
    // If route is already loaded, render it
    if (this.route) {
      this.renderRoute();
    }
  }

  private loadRoute(): void {
    if (!this.routeId) {
      this.errorMessage = 'No route ID provided';
      this.isLoading = false;
      return;
    }

    // Get the route from cache using the renamed method
    this.gpxService.getRoute(this.routeId).subscribe(
      (route: GpxRoute | null) => {
        if (route) {
          this.route = route;
          this.isLoading = false;
          
          if (this.map) {
            this.renderRoute();
          }
        } else {
          this.errorMessage = 'Route not found. Please select it from the main map first.';
          this.isLoading = false;
        }
      },
      (error: Error) => {
        console.error('Error loading route:', error);
        this.errorMessage = 'An error occurred while loading the route.';
        this.isLoading = false;
      }
    );
  }

  private renderRoute(): void {
    if (!this.route || !this.map) return;
    
    // Ensure route is visible
    this.route.visible = true;
    
    // Always render as selected for better visibility
    this.routeRenderer.renderGpxRoute(this.route, this.map, true);
    
    // Fit map to show the route
    this.fitMapToRoute();
  }

  private fitMapToRoute(): void {
    if (!this.route || !this.map || !this.route.coordinates || this.route.coordinates.length === 0) return;
    
    // Create bounds from route coordinates
    const bounds = L.latLngBounds(this.route.coordinates.map(coord => L.latLng(coord[0], coord[1])));
    
    // Fit map to bounds with some padding
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  /**
   * Calculate route distance for display in the template
   */
  calculateRouteDistance(coordinates: [number, number][]): number {
    return this.mapUtils.calculateRouteDistance(coordinates);
  }
} 