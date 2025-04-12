import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MapComponent } from './components/map/map.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SessionFilterPipe } from './pipes/session-filter.pipe';
import { FilterPipe } from './pipes/filter.pipe';
import { RouteExplorerComponent } from './components/route-explorer/route-explorer.component';
import { RouteViewComponent } from './components/route-view/route-view.component';
import { GpxCalculatorComponent } from './components/gpx-calculator/gpx-calculator.component';
import { EventCreatorComponent } from './components/event-creator/event-creator.component';
import { TimeFormatConverterComponent } from './components/time-format-converter/time-format-converter.component';
import { TimeFormatPipe } from './pipes/time-format.pipe';
import { DateTimeFormatPipe } from './pipes/date-time-format.pipe';
import { MapServicesModule } from './services/map-services.module';
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
import { LoginComponent } from './components/login/login.component';

@NgModule({
  declarations: [
    AppComponent,
    MapComponent,
    NavbarComponent,
    SessionFilterPipe,
    FilterPipe,
    RouteExplorerComponent,
    RouteViewComponent,
    GpxCalculatorComponent,
    EventCreatorComponent,
    TimeFormatConverterComponent,
    TimeFormatPipe,
    DateTimeFormatPipe,
    EventListComponent,
    EventRegistrationComponent,
    EventStartlistComponent,
    ParticipantLoginComponent,
    ParticipantEventViewComponent,
    CheckpointCheckInComponent,
    HomePageComponent,
    OldHomePageComponent,
    AccountCreationComponent,
    AdminPageComponent,
    LoginComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MapServicesModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
