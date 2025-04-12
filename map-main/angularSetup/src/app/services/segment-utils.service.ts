import { Injectable } from '@angular/core';
import { StravaSegment } from '../interfaces/strava.interface';

@Injectable({
  providedIn: 'root'
})
export class SegmentUtilsService {
  // Generate colors for segments
  generateSegmentColors(segmentCount: number): string[] {
    const colors = [
      '#FF5733', // Red-orange
      '#33FF57', // Light green
      '#3357FF', // Blue
      '#F033FF', // Purple
      '#FF33A8', // Pink
      '#33FFF0', // Cyan
      '#FFD700', // Gold
      '#9370DB', // Medium purple
      '#3CB371', // Medium sea green
      '#FF6347', // Tomato
    ];

    // If we need more colors than the pre-defined ones, generate them
    if (segmentCount > colors.length) {
      for (let i = colors.length; i < segmentCount; i++) {
        const hue = (i * 137.5) % 360; // Use golden ratio for good distribution
        colors.push(`hsl(${hue}, 70%, 50%)`);
      }
    }

    return colors.slice(0, segmentCount);
  }

  // Find segment indices in route coordinates
  matchSegmentsToRoute(
    segments: StravaSegment[],
    routeCoordinates: [number, number][]
  ): StravaSegment[] {
    if (!segments || !routeCoordinates || segments.length === 0 || routeCoordinates.length === 0) {
      return [];
    }

    return segments.map(segment => {
      if (!segment.start_latlng || !segment.end_latlng) {
        return segment; // Skip if missing coordinates
      }

      // Find the closest point in the route to the start latlng
      const startIndex = this.findClosestPointIndex(segment.start_latlng, routeCoordinates);
      
      // Find the closest point in the route to the end latlng
      const endIndex = this.findClosestPointIndex(segment.end_latlng, routeCoordinates);
      
      return {
        ...segment,
        start_index: startIndex,
        end_index: endIndex
      };
    });
  }

  // Utility to find the closest point in a route
  private findClosestPointIndex(target: [number, number], points: [number, number][]): number {
    let closestIndex = 0;
    let minDistance = Number.MAX_VALUE;

    for (let i = 0; i < points.length; i++) {
      const dist = this.calcDistance(target, points[i]);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  // Calculate distance between two lat/lng points
  private calcDistance(p1: [number, number], p2: [number, number]): number {
    const latDiff = p1[0] - p2[0];
    const lngDiff = p1[1] - p2[1];
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  }
}
