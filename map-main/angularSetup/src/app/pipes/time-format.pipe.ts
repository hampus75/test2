import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeFormat'
})
export class TimeFormatPipe implements PipeTransform {
  transform(value: Date | string | null, use24HourFormat: boolean = false): string {
    if (!value) {
      return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return String(value);
    }

    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !use24HourFormat
    };

    return date.toLocaleTimeString(use24HourFormat ? 'sv-SE' : 'en-US', options);
  }
} 