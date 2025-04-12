import { Injectable } from '@angular/core';
import { Subject, Observable, from, of, switchMap, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { GpxRoute } from '../interfaces/route.interface';
import { MapUtilsService } from './map-utils.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ACPBrevetCalculator, ControlTime } from './acp-brevet-calculator';

@Injectable({
  providedIn: 'root'
})
export class GpxService {
  // Store routes in memory to share between components
  private routeCache = new Map<string, GpxRoute>();
  
  // Backend API URL
  private readonly API_URL = environment.apiUrl || 'http://localhost:3000/api';
  
  // IndexedDB as primary storage (for offline support)
  private readonly DB_NAME = 'gpx_routes_db';
  private readonly STORE_NAME = 'routes';
  private readonly DB_VERSION = 1;
  
  // Database connection
  private db: IDBDatabase | null = null;
  
  // Subject to notify when database is ready
  private dbReady = new Subject<boolean>();
  
  // Flag to determine if we should use API or IndexedDB - default to IndexedDB
  private useApi = false;

  constructor(
    private mapUtils: MapUtilsService,
    private http: HttpClient
  ) {
    // Initialize IndexedDB as primary storage method
    this.initIndexedDB();
    
    console.log(`Using IndexedDB for route storage`);
  }
  
  /**
   * Check if API is available (not used - API disabled)
   */
  private checkApiAvailability(): void {
    // Method kept for reference but not used
    console.log('API availability check skipped - using IndexedDB by default');
    this.useApi = false;
  }
  
  /**
   * Initialize IndexedDB
   */
  private initIndexedDB(): void {
    const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      this.dbReady.next(false);
    };
    
    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      console.log('IndexedDB connection established successfully');
      
      // Set up error handler for database
      this.db.onerror = (event) => {
        console.error('Database error:', event);
      };
      
      this.dbReady.next(true);
      
      // Always load cached routes from IndexedDB
      this.loadAllRoutesFromDB().subscribe(
        routes => console.log(`Loaded ${routes.length} routes from IndexedDB`),
        error => console.error('Error loading routes from IndexedDB:', error)
      );
    };
    
    request.onupgradeneeded = (event) => {
      console.log('Upgrading or creating IndexedDB database');
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store for routes
      if (!db.objectStoreNames.contains(this.STORE_NAME)) {
        const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        console.log('Created routes store in IndexedDB');
      }
    };
  }

  /**
   * Save a route to both in-memory cache and IndexedDB
   */
  saveRouteToCache(route: GpxRoute): Observable<boolean> {
    console.log(`Attempting to save route "${route.name}" to cache and storage`);
    
    // Save to in-memory cache
    try {
      this.routeCache.set(route.id, JSON.parse(JSON.stringify(route)));
      console.log(`Route "${route.name}" saved to in-memory cache`);
    } catch (error) {
      console.error('Error saving to in-memory cache:', error);
    }
    
    // Always use IndexedDB for storage
    // If database isn't ready yet, wait for it
    if (!this.db) {
      console.log('Database not ready, waiting for initialization');
      
      return new Observable<boolean>(observer => {
        // Subscribe to the dbReady event
        const subscription = this.dbReady.subscribe(ready => {
          if (!ready || !this.db) {
            console.error('Database failed to initialize properly');
            observer.next(false);
            observer.complete();
            return;
          }
          
          console.log('Database is now ready, proceeding with save');
          
          // Now perform the actual save
          this.saveRouteToDB(route).subscribe(
            success => {
              observer.next(success);
              observer.complete();
            },
            error => {
              console.error('Error in saveRouteToDB:', error);
              observer.next(false);
              observer.complete();
            }
          );
        });
        
        // Cleanup subscription when this observable is unsubscribed
        return () => {
          subscription.unsubscribe();
        };
      });
    }
    
    // Database is ready, save directly
    return this.saveRouteToDB(route);
  }
  
  /**
   * Save a route to the backend API
   */
  private saveRouteToAPI(route: GpxRoute): Observable<boolean> {
    console.log(`Saving route "${route.name}" to API`);
    
    // Handle circular reference issues by creating a clean copy
    const cleanRoute: any = JSON.parse(JSON.stringify(route));
    
    // Explicitly ensure visible property is set (defaults to true if not set)
    cleanRoute.visible = cleanRoute.visible !== false;
    
    // Remove any Leaflet-specific properties that could cause issues
    delete cleanRoute.polyline;
    delete cleanRoute.markers;
    
    if (cleanRoute.checkpoints) {
      cleanRoute.checkpoints.forEach((checkpoint: any) => {
        delete checkpoint.marker;
        delete checkpoint.circle;
      });
    }
    
    // Use gpxId to match the backend model
    cleanRoute.gpxId = cleanRoute.id;
    
    return this.http.post<any>(`${this.API_URL}/routes/gpx/upload`, cleanRoute)
      .pipe(
        map(response => {
          if (response && response.success) {
            console.log(`Route "${route.name}" (ID: ${route.id}) successfully saved to API`);
            return true;
          } else {
            console.error(`Error saving route "${route.name}" to API:`, response);
            return false;
          }
        }),
        catchError(error => {
          console.error(`Error saving route "${route.name}" to API:`, error);
          
          // Fallback to IndexedDB if API fails
          console.log(`Falling back to IndexedDB for route "${route.name}"`);
          return this.saveRouteToDB(route);
        })
      );
  }
  
  /**
   * Save a route to IndexedDB
   */
  private saveRouteToDB(route: GpxRoute): Observable<boolean> {
    console.log(`Saving route "${route.name}" to IndexedDB`);
    
    return new Observable<boolean>(observer => {
      if (!this.db) {
        console.error('Database is not initialized');
        observer.next(false);
        observer.complete();
        return;
      }
      
      try {
        // Handle circular reference issues by creating a clean copy
        const cleanRoute = JSON.parse(JSON.stringify(route));
        
        // Explicitly ensure visible property is set (defaults to true if not set)
        cleanRoute.visible = cleanRoute.visible !== false;
        console.log(`Saving route with visibility: ${cleanRoute.visible}`);
        
        // Remove any Leaflet-specific properties that could cause issues
        delete cleanRoute.polyline;
        delete cleanRoute.markers;
        
        if (cleanRoute.checkpoints) {
          cleanRoute.checkpoints.forEach((checkpoint: any) => {
            delete checkpoint.marker;
            delete checkpoint.circle;
          });
        }
        
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        
        transaction.oncomplete = () => {
          console.log(`Transaction completed for route "${route.name}"`);
        };
        
        transaction.onerror = (event) => {
          console.error(`Transaction error for route "${route.name}":`, event);
        };
        
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.put(cleanRoute);
        
        request.onsuccess = () => {
          console.log(`Route "${route.name}" (ID: ${route.id}) successfully saved to IndexedDB`);
          observer.next(true);
          observer.complete();
        };
        
        request.onerror = (event) => {
          console.error(`Error saving route "${route.name}" to IndexedDB:`, event);
          observer.next(false);
          observer.complete();
        };
      } catch (error) {
        console.error(`Transaction error for route "${route.name}":`, error);
        observer.next(false);
        observer.complete();
      }
    });
  }
  
  /**
   * Get a route by ID from cache or storage
   */
  getRoute(id: string): Observable<GpxRoute | null> {
    // Check in-memory cache first
    const cachedRoute = this.routeCache.get(id);
    if (cachedRoute) {
      console.log(`Route ${id} found in memory cache`);
      return of(cachedRoute);
    }
    
    // Route not in memory, get from storage
    console.log(`Route ${id} not in memory cache, fetching from IndexedDB`);
    return this.getRouteFromDB(id);
  }
  
  /**
   * Get a route from API
   */
  private getRouteFromAPI(id: string): Observable<GpxRoute | null> {
    return this.http.get<any>(`${this.API_URL}/routes/gpx/${id}`)
      .pipe(
        map(response => {
          if (response && response.success && response.route) {
            const route = response.route as GpxRoute;
            // Update in-memory cache
            this.routeCache.set(id, route);
            return route;
          } else {
            return null;
          }
        }),
        catchError(error => {
          console.error(`Error getting route ${id} from API:`, error);
          
          // Fallback to IndexedDB if API fails
          console.log(`Falling back to IndexedDB for route ${id}`);
          return this.getRouteFromDB(id);
        })
      );
  }
  
  /**
   * Get a route from IndexedDB
   */
  private getRouteFromDB(id: string): Observable<GpxRoute | null> {
    return new Observable<GpxRoute | null>(observer => {
      if (!this.db) {
        observer.next(null);
        observer.complete();
        return;
      }
      
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => {
          const route = request.result as GpxRoute;
          if (route) {
            // Update in-memory cache
            this.routeCache.set(id, route);
            observer.next(route);
          } else {
            observer.next(null);
          }
          observer.complete();
        };
        
        request.onerror = () => {
          console.error(`Error getting route ${id} from IndexedDB`);
          observer.next(null);
          observer.complete();
        };
      } catch (error) {
        console.error('Transaction error:', error);
        observer.next(null);
        observer.complete();
      }
    });
  }

  /**
   * Save multiple routes to cache and storage
   */
  saveRoutesToCache(routes: GpxRoute[]): Observable<boolean> {
    // Save each route to in-memory cache and storage
    if (routes.length === 0) {
      return of(true);
    }
    
    return new Observable<boolean>(observer => {
      let completedCount = 0;
      let allSuccessful = true;
      
      // Process each route
      routes.forEach(route => {
        this.saveRouteToCache(route).subscribe(
          success => {
            if (!success) {
              allSuccessful = false;
            }
            
            completedCount++;
            if (completedCount === routes.length) {
              observer.next(allSuccessful);
              observer.complete();
            }
          },
          error => {
            console.error(`Error saving route ${route.id}:`, error);
            allSuccessful = false;
            
            completedCount++;
            if (completedCount === routes.length) {
              observer.next(allSuccessful);
              observer.complete();
            }
          }
        );
      });
    });
  }
  
  /**
   * Load all routes from API
   */
  loadAllRoutesFromAPI(): Observable<GpxRoute[]> {
    return this.http.get<any>(`${this.API_URL}/routes/gpx`)
      .pipe(
        map(response => {
          if (response && response.success && response.routes) {
            const routes = response.routes as GpxRoute[];
            
            if (routes && routes.length > 0) {
              // Ensure all routes have the visible property set
              for (const route of routes) {
                // Default to visible if not explicitly set to false
                route.visible = route.visible !== false;
                console.log(`Loaded route "${route.name}" with visibility: ${route.visible}`);
              }
              
              // Update in-memory cache
              routes.forEach(route => {
                // Ensure we have a valid string key for the cache
                const cacheKey = route.id || route.gpxId || `route-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                // Assign the ID if it was missing
                if (!route.id) {
                  route.id = cacheKey;
                }
                this.routeCache.set(cacheKey, route);
              });
            }
            
            return routes;
          } else {
            return [];
          }
        }),
        catchError(error => {
          console.error('Error loading routes from API:', error);
          
          // Fallback to IndexedDB if API fails
          console.log('Falling back to IndexedDB for loading all routes');
          return this.loadAllRoutesFromDB();
        })
      );
  }
  
  /**
   * Load all routes from IndexedDB
   */
  loadAllRoutesFromDB(): Observable<GpxRoute[]> {
    return new Observable<GpxRoute[]>(observer => {
      if (!this.db) {
        observer.next([]);
        observer.complete();
        return;
      }
      
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const routes = request.result as GpxRoute[];
          
          if (routes && routes.length > 0) {
            // Ensure all routes have the visible property set
            for (const route of routes) {
              // Default to visible if not explicitly set to false
              route.visible = route.visible !== false;
              console.log(`Loaded route "${route.name}" with visibility: ${route.visible}`);
            }
          }
          
          // Update in-memory cache
          routes.forEach(route => {
            this.routeCache.set(route.id, route);
          });
          
          observer.next(routes);
          observer.complete();
        };
        
        request.onerror = () => {
          console.error('Error loading routes from IndexedDB');
          observer.next([]);
          observer.complete();
        };
      } catch (error) {
        console.error('Transaction error:', error);
        observer.next([]);
        observer.complete();
      }
    });
  }
  
  /**
   * Load all routes from either API or IndexedDB
   */
  loadAllRoutes(): Observable<GpxRoute[]> {
    // Always use IndexedDB instead of API
    return this.loadAllRoutesFromDB();
  }
  
  /**
   * Delete route from cache and storage
   */
  deleteRoute(id: string): Observable<boolean> {
    console.log(`Deleting route ${id}`);
    
    // Remove from in-memory cache
    this.routeCache.delete(id);
    
    // Delete from IndexedDB storage
    return this.deleteRouteFromDB(id);
  }
  
  /**
   * Delete a route from IndexedDB
   */
  private deleteRouteFromDB(id: string): Observable<boolean> {
    // Remove from IndexedDB
    return new Observable<boolean>(observer => {
      if (!this.db) {
        observer.next(false);
        observer.complete();
        return;
      }
      
      try {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => {
          console.log(`Route ${id} deleted from IndexedDB`);
          observer.next(true);
          observer.complete();
        };
        
        request.onerror = () => {
          console.error(`Error deleting route ${id} from IndexedDB`);
          observer.next(false);
          observer.complete();
        };
      } catch (error) {
        console.error('Transaction error:', error);
        observer.next(false);
        observer.complete();
      }
    });
  }

  /**
   * Parse GPX file and extract route data
   * @param gpxContent The content of the GPX file
   * @param fileName Name of the file
   * @returns GpxRoute object or null if parsing failed
   */
  parseGpxFile(gpxContent: string, fileName: string): GpxRoute | null {
    try {
      // Parse GPX content
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');
      
      // Get route name from file name (removing extension)
      let routeName = fileName.replace(/\.[^/.]+$/, "");
      
      // Extract track points
      const trackPoints = gpxDoc.querySelectorAll('trkpt');
      const coordinates: [number, number][] = [];
      const elevationData: number[] = [];
      
      console.log(`Parsing ${trackPoints.length} track points from GPX file: ${fileName}`);
      
      if (trackPoints.length === 0) {
        console.error('No track points found in GPX file');
        return null;
      }
      
      // Extract coordinates from each track point
      let validPoints = 0;
      trackPoints.forEach(trackPoint => {
        const lat = parseFloat(trackPoint.getAttribute('lat') || '');
        const lon = parseFloat(trackPoint.getAttribute('lon') || '');
        const ele = parseFloat(trackPoint.querySelector('ele')?.textContent || '0');
        
        // Validate latitude and longitude
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          console.warn(`Invalid coordinates found: lat=${lat}, lon=${lon} - skipping point`);
          return;
        }
        
        coordinates.push([lat, lon]);
        elevationData.push(isNaN(ele) ? 0 : ele);
        validPoints++;
      });
      
      console.log(`Extracted ${validPoints} valid coordinates out of ${trackPoints.length} track points`);
      
      // Check if we have enough valid coordinates
      if (coordinates.length < 2) {
        console.error('Not enough valid coordinates found in GPX file (minimum 2 needed)');
        return null;
      }
      
      // Extract waypoints as checkpoints
      const waypoints = gpxDoc.querySelectorAll('wpt');
      const checkpoints: { lat: number; lng: number; name: string; description?: string }[] = [];
      
      console.log(`Found ${waypoints.length} waypoints in GPX file`);
      
      /**
       * Check if a waypoint is a navigation instruction (turn, continue, etc.)
       * These should be excluded from checkpoints
       */
      const isNavigationInstruction = (name: string, desc?: string): boolean => {
        if (!name && !desc) return false;
        
        const textLower = (name + ' ' + (desc || '')).toLowerCase();
        const navTerms = ['turn', 'left', 'right', 'continue', 'straight', 'onto', 'head'];
        
        return navTerms.some(term => textLower.includes(term));
      };
      
      /**
       * Check if a waypoint name represents a checkpoint
       * This looks for variations of checkpoint naming
       * 
       * Example of a checkpoint waypoint in GPX file:
       * <wpt lat="65.26199" lon="19.6604">
       *   <n>checkpoint</n>
       *   <desc></desc>
       *   <sym>Checkpoint</sym>
       *   <type>Checkpoint</type>
       * </wpt>
       */
      const isCheckpoint = (name: string, symbol?: string, type?: string): boolean => {
        const nameLower = name.toLowerCase();
        // Set defaults and handle undefined values properly
        const symbolLower = symbol ? symbol.toLowerCase() : '';
        const typeLower = type ? type.toLowerCase() : '';
        
        const checkpointVariations = [
          'checkpoint', 'check point', 'chk', 'cp', 'kontroll'
        ];
        
        // Exact match is preferred over partial match
        const exactMatch = checkpointVariations.some(variation => 
          nameLower === variation || 
          symbolLower === variation || 
          typeLower === variation
        );
        
        if (exactMatch) return true;
        
        // Check for substring match only if there's no exact match
        return checkpointVariations.some(variation => 
          nameLower.includes(variation) || 
          symbolLower.includes(variation) || 
          typeLower.includes(variation)
        );
      };
      
      waypoints.forEach(waypoint => {
        const lat = parseFloat(waypoint.getAttribute('lat') || '');
        const lon = parseFloat(waypoint.getAttribute('lon') || '');
        
        // Validate latitude and longitude
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          console.warn(`Invalid waypoint coordinates found: lat=${lat}, lon=${lon} - skipping waypoint`);
          return;
        }
        
        const name = waypoint.querySelector('name')?.textContent || 'Unnamed';
        const descElement = waypoint.querySelector('desc');
        const description = descElement?.textContent || undefined;
        const symbol = waypoint.querySelector('sym')?.textContent || '';
        const type = waypoint.querySelector('type')?.textContent || '';
        
        // Skip navigation instructions
        if (isNavigationInstruction(name, description)) {
          console.log(`Skipping navigation waypoint: ${name}`);
          return;
        }
        
        // Only add waypoints that are identified as checkpoints
        if (isCheckpoint(name, symbol, type)) {
          console.log(`Adding checkpoint waypoint: ${name}`);
          checkpoints.push({
            lat,
            lng: lon,
            name,
            description
          });
        } else {
          console.log(`Skipping non-checkpoint waypoint: ${name}`);
        }
      });
      
      console.log(`Added ${checkpoints.length} checkpoint waypoints from GPX file`);
      
      // Create a unique ID for this route
      const routeId = 'gpx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      
      console.log(`Creating route with ID: ${routeId}, Name: ${routeName}, Coordinates: ${coordinates.length}`);
      if (coordinates.length > 0) {
        console.log(`First few coordinates: ${JSON.stringify(coordinates.slice(0, 3))}`);
      }
      
      // Create a new GPX route object
      const gpxRoute: GpxRoute = {
        id: routeId,
        name: routeName,
        coordinates,
        elevationData,
        color: this.mapUtils.getRandomColor(),
        visible: true,
        checkpoints: checkpoints.length > 0 ? checkpoints : undefined
      };
      
      console.log(`Successfully parsed GPX file: ${fileName}`);
      return gpxRoute;
    } catch (error) {
      console.error('Error processing GPX file:', error);
      return null;
    }
  }
  
  /**
   * Parse GPX file for distance calculation (used by calculator component)
   * @param fileContent The content of the GPX file
   * @returns Total distance and track points
   */
  calculateGpxDistance(fileContent: string): {
    totalDistance: number,
    trackPoints: { distance: number, lat: number, lng: number }[]
  } {
    try {
      const parser = new DOMParser();
      const gpx = parser.parseFromString(fileContent, 'text/xml');
      
      // Extract track points from GPX
      const trackPoints: { lat: number, lng: number, distance: number }[] = [];
      const trackPointElements = gpx.querySelectorAll('trkpt');
      
      // Calculate total distance and process track points
      let totalDistance = 0;
      let prevPoint: { lat: number, lng: number } | null = null;
      
      trackPointElements.forEach((point) => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lng = parseFloat(point.getAttribute('lon') || '0');
        
        if (prevPoint) {
          const segmentDistance = this.calculateDistance(
            prevPoint.lat, prevPoint.lng, lat, lng
          );
          totalDistance += segmentDistance;
        }
        
        trackPoints.push({
          lat,
          lng,
          distance: totalDistance
        });
        
        prevPoint = { lat, lng };
      });
      
      return {
        totalDistance, // in kilometers
        trackPoints
      };
    } catch (error) {
      console.error('Error parsing GPX file:', error);
      throw new Error('Failed to parse GPX file');
    }
  }
  
  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 Latitude of point 1
   * @param lon1 Longitude of point 1
   * @param lat2 Latitude of point 2
   * @param lon2 Longitude of point 2
   * @returns Distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
  
  /**
   * Calculate control points at regular intervals
   * @param totalDistance Total route distance in kilometers
   * @param interval Interval between control points in kilometers
   * @returns Array of distances for control points
   */
  calculateControlPoints(totalDistance: number, interval: number = 50): number[] {
    const controlPoints: number[] = [0]; // Start point
    let currentDistance = interval;
    
    while (currentDistance < totalDistance) {
      controlPoints.push(currentDistance);
      currentDistance += interval;
    }
    
    // Add finish point if not already included
    if (controlPoints[controlPoints.length - 1] !== totalDistance) {
      controlPoints.push(totalDistance);
    }
    
    return controlPoints;
  }
  
  /**
   * Calculate control times using ACP rules
   * @param totalDistance Total route distance
   * @param startTime Start time of the brevet
   * @param controlPoints Array of control point distances
   * @returns Array of control times
   */
  calculateControlTimes(
    totalDistance: number, 
    startTime: Date | string,
    controlPoints: number[]
  ): ControlTime[] {
    const calculator = new ACPBrevetCalculator(totalDistance, startTime);
    return calculator.calculateControls(controlPoints);
  }
  
  /**
   * Generate text file with control points and time limits
   * @param controlTimes Array of control times
   * @param routeName Optional name of the route
   * @returns Text content for download
   */
  generateControlTimesTextFile(controlTimes: ControlTime[], routeName?: string): string {
    let content = '';
    
    if (routeName) {
      content += `Route: ${routeName}\n`;
    }
    
    content += `Total Distance: ${controlTimes[controlTimes.length - 1].distance.toFixed(1)} km\n\n`;
    content += 'Control Points:\n';
    content += '--------------------------------------------------------------------------------\n';
    content += 'Distance (km) | Opening Time           | Closing Time          \n';
    content += '--------------------------------------------------------------------------------\n';
    
    controlTimes.forEach(control => {
      const openingDateTime = control.openingDatetime.toLocaleString();
      const closingDateTime = control.closingDatetime.toLocaleString();
      content += `${control.distance.toFixed(1).padEnd(13)} | ${openingDateTime.padEnd(22)} | ${closingDateTime.padEnd(22)}\n`;
    });
    
    return content;
  }
  
  /**
   * Download content as a text file
   * @param content Text content
   * @param filename Filename for download
   */
  downloadTextFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
} 