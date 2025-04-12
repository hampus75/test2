import { Component, OnInit, OnDestroy } from '@angular/core';
import { GpxCalculatorService, GpxCheckpoint } from '../../services/gpx-calculator.service';
import { ControlTime } from '../../services/acp-brevet-calculator';
import { TimeFormatService } from '../../services/time-format.service';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';

@Component({
  selector: 'app-gpx-calculator',
  templateUrl: './gpx-calculator.component.html',
  styleUrls: ['./gpx-calculator.component.css']
})
export class GpxCalculatorComponent implements OnInit, OnDestroy {
  isLoading = false;
  gpxFile: File | null = null;
  fileName = '';
  routeName = '';
  totalDistance = 0;
  controlInterval = 50; // Default interval in kilometers
  startTime: string = '';
  controlPoints: number[] = [];
  controlTimes: ControlTime[] = [];
  errorMessage = '';
  processCompleted = false;
  
  // Time format
  use24HourFormat = false;
  private timeFormatSubscription: Subscription | null = null;
  
  // GPX checkpoints
  useGpxCheckpoints = false;
  gpxCheckpoints: GpxCheckpoint[] = [];
  checkpointNames: string[] = [];
  
  // Predefined brevet distances
  brevetDistances = [200, 300, 400, 600, 1000, 1200];
  selectedDistance = 200;
  
  // Map related properties
  private map: L.Map | null = null;
  private routeLayer: L.Polyline | null = null;
  private markerLayers: L.Marker[] = [];
  private circleLayers: L.Circle[] = [];
  private dotMarkers: L.CircleMarker[] = []; // Array to track dot markers
  private trackPoints: { lat: number, lng: number, distance: number }[] = [];
  
  // Control point radius in meters - brevet standard is often 200-300m
  public controlRadius: number = 200;

  constructor(
    private gpxCalculatorService: GpxCalculatorService,
    private timeFormatService: TimeFormatService
  ) {}

  ngOnInit(): void {
    // Subscribe to time format changes
    this.timeFormatSubscription = this.timeFormatService.use24HourFormat$.subscribe(
      use24Hour => {
        this.use24HourFormat = use24Hour;
        // Update control markers to reflect new time format
        if (this.processCompleted) {
          this.updateControlMarkers();
        }
      }
    );
    
    // Initialize with current date/time
    const now = new Date();
    const localDateTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);
    this.startTime = localDateTime;
  }
  
  ngOnDestroy(): void {
    // Clean up the map when component is destroyed
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.routeLayer = null;
      this.markerLayers = [];
      this.circleLayers = [];
      this.dotMarkers = [];
    }
    
    // Unsubscribe from time format service
    if (this.timeFormatSubscription) {
      this.timeFormatSubscription.unsubscribe();
      this.timeFormatSubscription = null;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.gpxFile = input.files[0];
      this.fileName = this.gpxFile.name;
      this.routeName = this.fileName.replace(/\.[^/.]+$/, ""); // Remove extension
      this.errorMessage = '';
      this.processCompleted = false;
      this.gpxCheckpoints = [];
    }
  }

  onSelectPredefinedDistance(distance: number): void {
    this.selectedDistance = distance;
    this.totalDistance = distance;
    this.calculateWithoutGpx();
  }

  toggleUseGpxCheckpoints(): void {
    this.useGpxCheckpoints = !this.useGpxCheckpoints;
    
    // If we have already processed a GPX file, recalculate with new setting
    if (this.gpxFile && this.gpxCheckpoints.length > 0) {
      this.processGpxFile();
    }
  }

  calculateWithoutGpx(): void {
    if (this.totalDistance <= 0) {
      this.errorMessage = 'Please enter a valid distance.';
      return;
    }

    if (!this.startTime) {
      this.errorMessage = 'Please enter a valid start time.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.processCompleted = false;

    try {
      // Calculate control points at regular intervals
      this.controlPoints = this.gpxCalculatorService.calculateControlPoints(this.totalDistance, this.controlInterval);
      
      // Calculate control times using ACP rules
      this.controlTimes = this.gpxCalculatorService.calculateControlTimes(
        this.totalDistance, 
        new Date(this.startTime),
        this.controlPoints
      );
      
      // Clear checkpoint names for manual calculation
      this.checkpointNames = [];
      
      // We don't have actual track points for manual calculation
      this.trackPoints = [];
      
      this.isLoading = false;
      this.processCompleted = true;
      
      // Initialize map with a simple straight line for manually entered distances
      setTimeout(() => {
        this.initializeMap();
        this.renderSimplifiedRoute();
      }, 100);
    } catch (error) {
      this.isLoading = false;
      this.errorMessage = 'Failed to calculate control times.';
      console.error('Error calculating control times:', error);
    }
  }

  processGpxFile(): void {
    if (!this.gpxFile) {
      this.errorMessage = 'Please select a GPX file first.';
      return;
    }

    if (!this.startTime) {
      this.errorMessage = 'Please enter a valid start time.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.processCompleted = false;

    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const content = e.target?.result as string;
        
        // Parse GPX file to get distance, track points, and checkpoints
        const gpxData = this.gpxCalculatorService.calculateGpxDistance(content);
        this.totalDistance = gpxData.totalDistance;
        this.trackPoints = gpxData.trackPoints;
        
        // Store GPX checkpoints if they exist
        this.gpxCheckpoints = gpxData.checkpoints || [];
        
        if (this.useGpxCheckpoints && this.gpxCheckpoints.length > 0) {
          console.log(`Using ${this.gpxCheckpoints.length} checkpoints from GPX file`);
          
          // Use the checkpoint distances as control points
          this.controlPoints = this.gpxCalculatorService.getControlPointsFromCheckpoints(
            this.gpxCheckpoints, 
            this.totalDistance
          );
          
          // Store checkpoint names for display
          this.checkpointNames = this.controlPoints.map(distance => {
            if (distance === 0) return 'Start';
            if (distance === this.totalDistance) return 'Finish';
            
            // Find the checkpoint closest to this distance
            const checkpoint = this.gpxCheckpoints.find(cp => 
              Math.abs(cp.distance - distance) < 0.1
            );
            
            return checkpoint?.name || '';
          });
        } else {
          // Calculate control points at regular intervals
          this.controlPoints = this.gpxCalculatorService.calculateControlPoints(
            this.totalDistance, 
            this.controlInterval
          );
          
          // Clear checkpoint names when not using GPX checkpoints
          this.checkpointNames = [];
        }
        
        // Calculate control times using ACP rules
        this.controlTimes = this.gpxCalculatorService.calculateControlTimes(
          this.totalDistance, 
          new Date(this.startTime),
          this.controlPoints
        );
        
        this.isLoading = false;
        this.processCompleted = true;
        
        // Initialize map and render GPX route
        setTimeout(() => {
          this.initializeMap();
          this.renderGpxRoute();
        }, 100);
      } catch (error) {
        this.isLoading = false;
        this.errorMessage = 'Failed to process GPX file. Please ensure it is a valid GPX format.';
        console.error('Error processing GPX file:', error);
      }
    };
    
    reader.onerror = () => {
      this.isLoading = false;
      this.errorMessage = 'Error reading the file.';
    };
    
    reader.readAsText(this.gpxFile);
  }

  initializeMap(): void {
    // If map already exists, clean it up first
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.routeLayer = null;
      this.markerLayers = [];
      this.circleLayers = [];
      this.dotMarkers = [];
    }
    
    // Create new map
    this.map = L.map('control-map', {
      center: [51.505, -0.09], // Default center
      zoom: 13
    });
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);
  }
  
  renderGpxRoute(): void {
    if (!this.map || this.trackPoints.length === 0) return;
    
    // Create polyline from track points
    const latlngs = this.trackPoints.map(point => [point.lat, point.lng] as L.LatLngExpression);
    this.routeLayer = L.polyline(latlngs, {
      color: '#3388ff',
      weight: 5,
      opacity: 0.7
    }).addTo(this.map);
    
    // Fit map to route
    this.map.fitBounds(this.routeLayer.getBounds());
    
    // Add control point markers
    this.addControlMarkers();
  }
  
  renderSimplifiedRoute(): void {
    if (!this.map || this.controlPoints.length < 2) return;
    
    // For manually entered distances, create a simple straight line
    // between evenly spaced control points
    const latlngs = this.getLatlngsForSimplifiedRoute();
    
    this.routeLayer = L.polyline(latlngs, {
      color: '#3388ff',
      weight: 5,
      opacity: 0.7
    }).addTo(this.map);
    
    // Fit map to route
    this.map.fitBounds(this.routeLayer.getBounds());
    
    // Add control point markers
    this.addControlMarkers(latlngs);
  }
  
  addControlMarkers(latlngs?: L.LatLngExpression[]): void {
    if (!this.map) return;
    
    // Clear existing markers and circles
    this.markerLayers.forEach(marker => marker.remove());
    this.markerLayers = [];
    
    this.circleLayers.forEach(circle => circle.remove());
    this.circleLayers = [];
    
    this.dotMarkers.forEach(dot => dot.remove());
    this.dotMarkers = [];
    
    this.controlTimes.forEach((controlTime, index) => {
      let markerLatLng: L.LatLngExpression;
      
      if (this.trackPoints.length > 0) {
        // Find the track point closest to this control distance
        const closest = this.trackPoints.reduce((prev, curr) => {
          return Math.abs(curr.distance - controlTime.distance) < Math.abs(prev.distance - controlTime.distance) 
            ? curr 
            : prev;
        });
        markerLatLng = [closest.lat, closest.lng];
      } else if (latlngs && latlngs[index]) {
        // Use the simplified route positions
        markerLatLng = latlngs[index];
      } else {
        return; // Skip if we can't determine position
      }
      
      // Determine if this is a start, finish, or intermediate control
      const isStart = index === 0;
      const isFinish = index === this.controlTimes.length - 1;
      const checkpointType = isStart ? 'start' : isFinish ? 'finish' : 'intermediate';
      
      // Get checkpoint name if available
      const controlName = this.checkpointNames[index] || 
                          (isStart ? 'Start' : isFinish ? 'Finish' : `Control ${index}`);
      
      // Determine color based on checkpoint type
      const controlColor = isStart ? '#10B981' : isFinish ? '#EF4444' : '#3B82F6';
      
      // Create a custom checkpoint icon
      const checkpointIcon = L.divIcon({
        className: `checkpoint-icon checkpoint-${checkpointType}`,
        html: `<div class="checkpoint-pin ${checkpointType}-pin">
                <div class="pin-head" style="background-color: ${controlColor}">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="white" xmlns="http://www.w3.org/2000/svg">
                    ${isStart ? '<path d="M3,9H7V5H3V9M3,14H7V10H3V14M8,14H12V10H8V14M13,14H17V10H13V14M8,9H12V5H8V9M13,5V9H17V5H13M18,14H22V10H18V14M3,19H7V15H3V19M8,19H12V15H8V19M13,19H17V15H13V19M18,19H22V15H18V19M18,5V9H22V5H18Z" />' : 
                     isFinish ? '<path d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M7,5A2,2 0 0,0 5,7A2,2 0 0,0 7,9A2,2 0 0,0 9,7A2,2 0 0,0 7,5M17,15A2,2 0 0,0 15,17A2,2 0 0,0 17,19A2,2 0 0,0 19,17A2,2 0 0,0 17,15M17,5A2,2 0 0,0 15,7A2,2 0 0,0 17,9A2,2 0 0,0 19,7A2,2 0 0,0 17,5M7,15A2,2 0 0,0 5,17A2,2 0 0,0 7,19A2,2 0 0,0 9,17A2,2 0 0,0 7,15M5,9V15H9V9H5M15,9V15H19V9H15M9,5V9H15V5H9M9,15V19H15V15H9Z" />' : 
                     '<path d="M5,9V21H9V9H5M19,9V21H23V9H19M15,3V21H19V3H15M9,3V21H13V3H9M3,9H7V3H3V9Z" />'}
                  </svg>
                </div>
                <div class="pin-tail"></div>
                <div class="center-dot"></div>
                <div class="checkpoint-number">${isStart ? 'S' : isFinish ? 'F' : index}</div>
              </div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42]
      });
      
      // Create marker
      const marker = L.marker(markerLatLng, {
        icon: checkpointIcon
      }).addTo(this.map!);
      
      // Add popup with control times - using the formatted time
      const openingTime = this.formatDateTime(controlTime.openingDatetime);
      const closingTime = this.formatDateTime(controlTime.closingDatetime);
      
      marker.bindPopup(`
        <div>
          <strong>${controlName}</strong><br>
          Distance: ${controlTime.distance.toFixed(1)} km<br>
          Opening: ${openingTime}<br>
          Closing: ${closingTime}<br>
          Radius: ${this.controlRadius}m
        </div>
      `);
      
      // Store marker for later cleanup
      this.markerLayers.push(marker);
      
      // Add a circle to represent the control radius
      const circle = L.circle(markerLatLng, {
        radius: this.controlRadius, // radius in meters
        color: controlColor,
        fillColor: controlColor,
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 10' // dashed line
      }).addTo(this.map!);
      
      // Store circle for later cleanup
      this.circleLayers.push(circle);
      
      // Add a separate dot marker at the exact control point location
      const dotMarker = L.circleMarker(markerLatLng, {
        radius: 6,
        color: 'black',
        weight: 2,
        fillColor: controlColor,
        fillOpacity: 1,
        opacity: 1
      }).addTo(this.map!);
      
      // Add a popup to the dot marker showing exact coordinates
      let lat = 0;
      let lng = 0;
      
      // Extract coordinates from the LatLngExpression
      if (Array.isArray(markerLatLng)) {
        lat = markerLatLng[0];
        lng = markerLatLng[1];
      } else if (markerLatLng instanceof L.LatLng) {
        lat = markerLatLng.lat;
        lng = markerLatLng.lng;
      }
      
      dotMarker.bindPopup(`
        <div class="coordinate-popup">
          <strong>Exact Coordinates</strong><br>
          Latitude: ${lat.toFixed(6)}<br>
          Longitude: ${lng.toFixed(6)}<br>
          <button class="copy-btn" onclick="navigator.clipboard.writeText('${lat.toFixed(6)}, ${lng.toFixed(6)}')">
            Copy to Clipboard
          </button>
        </div>
      `);
      
      // Store dot marker for later cleanup
      this.dotMarkers.push(dotMarker);
    });
  }

  downloadControlTimes(): void {
    if (this.controlTimes.length === 0) {
      this.errorMessage = 'No control times to download.';
      return;
    }
    
    // Generate text file content, passing checkpoint names if available
    const content = this.gpxCalculatorService.generateControlTimesTextFile(
      this.controlTimes, 
      this.routeName,
      this.checkpointNames.length > 0 ? this.checkpointNames : undefined,
      this.use24HourFormat // Pass the current time format preference
    );
    
    // Download the text file
    const filename = `${this.routeName || 'brevet'}-control-times.txt`;
    this.gpxCalculatorService.downloadTextFile(content, filename);
  }

  getControlTimeRows(): any[] {
    if (!this.controlTimes || this.controlTimes.length === 0) {
      return [];
    }
    
    return this.controlTimes.map((control, index) => ({
      distance: control.distance.toFixed(1),
      openingTime: this.formatDateTime(control.openingDatetime),
      closingTime: this.formatDateTime(control.closingDatetime),
      name: this.checkpointNames[index] || ''
    }));
  }
  
  /**
   * Calculate the total time window from start opening to finish closing
   * @returns Formatted time window string
   */
  getTotalTimeWindow(): string {
    if (!this.controlTimes || this.controlTimes.length < 2) {
      return 'N/A';
    }
    
    const startOpeningTime = this.controlTimes[0].openingDatetime;
    const finishClosingTime = this.controlTimes[this.controlTimes.length - 1].closingDatetime;
    
    // Calculate time difference in milliseconds
    const timeDiff = finishClosingTime.getTime() - startOpeningTime.getTime();
    
    // Convert to hours and minutes
    const totalHours = Math.floor(timeDiff / (1000 * 60 * 60));
    const totalMinutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format the time window
    return `${totalHours}h ${totalMinutes}m`;
  }
  
  /**
   * Get formatted time window details
   * @returns Formatted time window details including start and finish times
   */
  getTimeWindowDetails(): string {
    if (!this.controlTimes || this.controlTimes.length < 2) {
      return 'N/A';
    }
    
    const startOpeningTime = this.controlTimes[0].openingDatetime;
    const finishClosingTime = this.controlTimes[this.controlTimes.length - 1].closingDatetime;
    
    // Format the start and finish times
    const startFormatted = this.formatDateTime(startOpeningTime);
    const finishFormatted = this.formatDateTime(finishClosingTime);
    
    return `${startFormatted} → ${finishFormatted}`;
  }
  
  hasGpxCheckpoints(): boolean {
    return this.gpxCheckpoints.length > 0;
  }

  // Add a method to update control circles when radius changes
  updateControlRadius(): void {
    if (this.processCompleted) {
      // Redraw the control markers with the new radius
      if (this.trackPoints.length > 0) {
        this.addControlMarkers();
      } else {
        this.addControlMarkers(this.getLatlngsForSimplifiedRoute());
      }
    }
  }
  
  // Helper method to get latlngs for simplified route
  private getLatlngsForSimplifiedRoute(): L.LatLngExpression[] {
    const latlngs: L.LatLngExpression[] = [];
    const baseLatLng: L.LatLngExpression = [51.505, -0.09]; // London as default center
    
    for (let i = 0; i < this.controlPoints.length; i++) {
      const progress = i / (this.controlPoints.length - 1);
      latlngs.push([
        baseLatLng[0] + progress * 0.1, 
        baseLatLng[1] + progress * 0.2
      ]);
    }
    
    return latlngs;
  }

  // Update the control markers with the current time format
  updateControlMarkers(): void {
    if (this.trackPoints.length > 0) {
      this.addControlMarkers();
    } else {
      this.addControlMarkers(this.getLatlngsForSimplifiedRoute());
    }
  }

  // Toggle time format
  toggleTimeFormat(): void {
    this.timeFormatService.toggleTimeFormat();
  }

  // Format date time according to current format setting
  formatDateTime(date: Date | string): string {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format options
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !this.use24HourFormat
    };
    
    return dateObj.toLocaleString(this.use24HourFormat ? 'sv-SE' : 'en-US', options);
  }
} 