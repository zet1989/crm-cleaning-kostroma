#!/bin/bash

# Развертывание Supabase Self-Hosted для CRM
# Запускать на сервере: bash scripts/deploy-supabase.sh

set -e

echo "🚀 Развертывание Supabase Self-Hosted..."

cd /opt/crm

# 1. Остановка текущих контейнеров
echo "📦 Останавливаем текущие контейнеры..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# 2. Проверка .env.supabase
if [ ! -f .env.supabase ]; then
    echo "❌ Файл .env.supabase не найден!"
    echo "   Запустите сначала: bash scripts/generate-supabase-keys.sh"
    echo "   И создайте .env.supabase с полученными ключами"
    exit 1
fi

# 3. Загружаем переменные окружения
set -a
source .env.supabase
set +a

# 4. Проверка обязательных переменных
for var in JWT_SECRET ANON_KEY SERVICE_ROLE_KEY POSTGRES_PASSWORD; do
    if [ -z "${!var}" ]; then
        echo "❌ Переменная $var не установлена в .env.supabase"
        exit 1
    fi
done

echo "✅ Все переменные окружения установлены"

# 5. Запуск Supabase
echo "🐳 Запускаем Supabase контейнеры..."
docker-compose -f docker-compose.supabase.yml --env-file .env.supabase up -d

# 6. Ожидание готовности PostgreSQL
echo "⏳ Ожидаем готовность PostgreSQL..."
sleep 10

for i in {1..30}; do
    if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL готов!"
        break
    fi
    echo "   Ожидание... ($i/30)"
    sleep 2
done

# 7. Применение миграций
echo "📄 Применяем миграции..."
for migration in /opt/crm/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "   Применяем: $(basename $migration)"
        docker exec -i supabase-db psql -U postgres -d postgres < "$migration" 2>/dev/null || true
    fi
done

# 8. Ожидание готовности Auth
echo "⏳ Ожидаем готовность GoTrue (Auth)..."
for i in {1..30}; do
    if curl -s http://localhost:9999/health > /dev/null 2>&1; then
        echo "✅ GoTrue готов!"
        break
    fi
    echo "   Ожидание... ($i/30)"
    sleep 2
done

# 9. Создание admin пользователя
echo "👤 Создаём admin пользователя..."
curl -s -X POST "http://localhost:9999/admin/users" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "admin@crm-kostroma.ru",
        "password": "admin123",
        "email_confirm": true,
        "user_metadata": {
            "full_name": "Администратор"
        }
    }' > /tmp/admin_user.json 2>/dev/null

if grep -q '"id"' /tmp/admin_user.json 2>/dev/null; then
    ADMIN_ID=$(cat /tmp/admin_user.json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "✅ Admin создан с ID: $ADMIN_ID"
    
    # Создаём профиль администратора
    docker exec supabase-db psql -U postgres -d postgres -c "
        INSERT INTO profiles (id, email, full_name, roles)
        VALUES ('$ADMIN_ID', 'admin@crm-kostroma.ru', 'Администратор', 'admin')
        ON CONFLICT (id) DO UPDATE SET roles = 'admin';
    " 2>/dev/null
    echo "✅ Профиль администратора создан"
else
    echo "⚠️  Admin уже существует или ошибка создания"
fi

# 10. Проверка статуса всех сервисов
echo ""
echo "📊 Статус сервисов:"
echo "===================="
docker-compose -f docker-compose.supabase.yml ps

echo ""
echo "🎉 Развертывание завершено!"
echo ""
echo "📌 Данные для входа:"
echo "   URL: https://crm-kostroma.ru"
echo "   Email: admin@crm-kostroma.ru"
echo "   Пароль: admin123"
echo ""
echo "⚠️  ВАЖНО: Смените пароль после первого входа!"
echo ""
