-- Create admin user (password is 'admin123' - would be hashed in production)
INSERT INTO users (id, email, password_hash, name, role)
VALUES (
  uuid_generate_v4(),
  'admin@example.com',
  '$2a$10$rTyOiGiRnAqJ5Qr0dTM5C.DTGHBh5sgiW0JYBorLOcqq4/.NVHgRS',
  'Admin User',
  'admin'
);

-- Create admin profile
INSERT INTO profiles (user_id, name, email, role)
SELECT 
  id,
  name,
  email,
  role
FROM users
WHERE email = 'admin@example.com';

-- Create sample event
INSERT INTO events (
  name,
  date,
  time,
  deadline,
  description,
  location,
  organizer,
  organizer_id,
  type,
  distance,
  elevation
)
VALUES (
  'Sample Brevet Event',
  '2023-06-15',
  '08:00',
  '2023-06-14',
  'A sample 200km brevet for testing purposes',
  'Stockholm',
  'Admin User',
  (SELECT user_id FROM profiles WHERE email = 'admin@example.com'),
  'brevet',
  200,
  1500
);

-- Create sample checkpoints
INSERT INTO checkpoints (
  event_id,
  name,
  distance,
  opening_time,
  closing_time
)
VALUES
  ((SELECT id FROM events WHERE name = 'Sample Brevet Event'), 'Start', 0, NOW(), NOW() + INTERVAL '1 hour'),
  ((SELECT id FROM events WHERE name = 'Sample Brevet Event'), 'Checkpoint 1', 50, NOW() + INTERVAL '2 hours', NOW() + INTERVAL '4 hours'),
  ((SELECT id FROM events WHERE name = 'Sample Brevet Event'), 'Checkpoint 2', 100, NOW() + INTERVAL '4 hours', NOW() + INTERVAL '8 hours'),
  ((SELECT id FROM events WHERE name = 'Sample Brevet Event'), 'Checkpoint 3', 150, NOW() + INTERVAL '6 hours', NOW() + INTERVAL '12 hours'),
  ((SELECT id FROM events WHERE name = 'Sample Brevet Event'), 'Finish', 200, NOW() + INTERVAL '8 hours', NOW() + INTERVAL '13.5 hours');
