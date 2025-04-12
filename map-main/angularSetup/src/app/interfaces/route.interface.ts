import * as L from 'leaflet';

export interface RouteStage {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  color: string;
  distance?: number;
  elevation?: number;
}

export interface GpxRoute {
  id: string;
  gpxId?: string; // ID used on the backend
  name: string;
  coordinates: [number, number][]; // [lat, lng]
  elevationData: number[];
  color: string;
  visible: boolean;
  alwaysShowCheckpoints?: boolean; // Whether to always show checkpoints regardless of selection status
  polyline?: L.Polyline;
  markers?: L.CircleMarker[];
  startMarker?: L.Marker; // Start marker for the route
  finishMarker?: L.Marker; // Finish marker for the route
  checkpoints?: {
    lat: number;
    lng: number;
    name: string;
    description?: string;
    marker?: L.Marker;
    circle?: L.Circle;
  }[];
} 