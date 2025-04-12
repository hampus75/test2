import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService, Event, Participant, Checkpoint, ParticipantCheckpoint } from '../../services/event.service';

@Component({
  selector: 'app-participant-event-view',
  templateUrl: './participant-event-view.component.html',
  styleUrls: ['./participant-event-view.component.css']
})
export class ParticipantEventViewComponent implements OnInit {
  event: Event | null = null;
  participant: Participant | null = null;
  checkpoints: Checkpoint[] = [];
  participantCheckpoints: ParticipantCheckpoint[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService
  ) { }

  ngOnInit(): void {
    // Get the event ID from the route
    const eventId = this.route.snapshot.paramMap.get('id');
    
    if (!eventId) {
      this.router.navigate(['/events']);
      return;
    }
    
    // Check if participant is logged in
    const participantData = this.eventService.getCurrentParticipant();
    
    if (!participantData || participantData.eventId !== eventId) {
      this.router.navigate(['/events/login', eventId]);
      return;
    }
    
    // Get event and participant data
    const eventData = this.eventService.getEventById(eventId);
    this.event = eventData || null;
    this.participant = participantData.participant;
    
    if (!this.event) {
      this.errorMessage = 'Eventet kunde inte hittas';
      this.loading = false;
      return;
    }
    
    // Get checkpoints
    this.checkpoints = this.event.checkpoints || [];
    
    // Get participant checkpoint status
    this.participantCheckpoints = this.participant.checkpoints || [];
    
    // If participant doesn't have checkpoint data yet, initialize it
    if (!this.participantCheckpoints.length && this.checkpoints.length) {
      this.participantCheckpoints = this.checkpoints.map((_, index) => ({
        checkpointId: index,
        checkInTime: null,
        status: 'pending'
      }));
    }
    
    this.loading = false;
  }
  
  // Get checkpoint status
  getCheckpointStatus(checkpointId: number): string {
    const checkpoint = this.participantCheckpoints.find(cp => cp.checkpointId === checkpointId);
    return checkpoint ? checkpoint.status : 'pending';
  }
  
  // Get checkpoint check-in time (if any)
  getCheckpointTime(checkpointId: number): Date | null {
    const checkpoint = this.participantCheckpoints.find(cp => cp.checkpointId === checkpointId);
    return checkpoint ? checkpoint.checkInTime : null;
  }
  
  // Navigate to check-in page for a checkpoint
  checkIn(checkpointId: number): void {
    if (!this.event) return;
    
    this.router.navigate(['/events/checkpoint', this.event.id, checkpointId]);
  }
  
  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleString('sv-SE', { month: 'long' });
      return `${day} ${month}`;
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString;
    }
  }
  
  // Format check-in time
  formatCheckInTime(date: Date | null): string {
    if (!date) return '-';
    
    try {
      return date.toLocaleTimeString('sv-SE', { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting time:', e);
      return '-';
    }
  }
  
  // Logout
  logout(): void {
    this.eventService.participantLogout();
    this.router.navigate(['/events']);
  }
}
