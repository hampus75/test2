import { Component, OnInit, LOCALE_ID, Inject, HostListener } from '@angular/core';
import { GpxCalculatorService } from '../../services/gpx-calculator.service';
import { EventService } from '../../services/event.service';
import { Router } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeSv from '@angular/common/locales/sv';

// Register Swedish locale
registerLocaleData(localeSv);

@Component({
  selector: 'app-event-creator',
  templateUrl: './event-creator.component.html',
  styleUrls: ['./event-creator.component.css']
})
export class EventCreatorComponent implements OnInit {
  // Event data
  eventName: string = '';
  eventDate: string = '';
  eventTime: string = '08:00';
  eventDeadline: string = '';
  eventDescription: string = '';
  eventLocation: string = '';
  eventOrganizer: string = '';
  eventType: string = 'brevet'; // Default to brevet
  eventDistance: number = 200; // Default to 200km
  eventElevation: number | null = null;
  eventPaymentMethod: string = '';
  eventRouteLink: string = '';
  
  // Swedish time format flag
  useSwedishFormat: boolean = true;
  
  // File handling
  gpxFile: File | null = null;
  gpxFileName: string = '';
  imageFile: File | null = null;
  imageFileName: string = '';
  imagePreviewUrl: string | ArrayBuffer | null = null;

  // GPX processing status
  processingGpx: boolean = false;
  gpxProcessingError: string = '';

  // Stepper properties
  activeStep: number = 0;
  steps = [
    { label: 'Basic Info', completed: false },
    { label: 'Event Details', completed: false },
    { label: 'Description', completed: false },
    { label: 'Confirmation', completed: false }
  ];

  // Available event types
  eventTypes = [
    { value: 'brevet', label: 'Brevet' },
    { value: 'permanent', label: 'Permanent' },
    { value: 'populaire', label: 'Populaire' },
    { value: 'gravel', label: 'Gravel Ride' },
    { value: 'other', label: 'Other' }
  ];

  // Common brevet distances
  brevetDistances = [200, 300, 400, 600, 1000, 1200];

  // Error message
  errorMessage: string = '';

  // Check if browser is using 24-hour format
  isBrowser24Hour: boolean = true;

  // Checkpoint management
  checkpoints: Array<{
    name: string;
    distance: number;
    openingTime: Date | null;
    closingTime: Date | null;
    imageFile: File | null;
    imageFileName: string;
    imagePreviewUrl: string | ArrayBuffer | null;
    location: string;
  }> = [];
  
  // Flag to indicate if checkpoint times have been calculated
  checkpointTimesCalculated: boolean = false;
  
  // Temporary checkpoint for adding new
  newCheckpoint: {
    name: string;
    distance: number;
    location: string;
    imageFile: File | null;
    imageFileName: string;
    imagePreviewUrl: string | ArrayBuffer | null;
  } = {
    name: '',
    distance: 0,
    location: '',
    imageFile: null,
    imageFileName: '',
    imagePreviewUrl: null
  };

  constructor(
    private gpxCalculatorService: GpxCalculatorService,
    private eventService: EventService,
    private router: Router,
    @Inject(LOCALE_ID) private locale: string
  ) {
    // Attempt to detect browser time format
    this.detectBrowserTimeFormat();
  }

  // Try to detect if browser is using 12h or 24h format
  private detectBrowserTimeFormat(): void {
    const testDate = new Date();
    testDate.setHours(14); // 2 PM
    const testTimeString = testDate.toLocaleTimeString();
    // If there's 'AM' or 'PM' in the string, it's likely 12-hour format
    this.isBrowser24Hour = !/(AM|PM|am|pm)/.test(testTimeString);
    
    console.log('Browser detected as using 24-hour format:', this.isBrowser24Hour);
  }

  @HostListener('document:DOMContentLoaded')
  onDocumentReady() {
    // Force 24-hour format for time inputs if needed
    this.applySwedishTimeFormat();
  }

  ngOnInit(): void {
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.eventDate = this.formatDateISOString(tomorrow);
    
    // Set default deadline to day before event
    const deadlineDate = new Date(tomorrow);
    deadlineDate.setDate(deadlineDate.getDate() - 1);
    this.eventDeadline = this.formatDateISOString(deadlineDate);
    
    // Set default time in 24-hour format
    this.eventTime = '08:00';
    
    // Force Swedish locale for dates if needed
    if (this.useSwedishFormat && this.locale !== 'sv') {
      console.log('Setting Swedish date formats');
    }
    
    // Force Swedish locale for dates and time formats
    this.applySwedishTimeFormat();
  }
  
  // Format date as ISO string (YYYY-MM-DD) for input fields
  formatDateISOString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format date in Swedish format for display
  formatDateSwedish(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateStr;
    }
  }

  // Get formatted time in Swedish format (24h)
  getFormattedTime(time: string): string {
    if (!time) return '';
    
    // If time is already in HH:MM format, return it
    if (/^\d{2}:\d{2}$/.test(time)) {
      return time;
    }
    
    try {
      // Create a date object from the time string
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      
      // Format in 24-hour time format
      const formattedHours = date.getHours().toString().padStart(2, '0');
      const formattedMinutes = date.getMinutes().toString().padStart(2, '0');
      return `${formattedHours}:${formattedMinutes}`;
    } catch (e) {
      console.error('Error formatting time:', e);
      return time;
    }
  }

  // Validate time format (24-hour)
  validateTimeFormat(time: string): boolean {
    // Check if the time is in valid 24-hour format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  // Methods to validate each step
  validateStep1(): boolean {
    // Check time format if provided
    if (this.eventTime && !this.validateTimeFormat(this.eventTime)) {
      this.errorMessage = 'Ange en giltig tid i 24-timmarsformat (HH:MM)';
      return false;
    }
    
    const isValid = !!(this.eventName && this.eventDate && this.eventLocation && this.eventOrganizer);
    this.steps[0].completed = isValid;
    return isValid;
  }

  validateStep2(): boolean {
    // For step 2, we just need a valid distance (for any event type)
    const isValid = this.eventDistance > 0;
    this.steps[1].completed = isValid;
    return isValid;
  }

  validateStep3(): boolean {
    // Description is optional, so this step is always valid
    this.steps[2].completed = true;
    return true;
  }

  // Display validation error for a step
  showStepError(step: number): void {
    if (step === 0 && !this.steps[0].completed) {
      this.errorMessage = 'Fyll i alla obligatoriska fält i Grundläggande information';
    } else if (step === 1 && !this.steps[1].completed) {
      this.errorMessage = 'Ange giltiga evenemangsdetaljer';
    } else {
      this.errorMessage = '';
    }
  }

  // Navigation methods
  goToStep(step: number): void {
    if (step === 0) {
      // Always allow navigating to the first step
      this.activeStep = 0;
    } else if (step === 1) {
      // To step 2, validate step 1
      if (this.validateStep1()) {
        this.activeStep = 1;
        this.errorMessage = '';
      } else {
        this.showStepError(0);
      }
    } else if (step === 2) {
      // To step 3, validate steps 1 and 2
      if (this.validateStep1() && this.validateStep2()) {
        this.activeStep = 2;
        this.errorMessage = '';
      } else if (!this.validateStep1()) {
        this.showStepError(0);
      } else {
        this.showStepError(1);
      }
    } else if (step === 3) {
      // To step 4, validate steps 1, 2, and 3
      if (this.validateStep1() && this.validateStep2() && this.validateStep3()) {
        this.activeStep = 3;
        this.errorMessage = '';
      } else if (!this.validateStep1()) {
        this.showStepError(0);
      } else if (!this.validateStep2()) {
        this.showStepError(1);
      }
    }
  }

  // Button navigation handlers
  goToNextStep(): void {
    this.goToStep(this.activeStep + 1);
  }

  goToPreviousStep(): void {
    if (this.activeStep > 0) {
      this.activeStep--;
      this.errorMessage = '';
    }
  }

  // Handle GPX file selection
  onGpxFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.gpxFile = input.files[0];
      this.gpxFileName = this.gpxFile.name;
      this.gpxProcessingError = '';
      
      // Automatically process the GPX file
      this.processGpxFile();
    }
  }

  // Process the GPX file to extract elevation and distance
  processGpxFile(): void {
    if (!this.gpxFile) {
      this.gpxProcessingError = 'No GPX file selected';
      return;
    }

    this.processingGpx = true;
    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const content = e.target?.result as string;
        
        // Use GpxCalculatorService to parse the GPX file
        const gpxData = this.gpxCalculatorService.calculateGpxDistance(content);
        
        // Update the form with the extracted data
        this.eventDistance = Math.round(gpxData.totalDistance);
        
        // Calculate elevation gain based on track points
        if (gpxData.trackPoints && gpxData.trackPoints.length > 0) {
          this.calculateElevationGain(gpxData.trackPoints);
        }
        
        // Check if GPX has checkpoints defined
        if (gpxData.checkpoints && gpxData.checkpoints.length > 0) {
          this.extractCheckpointsFromGpx(gpxData.checkpoints);
        } else {
          // Create default checkpoints at regular intervals
          this.createDefaultCheckpoints(gpxData.totalDistance);
        }
        
        this.processingGpx = false;
      } catch (error) {
        console.error('Error processing GPX file:', error);
        this.gpxProcessingError = 'Failed to process GPX file. Please ensure it is a valid GPX format.';
        this.processingGpx = false;
      }
    };
    
    reader.onerror = () => {
      this.gpxProcessingError = 'Error reading the file';
      this.processingGpx = false;
    };
    
    reader.readAsText(this.gpxFile);
  }

  // Calculate elevation gain from track points
  calculateElevationGain(trackPoints: any[]): void {
    // For a basic implementation, we can use the elevation data if available in the GPX
    // If the GPX doesn't have elevation data, we'll set a default value
    let totalElevation = 0;
    let elevationData = false;
    
    // This is a simplified calculation - in a real implementation, you would
    // process the elevation data more comprehensively
    if (trackPoints.length > 1) {
      for (let i = 1; i < trackPoints.length; i++) {
        const prev = trackPoints[i-1];
        const curr = trackPoints[i];
        
        if (prev.elevation !== undefined && curr.elevation !== undefined) {
          elevationData = true;
          const diff = curr.elevation - prev.elevation;
          if (diff > 0) {
            totalElevation += diff; // Only count uphill
          }
        }
      }
    }
    
    if (elevationData) {
      this.eventElevation = Math.round(totalElevation);
    } else {
      // If no elevation data found, we'll use a default value
      this.eventElevation = Math.round(this.eventDistance * 8); // Rough estimate based on flat to rolling terrain
    }
  }

  // Handle image file selection
  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.imageFile = input.files[0];
      this.imageFileName = this.imageFile.name;
      
      // Create a preview of the image
      this.createImagePreview();
    }
  }

  // Create a preview of the selected image
  createImagePreview(): void {
    if (!this.imageFile) {
      this.imagePreviewUrl = null;
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.imagePreviewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(this.imageFile);
  }

  // Remove the image
  removeImage(): void {
    this.imageFile = null;
    this.imageFileName = '';
    this.imagePreviewUrl = null;
  }

  createEvent(): void {
    // Validate all steps before creating the event
    if (!this.validateStep1() || !this.validateStep2() || !this.validateStep3()) {
      if (!this.validateStep1()) {
        this.showStepError(0);
      } else if (!this.validateStep2()) {
        this.showStepError(1);
      }
      return;
    }

    // Format the time in Swedish format for submission
    const formattedTime = this.getFormattedTime(this.eventTime);

    // Prepare checkpoint data by converting File objects to filename strings
    // since we can't store File objects in localStorage
    const processedCheckpoints = this.checkpoints.map(cp => ({
      name: cp.name,
      distance: cp.distance,
      openingTime: cp.openingTime,
      closingTime: cp.closingTime,
      imageFile: cp.imageFile, // Keep the File object for upload
      imageFileName: cp.imageFileName,
      imagePreviewUrl: cp.imagePreviewUrl,
      location: cp.location
    }));

    // Create the event object
    const eventData = {
      name: this.eventName,
      date: this.eventDate,
      time: formattedTime,
      deadline: this.eventDeadline,
      description: this.eventDescription,
      location: this.eventLocation,
      organizer: this.eventOrganizer,
      type: this.eventType,
      distance: this.eventDistance,
      elevation: this.eventElevation,
      paymentMethod: this.eventPaymentMethod,
      routeLink: this.eventRouteLink,
      gpxFile: this.gpxFile, // Include the actual File objects
      gpxFileName: this.gpxFileName,
      imageFile: this.imageFile,
      imageFileName: this.imageFileName,
      imagePreviewUrl: this.imagePreviewUrl,
      checkpoints: processedCheckpoints
    };

    console.log('Creating event with data:', eventData.name);
    
    // Save the event using the event service
    this.eventService.createEvent(eventData)
      .then(createdEvent => {
        console.log('Event created successfully:', createdEvent.id);
        
        // Ensure events are loaded again to update the list
        setTimeout(() => {
          this.eventService.loadEvents();
        }, 100);
        
        // Show success message
        alert('Evenemang skapat! ID: ' + createdEvent.id);
        
        // Navigate to the events page
        this.router.navigate(['/events']);
      })
      .catch(error => {
        console.error('Error creating event:', error);
        alert('Ett fel uppstod vid skapande av evenemanget: ' + error.message);
      });
  }

  resetForm(): void {
    this.eventName = '';
    this.eventDescription = '';
    this.eventLocation = '';
    this.eventOrganizer = '';
    this.eventElevation = null;
    this.eventPaymentMethod = '';
    this.eventRouteLink = '';
    this.errorMessage = '';
    this.gpxFile = null;
    this.gpxFileName = '';
    this.gpxProcessingError = '';
    this.imageFile = null;
    this.imageFileName = '';
    this.imagePreviewUrl = null;
    
    // Keep the default values for date, time, deadline, type and distance
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.eventDate = this.formatDateISOString(tomorrow);
    this.eventTime = '08:00';
    
    const deadlineDate = new Date(tomorrow);
    deadlineDate.setDate(deadlineDate.getDate() - 1);
    this.eventDeadline = this.formatDateISOString(deadlineDate);
    
    this.eventType = 'brevet';
    this.eventDistance = 200;
    
    // Reset steps
    this.activeStep = 0;
    this.steps.forEach(step => step.completed = false);
    
    // Clear checkpoints
    this.checkpoints = [];
    this.checkpointTimesCalculated = false;
    this.newCheckpoint = {
      name: '',
      distance: 0,
      location: '',
      imageFile: null,
      imageFileName: '',
      imagePreviewUrl: null
    };
  }
  
  // Helper method to get event type label from value
  getEventTypeLabel(eventTypeValue: string): string {
    const eventType = this.eventTypes.find(t => t.value === eventTypeValue);
    return eventType ? eventType.label : eventTypeValue;
  }

  // Apply Swedish time format to UI elements
  private applySwedishTimeFormat(): void {
    // Try to force 24-hour format by setting lang attribute on time inputs
    setTimeout(() => {
      const timeInputs = document.querySelectorAll('input[type="time"]');
      timeInputs.forEach(input => {
        (input as HTMLElement).setAttribute('lang', 'sv-SE');
      });
    }, 0);
  }

  // Normalize time input to ensure 24-hour format
  normalizeTimeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // If the value matches HH:MM format, it's already good
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      // Make sure hours are padded to 2 digits
      const [hours, minutes] = value.split(':');
      this.eventTime = `${hours.padStart(2, '0')}:${minutes}`;
      return;
    }
    
    // Otherwise format it properly
    if (value) {
      this.eventTime = this.getFormattedTime(value);
    }
  }

  // Get hours from time string (HH:MM)
  getHours(timeString: string): number {
    if (!timeString || !timeString.includes(':')) {
      return 0;
    }
    
    const hours = parseInt(timeString.split(':')[0], 10);
    return isNaN(hours) ? 0 : hours;
  }
  
  // Get minutes from time string (HH:MM)
  getMinutes(timeString: string): number {
    if (!timeString || !timeString.includes(':')) {
      return 0;
    }
    
    const minutes = parseInt(timeString.split(':')[1], 10);
    return isNaN(minutes) ? 0 : minutes;
  }
  
  // Update time from hours and minutes
  updateTime(hours: number, minutes: number): void {
    // Ensure values are within valid ranges
    hours = Math.max(0, Math.min(23, hours));
    minutes = Math.max(0, Math.min(59, minutes));
    
    // Format with padding
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    
    // Update time string
    this.eventTime = `${formattedHours}:${formattedMinutes}`;
  }

  // Extract checkpoints from GPX data
  extractCheckpointsFromGpx(gpxCheckpoints: any[]): void {
    // Clear existing checkpoints
    this.checkpoints = [];
    
    // Always add start point at 0km
    const startPoint = {
      name: 'Start',
      distance: 0,
      openingTime: null,
      closingTime: null,
      imageFile: null,
      imageFileName: '',
      imagePreviewUrl: null,
      location: this.eventLocation || 'Start location'
    };
    this.checkpoints.push(startPoint);
    
    // Add checkpoints from GPX
    gpxCheckpoints.forEach(cp => {
      this.checkpoints.push({
        name: cp.name || `Checkpoint at ${cp.distance.toFixed(1)}km`,
        distance: cp.distance,
        openingTime: null,
        closingTime: null,
        imageFile: null,
        imageFileName: '',
        imagePreviewUrl: null,
        location: cp.description || ''
      });
    });
    
    // Add finish checkpoint if not already included
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    if (Math.abs(lastCheckpoint.distance - this.eventDistance) > 1) {
      this.checkpoints.push({
        name: 'Finish',
        distance: this.eventDistance,
        openingTime: null,
        closingTime: null,
        imageFile: null,
        imageFileName: '',
        imagePreviewUrl: null,
        location: this.eventLocation || 'Finish location'
      });
    }
    
    // Sort checkpoints by distance
    this.checkpoints.sort((a, b) => a.distance - b.distance);
  }
  
  // Create default checkpoints at regular intervals
  createDefaultCheckpoints(totalDistance: number): void {
    // Clear existing checkpoints
    this.checkpoints = [];
    
    // Determine checkpoint interval based on distance
    let interval: number;
    if (totalDistance <= 200) {
      interval = 50; // 50km intervals for 200km or shorter
    } else if (totalDistance <= 400) {
      interval = 75; // 75km intervals for 200-400km
    } else if (totalDistance <= 600) {
      interval = 100; // 100km intervals for 400-600km
    } else {
      interval = 150; // 150km intervals for longer events
    }
    
    // Add start checkpoint
    this.checkpoints.push({
      name: 'Start',
      distance: 0,
      openingTime: null,
      closingTime: null,
      imageFile: null,
      imageFileName: '',
      imagePreviewUrl: null,
      location: this.eventLocation || 'Start location'
    });
    
    // Add intermediate checkpoints
    let distance = interval;
    while (distance < totalDistance - (interval / 2)) {
      this.checkpoints.push({
        name: `Checkpoint at ${distance}km`,
        distance: distance,
        openingTime: null,
        closingTime: null,
        imageFile: null,
        imageFileName: '',
        imagePreviewUrl: null,
        location: ''
      });
      distance += interval;
    }
    
    // Add finish checkpoint
    this.checkpoints.push({
      name: 'Finish',
      distance: totalDistance,
      openingTime: null,
      closingTime: null,
      imageFile: null,
      imageFileName: '',
      imagePreviewUrl: null,
      location: this.eventLocation || 'Finish location'
    });
  }
  
  // Calculate control opening and closing times
  calculateCheckpointTimes(): void {
    if (this.checkpoints.length === 0) {
      // If no checkpoints, create default ones
      this.createDefaultCheckpoints(this.eventDistance);
    }
    
    // Extract distances for calculation
    const checkpointDistances = this.checkpoints.map(cp => cp.distance);
    
    // Create event start datetime
    const startDate = new Date(this.eventDate);
    const [hours, minutes] = this.eventTime.split(':').map(Number);
    startDate.setHours(hours, minutes, 0, 0);
    
    // Calculate control times
    try {
      const controlTimes = this.gpxCalculatorService.calculateControlTimes(
        this.eventDistance,
        startDate,
        checkpointDistances
      );
      
      // Update checkpoints with calculated times
      for (let i = 0; i < controlTimes.length; i++) {
        if (i < this.checkpoints.length) {
          this.checkpoints[i].openingTime = controlTimes[i].openingDatetime;
          this.checkpoints[i].closingTime = controlTimes[i].closingDatetime;
        }
      }
      
      this.checkpointTimesCalculated = true;
    } catch (error) {
      console.error('Error calculating control times:', error);
      this.errorMessage = 'Det gick inte att beräkna kontrolltider. Kontrollera evenemangsinformationen.';
    }
  }
  
  // Add a new checkpoint
  addCheckpoint(): void {
    if (!this.newCheckpoint.name || this.newCheckpoint.distance <= 0) {
      this.errorMessage = 'Ange ett namn och avstånd för kontrollpunkten';
      return;
    }
    
    // Find the right position to insert the checkpoint based on distance
    const newCheckpointData = {
      name: this.newCheckpoint.name,
      distance: this.newCheckpoint.distance,
      openingTime: null,
      closingTime: null,
      imageFile: this.newCheckpoint.imageFile,
      imageFileName: this.newCheckpoint.imageFileName,
      imagePreviewUrl: this.newCheckpoint.imagePreviewUrl,
      location: this.newCheckpoint.location
    };
    
    // Add the new checkpoint
    this.checkpoints.push(newCheckpointData);
    
    // Sort checkpoints by distance
    this.checkpoints.sort((a, b) => a.distance - b.distance);
    
    // Recalculate control times if already calculated
    if (this.checkpointTimesCalculated) {
      this.calculateCheckpointTimes();
    }
    
    // Reset the new checkpoint form
    this.newCheckpoint = {
      name: '',
      distance: 0,
      location: '',
      imageFile: null,
      imageFileName: '',
      imagePreviewUrl: null
    };
  }
  
  // Remove a checkpoint
  removeCheckpoint(index: number): void {
    // Don't allow removing the start or finish points
    if (index === 0 || index === this.checkpoints.length - 1) {
      this.errorMessage = 'Start- och målpunkter kan inte tas bort';
      return;
    }
    
    this.checkpoints.splice(index, 1);
    
    // Recalculate control times if already calculated
    if (this.checkpointTimesCalculated) {
      this.calculateCheckpointTimes();
    }
  }
  
  // Format time as HH:MM
  formatTimeString(date: Date | null): string {
    if (!date) return '';
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  // Format date as YYYY-MM-DD
  formatDateString(date: Date | null): string {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Handle checkpoint image upload
  onCheckpointImageSelected(event: Event, isNewCheckpoint: boolean, checkpointIndex?: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      if (isNewCheckpoint) {
        // Update the new checkpoint template
        this.newCheckpoint.imageFile = file;
        this.newCheckpoint.imageFileName = file.name;
        this.createCheckpointImagePreview(file, true);
      } else if (checkpointIndex !== undefined) {
        // Update an existing checkpoint
        this.checkpoints[checkpointIndex].imageFile = file;
        this.checkpoints[checkpointIndex].imageFileName = file.name;
        this.createCheckpointImagePreview(file, false, checkpointIndex);
      }
    }
  }
  
  // Create image preview for checkpoint
  createCheckpointImagePreview(file: File, isNewCheckpoint: boolean, checkpointIndex?: number): void {
    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result as string;
      
      if (isNewCheckpoint) {
        this.newCheckpoint.imagePreviewUrl = result;
      } else if (checkpointIndex !== undefined) {
        this.checkpoints[checkpointIndex].imagePreviewUrl = result;
      }
    };
    
    reader.readAsDataURL(file);
  }
  
  // Remove checkpoint image
  removeCheckpointImage(isNewCheckpoint: boolean, checkpointIndex?: number): void {
    if (isNewCheckpoint) {
      this.newCheckpoint.imageFile = null;
      this.newCheckpoint.imageFileName = '';
      this.newCheckpoint.imagePreviewUrl = null;
    } else if (checkpointIndex !== undefined) {
      this.checkpoints[checkpointIndex].imageFile = null;
      this.checkpoints[checkpointIndex].imageFileName = '';
      this.checkpoints[checkpointIndex].imagePreviewUrl = null;
    }
  }
}