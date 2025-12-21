#!/bin/bash
cd /opt/crm

# Загружаем переменные
source .env.local

# Пересобираем с правильными аргументами
docker build -f Dockerfile.prod \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  --build-arg NOVOFON_APP_ID="$NOVOFON_APP_ID" \
  --build-arg NOVOFON_SECRET="$NOVOFON_SECRET" \
  -t crm-next-app:latest .

# Перезапускаем контейнер
docker rm -f crm-next-app 2>/dev/null
docker run -d \
  --name crm-next-app \
  --restart always \
  --env-file /opt/crm/.env.local \
  -p 3000:3000 \
  --add-host=supabase-kong:127.0.0.1 \
  --add-host=supabase-db:127.0.0.1 \
  crm-next-app:latest

echo "Done! Check logs with: docker logs crm-next-app"
