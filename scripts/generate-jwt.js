const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'PJc9HXcbvgz1xrfibrQZchUafhcBJGMWYVnXOrzymJY';

// Anon key
const anonPayload = {
  role: 'anon',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 лет
};
const anonKey = jwt.sign(anonPayload, secret);
console.log('ANON_KEY=' + anonKey);

// Service role key  
const servicePayload = {
  role: 'service_role',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
};
const serviceKey = jwt.sign(servicePayload, secret);
console.log('SERVICE_ROLE_KEY=' + serviceKey);
