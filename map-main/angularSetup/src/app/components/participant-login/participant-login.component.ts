import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EventService, Event, Participant } from '../../services/event.service';

@Component({
  selector: 'app-participant-login',
  templateUrl: './participant-login.component.html',
  styleUrls: ['./participant-login.component.css']
})
export class ParticipantLoginComponent implements OnInit {
  event: Event | null = null;
  loginForm: FormGroup;
  submitted = false;
  loginError = '';
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private eventService: EventService
  ) {
    this.loginForm = this.formBuilder.group({
      registrationCode: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Get the event ID from the route
    const eventId = this.route.snapshot.paramMap.get('id');
    
    if (eventId) {
      const event = this.eventService.getEventById(eventId);
      if (event) {
        this.event = event;
      } else {
        this.router.navigate(['/events']);
      }
    } else {
      this.router.navigate(['/events']);
    }
    
    // Check if already logged in for this event
    const currentParticipant = this.eventService.getCurrentParticipant();
    if (currentParticipant && currentParticipant.eventId === (eventId || '')) {
      this.router.navigate(['/events/participant-view', eventId]);
    }
  }

  // Convenience getter for form fields
  get f() { return this.loginForm.controls; }

  async onSubmit(): Promise<void> {
    this.submitted = true;
    
    // Stop if form is invalid
    if (this.loginForm.invalid) {
      return;
    }
    
    this.loading = true;
    this.loginError = '';
    
    if (!this.event) {
      this.loginError = 'Event not found';
      this.loading = false;
      return;
    }
    
    try {
      const registrationCode = this.f['registrationCode'].value.trim().toUpperCase();
      const participant = await this.eventService.participantLogin(this.event.id, registrationCode);
      
      if (participant) {
        this.router.navigate(['/events/participant-view', this.event.id]);
      } else {
        this.loginError = 'Ogiltig registreringskod. Kontrollera och försök igen.';
        this.loading = false;
      }
    } catch (error) {
      console.error('Login error:', error);
      this.loginError = 'Ett fel uppstod vid inloggning. Försök igen.';
      this.loading = false;
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
}
