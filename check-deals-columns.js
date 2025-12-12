require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('deals').select('*').limit(1).then(r=>{
  if(r.data && r.data[0]) {
    console.log('Колонки deals:', Object.keys(r.data[0]).join(', '));
  } else {
    console.log('Нет данных');
  }
});
