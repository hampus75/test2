import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { ModelConverterService } from './model-converter.service';
import { SupabaseService } from './supabase.service';
import { Router } from '@angular/router';

export interface Checkpoint {
  name: string;
  distance: number;
  openingTime: Date | null;
  closingTime: Date | null;
  imageFile: File | null;
  imageFileName: string;
  imagePreviewUrl: string | ArrayBuffer | null;
  location: string;
}

export interface ParticipantCheckpoint {
  checkpointId: number;
  checkInTime: Date | null;
  status: 'pending' | 'checked-in' | 'missed';
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  club?: string;
  registrationCode: string;
  registrationDate: Date;
  checkpoints?: ParticipantCheckpoint[];
}

export interface CurrentParticipantData {
  eventId: string;
  participant: Participant;
}

export interface Event {
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
  paymentMethod: string;
  routeLink: string;
  gpxFileName: string;
  imageFileName: string;
  imagePreviewUrl: string | ArrayBuffer | null;
  checkpoints: Checkpoint[];
  participants: Participant[];
  createdAt: Date;
  imageFile?: File | null;
  gpxFile?: File | null;
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private events: Event[] = [];
  private eventsSubject = new BehaviorSubject<Event[]>([]);
  public events$ = this.eventsSubject.asObservable();
  
  private currentParticipant: CurrentParticipantData | null = null;

  constructor(
    private modelConverter: ModelConverterService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    console.log('EventService initialized');
    this.loadEvents();
    this.loadCurrentParticipant(); // Load participant from sessionStorage
  }

  // Load events from localStorage or backend
  loadEvents(): void {
    console.log('Loading events...');
    try {
      // First try to load from localStorage
      const storedEvents = localStorage.getItem('events');
      if (storedEvents) {
        try {
          this.events = JSON.parse(storedEvents);
          console.log(`Loaded ${this.events.length} events from localStorage`);
        } catch (parseError) {
          console.error('Error parsing events from localStorage:', parseError);
          // Reset localStorage if data is corrupted
          localStorage.setItem('events', JSON.stringify([]));
          this.events = [];
        }
      } else {
        console.log('No events found in localStorage, initializing empty array');
        this.events = [];
        // Initialize empty events array in localStorage
        localStorage.setItem('events', JSON.stringify([]));
      }
      
      // Fetch events from Supabase if connected
      this.loadEventsFromSupabase()
        .then(supabaseEvents => {
          if (supabaseEvents && supabaseEvents.length > 0) {
            console.log(`Loaded ${supabaseEvents.length} events from Supabase`);
            // Merge with local events, preferring Supabase versions
            this.mergeEvents(supabaseEvents);
          }
        })
        .catch(error => {
          console.error('Failed to load events from Supabase:', error);
        })
        .finally(() => {
          // Always emit the updated events
          this.eventsSubject.next([...this.events]);
        });
        
      // Immediately emit the events we have from localStorage
      this.eventsSubject.next([...this.events]);
    } catch (error) {
      console.error('Error in loadEvents:', error);
      this.events = [];
      this.eventsSubject.next([]);
    }
  }

  // Load current participant from sessionStorage
  private loadCurrentParticipant(): void {
    try {
      const storedParticipant = sessionStorage.getItem('currentParticipant');
      if (storedParticipant) {
        this.currentParticipant = JSON.parse(storedParticipant);
        console.log('Loaded current participant from sessionStorage');
      }
    } catch (error) {
      console.error('Error loading current participant from sessionStorage:', error);
      this.currentParticipant = null;
    }
  }

  // Get current participant data
  getCurrentParticipant(): CurrentParticipantData | null {
    return this.currentParticipant;
  }

  // Register a new participant for an event
  async registerParticipant(eventId: string, participantData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    club?: string;
  }): Promise<Participant> {
    console.log('Registering participant for event:', eventId);
    
    try {
      // Find the event
      const event = this.getEventById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Generate a unique registration code (6 digits)
      const registrationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Create new participant object
      const newParticipant: Participant = {
        id: 'p_' + Date.now().toString(),
        firstName: participantData.firstName,
        lastName: participantData.lastName,
        email: participantData.email,
        phone: participantData.phone,
        club: participantData.club,
        registrationCode: registrationCode,
        registrationDate: new Date(),
        checkpoints: event.checkpoints.map((_, index) => ({
          checkpointId: index,
          checkInTime: null,
          status: 'pending'
        }))
      };
      
      // Try to save to Supabase if available
      try {
        // Implement Supabase save logic here if needed
      } catch (supabaseError) {
        console.error('Failed to save participant to Supabase:', supabaseError);
      }
      
      // Add to local event's participants list
      if (!event.participants) {
        event.participants = [];
      }
      event.participants.push(newParticipant);
      
      // Save updated event to localStorage
      this.saveEventToLocalStorage(event);
      
      return newParticipant;
    } catch (error) {
      console.error('Error registering participant:', error);
      throw new Error('Failed to register participant: ' + error);
    }
  }

  // Participant login with registration code
  async participantLogin(eventId: string, registrationCode: string): Promise<Participant> {
    console.log('Participant login attempt for event:', eventId);
    
    try {
      // Find the event
      const event = this.getEventById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Find participant with matching registration code
      const participant = event.participants?.find(p => p.registrationCode === registrationCode);
      if (!participant) {
        throw new Error('Invalid registration code');
      }
      
      // Store current participant in sessionStorage
      this.currentParticipant = {
        eventId,
        participant
      };
      sessionStorage.setItem('currentParticipant', JSON.stringify(this.currentParticipant));
      
      console.log('Participant logged in successfully:', participant.firstName);
      return participant;
    } catch (error) {
      console.error('Error in participant login:', error);
      throw new Error('Login failed: ' + error);
    }
  }

  // Participant logout
  participantLogout(): void {
    console.log('Participant logout');
    this.currentParticipant = null;
    sessionStorage.removeItem('currentParticipant');
  }

  // Participant check-in at a checkpoint
  async participantCheckIn(
    eventId: string, 
    checkpointId: number, 
    participantId: string
  ): Promise<boolean> {
    console.log(`Participant ${participantId} checking in at checkpoint ${checkpointId}`);
    
    try {
      // Find the event
      const event = this.getEventById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Find the participant
      const participantIndex = event.participants.findIndex(p => p.id === participantId);
      if (participantIndex === -1) {
        throw new Error('Participant not found');
      }
      
      const participant = event.participants[participantIndex];
      
      // Initialize checkpoints array if not exists
      if (!participant.checkpoints) {
        participant.checkpoints = event.checkpoints.map((_, index) => ({
          checkpointId: index,
          checkInTime: null,
          status: 'pending'
        }));
      }
      
      // Find the checkpoint to update
      const checkpointIndex = participant.checkpoints.findIndex(
        cp => cp.checkpointId === checkpointId
      );
      
      if (checkpointIndex === -1) {
        // If checkpoint doesn't exist, create it
        participant.checkpoints.push({
          checkpointId,
          checkInTime: new Date(),
          status: 'checked-in'
        });
      } else {
        // Update existing checkpoint
        participant.checkpoints[checkpointIndex] = {
          ...participant.checkpoints[checkpointIndex],
          checkInTime: new Date(),
          status: 'checked-in'
        };
      }
      
      // Update the participant in the event
      event.participants[participantIndex] = participant;
      
      // Save updated event to localStorage
      this.saveEventToLocalStorage(event);
      
      // Update current participant in sessionStorage if it's the logged-in participant
      if (this.currentParticipant?.participant.id === participantId) {
        this.currentParticipant = {
          eventId,
          participant
        };
        sessionStorage.setItem('currentParticipant', JSON.stringify(this.currentParticipant));
      }
      
      return true;
    } catch (error) {
      console.error('Error during check-in:', error);
      return false;
    }
  }

  // Attempt to load events from Supabase
  private async loadEventsFromSupabase(): Promise<Event[]> {
    try {
      // Call the Supabase service to get events
      const supabaseEvents = await this.supabaseService.getEvents();
      if (supabaseEvents && Array.isArray(supabaseEvents)) {
        return supabaseEvents.map(event => this.modelConverter.supabaseEventToEvent(event));
      }
      return [];
    } catch (error) {
      console.error('Error loading events from Supabase:', error);
      return [];
    }
  }

  // Merge local and remote events
  private mergeEvents(remoteEvents: Event[]): void {
    // Create a map of existing events by ID
    const eventsMap = new Map<string, Event>();
    
    // Add all local events to the map
    this.events.forEach(event => {
      eventsMap.set(event.id, event);
    });
    
    // Override or add remote events
    remoteEvents.forEach(event => {
      eventsMap.set(event.id, event);
    });
    
    // Convert map back to array
    this.events = Array.from(eventsMap.values());
    
    // Save merged events to localStorage
    localStorage.setItem('events', JSON.stringify(this.events));
    
    console.log(`After merging, we have ${this.events.length} events`);
  }

  // Get all events
  getAllEvents(): Event[] {
    return [...this.events];
  }

  // Get event by ID
  getEventById(id: string): Event | undefined {
    return this.events.find(event => event.id === id);
  }

  // Create a new event
  async createEvent(eventData: Omit<Event, 'id' | 'createdAt' | 'participants'>): Promise<Event> {
    try {
      console.log('Creating event:', eventData.name);
      let newEvent: Event;
      
      // Create event with a temporary local ID
      const tempEvent: Event = {
        id: 'temp_' + Date.now().toString(),
        ...eventData,
        createdAt: new Date(),
        participants: []
      } as Event;
      
      // Save to local storage immediately for responsiveness
      this.saveEventToLocalStorage(tempEvent);
      
      try {
        // Try to create in Supabase and get a proper ID
        const supabaseEvent = await this.saveEventToSupabase(eventData);
        
        if (supabaseEvent && supabaseEvent.id) {
          // Replace temp event with Supabase version
          newEvent = this.modelConverter.supabaseEventToEvent(supabaseEvent);
          
          // Remove the temp event and add the real one
          this.events = this.events.filter(e => e.id !== tempEvent.id);
          this.saveEventToLocalStorage(newEvent);
        } else {
          // Keep using the temp event
          newEvent = tempEvent;
        }
      } catch (supabaseError) {
        console.error('Supabase error during event creation:', supabaseError);
        console.log('Using local event as fallback');
        newEvent = tempEvent;
      }
      
      // Return the new event
      return newEvent;
    } catch (error) {
      console.error('Error in createEvent:', error);
      throw new Error('Failed to create event: ' + error);
    }
  }

  // Save event to Supabase
  private async saveEventToSupabase(eventData: any): Promise<any> {
    try {
      // Convert app model to Supabase model if needed
      const supabaseEventData = this.modelConverter.eventToSupabaseEvent 
        ? this.modelConverter.eventToSupabaseEvent(eventData as Event) 
        : eventData;
      
      // Create event in Supabase
      return await this.supabaseService.createEvent(supabaseEventData);
    } catch (error) {
      console.error('Error saving event to Supabase:', error);
      throw error;
    }
  }

  // Save event to localStorage
  private saveEventToLocalStorage(event: Event): void {
    try {
      console.log('Saving event to localStorage:', event.name);
      
      // Add to events array if not already present
      const existingEventIndex = this.events.findIndex(e => e.id === event.id);
      
      if (existingEventIndex >= 0) {
        console.log('Updating existing event in array');
        this.events[existingEventIndex] = event;
      } else {
        console.log('Adding new event to array');
        this.events.push(event);
      }
      
      // Save to localStorage
      localStorage.setItem('events', JSON.stringify(this.events));
      console.log(`Saved ${this.events.length} events to localStorage`);
      
      // Update the BehaviorSubject with a new array reference
      this.eventsSubject.next([...this.events]);
      console.log('Updated events observable with new event');
      
    } catch (error) {
      console.error('Error saving event to localStorage:', error);
      throw new Error('Failed to save event locally: ' + error);
    }
  }

  // Delete an event by ID
  deleteEvent(id: string): void {
    console.log('Deleting event:', id);
    
    // Remove from local array
    this.events = this.events.filter(event => event.id !== id);
    
    // Update localStorage
    localStorage.setItem('events', JSON.stringify(this.events));
    
    // Update the BehaviorSubject
    this.eventsSubject.next([...this.events]);
    
    console.log('Event deleted, remaining events:', this.events.length);
  }
}
