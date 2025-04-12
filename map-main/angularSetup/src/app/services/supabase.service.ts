import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.key
    );
  }

  // Get the Supabase client instance
  get supabaseClient(): SupabaseClient {
    return this.supabase;
  }

  // ================ Events ================

  // Get all events
  async getEvents() {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // Get a single event by ID
  async getEventById(id: string) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select(`
          *,
          checkpoints(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  }

  // Create a new event
  async createEvent(eventData: any) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .insert([eventData])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  // Update an event
  async updateEvent(id: string, eventData: any) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .update(eventData)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  // Delete an event
  async deleteEvent(id: string) {
    try {
      const { error } = await this.supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  // ================ Checkpoints ================

  // Get checkpoints for an event
  async getCheckpoints(eventId: string) {
    try {
      const { data, error } = await this.supabase
        .from('checkpoints')
        .select('*')
        .eq('event_id', eventId)
        .order('distance', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching checkpoints:', error);
      throw error;
    }
  }

  // Create checkpoints (batch)
  async createCheckpoints(checkpoints: any[]) {
    try {
      const { data, error } = await this.supabase
        .from('checkpoints')
        .insert(checkpoints)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating checkpoints:', error);
      throw error;
    }
  }

  // ================ Participants ================

  // Get all participants for an event
  async getParticipants(eventId: string) {
    try {
      const { data, error } = await this.supabase
        .from('participants')
        .select('*, participant_checkpoints(*)')
        .eq('event_id', eventId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching participants:', error);
      throw error;
    }
  }

  // Register a participant for an event
  async registerParticipant(participantData: any) {
    try {
      const { data, error } = await this.supabase
        .from('participants')
        .insert([participantData])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error registering participant:', error);
      throw error;
    }
  }

  // Participant login with registration code
  async participantLogin(eventId: string, registrationCode: string) {
    try {
      const { data, error } = await this.supabase
        .from('participants')
        .select('*, participant_checkpoints(*)')
        .eq('event_id', eventId)
        .eq('registration_code', registrationCode)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error with participant login:', error);
      return null;
    }
  }

  // ================ Participant Checkpoints ================

  // Create participant checkpoint record (initial setup)
  async createParticipantCheckpoints(participantCheckpoints: any[]) {
    try {
      const { data, error } = await this.supabase
        .from('participant_checkpoints')
        .insert(participantCheckpoints)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating participant checkpoints:', error);
      throw error;
    }
  }

  // Update participant checkpoint (check-in)
  async checkInParticipantCheckpoint(id: string, checkpointData: any) {
    try {
      const { data, error } = await this.supabase
        .from('participant_checkpoints')
        .update(checkpointData)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error checking in participant checkpoint:', error);
      throw error;
    }
  }

  // ================ File Storage ================

  // Upload event image
  async uploadEventImage(file: File, path: string) {
    try {
      const { data, error } = await this.supabase
        .storage
        .from(environment.supabase.buckets.events)
        .upload(path, file, {
          upsert: true
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error uploading event image:', error);
      throw error;
    }
  }

  // Upload checkpoint image
  async uploadCheckpointImage(file: File, path: string) {
    try {
      const { data, error } = await this.supabase
        .storage
        .from(environment.supabase.buckets.checkpoints)
        .upload(path, file, {
          upsert: true
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error uploading checkpoint image:', error);
      throw error;
    }
  }

  // Upload GPX file
  async uploadGpxFile(file: File, path: string) {
    try {
      const { data, error } = await this.supabase
        .storage
        .from(environment.supabase.buckets.gpx)
        .upload(path, file, {
          upsert: true
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error uploading GPX file:', error);
      throw error;
    }
  }

  // Get public URL for a file
  getPublicUrl(bucket: string, path: string) {
    const { data } = this.supabase
      .storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }
}
