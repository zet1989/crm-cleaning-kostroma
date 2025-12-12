import { config } from 'dotenv';
import { resolve } from 'path';
import { NovofonClient } from './src/lib/novofon/client-v2';

config({ path: resolve(process.cwd(), '.env.local') });

const accessToken = process.env.NOVOFON_ACCESS_TOKEN!;
const client = new NovofonClient(accessToken);

// Проверяем звонки за последние 24 часа
const now = new Date();
const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const formatDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

console.log('🔍 Проверяю звонки за последние 24 часа...');
console.log(`   Период: ${formatDate(from)} - ${formatDate(now)}\n`);

client.getCalls(formatDate(from), formatDate(now))
  .then((result) => {
    const items = result.data || result.items || [];
    
    console.log(`✅ Всего звонков: ${items.length}\n`);
    
    if (items.length > 0) {
      console.log('📞 Последние звонки:\n');
      items.slice(0, 10).forEach((call: any, index: number) => {
        console.log(`${index + 1}. ${call.communication_date_create || call.start}`);
        console.log(`   От: ${call.contact_phone_number || call.from}`);
        console.log(`   Статус: ${call.communication_status || call.status}`);
        console.log(`   Внутренний: ${call.employee_phone_number || call.internal}`);
        console.log(`   Длительность разговора: ${call.talk_time || call.talk_duration || 0} сек`);
        console.log('');
      });
      
      // Группировка по статусам
      const statuses: any = {};
      items.forEach((call: any) => {
        const status = call.communication_status || call.status || 'unknown';
        statuses[status] = (statuses[status] || 0) + 1;
      });
      
      console.log('📊 По статусам:');
      Object.entries(statuses).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    } else {
      console.log('❌ Звонков не найдено');
      console.log('\nВозможные причины:');
      console.log('1. Звонков действительно не было');
      console.log('2. Неправильный access_token');
      console.log('3. Проблема с API Novofon');
    }
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error.message);
  });
