import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../../services/auth/auth.service';

interface Activity {
  title: string;
  type: 'user' | 'event' | 'route';
  timestamp: Date;
}

@Component({
  selector: 'app-admin-page',
  templateUrl: './admin-page.component.html',
  styleUrls: ['./admin-page.component.css']
})
export class AdminPageComponent implements OnInit {
  currentUser: User | null = null;
  
  // Stats counters - these would come from your services in a real app
  userCount: number = 0;
  eventCount: number = 0;
  routeCount: number = 0;

  // Mock recent activities - replace with real data in a production app
  recentActivities: Activity[] = [
    { 
      title: 'New user registered', 
      type: 'user', 
      timestamp: new Date(Date.now() - 3600000) // 1 hour ago
    },
    { 
      title: 'Event "Summer Brevet" created', 
      type: 'event', 
      timestamp: new Date(Date.now() - 86400000) // 1 day ago
    },
    { 
      title: 'New route uploaded', 
      type: 'route', 
      timestamp: new Date(Date.now() - 172800000) // 2 days ago
    },
  ];

  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    // Get current user
    this.currentUser = this.authService.getCurrentUser();
    
    // Ensure user is an admin
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      console.warn('Non-admin user attempted to access admin page');
      // You could redirect non-admins here
    }
    
    this.loadStatistics();
  }
  
  private loadStatistics(): void {
    // Here you would make API calls to your backend to get actual statistics
    // For now, we'll just use hardcoded values
    
    // Simulate loading data
    setTimeout(() => {
      this.userCount = 12;
      this.eventCount = 5;
      this.routeCount = 8;
    }, 500);
  }
}
