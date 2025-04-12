#!/usr/bin/env node

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Initialize readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load environment variables
let dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'mapdb',
  user: process.env.POSTGRES_USER || 'mapuser',
  password: process.env.POSTGRES_PASSWORD || 'mappassword'
};

// Try to load from .env file if exists
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent.split('\n').reduce((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) acc[match[1].trim()] = match[2].trim();
      return acc;
    }, {});
    
    dbConfig = {
      host: envVars.POSTGRES_HOST || dbConfig.host,
      port: envVars.POSTGRES_PORT || dbConfig.port,
      database: envVars.POSTGRES_DB || dbConfig.database,
      user: envVars.POSTGRES_USER || dbConfig.user,
      password: envVars.POSTGRES_PASSWORD || dbConfig.password
    };
  }
} catch (error) {
  console.warn('Could not load .env file:', error.message);
}

async function createUser() {
  console.log('=== Create User ===');
  
  // Get user information
  const email = await new Promise(resolve => {
    rl.question('Enter email: ', (answer) => resolve(answer.trim()));
  });

  const password = await new Promise(resolve => {
    rl.question('Enter password: ', (answer) => resolve(answer.trim()));
  });

  const name = await new Promise(resolve => {
    rl.question('Enter name: ', (answer) => resolve(answer.trim()));
  });

  const role = await new Promise(resolve => {
    rl.question('Enter role (admin, organizer, user) [default: user]: ', (answer) => {
      const role = answer.trim().toLowerCase();
      if (['admin', 'organizer', 'user'].includes(role)) {
        resolve(role);
      } else {
        resolve('user');
      }
    });
  });

  // Hash the password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Connect to the database
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected to database');

    // Start a transaction
    await client.query('BEGIN');

    // Insert into users table
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [email, passwordHash, name, role]
    );

    const userId = userResult.rows[0].id;

    // Insert into profiles table
    await client.query(
      `INSERT INTO profiles (user_id, name, email, role) 
       VALUES ($1, $2, $3, $4)`,
      [userId, name, email, role]
    );

    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`\n✅ User created successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Role: ${role}`);
    console.log(`User ID: ${userId}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating user:', error.message);
  } finally {
    await client.end();
    rl.close();
  }
}

createUser();
