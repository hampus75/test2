import { Injectable } from '@angular/core';
import { ACPBrevetCalculator, ControlTime } from './acp-brevet-calculator';

export interface GpxCheckpoint {
  lat: number;
  lng: number;
  name: string;
  description?: string;
  distance: number;
}

@Injectable({
  providedIn: 'root'
})
export class GpxCalculatorService {

  constructor() { }
  
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
   * Check if a waypoint is a navigation instruction (turn, continue, etc.)
   * These should be excluded from checkpoints
   */
  private isNavigationInstruction(name: string, desc?: string): boolean {
    if (!name && !desc) return false;
    
    const textLower = (name + ' ' + (desc || '')).toLowerCase();
    const navTerms = ['turn', 'left', 'right', 'continue', 'straight', 'onto', 'head'];
    
    return navTerms.some(term => textLower.includes(term));
  }
  
  /**
   * Check if a waypoint name represents a checkpoint
   * This looks for variations of checkpoint naming
   */
  private isCheckpoint(name: string, symbol?: string, type?: string): boolean {
    const nameLower = name.toLowerCase();
    // Set defaults and handle undefined values properly
    const symbolLower = symbol ? symbol.toLowerCase() : '';
    const typeLower = type ? type.toLowerCase() : '';
    
    const checkpointVariations = [
      'checkpoint', 'check point', 'chk', 'cp', 'kontroll', 'control'
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
  }
  
  /**
   * Find the nearest point on a route to a given coordinate
   * @param lat Latitude of the point
   * @param lng Longitude of the point
   * @param trackPoints Array of track points
   * @returns The distance along the route
   */
  private findNearestPointOnRoute(lat: number, lng: number, trackPoints: { lat: number, lng: number, distance: number }[]): number {
    let minDistance = Number.MAX_VALUE;
    let nearestPoint = trackPoints[0].distance;
    
    trackPoints.forEach(point => {
      const distance = this.calculateDistance(lat, lng, point.lat, point.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point.distance;
      }
    });
    
    return nearestPoint;
  }
  
  /**
   * Parse GPX file for distance calculation and checkpoint extraction
   * @param fileContent The content of the GPX file
   * @returns Total distance, track points, and checkpoints
   */
  calculateGpxDistance(fileContent: string): {
    totalDistance: number,
    trackPoints: { distance: number, lat: number, lng: number }[],
    checkpoints?: GpxCheckpoint[]
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
      
      // Extract checkpoints from waypoints
      const waypointElements = gpx.querySelectorAll('wpt');
      const checkpoints: GpxCheckpoint[] = [];
      
      // Process waypoints to find checkpoints
      waypointElements.forEach(waypoint => {
        const lat = parseFloat(waypoint.getAttribute('lat') || '0');
        const lng = parseFloat(waypoint.getAttribute('lon') || '0');
        
        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return;
        }
        
        const name = waypoint.querySelector('name')?.textContent || 'Unnamed';
        const description = waypoint.querySelector('desc')?.textContent || undefined;
        const symbol = waypoint.querySelector('sym')?.textContent || '';
        const type = waypoint.querySelector('type')?.textContent || '';
        
        // Skip navigation instructions
        if (this.isNavigationInstruction(name, description)) {
          return;
        }
        
        // Only add waypoints that are identified as checkpoints
        if (this.isCheckpoint(name, symbol, type)) {
          // Find the distance along the route
          const distance = this.findNearestPointOnRoute(lat, lng, trackPoints);
          
          // Add to checkpoints array
          checkpoints.push({
            lat,
            lng,
            name,
            description,
            distance
          });
        }
      });
      
      // Sort checkpoints by distance
      const sortedCheckpoints = checkpoints.sort((a, b) => a.distance - b.distance);
      
      return {
        totalDistance,
        trackPoints,
        checkpoints: sortedCheckpoints.length > 0 ? sortedCheckpoints : undefined
      };
    } catch (error) {
      console.error('Error parsing GPX file:', error);
      throw new Error('Failed to parse GPX file');
    }
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
   * Get control points from GPX checkpoints
   * @param checkpoints Array of GPX checkpoints
   * @param totalDistance Total route distance
   * @returns Array of distances for control points
   */
  getControlPointsFromCheckpoints(checkpoints: GpxCheckpoint[], totalDistance: number): number[] {
    // Always include start point (0 km)
    const controlPoints: number[] = [0];
    
    // Add distances from all checkpoints
    checkpoints.forEach(checkpoint => {
      if (checkpoint.distance > 0 && !controlPoints.includes(checkpoint.distance)) {
        controlPoints.push(checkpoint.distance);
      }
    });
    
    // Always include end point if not already included
    if (controlPoints[controlPoints.length - 1] !== totalDistance) {
      controlPoints.push(totalDistance);
    }
    
    // Sort control points by distance
    return controlPoints.sort((a, b) => a - b);
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
   * @param checkpointNames Optional array of checkpoint names
   * @param use24HourFormat Whether to use 24-hour format (true) or 12-hour format (false)
   * @returns Text content for download
   */
  generateControlTimesTextFile(
    controlTimes: ControlTime[], 
    routeName?: string,
    checkpointNames?: string[],
    use24HourFormat: boolean = false
  ): string {
    let content = '';
    
    if (routeName) {
      content += `Route: ${routeName}\n`;
    }
    
    content += `Total Distance: ${controlTimes[controlTimes.length - 1].distance.toFixed(1)} km\n`;
    
    // Calculate and add total time window
    if (controlTimes.length >= 2) {
      const startOpeningTime = controlTimes[0].openingDatetime;
      const finishClosingTime = controlTimes[controlTimes.length - 1].closingDatetime;
      
      // Calculate time difference in milliseconds
      const timeDiff = finishClosingTime.getTime() - startOpeningTime.getTime();
      
      // Convert to hours and minutes
      const totalHours = Math.floor(timeDiff / (1000 * 60 * 60));
      const totalMinutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      
      // Format the time window
      content += `Total Time Window: ${totalHours}h ${totalMinutes}m\n`;
      
      // Format dates based on preferred format
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !use24HourFormat
      };
      
      const locale = use24HourFormat ? 'sv-SE' : 'en-US';
      const startFormatted = startOpeningTime.toLocaleString(locale, options);
      const finishFormatted = finishClosingTime.toLocaleString(locale, options);
      
      content += `Time Range: ${startFormatted} → ${finishFormatted}\n`;
    }
    
    content += '\nControl Points:\n';
    content += '--------------------------------------------------------------------------------\n';
    content += 'Distance (km) | Opening Time           | Closing Time          ';
    
    if (checkpointNames && checkpointNames.length > 0) {
      content += ' | Name';
    }
    
    content += '\n';
    content += '--------------------------------------------------------------------------------\n';
    
    controlTimes.forEach((control, index) => {
      // Format times based on the preferred format
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !use24HourFormat
      };
      
      const locale = use24HourFormat ? 'sv-SE' : 'en-US';
      const openingDateTime = control.openingDatetime.toLocaleString(locale, options);
      const closingDateTime = control.closingDatetime.toLocaleString(locale, options);
      
      let line = `${control.distance.toFixed(1).padEnd(13)} | ${openingDateTime.padEnd(22)} | ${closingDateTime.padEnd(22)}`;
      
      // Add checkpoint name if available
      if (checkpointNames && checkpointNames[index]) {
        line += ` | ${checkpointNames[index]}`;
      }
      
      content += line + '\n';
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