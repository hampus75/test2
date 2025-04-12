export interface Rider {
  id: string;
  name: string;
  color: string;
  position: number;
  speed: number;
  elevation: number;
  distanceCovered: number;
  checkpointsPassed: string[];
  startTime: number;
  lastCheckpointTime?: number;
  sessionId: string;
  userId?: string;
}

export interface Waypoint {
  id: string;
  position: number;
  name: string;
  lat: number;
  lng: number;
}

export interface WaypointPass {
  riderId: string;
  riderName: string;
  waypointId: string;
  waypointName: string;
  time: number;
  formattedTime: string;
}

export interface Session {
  _id: string;
  name: string;
  description?: string;
  creator: {
    _id: string;
    name: string;
    profileImage?: string;
  };
  routeId: string;
  routeData: {
    name: string;
    coordinates: [number, number][];
    elevation: number[];
    distance: number;
  };
  isPublic: boolean;
  riders: Rider[];
  waypoints: Waypoint[];
  waypointPasses: WaypointPass[];
  isActive: boolean;
  createdAt: string;
  lastActivity: string;
}
