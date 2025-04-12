import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimeFormatService {
  private static readonly TIME_FORMAT_KEY = 'use24HourFormat';
  
  private use24HourFormatSubject: BehaviorSubject<boolean>;
  public use24HourFormat$: Observable<boolean>;

  constructor() {
    // Initialize with value from localStorage or default to false (12-hour format)
    const savedPreference = localStorage.getItem(TimeFormatService.TIME_FORMAT_KEY);
    const initialValue = savedPreference ? JSON.parse(savedPreference) : false;
    
    this.use24HourFormatSubject = new BehaviorSubject<boolean>(initialValue);
    this.use24HourFormat$ = this.use24HourFormatSubject.asObservable();
  }

  /**
   * Toggle the time format between 12-hour and 24-hour
   */
  public toggleTimeFormat(): void {
    const currentValue = this.use24HourFormatSubject.value;
    this.setTimeFormat(!currentValue);
  }

  /**
   * Set the time format to 12-hour or 24-hour
   * @param use24Hour True for 24-hour format, false for 12-hour format
   */
  public setTimeFormat(use24Hour: boolean): void {
    localStorage.setItem(TimeFormatService.TIME_FORMAT_KEY, JSON.stringify(use24Hour));
    this.use24HourFormatSubject.next(use24Hour);
  }

  /**
   * Get the current time format setting
   * @returns True if using 24-hour format, false if using 12-hour format
   */
  public getTimeFormat(): boolean {
    return this.use24HourFormatSubject.value;
  }
} 