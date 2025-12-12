require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('profiles').select('id,email,full_name,novofon_internal').then(r=>{
  console.log('Профили:');
  console.log(JSON.stringify(r.data,null,2));
});
