import { Component, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

// Import interfaces from separate files
import { Waypoint, WaypointPass } from '../../interfaces/waypoint.interface';
import { Rider, RealRider, RiderStageSpeed } from '../../interfaces/rider.interface';
import { RouteStage, GpxRoute } from '../../interfaces/route.interface';

// Import services
import { MapUtilsService } from '../../services/map-utils.service';
import { GpxService } from '../../services/gpx.service';
import { RouteRendererService } from '../../services/route-renderer.service';
import { RiderService } from '../../services/rider.service';

// Fix Leaflet's default icon path issues
// This is needed when you use Leaflet with Angular
L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.7.1/dist/images/';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit, OnDestroy, AfterViewInit {
  // Expose environment for template
  environment = environment;

  private map!: L.Map;
  isLoading = false;
  routeLayers: L.Layer[] = [];
  riders: Rider[] = [];
  routeCoordinates: [number, number][] = [];
  elevationData: number[] = [];
  private simulationInterval: any;
  waypoints: Waypoint[] = [];
  waypointPasses: WaypointPass[] = [];
  showLeaderboard = false;
  currentSortColumn = 'time';
  sortAscending = true;
  showSegments = true;

  // Add properties needed for template
  routeSource: 'manual' = 'manual';
  segments: any[] = [];
  selectedSegment: any = null;

  stages: RouteStage[] = [];
  stageLayers: L.Layer[] = [];
  activeStage: RouteStage | null = null;
  showStages = true;

  sessionId: string = localStorage.getItem('session_id') || this.generateSessionId();

  // For checkpoint-based stage creation
  checkpoints: Waypoint[] = [];
  checkpointMode = false;

  // Properties for real-time simulation
  simulationSpeedFactor: number = 10; // Default 10x speed
  useRealTimeMode: boolean = true; // Default to real-time mode
  private lastUpdateTime: number = 0;
  riderStageSpeeds: RiderStageSpeed[] = [];

  nextRiderColor: string = this.mapUtils.getRandomColor(); // Initialize with a random color
  randomNames: string[] = [
    'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 
    'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet',
    'Kilo', 'Lima', 'Mike', 'November', 'Oscar',
    'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango',
    'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'
  ];

  // Add property to track real riders
  realRiders: RealRider[] = [];
  
  // Default checkpoint radius in meters
  defaultCheckpointRadius = 500;
  
  // Add property to track the currently simulated GPS position
  simulatedGpsPosition: L.LatLng | null = null;
  simulatedGpsMarker: L.Marker | null = null;
  
  // Flag to enable real-rider mode
  realRiderMode = false;

  // Add properties for manual coordinate input
  manualLatitude: number | null = null;
  manualLongitude: number | null = null;

  // Add property to track selected riders
  selectedRiderIds: Set<string> = new Set<string>();

  // GPX upload functionality
  gpxRoutes: GpxRoute[] = [];
  isProcessingGpx = false;
  selectedRouteId: string | null = null; // Track the currently selected route

  constructor(
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private mapUtils: MapUtilsService,
    private gpxService: GpxService,
    private routeRenderer: RouteRendererService,
    private riderService: RiderService
  ) {}

  /**
   * Initialize the component
   */
  ngOnInit() {
    // Check if shared storage is available by attempting to load routes
    console.log('Initializing map component...');
    
    // Defer map initialization to ngAfterViewInit to ensure DOM is ready
     
    // Check for route ID in URL params
    this.route.queryParams.subscribe(params => {
      const routeId = params['routeId'];
      if (routeId) {
        this.loadRouteFromId(routeId);
      }
    });

    // Load saved routes from shared storage (API or IndexedDB) and render them once the map is ready
    this.gpxRoutes = [];
    this.loadRoutesFromServer();

    // Listen for custom route selection events from map popups
    document.addEventListener('route-selected', ((event: CustomEvent) => {
      this.ngZone.run(() => {
        console.log('Received route-selected event for route ID:', event.detail.routeId);
        this.selectRoute(event.detail.routeId);
      });
    }) as EventListener);
    
    // Listen for custom route view in new window events
    document.addEventListener('route-view-new-window', ((event: CustomEvent) => {
      this.ngZone.run(() => {
        console.log('Received route-view-new-window event for route ID:', event.detail.routeId);
        this.openRouteInNewWindow(event.detail.routeId);
      });
    }) as EventListener);
  }

  /**
   * After view init lifecycle hook - initialize the map once the view is ready
   */
  ngAfterViewInit(): void {
    console.log('ngAfterViewInit called - initializing map...');
    
    // Map initialization is done here to ensure the DOM element is available
    console.log(`BEFORE initMap: gpxRoutes.length = ${this.gpxRoutes.length}, first route: ${this.gpxRoutes.length > 0 ? this.gpxRoutes[0].name : 'none'}`);
    
    this.initMap()
      .then(() => {
        console.log('Map initialized in ngAfterViewInit, now rendering loaded routes');
        
        if (this.gpxRoutes.length > 0) {
          console.log(`Found ${this.gpxRoutes.length} routes to render after map initialization`);
          // Add a small delay to ensure the map is fully rendered
          setTimeout(() => {
            console.log(`BEFORE renderLoadedRoutes: gpxRoutes.length = ${this.gpxRoutes.length}`);
            this.renderLoadedRoutes();
          }, 500);
        } else {
          console.log('No routes to render after map initialization - attempting to load routes again');
          
          // If routes array is empty, try loading from server/storage
          this.loadRoutesFromServer();
        }
      })
      .catch(error => {
        console.error('Error initializing map:', error);
      });
  }

  ngOnDestroy() {
    // Remove event listener when component is destroyed
    document.removeEventListener('route-selected', ((event: CustomEvent) => {
      this.ngZone.run(() => {
        this.selectRoute(event.detail.routeId);
      });
    }) as EventListener);
    
    // Remove route view in new window event listener
    document.removeEventListener('route-view-new-window', ((event: CustomEvent) => {
      this.ngZone.run(() => {
        this.openRouteInNewWindow(event.detail.routeId);
      });
    }) as EventListener);
    
    this.stopRiderSimulation();
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Stop the rider simulation
   */
  stopRiderSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      console.log('Rider simulation stopped');
    }
  }

  private generateSessionId(): string {
    const newId = 'session_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('session_id', newId);
    return newId;
  }

  /**
   * Initialize the map
   */
  private initMap(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // Check if map container exists
        const mapElement = document.getElementById('map');
        if (!mapElement) {
          console.error('Map container element not found');
          reject(new Error('Map container element not found'));
          return;
        }

        console.log(`Initializing map... (gpxRoutes.length: ${this.gpxRoutes.length}, first route: ${this.gpxRoutes.length > 0 ? this.gpxRoutes[0].name : 'none'})`);
        
        // Initialize the map
        this.map = L.map('map', {
          center: [59.3293, 18.0686], // Stockholm
          zoom: 13,
          zoomControl: true
        });
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Add scale control
        L.control.scale().addTo(this.map);
        
        // Add click listener for checkpoint placement
        this.addMapClickListener();
        
        console.log(`Map initialized, now rendering loaded routes... (gpxRoutes.length: ${this.gpxRoutes.length})`);
        
        // Ensure routes are loaded if we somehow lost them during initialization
        if (this.gpxRoutes.length === 0) {
          console.log('Routes array empty during map initialization, reloading from IndexedDB');
          this.gpxService.loadAllRoutesFromDB().subscribe((routes) => {
            if (routes && routes.length > 0) {
              console.log(`Reloaded ${routes.length} routes from IndexedDB during map initialization`);
              this.gpxRoutes = routes;
            }
            
            // Delay rendering to ensure map is fully initialized
            setTimeout(() => {
              console.log(`Map initialization complete, resolving promise`);
              resolve();
            }, 200);
          });
        } else {
          // Delay rendering to ensure map is fully initialized
          setTimeout(() => {
            console.log(`Map initialization complete, resolving promise`);
            resolve();
          }, 200);
        }
      } catch (error) {
        console.error('Error initializing map:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Render the loaded routes on the map
   * Note: Implementation moved to line ~1081 
   */
  // private renderLoadedRoutes(): void { ... }

  /**
   * Add map click listener for checkpoint placement
   */
  addMapClickListener(): void {
    if (!this.map) return;
    
    this.map.on('click', (e) => {
      // Get clicked coordinates
      const clickLatLng = e.latlng;
      
      // Show information popup for all clicks regardless of mode
      this.showLocationInfoPopup(clickLatLng);
      
      // Only add checkpoints if in checkpoint mode
      if (!this.checkpointMode || !this.routeCoordinates || this.routeCoordinates.length === 0) {
        return;
      }
      
      // Find the closest point on the route to the click
      let closestIndex = 0;
      let minDistance = Number.MAX_VALUE;
      
      // Find the closest point in the route, respecting directionality
      // We'll check the entire route but prioritize finding points that maintain sequence
      for (let i = 0; i < this.routeCoordinates.length; i++) {
        const routeLatLng = L.latLng(this.routeCoordinates[i][0], this.routeCoordinates[i][1]);
        const distance = clickLatLng.distanceTo(routeLatLng);
        
        if (distance < minDistance) {
          // Get the previous and next checkpoint positions
          const prevCheckpoint = this.getLastCheckpointBefore(i);
          const nextCheckpoint = this.getFirstCheckpointAfter(i);
          
          // Make sure this position is in sequence (after prevCheckpoint and before nextCheckpoint)
          if ((prevCheckpoint === -1 || i > prevCheckpoint) && 
              (nextCheckpoint === -1 || i < nextCheckpoint)) {
            minDistance = distance;
            closestIndex = i;
          }
        }
      }
      
      // Only add checkpoint if click is close enough to the route (within 50 meters)
      // And the clicked position maintains proper order along the route
      if (minDistance <= 50) {
        this.addCheckpoint(
          closestIndex,
          this.routeCoordinates[closestIndex][0],
          this.routeCoordinates[closestIndex][1]
        );
      } else {
        console.warn('Click too far from route or would create out-of-sequence checkpoint');
      }
    });
  }
  
  /**
   * Show a popup with location information when clicking on the map
   */
  private showLocationInfoPopup(latlng: L.LatLng): void {
    // Don't show info popup in real rider mode to avoid conflicts
    if (this.realRiderMode) return;
    
    // Find closest point on any visible GPX route
    let closestRouteInfo: { name: string, distance: number } | undefined = undefined;
    
    // Process each GPX route
    for (const route of this.gpxRoutes) {
      if (!route.visible) continue;
      
      for (let i = 0; i < route.coordinates.length; i++) {
        const routeLatLng = L.latLng(route.coordinates[i][0], route.coordinates[i][1]);
        const distance = latlng.distanceTo(routeLatLng);
        
        if (closestRouteInfo === undefined || distance < closestRouteInfo.distance) {
          closestRouteInfo = {
            name: route.name,
            distance: distance
          };
        }
      }
    }
    
    // Create popup content
    let content = `
      <div class="location-info-popup">
        <h4 class="text-sm font-bold mb-1">Location Information</h4>
        <div class="text-xs">
          <div><b>Latitude:</b> ${latlng.lat.toFixed(6)}</div>
          <div><b>Longitude:</b> ${latlng.lng.toFixed(6)}</div>
    `;
    
    // Add elevation if available (using nearest point from any route)
    const elevationPoint = this.mapUtils.findElevationAtPoint(latlng, this.routeCoordinates, this.elevationData, this.gpxRoutes);
    if (elevationPoint !== null) {
      content += `<div><b>Elevation:</b> ${elevationPoint.toFixed(1)} m</div>`;
    }
    
    // Add closest route info if available
    if (closestRouteInfo !== undefined) {
      content += `
        <div><b>Nearest route:</b> ${closestRouteInfo.name}</div>
        <div><b>Distance to route:</b> ${closestRouteInfo.distance.toFixed(1)} m</div>
      `;
    }
    
    content += `
        </div>
      </div>
    `;
    
    // Show popup
    L.popup()
      .setLatLng(latlng)
      .setContent(content)
      .openOn(this.map);
  }
  
  // Method to add a checkpoint at a specific position on the route
  addCheckpoint(position: number, lat: number, lng: number): void {
    // Implementation details...
  }
  
  // Method to get the last checkpoint before a specific position
  private getLastCheckpointBefore(position: number): number {
    // Implementation details...
    return -1;
  }
  
  // Method to get the first checkpoint after a specific position
  private getFirstCheckpointAfter(position: number): number {
    // Implementation details...
    return -1;
  }
  
  /**
   * Handle GPX file selection
   */
  onGpxFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    this.isProcessingGpx = true;
    console.log(`Processing ${input.files.length} GPX files`);
    
    const newRoutes: GpxRoute[] = [];
    let processedFiles = 0;
    let successfulSaves = 0;
    
    // Process each selected file
    Array.from(input.files).forEach(file => {
      console.log(`Reading file: ${file.name}`);
      const reader = new FileReader();
      
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result) {
          const gpxContent = e.target.result as string;
          
          // Parse GPX file
          console.log(`Parsing GPX file: ${file.name}`);
          const gpxRoute = this.gpxService.parseGpxFile(gpxContent, file.name);
          
          if (gpxRoute) {
            console.log(`Successfully parsed route: ${gpxRoute.name}`);
            
            // Add to routes array
            this.gpxRoutes.push(gpxRoute);
            newRoutes.push(gpxRoute);
            
            // Save the route to shared storage (API or IndexedDB)
            this.gpxService.saveRouteToCache(gpxRoute).subscribe(
              success => {
                if (success) {
                  console.log(`Route "${gpxRoute.name}" saved successfully to shared storage`);
                  successfulSaves++;
                } else {
                  console.error(`Failed to save route "${gpxRoute.name}" to shared storage`);
                }
              },
              error => console.error('Error saving route to shared storage:', error)
            );
            
            console.log(`GPX route "${gpxRoute.name}" added with ${gpxRoute.coordinates.length} points and ${gpxRoute.checkpoints?.length || 0} checkpoints`);
          } else {
            console.error(`Failed to parse GPX file: ${file.name}`);
          }
        }
        
        processedFiles++;
        
        // Check if all files have been processed
        if (processedFiles === input.files!.length) {
          this.isProcessingGpx = false;
          
          // Render all new routes
          console.log(`Rendering ${newRoutes.length} new routes`);
          newRoutes.forEach(route => {
            if (route.visible) {
              this.renderGpxRoute(route);
            }
          });
          
          // If we have added at least one route, center the map
          if (newRoutes.length > 0) {
            console.log('Fitting map to show new routes');
            this.fitMapToGpxRoutes();
            
            // Display a success message
            const successMsg = document.createElement('div');
            successMsg.innerText = `Saved ${successfulSaves} routes to shared storage. All users can now see these routes.`;
            successMsg.style.position = 'absolute';
            successMsg.style.top = '20px';
            successMsg.style.left = '50%';
            successMsg.style.transform = 'translateX(-50%)';
            successMsg.style.zIndex = '1000';
            successMsg.style.padding = '12px 24px';
            successMsg.style.backgroundColor = '#4CAF50';
            successMsg.style.color = 'white';
            successMsg.style.borderRadius = '4px';
            successMsg.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            successMsg.style.textAlign = 'center';
            
            document.body.appendChild(successMsg);
            
            // Remove the message after 5 seconds
            setTimeout(() => {
              successMsg.remove();
            }, 7000);
          }
          
          // Clear the input to allow selecting the same file again
          input.value = '';
        }
      };
      
      reader.onerror = () => {
        console.error(`Error reading GPX file: ${file.name}`);
        processedFiles++;
        
        if (processedFiles === input.files!.length) {
          this.isProcessingGpx = false;
          input.value = '';
        }
      };
      
      reader.readAsText(file);
    });
  }
  
  /**
   * Render a GPX route on the map
   */
  renderGpxRoute(route: GpxRoute): void {
    if (!this.map) {
      console.error('Cannot render route: map is not initialized');
      return;
    }
    
    if (!route) {
      console.error('Cannot render route: route is null or undefined');
      return;
    }
    
    console.log(`Rendering route ${route.name} (ID: ${route.id})`);
    
    try {
      // Skip routes without enough coordinates
      if (!route.coordinates || route.coordinates.length < 2) {
        console.error(`Cannot render route ${route.name}: Not enough coordinates (${route.coordinates?.length || 0})`);
        return;
      }
      
      const isSelected = this.selectedRouteId === route.id;
      
      // Force a clean render without any memory of previous renders
      if (route.polyline) {
        console.log(`Removing existing polyline for ${route.name}`);
        this.map.removeLayer(route.polyline);
        route.polyline = undefined;
      }
      
      console.log(`Passing route to renderer: ${route.name} with ${route.coordinates.length} points, isSelected=${isSelected}`);
      this.routeRenderer.renderGpxRoute(route, this.map, isSelected);
      console.log(`Successfully rendered route: ${route.name}`);
    } catch (error) {
      console.error(`Error rendering route ${route.name}:`, error);
    }
  }
  
  /**
   * Toggle the visibility of a GPX route
   */
  toggleGpxRouteVisibility(route: GpxRoute): void {
    route.visible = !route.visible;
    
    // Re-render the route with updated visibility
    if (route.visible) {
      this.renderGpxRoute(route);
    } else if (route.polyline) {
      this.map.removeLayer(route.polyline);
      route.polyline = undefined;
    }
    
    // Fit map to visible routes
    if (this.gpxRoutes.some(r => r.visible)) {
      this.fitMapToGpxRoutes();
    }
  }
  
  /**
   * Calculate total distance of a route in meters
   */
  calculateRouteDistance(coordinates: [number, number][]): number {
    return this.mapUtils.calculateRouteDistance(coordinates);
  }
  
  /**
   * Change color of a GPX route
   */
  changeGpxRouteColor(route: GpxRoute, event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    route.color = color;
    
    // Re-render the route with the new color
    if (route.visible) {
      this.renderGpxRoute(route);
    }
  }
  
  /**
   * Remove a GPX route from the list and map
   */
  removeGpxRoute(routeId: string): void {
    // If we're removing the currently selected route, clear the selection
    if (this.selectedRouteId === routeId) {
      this.selectedRouteId = null;
    }
    
    const index = this.gpxRoutes.findIndex(r => r.id === routeId);
    if (index === -1) return;
    
    const route = this.gpxRoutes[index];
    
    // Remove polyline from map if it exists
    if (route.polyline) {
      this.map.removeLayer(route.polyline);
    }
    
    // Remove any markers associated with the route
    if (route.markers && route.markers.length > 0) {
      route.markers.forEach(marker => {
        this.map.removeLayer(marker);
      });
    }
    
    // Remove any checkpoint markers and circles
    if (route.checkpoints) {
      route.checkpoints.forEach(checkpoint => {
        if (checkpoint.marker) {
          this.map.removeLayer(checkpoint.marker);
        }
        if (checkpoint.circle) {
          this.map.removeLayer(checkpoint.circle);
        }
      });
    }
    
    // Remove route from array
    this.gpxRoutes.splice(index, 1);
    
    // Delete from IndexedDB
    this.gpxService.deleteRoute(routeId).subscribe(
      success => {
        if (success) {
          console.log(`Route ${routeId} successfully deleted from IndexedDB`);
        } else {
          console.error(`Failed to delete route ${routeId} from IndexedDB`);
        }
      },
      error => console.error('Error deleting route:', error)
    );
  }
  
  /**
   * Fit map to show all visible GPX routes
   */
  fitMapToGpxRoutes(): void {
    this.routeRenderer.fitMapToGpxRoutes(this.gpxRoutes, this.map);
  }
  
  /**
   * Clear all GPX routes
   */
  clearAllGpxRoutes(): void {
    // Reset selection
    this.selectedRouteId = null;
    
    // Create a copy of route IDs for deletion
    const routeIds = this.gpxRoutes.map(route => route.id);
    
    // Remove all polylines and markers from map
    this.gpxRoutes.forEach(route => {
      if (route.polyline) {
        this.map.removeLayer(route.polyline);
      }
      
      // Remove all markers associated with the route
      if (route.markers && route.markers.length > 0) {
        route.markers.forEach(marker => {
          this.map.removeLayer(marker);
        });
      }
      
      // Remove checkpoint markers and circles
      if (route.checkpoints) {
        route.checkpoints.forEach(checkpoint => {
          if (checkpoint.marker) {
            this.map.removeLayer(checkpoint.marker);
          }
          if (checkpoint.circle) {
            this.map.removeLayer(checkpoint.circle);
          }
        });
      }
    });
    
    // Clear array
    this.gpxRoutes = [];
    
    // Clear routes from IndexedDB
    routeIds.forEach(id => {
      this.gpxService.deleteRoute(id).subscribe(
        success => {
          if (success) {
            console.log(`Route ${id} successfully deleted from IndexedDB`);
          } else {
            console.error(`Failed to delete route ${id} from IndexedDB`);
          }
        },
        error => console.error('Error deleting route:', error)
      );
    });
  }
  
  /**
   * For demonstration purposes
   */
  addFakeRoute(): void {
    // Disabled during debugging to avoid interfering with real routes
    console.log('addFakeRoute is disabled during debugging');
    // Implementation code would be here
  }
  
  /**
   * Load a route from the server using its ID
   */
  loadRouteFromId(routeId: string): void {
    // Implementation to be added
  }

  /**
   * Select a single route to focus on
   */
  selectRoute(routeIdOrObject: string | GpxRoute): void {
    const routeId = typeof routeIdOrObject === 'string' 
      ? routeIdOrObject 
      : routeIdOrObject.id;
      
    const route = typeof routeIdOrObject === 'string'
      ? this.gpxRoutes.find(r => r.id === routeIdOrObject)
      : routeIdOrObject;
    
    if (!route) {
      console.error(`Cannot select route: Route with ID ${routeId} not found`);
      return;
    }
      
    if (this.selectedRouteId === routeId) {
      // If already selected, just return
      console.log(`Route ${route.name} is already selected`);
      return;
    }

    console.log(`Selecting route: ${route.name}`);
    
    // Store the selected route ID
    this.selectedRouteId = routeId;
    
    // Remember original visibility states for when we clear the selection
    this.gpxRoutes.forEach(r => {
      // Save current visibility state in a hidden property
      (r as any)._previousVisibility = r.visible;
      
      // Only show the selected route
      r.visible = r.id === routeId;
    });
    
    // Re-render all routes
    this.gpxRoutes.forEach(r => {
      if (r.visible) {
        this.renderGpxRoute(r);
      } else if (r.polyline) {
        this.map.removeLayer(r.polyline);
        r.polyline = undefined;
        
        // Remove any markers associated with the route
        if (r.markers && r.markers.length > 0) {
          r.markers.forEach(marker => {
            this.map.removeLayer(marker);
          });
          r.markers = [];
        }
        
        // Remove any checkpoint markers and circles
        if (r.checkpoints) {
          r.checkpoints.forEach(checkpoint => {
            if (checkpoint.marker) {
              this.map.removeLayer(checkpoint.marker);
              checkpoint.marker = undefined;
            }
            if (checkpoint.circle) {
              this.map.removeLayer(checkpoint.circle);
              checkpoint.circle = undefined;
            }
          });
        }
      }
    });
    
    // Fit the map to show the selected route
    this.fitMapToGpxRoutes();
  }
  
  /**
   * Clear route selection and show all routes with their original visibility
   */
  clearRouteSelection(): void {
    if (!this.selectedRouteId) return;
    
    // Clear the selected route ID
    this.selectedRouteId = null;
    
    // Restore previous visibility states
    this.gpxRoutes.forEach(r => {
      if ((r as any)._previousVisibility !== undefined) {
        r.visible = (r as any)._previousVisibility;
        delete (r as any)._previousVisibility;
      }
    });
    
    // Re-render all routes
    this.gpxRoutes.forEach(r => {
      if (r.visible) {
        this.renderGpxRoute(r);
      } else if (r.polyline) {
        this.map.removeLayer(r.polyline);
        r.polyline = undefined;
      }
    });
    
    // Fit the map to show all visible routes
    this.fitMapToGpxRoutes();
  }

  /**
   * Open a route in a new window
   */
  openRouteInNewWindow(routeId: string): void {
    const route = this.gpxRoutes.find(r => r.id === routeId);
    if (!route) return;
    
    // Save the route to the cache so it can be retrieved in the new window
    this.gpxService.saveRouteToCache(route).subscribe(success => {
      if (success) {
        // Open the route in a new window
        const url = this.router.serializeUrl(
          this.router.createUrlTree(['/route', routeId])
        );
        window.open(url, '_blank');
      } else {
        console.error('Failed to save route to cache before opening new window');
      }
    });
  }

  /**
   * Debug method to reload routes from IndexedDB
   */
  reloadRoutesFromIndexedDB(): void {
    console.log('Manually reloading routes from IndexedDB...');
    
    // Clear current routes
    this.clearAllGpxRoutes();
    
    // Load routes from IndexedDB
    this.gpxService.loadAllRoutesFromDB().subscribe(
      (routes: GpxRoute[]) => {
        if (routes && routes.length > 0) {
          console.log(`Manually loaded ${routes.length} routes from IndexedDB`);
          
          // Assign loaded routes
          this.gpxRoutes = routes;
          
          // Force validation of coordinates
          this.gpxRoutes.forEach(route => {
            if (route.coordinates) {
              console.log(`Route ${route.name} has ${route.coordinates.length} coordinates`);
              
              // Force all routes to be visible
              route.visible = true;
              
              // Make sure coordinates are valid
              route.coordinates = route.coordinates.filter((coord: any) => {
                if (Array.isArray(coord)) {
                  return coord.length === 2 && 
                        !isNaN(Number(coord[0])) && 
                        !isNaN(Number(coord[1]));
                } else if (coord && typeof coord === 'object' && 'lat' in coord && 'lng' in coord) {
                  // Convert object format to array format
                  return !isNaN(Number(coord.lat)) && 
                        !isNaN(Number(coord.lng));
                }
                return false;
              });
              
              console.log(`After validation, route ${route.name} has ${route.coordinates.length} coordinates`);
            } else {
              console.warn(`Route ${route.name} has no coordinates`);
            }
          });
          
          // Render routes after a brief delay
          setTimeout(() => {
            console.log('Rendering manually loaded routes');
            this.renderLoadedRoutes();
          }, 100);
        } else {
          console.log('No routes found in IndexedDB during manual reload');
        }
      },
      error => {
        console.error('Error during manual reload of routes from IndexedDB:', error);
      }
    );
  }

  /**
   * Dump route information to the console for debugging
   */
  dumpRouteInfo(): void {
    console.log('=== DEBUG: ROUTE INFORMATION ===');
    console.log(`Total routes in array: ${this.gpxRoutes?.length || 0}`);
    
    if (this.gpxRoutes && this.gpxRoutes.length > 0) {
      this.gpxRoutes.forEach((route, index) => {
        console.log(`---`);
        console.log(`Route ${index+1}: ${route.name} (ID: ${route.id})`);
        console.log(`Visible: ${route.visible}`);
        console.log(`Color: ${route.color}`);
        console.log(`Coordinates: ${route.coordinates?.length || 0}`);
        
        if (route.coordinates && route.coordinates.length > 0) {
          // Sample a few coordinates
          console.log(`First few coordinates: ${JSON.stringify(route.coordinates.slice(0, 2))}`);
          
          // Check if coordinates look valid
          const validCoords = route.coordinates.filter(coord => 
            Array.isArray(coord) && 
            coord.length === 2 && 
            !isNaN(Number(coord[0])) && 
            !isNaN(Number(coord[1]))
          );
          
          console.log(`Valid coordinates: ${validCoords.length} of ${route.coordinates.length}`);
        }
        
        console.log(`Checkpoints: ${route.checkpoints?.length || 0}`);
        console.log(`Has polyline: ${route.polyline ? 'yes' : 'no'}`);
      });
    } else {
      console.log('No routes available to dump');
      
      // Try querying database directly
      console.log('Attempting to query database directly...');
      this.gpxService.loadAllRoutesFromDB().subscribe(
        (routes: GpxRoute[]) => {
          console.log(`Database query returned ${routes?.length || 0} routes`);
          if (routes && routes.length > 0) {
            const sampleRoute = routes[0];
            console.log(`Sample route in DB: ${sampleRoute.name}, visible: ${sampleRoute.visible}, coords: ${sampleRoute.coordinates?.length || 0}`);
          }
        }
      );
    }
  }

  /**
   * Load routes from the server
   */
  private loadRoutesFromServer(): void {
    console.log('Loading routes from server or local storage...');

    // Attempt to load routes from server or local storage
    this.gpxService.loadAllRoutes().subscribe(
      routes => {
        if (routes.length > 0) {
          console.log(`Loaded ${routes.length} routes from storage`);
          
          // Add the routes to our local array 
          this.gpxRoutes = routes;
          
          // Render routes on the map if it's initialized
          setTimeout(() => {
            this.renderLoadedRoutes();
          }, 500); // Small delay to ensure map is ready
        } else {
          console.log('No saved routes found');
        }
      },
      error => console.error('Error loading routes:', error)
    );
  }

  /**
   * Render the loaded routes on the map
   */
  private renderLoadedRoutes(): void {
    if (!this.map) {
      console.error('Cannot render routes: Map is not initialized');
      return;
    }

    // Filter to only visible routes
    const visibleRoutes = this.gpxRoutes.filter(route => route.visible);
    
    if (visibleRoutes.length === 0) {
      console.log('No routes to render from storage');
      return;
    }
    
    console.log(`Rendering ${visibleRoutes.length} routes from storage`);
    
    // Render each route
    visibleRoutes.forEach(route => {
      console.log(`Rendering route: "${route.name}" with visibility ${route.visible}`);
      this.renderGpxRoute(route);
    });
    
    // Fit map to show all visible routes
    this.fitMapToGpxRoutes();
  }
}
