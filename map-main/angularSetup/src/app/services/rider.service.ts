import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { Rider, RealRider } from '../interfaces/rider.interface';
import { Waypoint } from '../interfaces/waypoint.interface';
import { MapUtilsService } from './map-utils.service';

@Injectable({
  providedIn: 'root'
})
export class RiderService {

  constructor(private mapUtils: MapUtilsService) {}
  
  /**
   * Create a rider marker for a simulated rider
   */
  createRiderMarker(rider: Rider, map: L.Map): void {
    // Create custom HTML for rider marker
    const markerHtml = `
      <div class="rider-icon" style="background-color: ${rider.color}">
        <span class="rider-label">${rider.name.substring(0, 1)}</span>
      </div>
    `;
    
    // Create marker
    const riderIcon = L.divIcon({
      className: 'custom-rider-marker',
      html: markerHtml,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    
    // Position doesn't matter here as it will be updated by the simulation
    rider.marker = L.marker([0, 0], {
      icon: riderIcon,
      zIndexOffset: 1000
    }).addTo(map);
    
    // Add popup with rider info
    rider.marker.bindPopup(() => this.createRiderPopup(rider));
    
    // Add tooltip with rider name
    rider.marker.bindTooltip(rider.name, {
      permanent: false,
      direction: 'top',
      className: 'rider-tooltip'
    });
  }
  
  /**
   * Create a marker for a real rider
   */
  createRealRiderMarker(rider: RealRider, map: L.Map): void {
    // Create custom HTML for rider marker
    const markerHtml = `
      <div class="rider-icon" style="background-color: ${rider.color}">
        <span class="rider-label">${rider.name.substring(0, 1)}</span>
      </div>
    `;
    
    // Create marker
    const riderIcon = L.divIcon({
      className: 'real-rider-marker',
      html: markerHtml,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    
    // Position will be set when updating
    rider.marker = L.marker([0, 0], {
      icon: riderIcon,
      zIndexOffset: 1000
    }).addTo(map);
    
    // Add tooltip with rider name
    rider.marker.bindTooltip(rider.name, {
      permanent: false,
      direction: 'top',
      className: 'rider-tooltip'
    });
  }
  
  /**
   * Get current speed of rider
   */
  getRiderCurrentSpeed(rider: Rider): number {
    if (rider.stageSpeeds && rider.currentStageId) {
      const stageSpeed = rider.stageSpeeds.find(s => s.stageId === rider.currentStageId);
      if (stageSpeed) {
        return stageSpeed.speed;
      }
    }
    
    return rider.speed;
  }
  
  /**
   * Create HTML content for rider popup
   */
  createRiderPopup(rider: Rider): string {
    // Calculate elapsed time since rider started
    const elapsedTime = rider.lastCheckpointTime ? 
      this.mapUtils.formatTime(rider.lastCheckpointTime - rider.startTime) : 
      this.mapUtils.formatTime(Date.now() - rider.startTime);
    
    // Get current speed in km/h
    const speed = this.getRiderCurrentSpeed(rider);
    
    // Create the HTML content
    return `
      <div class="rider-popup">
        <h3 style="color: ${rider.color}; margin-top: 0;">${rider.name}</h3>
        <div><strong>Speed:</strong> ${speed.toFixed(1)} km/h</div>
        <div><strong>Elapsed Time:</strong> ${elapsedTime}</div>
        <div><strong>Distance:</strong> ${(rider.actualDistanceCovered / 1000).toFixed(2)} km</div>
        <div><strong>Elevation:</strong> ${rider.elevation.toFixed(0)} m</div>
        <div><strong>Checkpoints:</strong> ${rider.checkpointsPassed.length}</div>
      </div>
    `;
  }
  
  /**
   * Update the position of a rider during simulation
   */
  updateRiderPosition(
    rider: Rider, 
    deltaTimeSeconds: number, 
    routeCoordinates: [number, number][],
    elevationData: number[],
    waypoints: Waypoint[]
  ): void {
    if (!rider.marker || !routeCoordinates.length) return;
    
    // Calculate the distance to move based on speed and time
    const speedMps = this.getRiderCurrentSpeed(rider) * 1000 / 3600; // Convert km/h to m/s
    const distanceToMove = speedMps * deltaTimeSeconds;
    
    // Store the last position for tracking actual distance covered
    const lastPositionIndex = rider.lastPosition !== undefined ? rider.lastPosition : rider.position;
    
    // Update the rider position along the route
    const [newPosition, newActualDistance] = this.moveRiderAlongRoute(
      rider.position,
      distanceToMove,
      routeCoordinates,
      rider.actualDistanceCovered,
      lastPositionIndex
    );
    
    // Update rider properties
    rider.lastPosition = rider.position;
    rider.position = newPosition;
    rider.actualDistanceCovered = newActualDistance;
    
    // Check if the rider has reached the end of the route
    if (rider.position >= routeCoordinates.length - 1) {
      rider.position = routeCoordinates.length - 1;
    }
    
    // Update rider's geographical position
    const [lat, lng] = routeCoordinates[Math.floor(rider.position)];
    rider.marker.setLatLng([lat, lng]);
    
    // Update elevation if available
    if (elevationData && elevationData.length > Math.floor(rider.position)) {
      rider.elevation = elevationData[Math.floor(rider.position)];
    }
    
    // Check if the rider passed any waypoints
    this.checkForWaypointPass(rider, waypoints);
  }
  
  /**
   * Move rider along the route and calculate actual distance covered
   */
  private moveRiderAlongRoute(
    currentPosition: number,
    distanceToMove: number,
    routeCoordinates: [number, number][],
    currentActualDistance: number,
    lastPositionIndex: number
  ): [number, number] {
    let actualDistance = currentActualDistance;
    let position = currentPosition;
    let remainingDistance = distanceToMove;
    
    // Move the rider segment by segment until the distance is covered or end is reached
    while (remainingDistance > 0 && Math.floor(position) < routeCoordinates.length - 1) {
      const currentIndex = Math.floor(position);
      const nextIndex = currentIndex + 1;
      
      // Calculate distance between the two points
      const [lat1, lon1] = routeCoordinates[currentIndex];
      const [lat2, lon2] = routeCoordinates[nextIndex];
      const segmentDistance = this.mapUtils.calculateDistanceBetweenPoints(lat1, lon1, lat2, lon2);
      
      // Calculate the fraction already moved within this segment
      const fractionAlreadyMoved = position - currentIndex;
      
      // Calculate the remaining distance in this segment
      const remainingSegmentDistance = segmentDistance * (1 - fractionAlreadyMoved);
      
      if (remainingDistance <= remainingSegmentDistance) {
        // We won't reach the next point, update position within the segment
        const fractionToMove = remainingDistance / segmentDistance;
        position += fractionToMove;
        actualDistance += remainingDistance;
        remainingDistance = 0;
      } else {
        // We'll pass the next point
        position = nextIndex;
        actualDistance += remainingSegmentDistance;
        remainingDistance -= remainingSegmentDistance;
      }
      
      // Calculate actual distance covered for this segment
      if (currentIndex >= lastPositionIndex) {
        const segmentActualDistance = this.mapUtils.calculateDistanceBetweenPoints(
          routeCoordinates[currentIndex][0],
          routeCoordinates[currentIndex][1],
          routeCoordinates[Math.min(routeCoordinates.length - 1, nextIndex)][0],
          routeCoordinates[Math.min(routeCoordinates.length - 1, nextIndex)][1]
        );
        actualDistance += segmentActualDistance;
      }
    }
    
    return [position, actualDistance];
  }
  
  /**
   * Check if the rider passed any waypoints
   */
  private checkForWaypointPass(rider: Rider, waypoints: Waypoint[]): void {
    waypoints.forEach(waypoint => {
      // Skip if already passed
      if (rider.checkpointsPassed.includes(waypoint.id)) return;
      
      // Check if the rider passed this waypoint
      if (rider.position >= waypoint.position) {
        // Mark as passed
        rider.checkpointsPassed.push(waypoint.id);
        rider.lastCheckpointTime = Date.now();
        
        console.log(`Rider ${rider.name} passed waypoint ${waypoint.name}`);
        
        // Show notification (this would be replaced with a UI notification)
        console.log(`${rider.name} passed ${waypoint.name}!`);
      }
    });
  }
} 