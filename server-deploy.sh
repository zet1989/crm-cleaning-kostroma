#!/bin/bash
# Автоматический деплой CRM

echo "=== Начало деплоя CRM ==="

# 1. Проверка Docker
echo "1. Проверка Docker..."
docker --version
docker-compose --version

# 2. Клонирование репозитория
echo "2. Клонирование репозитория..."
rm -rf /opt/crm
git clone https://github.com/zet1989/crm-cleaning-kostroma.git /opt/crm
cd /opt/crm

# 3. Создание .env.production
echo "3. Создание .env.production..."
cat > .env.production << 'EOF'
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://155.212.191.59

# Supabase локальный
NEXT_PUBLIC_SUPABASE_URL=http://155.212.191.59:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# База данных
POSTGRES_PASSWORD=CrmSecurePass2024!
POSTGRES_DB=crm_production

# API ключи - ЗАПОЛНИТЕ СВОИ!
NOVOFON_API_KEY=your_novofon_key_here
OPENROUTER_API_KEY=your_openrouter_key_here

# JWT Secret
JWT_SECRET=super-secret-jwt-token-min-32-chars-long-2024
EOF

echo ".env.production создан"

# 4. Настройка файрвола
echo "4. Настройка файрвола..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
echo "y" | ufw enable

# 5. Запуск Docker Compose
echo "5. Запуск Docker Compose..."
docker-compose -f docker-compose.prod.yml up -d

# 6. Ожидание запуска
echo "6. Ожидание запуска контейнеров..."
sleep 10

# 7. Проверка статуса
echo "7. Статус контейнеров:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "=== Деплой завершен! ==="
echo ""
echo "Приложение доступно:"
echo "  CRM: http://155.212.191.59"
echo "  Supabase Studio: http://155.212.191.59:8000"
echo ""
echo "ВАЖНО: Отредактируйте /opt/crm/.env.production"
echo "Добавьте свои API ключи для Novofon и OpenRouter"
