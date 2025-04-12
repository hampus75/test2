// Supabase data models for use with TypeScript

// Events table
export interface SupabaseEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  deadline: string;
  description: string;
  location: string;
  organizer: string;
  type: string;
  distance: number;
  elevation: number | null;
  payment_method: string;
  route_link: string;
  gpx_file_path: string;
  image_path: string;
  created_at: string;
}

// Checkpoints table
export interface SupabaseCheckpoint {
  id: string;
  event_id: string;
  name: string;
  distance: number;
  opening_time: string | null;
  closing_time: string | null;
  image_path: string | null;
  location: string;
  created_at: string;
}

// Participants table
export interface SupabaseParticipant {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  club?: string;
  registration_code: string;
  registration_date: string;
  created_at: string;
}

// Participant checkpoints table
export interface SupabaseParticipantCheckpoint {
  id: string;
  participant_id: string;
  checkpoint_id: string;
  check_in_time: string | null;
  status: 'pending' | 'checked-in' | 'missed';
  created_at: string;
}

// Response from getting a participant with their checkpoints
export interface SupabaseParticipantWithCheckpoints extends SupabaseParticipant {
  participant_checkpoints: SupabaseParticipantCheckpoint[];
}

// Response from getting an event with its checkpoints
export interface SupabaseEventWithCheckpoints extends SupabaseEvent {
  checkpoints: SupabaseCheckpoint[];
} 