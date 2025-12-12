require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

s.from('deals').select('id,source,created_at',{count:'exact'}).eq('source','novofon').order('created_at',{ascending:false}).then(r=>{
  console.log('Всего сделок из Novofon:',r.count);
  console.log('\nПоследние:');
  r.data.slice(0,20).forEach((d,i)=>console.log(`${i+1}. ${d.created_at} - ${d.id.substring(0,8)}...`));
});
