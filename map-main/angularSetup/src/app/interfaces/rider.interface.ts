import * as L from 'leaflet';

export interface Rider {
  id: string;
  name: string;
  color: string;
  position: number;
  marker: L.Marker | null;
  speed: number;
  elevation: number;
  distanceCovered: number;
  actualDistanceCovered: number; // Actual distance covered along the route in meters
  checkpointsPassed: string[]; // IDs of passed waypoints
  startTime: number; // When the rider started
  lastCheckpointTime?: number; // When the rider last passed a waypoint
  sessionId: string; // Session ID of the rider's creator
  lastPosition?: number; // Track last position to calculate actual distance
  currentStageId?: string; // Current stage the rider is in
  stageSpeeds?: RiderStageSpeed[]; // Speeds for different stages
}

export interface RealRider {
  id: string;
  name: string;
  color: string;
  marker: L.Marker | null;
  lastPosition: L.LatLng;
  lastCheckpoint?: string;
  checkpointsPassed: string[];
}

export interface RiderStageSpeed {
  riderId: string;
  stageId: string;
  speed: number; // Speed in km/h
} 