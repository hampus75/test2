import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  constructor(private router: Router) { }

  navigateToEvents(): void {
    console.log('Navigating to events page...');
    this.router.navigate(['/events']);
  }

  ngOnInit(): void {
    // Initialization logic here
  }
}