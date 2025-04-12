# GPX Route Sharing

This feature enables all users of the application to see the same GPX routes, regardless of which browser or device they use.

## How It Works

1. **Server-Side Storage**: GPX routes are now stored on the server in a MongoDB database, making them accessible across all browsers and devices.

2. **Automatic Fallback**: If the server is not available, the app will automatically fall back to storing routes in your browser's IndexedDB for offline support.

3. **Shared Access**: Any route uploaded by any user will be visible to all users of the application.

4. **API Integration**: The application uses a REST API to upload, retrieve, and manage GPX routes.

## Getting Started

### Starting the Backend Server

1. Navigate to the backend directory:
   ```
   cd map-main/backend
   ```

2. Install dependencies (first time only):
   ```
   npm install
   ```

3. Start the server:
   ```
   npm run dev
   ```

4. You should see a message indicating the server is running, typically on port 3000.

### Starting the Frontend Application

1. Navigate to the Angular setup directory:
   ```
   cd map-main/angularSetup
   ```

2. Install dependencies (first time only):
   ```
   npm install
   ```

3. Start the application:
   ```
   ng serve
   ```

4. Open your browser and navigate to `http://localhost:4200`.

## Uploading and Viewing Routes

1. **Upload a GPX File**: Use the GPX File Upload section in the sidebar to select and upload one or more GPX files.

2. **All Users See the Same Routes**: Once uploaded, the routes are stored on the server and will be visible to all users across all browsers and devices.

3. **Offline Support**: If the server is unavailable, the application will store routes locally using IndexedDB as a fallback.

## Technical Implementation

The feature uses:

1. **MongoDB**: For persistent server-side storage
2. **Express API**: For handling GPX route uploads and retrieval
3. **IndexedDB**: As a fallback for offline support
4. **Angular HttpClient**: For API communication

For developers who want to extend this functionality, the key components are:

- **Backend**: `route.controller.js` and `route.routes.js` handle the API endpoints
- **Frontend**: `gpx.service.ts` manages route storage and retrieval 