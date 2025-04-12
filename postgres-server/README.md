# PostgreSQL Server for Map Application

This directory contains setup files for running a standalone PostgreSQL database server that can be deployed on a separate Linux machine and connected to the map application.

## Setup Instructions

### 1. Prepare the server

Make sure you have Docker and Docker Compose installed on your Linux server:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Clone this repository

```bash
git clone <repository-url>
cd postgres-server
```

### 3. Configure environment variables

```bash
cp .env.example .env
nano .env  # Edit variables as needed
```

### 4. Start the PostgreSQL server

```bash
docker-compose up -d
```

### 5. Verify the installation

```bash
# Check if containers are running
docker-compose ps

# Check PostgreSQL logs
docker-compose logs postgres
```

## Connecting to the database

### From the Map Application

Update the connection details in your map application environment configuration:

1. In your `.env` file in the map-main project, update the following:

```
# PostgreSQL configuration
POSTGRES_URL=postgresql://<username>:<password>@<server-ip>:5432/mapdb
```

2. Use this connection string in your application code.

### Using pgAdmin

pgAdmin is included in the Docker Compose setup and can be accessed at: http://<server-ip>:5050

Login with:
- Email: admin@example.com (or as configured in .env)
- Password: admin (or as configured in .env)

## Security Considerations

1. Change all default passwords in the .env file
2. Consider setting up SSL for PostgreSQL connections
3. Configure proper firewall rules to only allow connections from your application servers
4. For production, consider implementing more robust authentication mechanisms
