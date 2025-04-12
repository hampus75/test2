import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService, Event } from '../../services/event.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-event-registration',
  templateUrl: './event-registration.component.html',
  styleUrls: ['./event-registration.component.css']
})
export class EventRegistrationComponent implements OnInit {
  event: Event | null = null;
  registrationForm: FormGroup;
  submitted = false;
  registrationSuccess = false;
  errorMessage = '';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private fb: FormBuilder
  ) {
    this.registrationForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      club: [''],
      acceptTerms: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {
    // Get the event ID from the route
    const eventId = this.route.snapshot.paramMap.get('id');
    
    if (eventId) {
      // Load the event details
      const foundEvent = this.eventService.getEventById(eventId);
      
      if (foundEvent) {
        this.event = foundEvent;
      } else {
        // If event not found, redirect to events list
        this.router.navigate(['/events']);
      }
    } else {
      // If no event ID, redirect to events list
      this.router.navigate(['/events']);
    }
  }
  
  // Getter for easy access to form fields
  get f() { return this.registrationForm.controls; }
  
  async onSubmit(): Promise<void> {
    this.submitted = true;
    
    // Stop here if form is invalid
    if (this.registrationForm.invalid) {
      return;
    }
    
    if (!this.event) {
      this.errorMessage = 'Evenemang saknas. Försök igen.';
      return;
    }
    
    // Get form values
    const formValues = this.registrationForm.value;
    
    try {
      // Register participant with the event service
      const participant = await this.eventService.registerParticipant(this.event.id, {
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        email: formValues.email,
        phone: formValues.phone,
        club: formValues.club || undefined
      });
      
      if (participant) {
        // Store the registration code for display
        sessionStorage.setItem('eventLoginCode', participant.registrationCode);
        
        // Show success message
        this.registrationSuccess = true;
      } else {
        this.errorMessage = 'Ett fel uppstod vid registrering. Försök igen.';
      }
    } catch (error) {
      console.error('Error registering participant:', error);
      this.errorMessage = 'Ett fel uppstod vid registrering. Försök igen.';
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
  
  // Get login code from sessionStorage
  get loginCode(): string | null {
    return sessionStorage.getItem('eventLoginCode');
  }
}
