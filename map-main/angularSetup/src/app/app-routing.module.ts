import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MapComponent } from './components/map/map.component';
import { RouteExplorerComponent } from './components/route-explorer/route-explorer.component';
import { RouteViewComponent } from './components/route-view/route-view.component';
import { GpxCalculatorComponent } from './components/gpx-calculator/gpx-calculator.component';
import { EventCreatorComponent } from './components/event-creator/event-creator.component';
import { EventListComponent } from './components/event-list/event-list.component';
import { EventRegistrationComponent } from './components/event-registration/event-registration.component';
import { EventStartlistComponent } from './components/event-startlist/event-startlist.component';
import { ParticipantLoginComponent } from './components/participant-login/participant-login.component';
import { ParticipantEventViewComponent } from './components/participant-event-view/participant-event-view.component';
import { CheckpointCheckInComponent } from './components/checkpoint-check-in/checkpoint-check-in.component';
import { HomePageComponent } from './components/home-page/home-page.component';
import { OldHomePageComponent } from './components/old-home-page/old-home-page.component';
import { AccountCreationComponent } from './components/account-creation/account-creation.component';
import { AdminPageComponent } from './components/admin-page/admin-page.component';
import { LoginComponent } from './components/login/login.component'; // Import LoginComponent
import { IpAuthGuard } from './services/auth/ip-auth.guard';
import { AdminAuthGuard } from './services/auth/admin-auth.guard';

const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'old', component: OldHomePageComponent },
  { path: 'map', component: MapComponent },
  { path: 'explore', component: RouteExplorerComponent },
  { path: 'gpx-calculator', component: GpxCalculatorComponent },
  { path: 'create-event', component: EventCreatorComponent },
  { 
    path: 'events', 
    component: EventListComponent 
  },
  { path: 'events/register/:id', component: EventRegistrationComponent },
  { path: 'events/startlist/:id', component: EventStartlistComponent },
  { path: 'events/login/:id', component: ParticipantLoginComponent },
  { path: 'events/participant-view/:id', component: ParticipantEventViewComponent },
  { path: 'events/checkpoint/:eventId/:checkpointId', component: CheckpointCheckInComponent },
  { path: 'route/:id', component: RouteViewComponent },
  { path: 'login', component: LoginComponent }, // Add login route
  { 
    path: 'make-account', 
    component: AccountCreationComponent,
    canActivate: [IpAuthGuard] // Protected by IP restriction
  },
  { 
    path: 'admin', 
    component: AdminPageComponent,
    canActivate: [AdminAuthGuard] // Now protected by admin guard
  },
  { path: '**', redirectTo: '' }  // Add catch-all route
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false })], // Disable debug tracing for better performance
  exports: [RouterModule]
})
export class AppRoutingModule { }
