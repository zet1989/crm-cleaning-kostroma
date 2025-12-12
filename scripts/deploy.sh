#!/bin/bash

# ============================================
# Скрипт развертывания CRM для клининговой компании
# Оптимизирован для VPS с 2 ГБ RAM
# Использование: ./deploy.sh
# ============================================

set -e

echo "🚀 Развертывание CRM системы"
echo "================================"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Запустите скрипт от root: sudo ./deploy.sh${NC}"
    exit 1
fi

# ============================================
# 1. Запрос параметров
# ============================================

echo ""
echo -e "${YELLOW}📝 Введите параметры для настройки:${NC}"
echo ""

read -p "Домен CRM (например, crm-msk.ru): " CRM_DOMAIN
read -p "Email администратора: " ADMIN_EMAIL
read -p "Название региона (для отображения): " REGION_NAME
read -s -p "Пароль для базы данных PostgreSQL: " DB_PASSWORD
echo ""
read -s -p "JWT Secret (минимум 32 символа, Enter для автогенерации): " JWT_SECRET
echo ""

# Генерация ключей если не указаны
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}✅ JWT Secret сгенерирован автоматически${NC}"
fi

ANON_KEY=$(openssl rand -base64 32)
SERVICE_ROLE_KEY=$(openssl rand -base64 32)

# ============================================
# 2. Настройка SWAP (критично для 2 ГБ RAM!)
# ============================================

echo ""
echo -e "${YELLOW}💾 Настройка SWAP для 2 ГБ RAM...${NC}"

if [ ! -f /swapfile ]; then
    # Создаём swap 2 ГБ
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Оптимизация swap для SSD
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
    sysctl -p
    
    echo -e "${GREEN}✅ SWAP 2 ГБ создан${NC}"
else
    echo -e "${GREEN}✅ SWAP уже существует${NC}"
fi

# ============================================
# 3. Обновление системы
# ============================================

echo ""
echo -e "${YELLOW}📦 Обновление системы...${NC}"
apt update && apt upgrade -y

# ============================================
# 3. Установка Docker (если не установлен)
# ============================================

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Установка Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo -e "${GREEN}✅ Docker уже установлен${NC}"
fi

# Установка Docker Compose plugin
apt install -y docker-compose-plugin

# ============================================
# 4. Установка дополнительных утилит
# ============================================

echo -e "${YELLOW}📦 Установка утилит...${NC}"
apt install -y git nginx certbot python3-certbot-nginx htop

# ============================================
# 5. Создание структуры директорий
# ============================================

echo -e "${YELLOW}📁 Создание директорий...${NC}"
mkdir -p /opt/crm
mkdir -p /opt/supabase
mkdir -p /opt/n8n
mkdir -p /opt/backups

# ============================================
# 6. Клонирование и настройка Supabase
# ============================================

echo -e "${YELLOW}🗄️ Настройка Supabase...${NC}"
cd /opt/supabase

if [ ! -d "supabase" ]; then
    git clone --depth 1 https://github.com/supabase/supabase
fi

cd supabase/docker
cp .env.example .env

# Обновление .env файла
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$DB_PASSWORD/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
sed -i "s/ANON_KEY=.*/ANON_KEY=$ANON_KEY/" .env
sed -i "s/SERVICE_ROLE_KEY=.*/SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY/" .env
sed -i "s|SITE_URL=.*|SITE_URL=https://$CRM_DOMAIN|" .env
sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://api.$CRM_DOMAIN|" .env

echo -e "${GREEN}✅ Supabase настроен${NC}"

# ============================================
# 7. Настройка n8n
# ============================================

echo -e "${YELLOW}⚡ Настройка n8n...${NC}"
cd /opt/n8n

cat > docker-compose.yml << EOF
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=n8n.$CRM_DOMAIN
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://n8n.$CRM_DOMAIN/
      - GENERIC_TIMEZONE=Europe/Moscow
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=$DB_PASSWORD
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
EOF

echo -e "${GREEN}✅ n8n настроен${NC}"

# ============================================
# 8. Настройка Nginx
# ============================================

echo -e "${YELLOW}🌐 Настройка Nginx...${NC}"

cat > /etc/nginx/sites-available/crm << EOF
# CRM приложение
server {
    listen 80;
    server_name $CRM_DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Supabase API
server {
    listen 80;
    server_name api.$CRM_DOMAIN;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# Supabase Studio
server {
    listen 80;
    server_name studio.$CRM_DOMAIN;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}

# n8n
server {
    listen 80;
    server_name n8n.$CRM_DOMAIN;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo -e "${GREEN}✅ Nginx настроен${NC}"

# ============================================
# 9. Создание скрипта бэкапа
# ============================================

echo -e "${YELLOW}💾 Настройка бэкапов...${NC}"

cat > /opt/backups/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="/opt/backups"

# Бэкап PostgreSQL
docker exec supabase-db pg_dump -U postgres postgres > $BACKUP_DIR/db_$DATE.sql

# Бэкап n8n
tar -czf $BACKUP_DIR/n8n_$DATE.tar.gz /var/lib/docker/volumes/n8n_n8n_data

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -name "*.sql" -type f -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/backups/backup.sh

# Добавление в cron
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/backups/backup.sh >> /var/log/backup.log 2>&1") | crontab -

echo -e "${GREEN}✅ Бэкапы настроены (ежедневно в 3:00)${NC}"

# ============================================
# 10. Запуск сервисов
# ============================================

echo ""
echo -e "${YELLOW}🚀 Запуск сервисов...${NC}"

cd /opt/supabase/supabase/docker
docker compose up -d

cd /opt/n8n
docker compose up -d

# ============================================
# 11. Вывод информации
# ============================================

echo ""
echo "============================================"
echo -e "${GREEN}✅ Развертывание завершено!${NC}"
echo "============================================"
echo ""
echo -e "${YELLOW}📋 Информация о развертывании:${NC}"
echo ""
echo "🌐 Домен CRM:     https://$CRM_DOMAIN"
echo "🔧 Supabase API:  https://api.$CRM_DOMAIN"
echo "📊 Supabase Studio: https://studio.$CRM_DOMAIN"
echo "⚡ n8n:           https://n8n.$CRM_DOMAIN"
echo ""
echo -e "${YELLOW}🔑 Сохраните эти данные:${NC}"
echo ""
echo "DB Password:      $DB_PASSWORD"
echo "JWT Secret:       $JWT_SECRET"
echo "Anon Key:         $ANON_KEY"
echo "Service Role Key: $SERVICE_ROLE_KEY"
echo ""
echo -e "${YELLOW}📝 Следующие шаги:${NC}"
echo ""
echo "1. Настройте DNS записи:"
echo "   - $CRM_DOMAIN        → $(curl -s ifconfig.me)"
echo "   - api.$CRM_DOMAIN    → $(curl -s ifconfig.me)"
echo "   - studio.$CRM_DOMAIN → $(curl -s ifconfig.me)"
echo "   - n8n.$CRM_DOMAIN    → $(curl -s ifconfig.me)"
echo ""
echo "2. После настройки DNS получите SSL сертификаты:"
echo "   certbot --nginx -d $CRM_DOMAIN -d api.$CRM_DOMAIN -d studio.$CRM_DOMAIN -d n8n.$CRM_DOMAIN"
echo ""
echo "3. Клонируйте репозиторий CRM и настройте .env.production"
echo ""
echo "============================================"
