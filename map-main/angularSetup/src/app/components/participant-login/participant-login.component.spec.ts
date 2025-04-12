import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParticipantLoginComponent } from './participant-login.component';

describe('ParticipantLoginComponent', () => {
  let component: ParticipantLoginComponent;
  let fixture: ComponentFixture<ParticipantLoginComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ParticipantLoginComponent]
    });
    fixture = TestBed.createComponent(ParticipantLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
