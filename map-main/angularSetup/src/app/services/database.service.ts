import { Injectable } from '@angular/core';
// Import from our local mock instead of the actual pg module
import { Pool } from './mock-pg';
import { environment } from '../../environments/environment';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private pool: Pool;
  private uploadPath = '/uploads';

  constructor() {
    // Initialize the PostgreSQL connection pool
    this.pool = new Pool({
      connectionString: environment.database.db.connectionString
    });
    
    console.log('DatabaseService initialized with PostgreSQL database:', 
      environment.database.db.host, 
      environment.database.db.connectionString.split('@')[1].split('/')[0]);
      
    // Test connection on startup
    this.testConnection();
  }

  private async testConnection() {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT current_database() as db');
      console.log('✅ Successfully connected to PostgreSQL database:', result.rows[0].db);
      client.release();
    } catch (error) {
      console.error('❌ Error connecting to PostgreSQL database:', error);
    }
  }

  // ================ Events ================

  // Get all events
  async getEvents() {
    try {
      const client = await this.pool.connect();
      const result = await client.query(`
        SELECT * FROM events 
        ORDER BY date ASC
      `);
      client.release();
      return result.rows;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // Get a single event by ID
  async getEventById(id: string) {
    try {
      const client = await this.pool.connect();
      
      // Get the event
      const eventResult = await client.query(`
        SELECT * FROM events 
        WHERE id = $1
      `, [id]);
      
      if (eventResult.rows.length === 0) {
        client.release();
        throw new Error('Event not found');
      }
      
      // Get associated checkpoints
      const checkpointsResult = await client.query(`
        SELECT * FROM checkpoints
        WHERE event_id = $1
        ORDER BY distance ASC
      `, [id]);
      
      client.release();
      
      // Construct response with event and checkpoints
      const event = eventResult.rows[0];
      event.checkpoints = checkpointsResult.rows;
      
      return event;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  }

  // Create a new event
  async createEvent(eventData: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Generate UUID for new event
      const eventId = uuidv4();
      
      // Insert event data
      const { rows } = await client.query(`
        INSERT INTO events (
          id, name, date, time, deadline, description, location,
          organizer, type, distance, elevation, payment_method,
          route_link, gpx_file_path, image_path
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING *
      `, [
        eventId, 
        eventData.name, 
        eventData.date,
        eventData.time, 
        eventData.deadline, 
        eventData.description,
        eventData.location, 
        eventData.organizer, 
        eventData.type,
        eventData.distance, 
        eventData.elevation, 
        eventData.payment_method,
        eventData.route_link, 
        eventData.gpx_file_path, 
        eventData.image_path
      ]);
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating event:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update an event
  async updateEvent(id: string, eventData: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(`
        UPDATE events SET
          name = $2,
          date = $3,
          time = $4,
          deadline = $5,
          description = $6,
          location = $7,
          organizer = $8,
          type = $9,
          distance = $10,
          elevation = $11,
          payment_method = $12,
          route_link = $13,
          gpx_file_path = COALESCE($14, gpx_file_path),
          image_path = COALESCE($15, image_path)
        WHERE id = $1
        RETURNING *
      `, [
        id,
        eventData.name, 
        eventData.date,
        eventData.time, 
        eventData.deadline, 
        eventData.description,
        eventData.location, 
        eventData.organizer, 
        eventData.type,
        eventData.distance, 
        eventData.elevation, 
        eventData.payment_method,
        eventData.route_link, 
        eventData.gpx_file_path, 
        eventData.image_path
      ]);
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating event:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete an event
  async deleteEvent(id: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // First, delete associated checkpoints
      await client.query(`
        DELETE FROM checkpoints
        WHERE event_id = $1
      `, [id]);
      
      // Then delete the event
      const result = await client.query(`
        DELETE FROM events
        WHERE id = $1
      `, [id]);
      
      await client.query('COMMIT');
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting event:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ================ Checkpoints ================

  // Get checkpoints for an event
  async getCheckpoints(eventId: string) {
    try {
      const client = await this.pool.connect();
      const result = await client.query(`
        SELECT * FROM checkpoints
        WHERE event_id = $1
        ORDER BY distance ASC
      `, [eventId]);
      client.release();
      return result.rows;
    } catch (error) {
      console.error('Error fetching checkpoints:', error);
      throw error;
    }
  }

  // Create checkpoints (batch)
  async createCheckpoints(checkpoints: any[]) {
    if (!checkpoints || checkpoints.length === 0) {
      return [];
    }
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const createdCheckpoints = [];
      
      for (const checkpoint of checkpoints) {
        const checkpointId = uuidv4();
        
        const { rows } = await client.query(`
          INSERT INTO checkpoints (
            id, event_id, name, distance, opening_time, closing_time,
            image_path, location
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          )
          RETURNING *
        `, [
          checkpointId,
          checkpoint.event_id,
          checkpoint.name,
          checkpoint.distance,
          checkpoint.opening_time,
          checkpoint.closing_time,
          checkpoint.image_path,
          checkpoint.location
        ]);
        
        createdCheckpoints.push(rows[0]);
      }
      
      await client.query('COMMIT');
      return createdCheckpoints;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating checkpoints:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ================ Participants ================

  // Get all participants for an event
  async getParticipants(eventId: string) {
    try {
      const client = await this.pool.connect();
      
      // Get participants
      const participantsResult = await client.query(`
        SELECT * FROM participants
        WHERE event_id = $1
      `, [eventId]);
      
      // Get participant checkpoints for all participants
      const participantIds = participantsResult.rows.map((p: any) => p.id);
      
      if (participantIds.length > 0) {
        const checkpointsResult = await client.query(`
          SELECT * FROM participant_checkpoints
          WHERE participant_id = ANY($1::uuid[])
        `, [participantIds]);
        
        // Organize participant checkpoints by participant id
        const checkpointsByParticipant: Record<string, any[]> = {};
        checkpointsResult.rows.forEach((cp: any) => {
          if (!checkpointsByParticipant[cp.participant_id]) {
            checkpointsByParticipant[cp.participant_id] = [];
          }
          checkpointsByParticipant[cp.participant_id].push(cp);
        });
        
        // Add checkpoint data to participants
        participantsResult.rows.forEach((p: any) => {
          p.participant_checkpoints = checkpointsByParticipant[p.id] || [];
        });
      }
      
      client.release();
      return participantsResult.rows;
    } catch (error) {
      console.error('Error fetching participants:', error);
      throw error;
    }
  }

  // Register a participant for an event
  async registerParticipant(participantData: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const participantId = uuidv4();
      
      const { rows } = await client.query(`
        INSERT INTO participants (
          id, event_id, first_name, last_name, email, phone,
          club, registration_code, registration_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING *
      `, [
        participantId,
        participantData.event_id,
        participantData.first_name,
        participantData.last_name,
        participantData.email,
        participantData.phone,
        participantData.club,
        participantData.registration_code,
        participantData.registration_date
      ]);
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error registering participant:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Participant login with registration code
  async participantLogin(eventId: string, registrationCode: string) {
    try {
      const client = await this.pool.connect();
      
      // Get participant
      const participantResult = await client.query(`
        SELECT * FROM participants
        WHERE event_id = $1 AND registration_code = $2
        LIMIT 1
      `, [eventId, registrationCode]);
      
      if (participantResult.rows.length === 0) {
        client.release();
        return null;
      }
      
      const participant = participantResult.rows[0];
      
      // Get participant checkpoints
      const checkpointsResult = await client.query(`
        SELECT * FROM participant_checkpoints
        WHERE participant_id = $1
      `, [participant.id]);
      
      participant.participant_checkpoints = checkpointsResult.rows;
      
      client.release();
      return participant;
    } catch (error) {
      console.error('Error with participant login:', error);
      return null;
    }
  }

  // ================ Participant Checkpoints ================

  // Create participant checkpoint record (initial setup)
  async createParticipantCheckpoints(participantCheckpoints: any[]) {
    if (!participantCheckpoints || participantCheckpoints.length === 0) {
      return [];
    }
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const createdCheckpoints = [];
      
      for (const checkpoint of participantCheckpoints) {
        const checkpointId = uuidv4();
        
        const { rows } = await client.query(`
          INSERT INTO participant_checkpoints (
            id, participant_id, checkpoint_id, check_in_time, status
          ) VALUES (
            $1, $2, $3, $4, $5
          )
          RETURNING *
        `, [
          checkpointId,
          checkpoint.participant_id,
          checkpoint.checkpoint_id,
          checkpoint.check_in_time,
          checkpoint.status || 'pending'
        ]);
        
        createdCheckpoints.push(rows[0]);
      }
      
      await client.query('COMMIT');
      return createdCheckpoints;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating participant checkpoints:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update participant checkpoint (check-in)
  async checkInParticipantCheckpoint(id: string, checkpointData: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(`
        UPDATE participant_checkpoints SET
          check_in_time = $2,
          status = $3
        WHERE id = $1
        RETURNING *
      `, [
        id,
        checkpointData.check_in_time,
        checkpointData.status
      ]);
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error checking in participant checkpoint:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ================ File Storage ================

  // Upload event image - modified for browser
  async uploadEventImage(file: File, filename: string) {
    try {
      // In browser, we need to use FormData and fetch to upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', filename);
      
      // This would be replaced with a real API endpoint in production
      const response = await fetch('/api/upload/event-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const result = await response.json();
      return { path: result.filename };
    } catch (error) {
      console.error('Error uploading event image:', error);
      throw error;
    }
  }

  // Upload checkpoint image - modified for browser
  async uploadCheckpointImage(file: File, filename: string) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', filename);
      
      const response = await fetch('/api/upload/checkpoint-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const result = await response.json();
      return { path: result.filename };
    } catch (error) {
      console.error('Error uploading checkpoint image:', error);
      throw error;
    }
  }

  // Upload GPX file - modified for browser
  async uploadGpxFile(file: File, filename: string) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', filename);
      
      const response = await fetch('/api/upload/gpx', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const result = await response.json();
      return { path: result.filename };
    } catch (error) {
      console.error('Error uploading GPX file:', error);
      throw error;
    }
  }

  // Get public URL for a file - simplified for browser
  getPublicUrl(bucket: string, filename: string) {
    // Map bucket name to directory
    let directory;
    switch (bucket) {
      case 'events':
      case environment.database.storage.events:
        directory = 'events';
        break;
      case 'checkpoints':
      case environment.database.storage.checkpoints:
        directory = 'checkpoints';
        break;
      case 'gpx':
      case environment.database.storage.gpx:
        directory = 'gpx';
        break;
      default:
        directory = bucket;
    }
    
    // For browser, create a URL to the uploads directory
    return `/uploads/${directory}/${filename}`;
  }
}
