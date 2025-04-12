import { Component, OnInit, OnDestroy } from '@angular/core';
import { EventService, Event } from '../../services/event.service';
import { Subscription } from 'rxjs';

interface MonthGroup {
  month: string;
  events: Event[];
}

@Component({
  selector: 'app-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.css']
})
export class EventListComponent implements OnInit, OnDestroy {
  events: Event[] = [];
  eventsByMonth: MonthGroup[] = [];
  private eventSubscription: Subscription | null = null;
  
  // Swedish month names
  private readonly MONTHS_SV = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ];

  constructor(private eventService: EventService) { }

  ngOnInit(): void {
    console.log('EventListComponent initialized');
    
    // Subscribe to events observable to get live updates
    this.eventSubscription = this.eventService.events$.subscribe(events => {
      console.log('Received updated events list:', events.length);
      this.events = events;
      
      // Debug info about each event
      if (events.length > 0) {
        console.log('Events received:');
        events.forEach(event => {
          console.log(`- ${event.name} (${event.id}), Date: ${event.date}`);
        });
      }
      
      this.groupEventsByMonth();
    });
    
    // Force a reload of events
    setTimeout(() => {
      console.log('Requesting event service to reload events');
      this.eventService.loadEvents();
    }, 500);
    
    // Add another reload with longer delay to ensure data is loaded
    setTimeout(() => {
      console.log('Second attempt to reload events');
      this.eventService.loadEvents();
      this.debugEvents();
    }, 2000);
  }
  
  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }
  
  // Debug method to manually check events
  debugEvents(): void {
    console.log('==== EVENTS DEBUG ====');
    console.log('Current events in service:', this.eventService.getAllEvents().length);
    console.log('Current events in component:', this.events.length);
    console.log('Current month groups:', this.eventsByMonth.length);
    
    // Try to read from localStorage directly
    try {
      const storedEvents = localStorage.getItem('events');
      if (storedEvents) {
        const parsedEvents = JSON.parse(storedEvents);
        console.log('Events in localStorage:', parsedEvents.length);
      } else {
        console.log('No events found in localStorage');
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }
    
    // If we still have no events, force another reload
    if (this.events.length === 0) {
      console.log('No events found, forcing another reload');
      this.eventService.loadEvents();
    }
    
    console.log('==== END DEBUG ====');
  }
  
  // Group events by month
  private groupEventsByMonth(): void {
    console.log('Grouping events by month, count:', this.events.length);
    
    if (!this.events || this.events.length === 0) {
      console.log('No events to group, setting empty array');
      this.eventsByMonth = [];
      return;
    }
    
    try {
      // Sort events by date (chronologically)
      const sortedEvents = [...this.events].sort((a, b) => {
        try {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          
          // Check for invalid dates
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            console.warn('Invalid date detected in sorting:', 
              isNaN(dateA.getTime()) ? a.date : b.date);
            return 0;
          }
          
          return dateA.getTime() - dateB.getTime();
        } catch (e) {
          console.error('Error comparing dates:', e);
          return 0;
        }
      });
      
      // Group by month and year
      const monthGroups = new Map<string, Event[]>();
      
      sortedEvents.forEach(event => {
        try {
          const date = new Date(event.date);
          
          // Check for invalid date
          if (isNaN(date.getTime())) {
            console.warn('Invalid date detected for event:', event.name, event.date);
            // Put invalid dates in "Unknown" group
            const monthYear = 'Unknown';
            if (!monthGroups.has(monthYear)) {
              monthGroups.set(monthYear, []);
            }
            monthGroups.get(monthYear)?.push(event);
            return;
          }
          
          const monthYear = `${this.MONTHS_SV[date.getMonth()]} ${date.getFullYear()}`;
          
          if (!monthGroups.has(monthYear)) {
            monthGroups.set(monthYear, []);
          }
          
          monthGroups.get(monthYear)?.push(event);
        } catch (e) {
          console.error('Error grouping event by month:', e, event);
        }
      });
      
      // Convert map to array for template
      this.eventsByMonth = Array.from(monthGroups.entries())
        .map(([month, events]) => ({ month, events }))
        .sort((a, b) => {
          // Special case for "Unknown" group - always put at the end
          if (a.month === 'Unknown') return 1;
          if (b.month === 'Unknown') return -1;
          
          try {
            // Extract year and month for comparison
            const [aMonth, aYear] = a.month.split(' ');
            const [bMonth, bYear] = b.month.split(' ');
            
            // Compare years first
            if (aYear !== bYear) {
              return parseInt(aYear) - parseInt(bYear);
            }
            
            // If years are equal, compare months
            return this.MONTHS_SV.indexOf(aMonth) - this.MONTHS_SV.indexOf(bMonth);
          } catch (e) {
            console.error('Error sorting month groups:', e);
            return 0;
          }
        });
        
      console.log('Grouped events by month. Groups created:', this.eventsByMonth.length);
      this.eventsByMonth.forEach(group => {
        console.log(`- ${group.month}: ${group.events.length} events`);
      });
    } catch (e) {
      console.error('Critical error in groupEventsByMonth:', e);
      this.eventsByMonth = [];
    }
  }
  
  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      // Format as "day month" (e.g., "22 Mars")
      const day = date.getDate();
      const month = this.MONTHS_SV[date.getMonth()];
      return `${day} ${month}`;
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString;
    }
  }
  
  // Delete an event
  deleteEvent(eventId: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent expanding the card
    
    if (confirm('Är du säker på att du vill ta bort detta evenemang?')) {
      this.eventService.deleteEvent(eventId);
    }
  }
  
  // Add test event (for debugging)
  createTestEvent(): void {
    try {
      console.log('Starting test event creation...');
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Format dates as YYYY-MM-DD
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      // Create test event data with more unique details
      const randomNum = Math.floor(Math.random() * 1000);
      const testEvent = {
        name: `Test Event ${randomNum}`,
        date: formatDate(tomorrow),
        time: '09:00',
        deadline: formatDate(today),
        description: `This is test event #${randomNum} created at ${new Date().toISOString()}`,
        location: 'Stockholm',
        organizer: 'Test Organizer',
        type: 'brevet',
        distance: 200,
        elevation: 1500,
        paymentMethod: 'Swish',
        routeLink: 'https://example.com/route',
        gpxFileName: '',
        imageFileName: '',
        imagePreviewUrl: null,
        checkpoints: []
      };
      
      console.log('Preparing test event data:', testEvent);
      
      // Create event in service
      this.eventService.createEvent(testEvent)
        .then(event => {
          console.log('✅ Test event created successfully:', event.id);
          
          // Add event to local array immediately
          this.events = [...this.events, event];
          console.log('Added to local events array, new count:', this.events.length);
          
          // Update month groups
          this.groupEventsByMonth();
          
          // Force reload after creation to ensure everything is in sync
          setTimeout(() => {
            console.log('Forcing reload after test event creation');
            this.eventService.loadEvents();
            this.debugEvents();
          }, 1000);
        })
        .catch(error => {
          console.error('❌ Error creating test event:', error);
        });
    } catch (error) {
      console.error('❌ Critical error in createTestEvent:', error);
    }
  }
  
  // Test localStorage functionality
  testLocalStorage(): void {
    try {
      console.log('Testing localStorage functionality...');
      
      // Clear test item if it exists
      localStorage.removeItem('test_item');
      
      // Try to write to localStorage
      const testValue = { test: 'value', timestamp: Date.now() };
      localStorage.setItem('test_item', JSON.stringify(testValue));
      console.log('Successfully wrote to localStorage');
      
      // Try to read from localStorage
      const readValue = localStorage.getItem('test_item');
      if (readValue) {
        const parsedValue = JSON.parse(readValue);
        console.log('Successfully read from localStorage:', parsedValue);
      } else {
        console.error('Failed to read from localStorage!');
      }
      
      // Clean up
      localStorage.removeItem('test_item');
      
      // Check events in localStorage
      const eventsJson = localStorage.getItem('events');
      if (eventsJson) {
        try {
          const parsedEvents = JSON.parse(eventsJson);
          console.log('Current events in localStorage:', parsedEvents.length);
        } catch (e) {
          console.error('Error parsing events from localStorage:', e);
        }
      } else {
        console.log('No events found in localStorage');
      }
      
      console.log('localStorage test complete');
    } catch (e) {
      console.error('Error testing localStorage:', e);
      alert('localStorage is not working! This could be why events are not being saved.');
    }
  }
  
  // Reset events in localStorage and memory
  resetEvents(): void {
    try {
      console.log('Resetting all events data...');
      
      // First, create a backup of existing data
      const eventsJson = localStorage.getItem('events');
      if (eventsJson) {
        localStorage.setItem('events_backup', eventsJson);
        console.log('Created backup of existing events data');
      }
      
      // Clear events from localStorage
      localStorage.removeItem('events');
      console.log('Cleared events from localStorage');
      
      // Force update the service
      this.events = [];
      this.eventsByMonth = [];
      
      // Create a new test event to verify everything is working
      this.createTestEvent();
      
      // Show success message
      alert('Events have been reset. A new test event should appear.');
    } catch (e) {
      console.error('Error resetting events:', e);
      alert('Error resetting events: ' + e);
    }
  }
}
