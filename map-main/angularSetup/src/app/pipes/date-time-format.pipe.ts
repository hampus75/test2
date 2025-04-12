import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateTimeFormat'
})
export class DateTimeFormatPipe implements PipeTransform {
  transform(value: Date | string | null, use24HourFormat: boolean = false): string {
    if (!value) {
      return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return String(value);
    }

    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !use24HourFormat
    };

    const dateFormatter = new Intl.DateTimeFormat('en-US', dateOptions);
    const timeFormatter = new Intl.DateTimeFormat(
      use24HourFormat ? 'sv-SE' : 'en-US', 
      timeOptions
    );

    return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
  }
} 