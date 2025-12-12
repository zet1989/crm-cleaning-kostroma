require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('kanban_columns').select('id,title,position').order('position').then(r=>{
  console.log('Колонки канбана:');
  console.log(JSON.stringify(r.data,null,2));
});
