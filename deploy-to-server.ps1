# Скрипт деплоя CRM на сервер Beget
# Использование: .\deploy-to-server.ps1

$SERVER = "root@155.212.191.59"
$SSH_KEY = "C:\Users\Alexey\.ssh\crm_beget"
$REPO_URL = "https://github.com/zet1989/crm-cleaning-kostroma.git"

Write-Host "=== Деплой CRM на сервер ===" -ForegroundColor Green

# 1. Проверка Docker на сервере
Write-Host "`n1. Проверка Docker на сервере..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER 'docker --version; docker-compose --version'

# 2. Клонирование репозитория
Write-Host "`n2. Клонирование репозитория в /opt/crm..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER "rm -rf /opt/crm && git clone $REPO_URL /opt/crm"

# 3. Создание .env.production (шаблон)
Write-Host "`n3. Создание файла .env.production..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER @"
cd /opt/crm
cat > .env.production << 'EOF'
# Next.js
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://155.212.191.59

# Supabase (локальный)
NEXT_PUBLIC_SUPABASE_URL=http://155.212.191.59:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# PostgreSQL
POSTGRES_PASSWORD=your-super-secret-password
POSTGRES_DB=crm_production

# Novofon API (ЗАПОЛНИТЕ!)
NOVOFON_API_KEY=ваш_ключ_новофон

# OpenRouter AI (ЗАПОЛНИТЕ!)
OPENROUTER_API_KEY=ваш_ключ_openrouter

# JWT Secret (для Supabase)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters
EOF
"@

# 4. Установка портов для файрвола
Write-Host "`n4. Настройка файрвола (порты 22, 80, 443, 8000)..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER @"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
ufw --force enable
"@

# 5. Запуск Docker Compose
Write-Host "`n5. Запуск Docker Compose..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER "cd /opt/crm && docker-compose -f docker-compose.prod.yml up -d"

# 6. Проверка статуса
Write-Host "`n6. Проверка статуса контейнеров..." -ForegroundColor Yellow
ssh -i $SSH_KEY $SERVER "cd /opt/crm && docker-compose -f docker-compose.prod.yml ps"

Write-Host "`n=== Деплой завершен! ===" -ForegroundColor Green
Write-Host "`nПриложение будет доступно через несколько минут на:" -ForegroundColor Cyan
Write-Host "http://155.212.191.59" -ForegroundColor White
Write-Host "`nSupabase Studio:" -ForegroundColor Cyan
Write-Host "http://155.212.191.59:8000" -ForegroundColor White
Write-Host "`n⚠️ ВАЖНО: Отредактируйте /opt/crm/.env.production на сервере!" -ForegroundColor Red
Write-Host "Заполните NOVOFON_API_KEY и OPENROUTER_API_KEY" -ForegroundColor Red
