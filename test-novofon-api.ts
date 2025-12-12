import { config } from 'dotenv';
import { resolve } from 'path';
import https from 'https';
import crypto from 'crypto';

// Загружаем .env.local явно
config({ path: resolve(process.cwd(), '.env.local') });

const appId = process.env.NOVOFON_APP_ID!;
const secret = process.env.NOVOFON_SECRET!;

console.log('🔍 APP_ID:', appId ? appId : 'НЕ ЗАГРУЖЕН');
console.log('🔍 SECRET:', secret ? '✅ Загружен' : 'НЕ ЗАГРУЖЕН');

// Генерация подписи
function generateSignature(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const paramsString = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
  const signString = `${paramsString}${secret}`;
  return crypto.createHash('md5').update(signString).digest('hex');
}

// Параметры запроса
const params = {
  app_id: appId,
  date_begin: new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19),
  date_end: new Date().toISOString().slice(0, 19),
};

console.log('📋 Параметры запроса:', params);

const sign = generateSignature(params);
console.log('🔐 Подпись:', sign);

const queryParams = new URLSearchParams({ ...params, sign });
const url = `https://api.novofon.com/statistic/call_history/?${queryParams}`;

console.log('🌐 URL:', url);
console.log('\n🚀 Выполняю запрос...\n');

const req = https.get(url, {
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'CRM-Client/1.0',
  },
}, (res) => {
  console.log('✅ Статус:', res.statusCode);
  console.log('📄 Заголовки:', res.headers);
  
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📦 Ответ:', data);
    try {
      const json = JSON.parse(data);
      console.log('\n✅ JSON успешно распарсен:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('\n❌ Ошибка парсинга JSON:', e);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Ошибка запроса:', error);
});

req.on('timeout', () => {
  console.error('\n⏱️ Таймаут запроса');
  req.destroy();
});

req.on('socket', (socket) => {
  console.log('🔌 Соединение установлено');
  
  socket.on('connect', () => {
    console.log('✅ TCP соединение установлено');
  });
  
  socket.on('secureConnect', () => {
    console.log('🔒 TLS рукопожатие завершено');
  });
  
  socket.on('close', () => {
    console.log('🔌 Соединение закрыто');
  });
  
  socket.on('error', (err) => {
    console.error('❌ Ошибка сокета:', err);
  });
});
