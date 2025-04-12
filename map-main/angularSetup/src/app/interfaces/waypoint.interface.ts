import * as L from 'leaflet';

export interface Waypoint {
  id: string;
  position: number; // Index in route coordinates
  name: string;
  description?: string;
  marker: L.Marker | null;
  lat: number;
  lng: number;
  leaderboardPopup?: L.Popup | null;
  isCheckpoint?: boolean; // Property to identify checkpoints
  radius?: number; // Radius in meters for real-life check-in
  circle?: L.Circle; // Visual representation of the check-in radius
}

export interface WaypointPass {
  riderId: string;
  riderName: string;
  waypointId: string;
  waypointName: string;
  time: number; // Timestamp
  formattedTime: string;
} 