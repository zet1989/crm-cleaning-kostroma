// Тест подключения к Novofon API
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const appId = process.env.NOVOFON_APP_ID;
const secret = process.env.NOVOFON_SECRET;

console.log('Testing Novofon API connection...');
console.log('App ID:', appId);
console.log('');

// Генерация подписи
function generateSignature(params, secret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const signString = `${sortedParams}${secret}`;
  return crypto.createHash('md5').update(signString).digest('hex');
}

// Параметры запроса
const today = new Date().toISOString().split('T')[0];
const params = {
  appid: appId,
  from: today,
  to: today,
};

const sign = generateSignature(params, secret);
const queryParams = new URLSearchParams({ ...params, sign });

const url = `https://api.novofon.com/v1/statistic/call_history/?${queryParams}`;

console.log('Request URL:', url.replace(secret, '***'));
console.log('');

try {
  const response = await fetch(url);
  const data = await response.text();
  
  console.log('Response status:', response.status);
  console.log('Response:', data);
  
  if (response.ok) {
    const json = JSON.parse(data);
    console.log('');
    console.log('✅ Success! Found', json.calls?.length || 0, 'calls');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Details:', error);
}
