export interface StravaSegment {
  id: number;
  name: string;
  activity_type?: string;
  distance?: number;
  average_grade?: number;
  maximum_grade?: number;
  elevation_high?: number;
  elevation_low?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  climb_category?: number;
  city?: string;
  state?: string;
  country?: string;
  private?: boolean;
  starred?: boolean;
  
  // Added properties for internal use
  start_index?: number;
  end_index?: number;
  color?: string;
} 