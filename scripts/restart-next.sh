#!/bin/bash
cd /opt/crm
set -a
source .env.supabase
export API_EXTERNAL_URL=https://crm-kostroma.ru
export SITE_URL=https://crm-kostroma.ru
set +a
docker-compose -f docker-compose.supabase.yml up -d --force-recreate kong auth rest realtime next-app nginx
sleep 10
echo "=== Kong ANON_KEY ==="
docker exec supabase-kong printenv ANON_KEY
echo "=== Next.js Supabase vars ==="
docker exec crm-next-app env | grep SUPABASE
echo "=== Next.js logs ==="
docker logs crm-next-app --tail 5
