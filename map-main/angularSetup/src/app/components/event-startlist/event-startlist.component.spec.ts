import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventStartlistComponent } from './event-startlist.component';

describe('EventStartlistComponent', () => {
  let component: EventStartlistComponent;
  let fixture: ComponentFixture<EventStartlistComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EventStartlistComponent]
    });
    fixture = TestBed.createComponent(EventStartlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
