import { Component, OnInit } from '@angular/core';
import { EventService, Event } from '../../services/event.service';

@Component({
  selector: 'app-old-home-page',
  templateUrl: './old-home-page.component.html',
  styleUrls: ['./old-home-page.component.css']
})
export class OldHomePageComponent implements OnInit {
  upcomingEvents: Event[] = [];
  pastEvents: Event[] = [];
  featuredEvents: Event[] = [];
  isLoading = true;
  currentYear = new Date().getFullYear();

  constructor(private eventService: EventService) { }

  ngOnInit(): void {
    this.loadEvents();
  }

  private loadEvents() {
    this.isLoading = true;
    
    // Get all events
    const events = this.eventService.getAllEvents();
    
    // Current date for comparing
    const today = new Date();
    
    // Filter out upcoming and past events
    this.upcomingEvents = events
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6); // Take only the next 6 events
    
    this.pastEvents = events
      .filter(event => new Date(event.date) < today)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort in reverse chronological order
      .slice(0, 3); // Take only the last 3 events
    
    // Select featured events (could be based on custom criteria)
    this.featuredEvents = this.upcomingEvents.slice(0, 3); // Just use the first 3 upcoming events
    
    this.isLoading = false;
  }
  
  // Format date for display (e.g., "22 March")
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
  
  // Get day from date string
  getEventDay(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.getDate().toString();
    } catch (e) {
      console.error('Error getting day from date:', e);
      return '';
    }
  }
  
  // Get short month name from date string
  getEventMonth(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('sv-SE', { month: 'short' });
    } catch (e) {
      console.error('Error getting month from date:', e);
      return '';
    }
  }
} 