import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sessionFilter'
})
export class SessionFilterPipe implements PipeTransform {
  transform<T extends { sessionId: string }>(items: T[], sessionId: string): T[] {
    if (!items || !sessionId) {
      return items;
    }
    return items.filter(item => item.sessionId === sessionId);
  }
}
