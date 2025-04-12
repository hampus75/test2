import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { GpxRoute, RouteStage } from '../interfaces/route.interface';
import { MapUtilsService } from './map-utils.service';

@Injectable({
  providedIn: 'root'
})
export class RouteRendererService {
  // Map to store route layers for easy access and removal
  private routeLayerMap = new Map<string, L.Polyline>();

  constructor(private mapUtils: MapUtilsService) {}
  
  /**
   * Remove a GPX route from the map
   */
  public removeGpxRoute(routeId: string, map: L.Map): void {
    // Find the route from the map
    const polyline = this.routeLayerMap.get(routeId);
    if (polyline) {
      // Get the route object without TypeScript errors
      // @ts-ignore - We know route exists because we added it in renderGpxRoute
      const route = polyline.options.route as GpxRoute;
      
      // Remove the polyline
      map.removeLayer(polyline);
      this.routeLayerMap.delete(routeId);
      
      // Remove start and finish markers if they exist
      if (route && route.startMarker) {
        map.removeLayer(route.startMarker);
      }
      if (route && route.finishMarker) {
        map.removeLayer(route.finishMarker);
      }
      
      // Remove checkpoint markers if they exist
      if (route && route.checkpoints) {
        route.checkpoints.forEach(checkpoint => {
          if (checkpoint.marker) map.removeLayer(checkpoint.marker);
          if (checkpoint.circle) map.removeLayer(checkpoint.circle);
        });
      }
    }
  }
  
  /**
   * Render a GPX route on the map
   */
  renderGpxRoute(route: GpxRoute, map: L.Map, isSelected: boolean = false): void {
    console.log(`RouteRenderer: Rendering route ${route.name}`);
    
    // Basic validation
    if (!route.coordinates || route.coordinates.length < 2) {
      console.error(`Cannot render route ${route.name}: Not enough coordinates`);
      return;
    }
    
    try {
      // Debug print to see first few coordinates
      if (route.coordinates.length > 0) {
        console.log(`First few coordinates for ${route.name}:`, JSON.stringify(route.coordinates.slice(0, 3)));
      }
      
      // Ensure coordinates are valid
      let validCoordinates = route.coordinates.filter(coord => {
        // Check if coordinates are an array and have exactly 2 elements
        if (Array.isArray(coord) && coord.length === 2) {
          const [lat, lng] = coord;
          return !isNaN(Number(lat)) && !isNaN(Number(lng)) && 
                 lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        }
        return false;
      });
      
      console.log(`Route ${route.name}: ${validCoordinates.length} valid coordinates out of ${route.coordinates.length}`);
      
      if (validCoordinates.length < 2) {
        console.error(`Cannot render route ${route.name}: Not enough valid coordinates after filtering`);
        return;
      }
      
      // Automatically add start and finish checkpoints if route doesn't have any
      this.ensureStartFinishCheckpoints(route);
      
      // Convert coordinates to LatLng objects
      const latlngs = validCoordinates.map(coord => new L.LatLng(coord[0], coord[1]));
      
      // Create a polyline with the coordinates
      try {
        const polyline = L.polyline(latlngs, {
          color: route.color,
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 0.9 : 0.75,
          // @ts-ignore - We need to store the route reference for later access
          route: route
        }).addTo(map);
        
        // Store the polyline reference in the route object
        route.polyline = polyline;
        
        // Store in our map for easy access
        this.routeLayerMap.set(route.id, polyline);
        
        // Add start and finish markers that are always visible
        this.addStartFinishMarkers(route, map);
        
        // Create a custom popup for the route
        this.addRoutePopup(route, polyline, map, isSelected);
        
        // By default, don't render checkpoints - they'll be toggled via the popup button
        // Only render checkpoints automatically if the route is selected
        if (route.checkpoints && isSelected) {
          this.renderCheckpoints(route, map, isSelected);
        }
        
        console.log(`Successfully rendered route ${route.name}`);
      } catch (error) {
        console.error(`Error creating polyline for route ${route.name}:`, error);
      }
    } catch (error) {
      console.error(`Error rendering route ${route.name}:`, error);
    }
  }
  
  /**
   * Ensure route has start and finish checkpoints
   */
  private ensureStartFinishCheckpoints(route: GpxRoute): void {
    if (!route.coordinates || route.coordinates.length < 2) return;
    
    // Initialize checkpoints array if needed
    if (!route.checkpoints) {
      route.checkpoints = [];
    }
    
    // First check if we already have start/finish points
    const hasStart = route.checkpoints.some(cp => 
      cp.name.toLowerCase().includes('start')
    );
    
    const hasFinish = route.checkpoints.some(cp => 
      cp.name.toLowerCase().includes('finish') || 
      cp.name.toLowerCase().includes('end') ||
      cp.name.toLowerCase().includes('mål')
    );
    
    // Add start checkpoint if needed
    if (!hasStart) {
      const startCoord = route.coordinates[0];
      route.checkpoints.push({
        lat: startCoord[0],
        lng: startCoord[1],
        name: "Start",
        description: `Start point for ${route.name}`
      });
    }
    
    // Add finish checkpoint if needed
    if (!hasFinish) {
      const finishCoord = route.coordinates[route.coordinates.length - 1];
      route.checkpoints.push({
        lat: finishCoord[0],
        lng: finishCoord[1],
        name: "Finish",
        description: `Finish point for ${route.name}`
      });
    }
  }
  
  /**
   * Validate coordinates to make sure they're in the right format for Leaflet
   */
  private validateCoordinates(coordinates: any[]): boolean {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return false;
    }
    
    // Check first item to see if it's in the correct format
    const first = coordinates[0];
    
    // Should be an array with two numbers (latitude and longitude)
    if (!Array.isArray(first) || first.length !== 2) {
      return false;
    }
    
    // Both values should be numbers and valid lat/lng
    const [lat, lng] = first;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return false;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Fix coordinates if they're in the wrong format
   */
  private fixCoordinates(coordinates: any[]): [number, number][] {
    if (!coordinates || !Array.isArray(coordinates)) {
      return [[0, 0]];
    }
    
    // Try to convert to [lat, lng] format
    const fixed: [number, number][] = [];
    
    for (const coord of coordinates) {
      if (Array.isArray(coord) && coord.length >= 2) {
        const lat = Number(coord[0]);
        const lng = Number(coord[1]);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          fixed.push([lat, lng]);
        }
      } else if (typeof coord === 'object') {
        // Try to handle {lat, lng} or {latitude, longitude} format
        const lat = Number(coord.lat || coord.latitude);
        const lng = Number(coord.lng || coord.longitude);
        
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
          fixed.push([lat, lng]);
        }
      }
    }
    
    if (fixed.length < 2) {
      // Stockholm default if we couldn't fix it
      return [[59.3293, 18.0686], [59.3294, 18.0687]];
    }
    
    return fixed;
  }
  
  /**
   * Render checkpoints for a route
   */
  private renderCheckpoints(route: GpxRoute, map: L.Map, isSelected: boolean = false): void {
    if (!route.checkpoints || route.checkpoints.length === 0) return;
    
    // Clear any existing checkpoint markers first
    if (route.markers) {
      route.markers.forEach(marker => {
        if (marker) map.removeLayer(marker);
      });
    }
    route.markers = [];
    
    // Check if we already have checkpoints rendered
    const existingCheckpoints = route.checkpoints.some(cp => cp.marker || cp.circle);
    if (existingCheckpoints) {
      // Just make them visible again
      route.checkpoints.forEach(checkpoint => {
        if (checkpoint.marker) checkpoint.marker.addTo(map);
        if (checkpoint.circle) checkpoint.circle.addTo(map);
      });
      return;
    }
    
    route.checkpoints.forEach((checkpoint, index) => {
      // Determine if this is a start or finish checkpoint by checking the name
      // rather than just assuming based on array position
      const isStart = checkpoint.name.toLowerCase().includes('start');
      const isFinish = checkpoint.name.toLowerCase().includes('finish') || 
                     checkpoint.name.toLowerCase().includes('end') ||
                     checkpoint.name.toLowerCase().includes('mål');
      const checkpointType = isStart ? 'start' : isFinish ? 'finish' : 'intermediate';
      
      // Create a custom checkpoint icon with pin design
      const checkpointIcon = L.divIcon({
        className: `checkpoint-icon checkpoint-${checkpointType}`,
        html: `<div class="checkpoint-pin ${checkpointType}-pin">
                <div class="pin-head" style="background-color: ${isStart ? '#10B981' : isFinish ? '#EF4444' : '#3B82F6'}">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="white" xmlns="http://www.w3.org/2000/svg">
                    ${isStart ? '<path d="M3,9H7V5H3V9M3,14H7V10H3V14M8,14H12V10H8V14M13,14H17V10H13V14M8,9H12V5H8V9M13,5V9H17V5H13M18,14H22V10H18V14M3,19H7V15H3V19M8,19H12V15H8V19M13,19H17V15H13V19M18,19H22V15H18V19M18,5V9H22V5H18Z" />' : 
                     isFinish ? '<path d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M7,5A2,2 0 0,0 5,7A2,2 0 0,0 7,9A2,2 0 0,0 9,7A2,2 0 0,0 7,5M17,15A2,2 0 0,0 15,17A2,2 0 0,0 17,19A2,2 0 0,0 19,17A2,2 0 0,0 17,15M17,5A2,2 0 0,0 15,7A2,2 0 0,0 17,9A2,2 0 0,0 19,7A2,2 0 0,0 17,5M7,15A2,2 0 0,0 5,17A2,2 0 0,0 7,19A2,2 0 0,0 9,17A2,2 0 0,0 7,15M5,9V15H9V9H5M15,9V15H19V9H15M9,5V9H15V5H9M9,15V19H15V15H9Z" />' : 
                     '<path d="M5,9V21H9V9H5M19,9V21H23V9H19M15,3V21H19V3H15M9,3V21H13V3H9M3,9H7V3H3V9Z" />'}
                  </svg>
                </div>
                <div class="pin-tail"></div>
                <div class="checkpoint-number">${isStart ? 'S' : isFinish ? 'F' : index}</div>
              </div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42]
      });
      
      // Create the marker
      const marker = L.marker([checkpoint.lat, checkpoint.lng], {
        icon: checkpointIcon
      }).addTo(map);
      
      // Create popup content
      let popupContent = `
        <div class="checkpoint-popup">
          <h4>${checkpoint.name}</h4>
      `;
      
      if (checkpoint.description) {
        popupContent += `<p>${checkpoint.description}</p>`;
      }
      
      popupContent += `
        <p>Type: ${isStart ? 'Start' : isFinish ? 'Finish' : 'Checkpoint'}</p>
        <p>Radius: 1000m</p>
        </div>
      `;
      
      // Add popup
      marker.bindPopup(popupContent);
      
      // Store marker reference for cleanup
      checkpoint.marker = marker;
      
      // Add a circle with 1000m radius around the checkpoint
      const circle = L.circle([checkpoint.lat, checkpoint.lng], {
        radius: 1000, // 1000 meters
        color: isStart ? '#10B981' : isFinish ? '#EF4444' : '#3B82F6', // Green for start, Red for finish, Blue for intermediate
        fillColor: isStart ? '#10B981' : isFinish ? '#EF4444' : '#3B82F6',
        fillOpacity: isSelected ? 0.2 : 0.1, // More visible when selected
        weight: isSelected ? 3 : 2, // Thicker border when selected
        dashArray: '5, 10', // Dashed line
        interactive: true
      }).addTo(map);
      
      // Store circle in the checkpoint object
      checkpoint.circle = circle;
      
      // Note: We don't add marker to route.markers anymore as it has type issues
    });
    
    console.log(`Added ${route.checkpoints.length} checkpoint markers to route ${route.name}`);
  }
  
  /**
   * Toggle checkpoints visibility for a route
   */
  public toggleCheckpoints(route: GpxRoute, map: L.Map, isSelected: boolean = false): void {
    if (!route.checkpoints || route.checkpoints.length === 0) return;
    
    // Check if checkpoints are currently visible
    const checkpointsVisible = route.checkpoints.some(cp => 
      cp.marker && map.hasLayer(cp.marker)
    );
    
    if (checkpointsVisible) {
      // Hide checkpoints
      route.checkpoints.forEach(checkpoint => {
        if (checkpoint.marker) map.removeLayer(checkpoint.marker);
        if (checkpoint.circle) map.removeLayer(checkpoint.circle);
      });
      console.log(`Hidden ${route.checkpoints.length} checkpoints for route ${route.name}`);
    } else {
      // Show checkpoints
      this.renderCheckpoints(route, map, isSelected);
      console.log(`Shown ${route.checkpoints.length} checkpoints for route ${route.name}`);
    }
  }
  
  /**
   * Render route stages
   */
  renderStages(
    stages: RouteStage[], 
    routeCoordinates: [number, number][], 
    map: L.Map,
    stageLayers: L.Layer[]
  ): void {
    // Clear existing stage layers
    stageLayers.forEach(layer => map.removeLayer(layer));
    stageLayers.length = 0;
    
    if (!stages || stages.length === 0 || !routeCoordinates || routeCoordinates.length === 0) {
      return;
    }
    
    // Render each stage as a separate polyline
    stages.forEach(stage => {
      if (stage.startIndex >= routeCoordinates.length || stage.endIndex >= routeCoordinates.length) {
        console.warn(`Stage "${stage.name}" has invalid indices`);
        return;
      }
      
      const stageCoordinates = routeCoordinates.slice(stage.startIndex, stage.endIndex + 1);
      
      // Skip stages with fewer than 2 points
      if (stageCoordinates.length < 2) {
        console.warn(`Stage "${stage.name}" has fewer than 2 points`);
        return;
      }
      
      // Create polyline for stage
      const polyline = L.polyline(
        stageCoordinates.map(coord => [coord[0], coord[1]]),
        {
          color: stage.color,
          weight: 5,
          opacity: 0.8,
          className: 'route-stage'
        }
      ).addTo(map);
      
      // Add stage info popup
      polyline.bindPopup(`
        <div>
          <strong>${stage.name}</strong><br>
          Distance: ${stage.distance ? (stage.distance / 1000).toFixed(2) : 'N/A'} km<br>
          Elevation Gain: ${stage.elevation ? stage.elevation.toFixed(2) : 'N/A'} m
        </div>
      `);
      
      // Store layer for later removal
      stageLayers.push(polyline);
      
      // Create start marker for stage
      const startMarker = L.marker([stageCoordinates[0][0], stageCoordinates[0][1]], {
        icon: L.divIcon({
          className: 'stage-marker',
          html: `<div>${stage.name} Start</div>`,
          iconSize: [80, 20],
          iconAnchor: [40, 10]
        })
      }).addTo(map);
      
      stageLayers.push(startMarker);
      
      // Create end marker for stage
      const endPoint = stageCoordinates[stageCoordinates.length - 1];
      const endMarker = L.marker([endPoint[0], endPoint[1]], {
        icon: L.divIcon({
          className: 'stage-marker',
          html: `<div>${stage.name} End</div>`,
          iconSize: [80, 20],
          iconAnchor: [40, 10]
        })
      }).addTo(map);
      
      stageLayers.push(endMarker);
    });
  }
  
  /**
   * Fit map to show all visible GPX routes
   */
  fitMapToGpxRoutes(gpxRoutes: GpxRoute[], map: L.Map): void {
    const visibleRoutes = gpxRoutes.filter(r => r.visible);
    
    if (visibleRoutes.length === 0) return;
    
    // Collect all coordinates from visible routes
    const allCoordinates: L.LatLngExpression[] = [];
    
    visibleRoutes.forEach(route => {
      route.coordinates.forEach(coord => {
        allCoordinates.push([coord[0], coord[1]]);
      });
    });
    
    if (allCoordinates.length === 0) return;
    
    // Create a bounds object and fit the map to it
    const bounds = L.latLngBounds(allCoordinates);
    map.fitBounds(bounds, { padding: [50, 50] });
  }
  
  /**
   * Add a custom popup to the route polyline
   */
  private addRoutePopup(route: GpxRoute, polyline: L.Polyline, map: L.Map, isSelected: boolean): void {
    try {
      // Calculate route stats
      const distance = (this.mapUtils.calculateRouteDistance(route.coordinates) / 1000).toFixed(2);
      
      // Calculate elevation stats if available
      let elevationGain = 0;
      let elevationLoss = 0;
      let minElevation = Infinity;
      let maxElevation = -Infinity;
      
      if (route.elevationData && route.elevationData.length > 0) {
        for (let i = 1; i < route.elevationData.length; i++) {
          const diff = route.elevationData[i] - route.elevationData[i - 1];
          if (diff > 0) elevationGain += diff;
          if (diff < 0) elevationLoss += Math.abs(diff);
          
          minElevation = Math.min(minElevation, route.elevationData[i]);
          maxElevation = Math.max(maxElevation, route.elevationData[i]);
        }
        
        // Make sure min/max are set properly even with only one elevation point
        if (route.elevationData.length === 1) {
          minElevation = maxElevation = route.elevationData[0];
        }
      }
      
      // Calculate route start and end coordinates
      const startPoint = route.coordinates[0];
      const endPoint = route.coordinates[route.coordinates.length - 1];
      
      // Check if route is a loop (start and end points are close)
      const isLoop = startPoint && endPoint && 
                     L.latLng(startPoint[0], startPoint[1])
                      .distanceTo(L.latLng(endPoint[0], endPoint[1])) < 500; // Less than 500m apart
      
      // Check if checkpoints are currently visible
      const checkpointsVisible = route.checkpoints && route.checkpoints.some(cp => 
        cp.marker && map.hasLayer(cp.marker)
      );
      
      // Create custom popup content with enhanced information
      const popupContent = `
        <div class="route-popup">
          <strong>${route.name}</strong>
          
          <div class="route-popup-info-grid">
            <div class="label">Distance:</div>
            <div class="value">${distance} km</div>
            
            <div class="label">Type:</div>
            <div class="value">${isLoop ? 'Loop' : 'Point to Point'}</div>
            
            ${route.elevationData && route.elevationData.length > 0 ? `
              <div class="label">Elevation Gain:</div>
              <div class="value">${elevationGain.toFixed(0)} m</div>
              
              <div class="label">Elevation Loss:</div>
              <div class="value">${elevationLoss.toFixed(0)} m</div>
              
              <div class="label">Min Elevation:</div>
              <div class="value">${minElevation.toFixed(0)} m</div>
              
              <div class="label">Max Elevation:</div>
              <div class="value">${maxElevation.toFixed(0)} m</div>
            ` : ''}
            
            <div class="label">Checkpoints:</div>
            <div class="value">${route.checkpoints ? route.checkpoints.length : 0}</div>
            
            <div class="label">Created:</div>
            <div class="value">${new Date(parseInt(route.id.split('-')[1])).toLocaleDateString()}</div>
          </div>
          
          <div class="route-popup-actions">
            <button id="select-route-${route.id}" class="${isSelected ? 'selected-route-btn' : 'select-route-btn'}" 
              style="background-color: ${isSelected ? '#d1d5db' : '#60a5fa'}; color: ${isSelected ? '#374151' : 'white'};">
              ${isSelected ? 'Selected' : 'Select Route'}
            </button>
            
            ${route.checkpoints && route.checkpoints.length > 0 ? `
            <button id="toggle-checkpoints-${route.id}" class="toggle-checkpoints-btn" 
              style="background-color: ${checkpointsVisible ? '#d1d5db' : '#FCD34D'}; color: ${checkpointsVisible ? '#374151' : '#1E293B'}; margin-top: 8px;">
              ${checkpointsVisible ? 'Hide Checkpoints' : 'Show Checkpoints'}
            </button>
            ` : ''}
            
            <button id="view-route-${route.id}" class="view-route-btn" 
              style="background-color: #10B981; color: white; margin-top: 8px;">
              View in New Window
            </button>
          </div>
        </div>
      `;
      
      // Bind popup with custom class to polyline
      const popup = L.popup({
        className: 'route-custom-popup',
        maxWidth: 300
      }).setContent(popupContent);
      
      polyline.bindPopup(popup);
      
      // Add event listener when popup is opened to attach click handlers to the buttons
      polyline.on('popupopen', () => {
        setTimeout(() => {
          // Select route button
          const selectButton = document.getElementById(`select-route-${route.id}`);
          if (selectButton) {
            selectButton.addEventListener('click', () => {
              // Close the popup
              map.closePopup();
              
              // Dispatch custom event that the MapComponent will listen for
              const event = new CustomEvent('route-selected', {
                detail: { routeId: route.id }
              });
              document.dispatchEvent(event);
            });
          }
          
          // Toggle checkpoints button
          const toggleCheckpointsButton = document.getElementById(`toggle-checkpoints-${route.id}`);
          if (toggleCheckpointsButton) {
            toggleCheckpointsButton.addEventListener('click', () => {
              // Toggle checkpoint visibility
              this.toggleCheckpoints(route, map, isSelected);
              
              // Close the popup
              map.closePopup();
            });
          }
          
          // View in new window button
          const viewButton = document.getElementById(`view-route-${route.id}`);
          if (viewButton) {
            viewButton.addEventListener('click', () => {
              // Close the popup
              map.closePopup();
              
              // Dispatch custom event
              const event = new CustomEvent('route-view-new-window', {
                detail: { routeId: route.id }
              });
              document.dispatchEvent(event);
            });
          }
        }, 0);
      });
    } catch (error) {
      console.error(`Error adding popup to route ${route.name}:`, error);
    }
  }

  /**
   * Add start and finish markers to the route that are always visible
   */
  private addStartFinishMarkers(route: GpxRoute, map: L.Map): void {
    if (!route.coordinates || route.coordinates.length < 2) return;
    
    // Clear existing route-specific markers if they exist
    if (route.startMarker) {
      map.removeLayer(route.startMarker);
    }
    if (route.finishMarker) {
      map.removeLayer(route.finishMarker);
    }
    
    // Create start marker
    const startCoord = route.coordinates[0];
    const startIcon = L.divIcon({
      className: 'checkpoint-icon checkpoint-start always-visible',
      html: `<div class="checkpoint-pin start-pin">
              <div class="pin-head" style="background-color: #10B981">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3,9H7V5H3V9M3,14H7V10H3V14M8,14H12V10H8V14M13,14H17V10H13V14M8,9H12V5H8V9M13,5V9H17V5H13M18,14H22V10H18V14M3,19H7V15H3V19M8,19H12V15H8V19M13,19H17V15H13V19M18,19H22V15H18V19M18,5V9H22V5H18Z" />
                </svg>
              </div>
              <div class="pin-tail"></div>
              <div class="checkpoint-number">S</div>
            </div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
    
    const startMarker = L.marker([startCoord[0], startCoord[1]], {
      icon: startIcon,
      zIndexOffset: 1000 // Make sure it's on top
    }).addTo(map);
    
    startMarker.bindPopup(`
      <div class="checkpoint-popup">
        <h4>Start</h4>
        <p>Starting point for ${route.name}</p>
      </div>
    `);
    
    // Store for later removal
    route.startMarker = startMarker;
    
    // Create finish marker
    const finishCoord = route.coordinates[route.coordinates.length - 1];
    const finishIcon = L.divIcon({
      className: 'checkpoint-icon checkpoint-finish always-visible',
      html: `<div class="checkpoint-pin finish-pin">
              <div class="pin-head" style="background-color: #EF4444">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M7,5A2,2 0 0,0 5,7A2,2 0 0,0 7,9A2,2 0 0,0 9,7A2,2 0 0,0 7,5M17,15A2,2 0 0,0 15,17A2,2 0 0,0 17,19A2,2 0 0,0 19,17A2,2 0 0,0 17,15M17,5A2,2 0 0,0 15,7A2,2 0 0,0 17,9A2,2 0 0,0 19,7A2,2 0 0,0 17,5M7,15A2,2 0 0,0 5,17A2,2 0 0,0 7,19A2,2 0 0,0 9,17A2,2 0 0,0 7,15M5,9V15H9V9H5M15,9V15H19V9H15M9,5V9H15V5H9M9,15V19H15V15H9Z" />
                </svg>
              </div>
              <div class="pin-tail"></div>
              <div class="checkpoint-number">F</div>
            </div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
    
    const finishMarker = L.marker([finishCoord[0], finishCoord[1]], {
      icon: finishIcon,
      zIndexOffset: 1000 // Make sure it's on top
    }).addTo(map);
    
    finishMarker.bindPopup(`
      <div class="checkpoint-popup">
        <h4>Finish</h4>
        <p>Finishing point for ${route.name}</p>
      </div>
    `);
    
    // Store for later removal
    route.finishMarker = finishMarker;
  }
} 