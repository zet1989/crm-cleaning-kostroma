import { config } from 'dotenv';
import { resolve } from 'path';
import { NovofonClient } from './src/lib/novofon/client-v2';

config({ path: resolve(process.cwd(), '.env.local') });

const accessToken = process.env.NOVOFON_ACCESS_TOKEN!;

console.log('🔍 Access Token:', accessToken ? '✅ Загружен' : '❌ НЕ ЗАГРУЖЕН');

if (!accessToken) {
  console.error('❌ NOVOFON_ACCESS_TOKEN не найден в .env.local');
  process.exit(1);
}

const client = new NovofonClient(accessToken);

// Тест: получение звонков за последние 5 минут
const now = new Date();
const from = new Date(now.getTime() - 5 * 60 * 1000);

const formatDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const dateFrom = formatDate(from);
const dateTill = formatDate(now);

console.log('\n📋 Параметры запроса:');
console.log('   date_from:', dateFrom);
console.log('   date_till:', dateTill);
console.log('\n🚀 Выполняю запрос к Data API...\n');

client.getCalls(dateFrom, dateTill)
  .then((result) => {
    console.log('✅ Успех!');
    console.log('\n📦 Результат:', JSON.stringify(result, null, 2));
    
    const items = result.items || result.calls || [];
    console.log(`\n📞 Найдено звонков: ${items.length}`);
    
    if (items.length > 0) {
      console.log('\n🔍 Первый звонок:');
      console.log(JSON.stringify(items[0], null, 2));
    }
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  });
