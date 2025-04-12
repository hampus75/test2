import { Injectable } from '@angular/core';
import { RouteStage } from '../interfaces/strava.interface';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StageManagerService {
  private _stages = new BehaviorSubject<RouteStage[]>([]);
  public stages$ = this._stages.asObservable();

  // Improved color palette for better visibility and distinction between stages
  private colors = [
    '#3498db', // blue
    '#e74c3c', // red
    '#2ecc71', // green
    '#9b59b6', // purple
    '#f39c12', // orange
    '#1abc9c', // turquoise
    '#d35400', // pumpkin
    '#34495e', // dark blue
    '#27ae60', // nephritis
    '#c0392b', // pomegranate
    '#8e44ad', // wisteria
    '#f1c40f', // sunflower
    '#16a085', // green sea
    '#d35400', // pumpkin
    '#2980b9', // belize hole
    '#c0392b'  // pomegranate
  ];

  constructor() {}

  /**
   * Create stages for a route by dividing it into equal parts
   */
  createEqualStages(
    routeCoordinates: [number, number][],
    numStages: number, 
    elevationData?: number[]
  ): void {
    if (!routeCoordinates || routeCoordinates.length === 0 || numStages <= 0) {
      console.error('Cannot create stages: Invalid parameters');
      return;
    }

    const stages: RouteStage[] = [];
    const totalPoints = routeCoordinates.length;
    const pointsPerStage = Math.floor(totalPoints / numStages);

    for (let i = 0; i < numStages; i++) {
      const startIndex = i * pointsPerStage;
      // The last stage gets all remaining points
      const endIndex = (i === numStages - 1) ? totalPoints - 1 : (i + 1) * pointsPerStage - 1;
      
      if (startIndex >= totalPoints) break;

      const stage: RouteStage = {
        id: `stage-${i+1}`,
        name: `Stage ${i+1}`,
        startIndex,
        endIndex,
        startPoint: routeCoordinates[startIndex],
        endPoint: routeCoordinates[endIndex],
        color: this.colors[i % this.colors.length],
      };

      // Calculate elevation gain if data available
      if (elevationData && elevationData.length === routeCoordinates.length) {
        let elevGain = 0;
        for (let j = startIndex + 1; j <= endIndex; j++) {
          const diff = elevationData[j] - elevationData[j-1];
          if (diff > 0) elevGain += diff;
        }
        stage.elevation = Math.round(elevGain);
      }

      stages.push(stage);
    }

    this._stages.next(stages);
    console.log(`Created ${stages.length} stages for route`);
  }

  /**
   * Create stages from an array of waypoint indices
   */
  createStagesFromWaypoints(
    routeCoordinates: [number, number][], 
    waypointIndices: number[],
    elevationData?: number[]
  ): void {
    if (!routeCoordinates || routeCoordinates.length === 0 || !waypointIndices || waypointIndices.length < 2) {
      console.error('Cannot create stages: Invalid parameters');
      return;
    }

    // Sort waypoint indices to ensure proper order
    waypointIndices.sort((a, b) => a - b);
    
    const stages: RouteStage[] = [];
    const totalPoints = routeCoordinates.length;

    // Ensure first waypoint starts at 0
    if (waypointIndices[0] !== 0) {
      waypointIndices.unshift(0);
    }

    // Ensure last waypoint is at the end
    if (waypointIndices[waypointIndices.length - 1] !== totalPoints - 1) {
      waypointIndices.push(totalPoints - 1);
    }

    // Create stages between consecutive waypoints
    for (let i = 0; i < waypointIndices.length - 1; i++) {
      const startIndex = waypointIndices[i];
      const endIndex = waypointIndices[i+1];
      
      const stage: RouteStage = {
        id: `stage-${i+1}`,
        name: `Stage ${i+1}`,
        startIndex,
        endIndex,
        startPoint: routeCoordinates[startIndex],
        endPoint: routeCoordinates[endIndex],
        color: this.colors[i % this.colors.length],
      };

      // Calculate elevation gain if data available
      if (elevationData && elevationData.length === routeCoordinates.length) {
        let elevGain = 0;
        for (let j = startIndex + 1; j <= endIndex; j++) {
          const diff = elevationData[j] - elevationData[j-1];
          if (diff > 0) elevGain += diff;
        }
        stage.elevation = Math.round(elevGain);
      }

      stages.push(stage);
    }

    this._stages.next(stages);
    console.log(`Created ${stages.length} stages from ${waypointIndices.length} waypoints`);
  }

  /**
   * Create sequential stages by connecting waypoints in order
   */
  createSequentialStages(
    routeCoordinates: [number, number][],
    waypointIndices: number[],
    waypointNames?: string[],
    elevationData?: number[]
  ): void {
    if (!routeCoordinates || routeCoordinates.length === 0 || 
        !waypointIndices || waypointIndices.length < 2) {
      console.error('Cannot create sequential stages: Need at least 2 waypoints');
      return;
    }

    // Sort waypoint indices to follow route order
    const sortedIndices = [...waypointIndices].sort((a, b) => a - b);
    
    const stages: RouteStage[] = [];
    const totalPoints = routeCoordinates.length;
    
    console.log(`Creating sequential stages from ${sortedIndices.length} waypoints`);

    // Create stages between consecutive waypoints
    for (let i = 0; i < sortedIndices.length - 1; i++) {
      const startIndex = sortedIndices[i];
      const endIndex = sortedIndices[i+1];
      
      // Skip invalid indices
      if (startIndex < 0 || startIndex >= totalPoints || 
          endIndex < 0 || endIndex >= totalPoints ||
          startIndex === endIndex) {
        console.warn(`Skipping invalid stage from index ${startIndex} to ${endIndex}`);
        continue;
      }

      // Generate stage name - if waypoint names provided, use them
      let stageName = `Stage ${i+1}`;
      if (waypointNames && waypointNames.length >= sortedIndices.length) {
        const startName = waypointNames[waypointIndices.indexOf(startIndex)];
        const endName = waypointNames[waypointIndices.indexOf(endIndex)];
        if (startName && endName) {
          stageName = `${startName} to ${endName}`;
        }
      }
      
      // Select a vibrant color for this stage - use the actual index to ensure color changes
      const stageColor = this.colors[i % this.colors.length];
      
      const stage: RouteStage = {
        id: `stage-${i+1}-${Date.now()}`, // Add timestamp to ensure unique IDs
        name: stageName,
        startIndex,
        endIndex,
        startPoint: routeCoordinates[startIndex],
        endPoint: routeCoordinates[endIndex],
        color: stageColor,
      };

      // Calculate elevation gain if data available
      if (elevationData && elevationData.length >= totalPoints) {
        let elevGain = 0;
        for (let j = startIndex + 1; j <= endIndex; j++) {
          const diff = elevationData[j] - elevationData[j-1];
          if (diff > 0) elevGain += diff;
        }
        stage.elevation = Math.round(elevGain);
      }

      // Calculate distance
      let distance = 0;
      for (let j = startIndex; j < endIndex; j++) {
        distance += this.calculateDistance(
          routeCoordinates[j],
          routeCoordinates[j+1]
        );
      }
      stage.distance = Math.round(distance);

      stages.push(stage);
    }

    console.log(`Created ${stages.length} sequential stages with colors:`, 
      stages.map(s => `${s.name}: ${s.color}`).join(', '));
    
    // Update the stages observable
    this._stages.next(stages);
  }

  /**
   * Add a new stage manually with specified start and end points
   */
  addManualStage(
    routeCoordinates: [number, number][],
    startPosition: number,
    endPosition: number,
    name?: string,
    elevationData?: number[]
  ): void {
    if (!routeCoordinates || routeCoordinates.length === 0) {
      console.error('Cannot create stage: No route coordinates');
      return;
    }
    
    const totalPoints = routeCoordinates.length;
    
    // Enhanced validation with specific error messages
    if (startPosition < 0 || startPosition >= totalPoints) {
      console.error(`Invalid start position (${startPosition}): Must be between 0 and ${totalPoints - 1}`);
      return;
    }
    
    if (endPosition < 0 || endPosition >= totalPoints) {
      console.error(`Invalid end position (${endPosition}): Must be between 0 and ${totalPoints - 1}`);
      return;
    }
    
    if (startPosition === endPosition) {
      console.error(`Invalid stage: Start position (${startPosition}) and end position (${endPosition}) cannot be the same`);
      return;
    }
    
    const existingStages = this._stages.getValue();
    const stageNumber = existingStages.length + 1;
    
    const stage: RouteStage = {
      id: `stage-${stageNumber}`,
      name: name || `Stage ${stageNumber}`,
      startIndex: startPosition,
      endIndex: endPosition,
      startPoint: routeCoordinates[startPosition],
      endPoint: routeCoordinates[endPosition],
      color: this.colors[(stageNumber - 1) % this.colors.length],
    };
    
    // Calculate elevation gain if data available
    if (elevationData && elevationData.length >= totalPoints) {
      let elevGain = 0;
      const start = Math.min(startPosition, endPosition);
      const end = Math.max(startPosition, endPosition);
      
      for (let j = start + 1; j <= end; j++) {
        const diff = elevationData[j] - elevationData[j-1];
        if (diff > 0) elevGain += diff;
      }
      stage.elevation = Math.round(elevGain);
    }
    
    // Calculate distance
    let distance = 0;
    const start = Math.min(startPosition, endPosition);
    const end = Math.max(startPosition, endPosition);
    
    for (let i = start; i < end; i++) {
      distance += this.calculateDistance(
        routeCoordinates[i],
        routeCoordinates[i+1]
      );
    }
    stage.distance = Math.round(distance);
    
    // Add new stage to existing stages
    this._stages.next([...existingStages, stage]);
    console.log(`Added manual stage: ${stage.name} (${stage.startIndex} to ${stage.endIndex})`);
  }

  /**
   * Update an existing stage
   */
  updateStage(
    stageId: string,
    updates: Partial<RouteStage>,
    routeCoordinates?: [number, number][],
    elevationData?: number[]
  ): void {
    const stages = this._stages.getValue();
    const stageIndex = stages.findIndex(s => s.id === stageId);
    
    if (stageIndex === -1) {
      console.error(`Stage with ID ${stageId} not found`);
      return;
    }
    
    // Create updated stage
    const updatedStage = { ...stages[stageIndex], ...updates };
    
    // If start or end indices changed, update points and recalculate metrics
    if (
      (updates.startIndex !== undefined || updates.endIndex !== undefined) && 
      routeCoordinates && 
      routeCoordinates.length > 0
    ) {
      // Update start/end points
      if (updates.startIndex !== undefined) {
        updatedStage.startPoint = routeCoordinates[updates.startIndex];
      }
      
      if (updates.endIndex !== undefined) {
        updatedStage.endPoint = routeCoordinates[updates.endIndex];
      }
      
      // Recalculate distance
      let distance = 0;
      const start = Math.min(updatedStage.startIndex, updatedStage.endIndex);
      const end = Math.max(updatedStage.startIndex, updatedStage.endIndex);
      
      for (let i = start; i < end; i++) {
        distance += this.calculateDistance(
          routeCoordinates[i],
          routeCoordinates[i+1]
        );
      }
      updatedStage.distance = Math.round(distance);
      
      // Recalculate elevation if data available
      if (elevationData && elevationData.length >= routeCoordinates.length) {
        let elevGain = 0;
        for (let j = start + 1; j <= end; j++) {
          const diff = elevationData[j] - elevationData[j-1];
          if (diff > 0) elevGain += diff;
        }
        updatedStage.elevation = Math.round(elevGain);
      }
    }
    
    // Update the stages array
    const updatedStages = [...stages];
    updatedStages[stageIndex] = updatedStage;
    this._stages.next(updatedStages);
    console.log(`Updated stage: ${updatedStage.id}`);
  }

  /**
   * Remove a stage by ID
   */
  removeStage(stageId: string): void {
    const stages = this._stages.getValue();
    const filteredStages = stages.filter(stage => stage.id !== stageId);
    
    if (filteredStages.length === stages.length) {
      console.warn(`Stage with ID ${stageId} not found, nothing removed`);
      return;
    }
    
    this._stages.next(filteredStages);
    console.log(`Removed stage: ${stageId}`);
  }

  /**
   * Calculate distance between two lat/lng points (in meters)
   */
  calculateDistance(p1: [number, number], p2: [number, number]): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = this.toRadians(p1[0]);
    const φ2 = this.toRadians(p2[0]);
    const Δφ = this.toRadians(p2[0] - p1[0]);
    const Δλ = this.toRadians(p2[1] - p1[1]);

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Calculate total distance for each stage
   */
  calculateStageDistances(routeCoordinates: [number, number][]): void {
    const stages = this._stages.getValue();
    
    stages.forEach(stage => {
      let distance = 0;
      for (let i = stage.startIndex; i < stage.endIndex; i++) {
        distance += this.calculateDistance(
          routeCoordinates[i],
          routeCoordinates[i+1]
        );
      }
      stage.distance = Math.round(distance);
    });

    this._stages.next([...stages]);
  }

  getStages(): RouteStage[] {
    return this._stages.getValue();
  }

  clearStages(): void {
    this._stages.next([]);
  }

  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }
}
