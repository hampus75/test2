import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Rider, Waypoint, WaypointPass } from '../interfaces/session.interface';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private apiUrl = environment.backendUrl + '/api';
  private socket: Socket | null = null;
  private currentSession = new BehaviorSubject<string | null>(null);
  private token: string | null = null;
  
  // Observables for real-time updates
  public riders = new BehaviorSubject<Rider[]>([]);
  public waypoints = new BehaviorSubject<Waypoint[]>([]);
  public waypointPasses = new BehaviorSubject<WaypointPass[]>([]);
  
  constructor(private http: HttpClient) {
    this.token = localStorage.getItem('strava_token');
    this.setupSocketConnection();
  }
  
  private setupSocketConnection(): void {
    if (!this.token) return;
    
    this.socket = io(environment.backendUrl, {
      auth: {
        token: this.token
      }
    });
    
    this.setupSocketListeners();
  }
  
  private setupSocketListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('Socket connected');
      
      // Rejoin current session if any
      const sessionId = this.currentSession.getValue();
      if (sessionId) {
        this.joinSession(sessionId);
      }
    });
    
    this.socket.on('session:state', (data) => {
      console.log('Received session state:', data);
      if (data.riders) this.riders.next(data.riders);
      if (data.waypoints) this.waypoints.next(data.waypoints);
      if (data.waypointPasses) this.waypointPasses.next(data.waypointPasses);
    });
    
    this.socket.on('rider:updated', (data) => {
      console.log('Rider updated:', data);
      const currentRiders = this.riders.getValue();
      const index = currentRiders.findIndex(r => r.id === data.riderId);
      
      if (index !== -1) {
        const updatedRiders = [...currentRiders];
        updatedRiders[index] = { ...updatedRiders[index], ...data };
        this.riders.next(updatedRiders);
      }
    });
    
    this.socket.on('rider:added', (rider) => {
      console.log('Rider added:', rider);
      const currentRiders = this.riders.getValue();
      this.riders.next([...currentRiders, rider]);
    });
    
    this.socket.on('waypoint:created', (waypoint) => {
      console.log('Waypoint created:', waypoint);
      const currentWaypoints = this.waypoints.getValue();
      this.waypoints.next([...currentWaypoints, waypoint]);
    });
    
    this.socket.on('waypoint:passed', (waypointPass) => {
      console.log('Waypoint passed:', waypointPass);
      const currentPasses = this.waypointPasses.getValue();
      this.waypointPasses.next([...currentPasses, waypointPass]);
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }
  
  public joinSession(sessionId: string): void {
    if (!this.socket) {
      this.setupSocketConnection();
    }
    
    if (this.socket) {
      this.socket.emit('session:join', sessionId);
      this.currentSession.next(sessionId);
    }
  }
  
  public leaveSession(): void {
    const sessionId = this.currentSession.getValue();
    if (sessionId && this.socket) {
      this.socket.emit('session:leave', sessionId);
      this.currentSession.next(null);
    }
  }
  
  public updateRiderPosition(riderId: string, position: number, elevation: number, distanceCovered: number): void {
    const sessionId = this.currentSession.getValue();
    if (sessionId && this.socket) {
      this.socket.emit('rider:update', {
        sessionId,
        riderId,
        position,
        elevation,
        distanceCovered
      });
    }
  }
  
  public createWaypoint(waypoint: Waypoint): void {
    const sessionId = this.currentSession.getValue();
    if (sessionId && this.socket) {
      this.socket.emit('waypoint:create', {
        sessionId,
        waypoint
      });
    }
  }
  
  public recordWaypointPass(riderId: string, waypointId: string, time: number): void {
    const sessionId = this.currentSession.getValue();
    if (sessionId && this.socket) {
      this.socket.emit('waypoint:pass', {
        sessionId,
        riderId,
        waypointId,
        time
      });
    }
  }
  
  // HTTP API Methods
  
  public getPublicSessions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/sessions`, this.getHttpOptions());
  }
  
  public getUserSessions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/users/sessions`, this.getHttpOptions());
  }
  
  public getSession(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/sessions/${sessionId}`, this.getHttpOptions());
  }
  
  public createSession(sessionData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/sessions`, sessionData, this.getHttpOptions());
  }
  
  public addRider(sessionId: string, riderData: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/sessions/${sessionId}/riders`, 
      riderData, 
      this.getHttpOptions()
    );
  }
  
  public addWaypointToSession(sessionId: string, waypointData: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/sessions/${sessionId}/waypoints`, 
      waypointData, 
      this.getHttpOptions()
    );
  }
  
  private getHttpOptions() {
    this.token = localStorage.getItem('strava_token');
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      })
    };
  }
}
