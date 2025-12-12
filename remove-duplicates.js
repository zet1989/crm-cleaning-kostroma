require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

async function removeDuplicates() {
  // Получаем все сделки из Novofon
  const {data: deals} = await s.from('deals').select('id, metadata, created_at').eq('source', 'novofon').order('created_at');
  
  if (!deals) {
    console.log('Нет сделок');
    return;
  }
  
  console.log(`Всего сделок из Novofon: ${deals.length}`);
  
  // Группируем по novofon_call_id
  const groups = {};
  deals.forEach(deal => {
    const callId = deal.metadata?.novofon_call_id;
    if (callId) {
      if (!groups[callId]) {
        groups[callId] = [];
      }
      groups[callId].push(deal);
    }
  });
  
  // Находим дубликаты
  const toDelete = [];
  Object.entries(groups).forEach(([callId, items]) => {
    if (items.length > 1) {
      console.log(`\nЗвонок ${callId}: ${items.length} дубликатов`);
      // Оставляем первую (самую старую), остальные удаляем
      items.slice(1).forEach(deal => {
        console.log(`  Удаляю дубликат: ${deal.id} (${deal.created_at})`);
        toDelete.push(deal.id);
      });
    }
  });
  
  if (toDelete.length > 0) {
    console.log(`\n📌 Удаляю ${toDelete.length} дубликатов...`);
    const {error} = await s.from('deals').delete().in('id', toDelete);
    if (error) {
      console.error('Ошибка:', error);
    } else {
      console.log('✅ Дубликаты удалены');
    }
  } else {
    console.log('\n✅ Дубликатов не найдено');
  }
}

removeDuplicates();
