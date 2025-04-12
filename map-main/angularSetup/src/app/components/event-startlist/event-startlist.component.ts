import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService, Event, Participant } from '../../services/event.service';

@Component({
  selector: 'app-event-startlist',
  templateUrl: './event-startlist.component.html',
  styleUrls: ['./event-startlist.component.css']
})
export class EventStartlistComponent implements OnInit {
  event: Event | null = null;
  participants: Participant[] = [];
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService
  ) { }

  ngOnInit(): void {
    // Get the event ID from the route
    const eventId = this.route.snapshot.paramMap.get('id');
    
    if (eventId) {
      // Load the event details
      const foundEvent = this.eventService.getEventById(eventId);
      
      if (foundEvent) {
        this.event = foundEvent;
        this.participants = this.event.participants;
      } else {
        // If event not found, redirect to events list
        this.router.navigate(['/events']);
      }
    } else {
      // If no event ID, redirect to events list
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
  
  // Format registration date
  formatRegistrationDate(date: Date): string {
    if (!date) return '-';
    
    try {
      return new Date(date).toLocaleDateString('sv-SE', {
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting registration date:', e);
      return '-';
    }
  }
}
