import { Injectable } from '@angular/core';
import { Event, Checkpoint, Participant, ParticipantCheckpoint } from './event.service';
import {
  SupabaseEvent,
  SupabaseCheckpoint,
  SupabaseParticipant,
  SupabaseParticipantCheckpoint,
  SupabaseEventWithCheckpoints,
  SupabaseParticipantWithCheckpoints
} from '../models/supabase.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ModelConverterService {

  constructor() { }

  // Convert Supabase event to application Event
  supabaseEventToEvent(supabaseEvent: SupabaseEvent | SupabaseEventWithCheckpoints): Event {
    const event: Event = {
      id: supabaseEvent.id,
      name: supabaseEvent.name,
      date: supabaseEvent.date,
      time: supabaseEvent.time,
      deadline: supabaseEvent.deadline,
      description: supabaseEvent.description,
      location: supabaseEvent.location,
      organizer: supabaseEvent.organizer,
      type: supabaseEvent.type,
      distance: supabaseEvent.distance,
      elevation: supabaseEvent.elevation,
      paymentMethod: supabaseEvent.payment_method,
      routeLink: supabaseEvent.route_link,
      gpxFileName: this.getFileNameFromPath(supabaseEvent.gpx_file_path),
      imageFileName: this.getFileNameFromPath(supabaseEvent.image_path),
      imagePreviewUrl: supabaseEvent.image_path ? 
        this.getPublicUrl(environment.supabase.buckets.events, supabaseEvent.image_path) : 
        null,
      checkpoints: [],
      participants: [],
      createdAt: new Date(supabaseEvent.created_at)
    };

    // Convert checkpoints if available
    if ('checkpoints' in supabaseEvent && supabaseEvent.checkpoints) {
      event.checkpoints = supabaseEvent.checkpoints.map(cp => this.supabaseCheckpointToCheckpoint(cp));
    }

    return event;
  }

  // Convert application Event to Supabase event
  eventToSupabaseEvent(event: Event): Omit<SupabaseEvent, 'id' | 'created_at'> {
    return {
      name: event.name,
      date: event.date,
      time: event.time,
      deadline: event.deadline,
      description: event.description,
      location: event.location,
      organizer: event.organizer,
      type: event.type,
      distance: event.distance,
      elevation: event.elevation,
      payment_method: event.paymentMethod,
      route_link: event.routeLink,
      gpx_file_path: event.gpxFileName,
      image_path: event.imageFileName
    };
  }

  // Convert Supabase checkpoint to application Checkpoint
  supabaseCheckpointToCheckpoint(supabaseCheckpoint: SupabaseCheckpoint): Checkpoint {
    return {
      name: supabaseCheckpoint.name,
      distance: supabaseCheckpoint.distance,
      openingTime: supabaseCheckpoint.opening_time ? new Date(supabaseCheckpoint.opening_time) : null,
      closingTime: supabaseCheckpoint.closing_time ? new Date(supabaseCheckpoint.closing_time) : null,
      imageFile: null,
      imageFileName: this.getFileNameFromPath(supabaseCheckpoint.image_path || ''),
      imagePreviewUrl: supabaseCheckpoint.image_path ? 
        this.getPublicUrl(environment.supabase.buckets.checkpoints, supabaseCheckpoint.image_path) : 
        null,
      location: supabaseCheckpoint.location
    };
  }

  // Convert application Checkpoint to Supabase checkpoint
  checkpointToSupabaseCheckpoint(checkpoint: Checkpoint, eventId: string): Omit<SupabaseCheckpoint, 'id' | 'created_at'> {
    return {
      event_id: eventId,
      name: checkpoint.name,
      distance: checkpoint.distance,
      opening_time: checkpoint.openingTime ? checkpoint.openingTime.toISOString() : null,
      closing_time: checkpoint.closingTime ? checkpoint.closingTime.toISOString() : null,
      image_path: checkpoint.imageFileName,
      location: checkpoint.location
    };
  }

  // Convert Supabase participant to application Participant
  supabaseParticipantToParticipant(supabaseParticipant: SupabaseParticipant | SupabaseParticipantWithCheckpoints): Participant {
    const participant: Participant = {
      id: supabaseParticipant.id,
      firstName: supabaseParticipant.first_name,
      lastName: supabaseParticipant.last_name,
      email: supabaseParticipant.email,
      phone: supabaseParticipant.phone,
      club: supabaseParticipant.club,
      registrationCode: supabaseParticipant.registration_code,
      registrationDate: new Date(supabaseParticipant.registration_date),
      checkpoints: []
    };

    // Convert participant checkpoints if available
    if ('participant_checkpoints' in supabaseParticipant && supabaseParticipant.participant_checkpoints) {
      participant.checkpoints = supabaseParticipant.participant_checkpoints.map(
        cp => this.supabaseParticipantCheckpointToParticipantCheckpoint(cp)
      );
    }

    return participant;
  }

  // Convert application Participant to Supabase participant
  participantToSupabaseParticipant(participant: Participant, eventId: string): Omit<SupabaseParticipant, 'id' | 'created_at'> {
    return {
      event_id: eventId,
      first_name: participant.firstName,
      last_name: participant.lastName,
      email: participant.email,
      phone: participant.phone,
      club: participant.club,
      registration_code: participant.registrationCode,
      registration_date: participant.registrationDate.toISOString()
    };
  }

  // Convert Supabase participant checkpoint to application ParticipantCheckpoint
  supabaseParticipantCheckpointToParticipantCheckpoint(supabaseParticipantCheckpoint: SupabaseParticipantCheckpoint): ParticipantCheckpoint {
    return {
      checkpointId: parseInt(supabaseParticipantCheckpoint.checkpoint_id),
      checkInTime: supabaseParticipantCheckpoint.check_in_time ? new Date(supabaseParticipantCheckpoint.check_in_time) : null,
      status: supabaseParticipantCheckpoint.status
    };
  }

  // Convert application ParticipantCheckpoint to Supabase participant checkpoint
  participantCheckpointToSupabaseParticipantCheckpoint(
    participantCheckpoint: ParticipantCheckpoint, 
    participantId: string, 
    checkpointId: string
  ): Omit<SupabaseParticipantCheckpoint, 'id' | 'created_at'> {
    return {
      participant_id: participantId,
      checkpoint_id: checkpointId,
      check_in_time: participantCheckpoint.checkInTime ? participantCheckpoint.checkInTime.toISOString() : null,
      status: participantCheckpoint.status
    };
  }

  // Helper methods
  private getFileNameFromPath(path: string): string {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  private getPublicUrl(bucket: string, path: string): string {
    // This is a simple implementation - in production you'd use the Supabase getPublicUrl method
    return `${environment.supabase.url}/storage/v1/object/public/${bucket}/${path}`;
  }
}
