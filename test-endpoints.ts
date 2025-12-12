import { config } from 'dotenv';
import { resolve } from 'path';
import https from 'https';
import crypto from 'crypto';

config({ path: resolve(process.cwd(), '.env.local') });

const appId = process.env.NOVOFON_APP_ID!;
const secret = process.env.NOVOFON_SECRET!;

function generateSignature(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const paramsString = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
  const signString = `${paramsString}${secret}`;
  return crypto.createHash('md5').update(signString).digest('hex');
}

const params = {
  app_id: appId,
  date_begin: new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19),
  date_end: new Date().toISOString().slice(0, 19),
};

const sign = generateSignature(params);
const queryParams = new URLSearchParams({ ...params, sign });

// Пробуем разные endpoints
const endpoints = [
  'https://api.novofon.com/statistic/call_history/',
  'https://api.novofon.com/v1/statistic/call_history/',
  'https://api.novofon.ru/statistic/call_history/',
  'https://api.novofon.ru/v1/statistic/call_history/',
];

async function testEndpoint(endpoint: string): Promise<void> {
  return new Promise((resolve) => {
    const url = `${endpoint}?${queryParams}`;
    console.log(`\n🔍 Тестирую: ${endpoint}`);
    
    const req = https.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CRM-Client/1.0',
      },
    }, (res) => {
      console.log(`   ✅ Статус: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (data.length < 200) {
          console.log(`   📦 Ответ: ${data}`);
        } else {
          console.log(`   📦 Получены данные (${data.length} байт)`);
        }
        resolve();
      });
    });

    req.on('error', (error: any) => {
      console.log(`   ❌ Ошибка: ${error.code || error.message}`);
      resolve();
    });

    req.on('timeout', () => {
      console.log(`   ⏱️ Таймаут`);
      req.destroy();
      resolve();
    });
  });
}

(async () => {
  console.log('🚀 Тестируем разные endpoints...\n');
  console.log(`App ID: ${appId}`);
  console.log(`Подпись: ${sign}\n`);
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('\n✅ Тестирование завершено');
})();
