import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { MapUtilsService } from './map-utils.service';
import { GpxService } from './gpx.service';
import { RouteRendererService } from './route-renderer.service';
import { RiderService } from './rider.service';
import { GpxCalculatorService } from './gpx-calculator.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    MapUtilsService,
    GpxService,
    RouteRendererService,
    RiderService,
    GpxCalculatorService
  ]
})
export class MapServicesModule { } 