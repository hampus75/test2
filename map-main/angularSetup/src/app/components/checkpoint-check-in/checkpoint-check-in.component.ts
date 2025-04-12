import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService, Event, Participant, Checkpoint } from '../../services/event.service';

@Component({
  selector: 'app-checkpoint-check-in',
  templateUrl: './checkpoint-check-in.component.html',
  styleUrls: ['./checkpoint-check-in.component.css']
})
export class CheckpointCheckInComponent implements OnInit {
  event: Event | null = null;
  participant: Participant | null = null;
  checkpoint: Checkpoint | null = null;
  checkpointId: number = -1;
  loading = true;
  errorMessage = '';
  checkInSuccess = false;
  checkInTime: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService
  ) { }

  ngOnInit(): void {
    // Get the event ID and checkpoint ID from the route
    const eventId = this.route.snapshot.paramMap.get('eventId');
    const checkpointIdParam = this.route.snapshot.paramMap.get('checkpointId');
    
    if (!eventId || !checkpointIdParam) {
      this.errorMessage = 'Ogiltig kontrollpunkt';
      this.loading = false;
      return;
    }
    
    this.checkpointId = parseInt(checkpointIdParam);
    
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
      this.errorMessage = 'Evenemanget kunde inte hittas';
      this.loading = false;
      return;
    }
    
    // Get the checkpoint
    if (this.checkpointId >= 0 && this.checkpointId < this.event.checkpoints.length) {
      this.checkpoint = this.event.checkpoints[this.checkpointId];
    } else {
      this.errorMessage = 'Kontrollpunkten kunde inte hittas';
    }
    
    // Check if already checked in
    if (this.participant && this.participant.checkpoints) {
      const participantCheckpoint = this.participant.checkpoints.find(cp => cp.checkpointId === this.checkpointId);
      if (participantCheckpoint && participantCheckpoint.status === 'checked-in') {
        this.checkInSuccess = true;
        this.checkInTime = participantCheckpoint.checkInTime;
      }
    }
    
    this.loading = false;
  }
  
  async checkIn(): Promise<void> {
    if (!this.event || !this.participant || !this.checkpoint) {
      this.errorMessage = 'Kunde inte slutföra incheckningen';
      return;
    }
    
    try {
      const success = await this.eventService.participantCheckIn(
        this.event.id, 
        this.checkpointId, 
        String(this.participant.id) // Explicitly convert to string if needed
      );
      
      if (success) {
        this.checkInSuccess = true;
        this.checkInTime = new Date();
        
        // Update the participant data after checking in
        const participantData = this.eventService.getCurrentParticipant();
        if (participantData) {
          this.participant = participantData.participant;
        }
      } else {
        this.errorMessage = 'Kunde inte checka in vid denna kontrollpunkt';
      }
    } catch (error) {
      console.error('Error during check-in:', error);
      this.errorMessage = 'Ett fel uppstod vid incheckning';
    }
  }
  
  backToEvent(): void {
    if (this.event) {
      this.router.navigate(['/events/participant-view', this.event.id]);
    } else {
      this.router.navigate(['/events']);
    }
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
  
  // Format time for display
  formatTime(date: Date | null): string {
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
}
