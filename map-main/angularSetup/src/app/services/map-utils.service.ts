import { Injectable } from '@angular/core';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MapUtilsService {
  
  /**
   * Calculate distance between two geographical points in meters
   */
  calculateDistanceBetweenPoints(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if ((lat1 === lat2) && (lon1 === lon2)) {
      return 0;
    }
    
    // Haversine formula for accurate Earth distances
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }
  
  /**
   * Calculate total distance of a route in meters
   */
  calculateRouteDistance(coordinates: [number, number][]): number {
    if (coordinates.length < 2) return 0;
    
    let totalDistance = 0;
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lat1, lon1] = coordinates[i];
      const [lat2, lon2] = coordinates[i + 1];
      
      totalDistance += this.calculateDistanceBetweenPoints(lat1, lon1, lat2, lon2);
    }
    
    return totalDistance;
  }
  
  /**
   * Generate a random color for riders or routes
   */
  getRandomColor(): string {
    // List of colors that work well on maps
    const colors = [
      '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', 
      '#EC4899', '#F43F5E', '#0EA5E9', '#14B8A6', '#22C55E',
      '#A855F7', '#D946EF', '#F97316', '#84CC16', '#06B6D4'
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /**
   * Format time in milliseconds to readable format
   */
  formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Find elevation at a specific point by looking for closest point on routes
   */
  findElevationAtPoint(
    latlng: L.LatLng, 
    mainRouteCoordinates: [number, number][], 
    mainElevationData: number[],
    gpxRoutes: any[]
  ): number | null {
    let closestDistance = Number.MAX_VALUE;
    let closestElevation = null;
    
    // Check main route first
    if (mainRouteCoordinates.length > 0 && mainElevationData.length > 0) {
      for (let i = 0; i < mainRouteCoordinates.length; i++) {
        const routeLatLng = L.latLng(mainRouteCoordinates[i][0], mainRouteCoordinates[i][1]);
        const distance = latlng.distanceTo(routeLatLng);
        
        if (distance < closestDistance && mainElevationData[i] !== undefined) {
          closestDistance = distance;
          closestElevation = mainElevationData[i];
        }
      }
    }
    
    // Then check all GPX routes
    for (const route of gpxRoutes) {
      if (!route.visible) continue;
      
      for (let i = 0; i < route.coordinates.length; i++) {
        const routeLatLng = L.latLng(route.coordinates[i][0], route.coordinates[i][1]);
        const distance = latlng.distanceTo(routeLatLng);
        
        if (distance < closestDistance && route.elevationData[i] !== undefined) {
          closestDistance = distance;
          closestElevation = route.elevationData[i];
        }
      }
    }
    
    // Only return elevation if point is within 100m of any route
    return closestDistance <= 100 ? closestElevation : null;
  }
} 