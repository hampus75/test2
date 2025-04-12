import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter'
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], filter: any): any[] {
    if (!items || !filter) {
      return items;
    }

    return items.filter(item => {
      const notMatchingField = Object.keys(filter)
        .find(key => item[key] !== filter[key]);
      
      return !notMatchingField; // true if matches all filter fields
    });
  }
} 