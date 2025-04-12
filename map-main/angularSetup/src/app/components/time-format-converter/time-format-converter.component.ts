import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-time-format-converter',
  templateUrl: './time-format-converter.component.html',
  styleUrls: ['./time-format-converter.component.css']
})
export class TimeFormatConverterComponent {
  @Input() use24HourFormat: boolean = false;
  @Output() formatChanged = new EventEmitter<boolean>();

  toggleTimeFormat() {
    this.use24HourFormat = !this.use24HourFormat;
    this.formatChanged.emit(this.use24HourFormat);
  }
} 