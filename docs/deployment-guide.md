# 🚀 Инструкция по развертыванию CRM на Beget

## Требования

Для развертывания вам понадобится:
- **VPS или Dedicated сервер на Beget** с Docker поддержкой
- Минимум 4 GB RAM (рекомендуется 8 GB)
- 50 GB SSD
- Ubuntu 22.04 LTS

> ⚠️ **Важно:** Обычный shared-хостинг Beget не подойдёт! Нужен VPS/VDS с root-доступом.

---

## Шаг 1: Подготовка сервера

### 1.1 Подключение к серверу

```bash
ssh root@your-server-ip
```

### 1.2 Обновление системы

```bash
apt update && apt upgrade -y
```

### 1.3 Установка Docker и Docker Compose

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
apt install docker-compose-plugin -y

# Проверка
docker --version
docker compose version
```

### 1.4 Установка дополнительных утилит

```bash
apt install -y git nginx certbot python3-certbot-nginx htop
```

---

## Шаг 2: Развертывание Supabase (Self-Hosted)

### 2.1 Клонирование репозитория Supabase

```bash
cd /opt
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### 2.2 Настройка переменных окружения

```bash
cp .env.example .env
nano .env
```

**Обязательно измените следующие параметры:**

```env
# Генерируем секреты (можно использовать: openssl rand -base64 32)
POSTGRES_PASSWORD=your_strong_postgres_password
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
ANON_KEY=your_anon_key_from_supabase_jwt_generator
SERVICE_ROLE_KEY=your_service_role_key_from_jwt_generator

# Настройки сайта
SITE_URL=https://crm.yourdomain.ru
API_EXTERNAL_URL=https://api.crm.yourdomain.ru

# SMTP для отправки email (опционально)
SMTP_HOST=smtp.beget.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.ru
SMTP_PASS=your_email_password
SMTP_SENDER_NAME=CRM System
```

> 💡 **Генерация JWT ключей:** Используйте [Supabase JWT Generator](https://supabase.com/docs/guides/self-hosting#api-keys)

### 2.3 Запуск Supabase

```bash
docker compose up -d
```

### 2.4 Проверка работы

```bash
docker compose ps
```

Все контейнеры должны быть в статусе `Up`.

---

## Шаг 3: Развертывание n8n

### 3.1 Создание директории для n8n

```bash
mkdir -p /opt/n8n
cd /opt/n8n
```

### 3.2 Создание docker-compose.yml для n8n

```bash
nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=n8n.yourdomain.ru
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://n8n.yourdomain.ru/
      - GENERIC_TIMEZONE=Europe/Moscow
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_n8n_password
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

### 3.3 Запуск n8n

```bash
docker compose up -d
```

---

## Шаг 4: Развертывание Next.js приложения

### 4.1 Клонирование проекта

```bash
cd /opt
git clone https://github.com/your-repo/crm-cleaning.git crm
cd crm
```

### 4.2 Настройка переменных окружения

```bash
cp .env.example .env.production
nano .env.production
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://api.crm.yourdomain.ru
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter AI
OPENROUTER_API_KEY=your_openrouter_api_key

# SMS провайдер
SMS_API_KEY=your_sms_api_key
SMS_SENDER=CRM

# Приложение
NEXT_PUBLIC_APP_URL=https://crm.yourdomain.ru
```

### 4.3 Создание Dockerfile

```bash
nano Dockerfile
```

```dockerfile
FROM node:20-alpine AS base

# Установка зависимостей
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Сборка приложения
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production образ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 4.4 Создание docker-compose.yml

```bash
nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  crm:
    build: .
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - supabase
```

### 4.5 Сборка и запуск

```bash
docker compose up -d --build
```

---

## Шаг 5: Настройка Nginx (Reverse Proxy)

### 5.1 Создание конфигурации для CRM

```bash
nano /etc/nginx/sites-available/crm
```

```nginx
# CRM приложение
server {
    listen 80;
    server_name crm.yourdomain.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Supabase API
server {
    listen 80;
    server_name api.crm.yourdomain.ru;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Supabase Studio (админка)
server {
    listen 80;
    server_name studio.crm.yourdomain.ru;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# n8n
server {
    listen 80;
    server_name n8n.yourdomain.ru;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 Активация конфигурации

```bash
ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 5.3 Получение SSL сертификатов

```bash
certbot --nginx -d crm.yourdomain.ru -d api.crm.yourdomain.ru -d studio.crm.yourdomain.ru -d n8n.yourdomain.ru
```

---

## Шаг 6: Настройка DNS на Beget

В панели управления Beget добавьте A-записи:

| Запись | Тип | Значение |
|--------|-----|----------|
| crm | A | IP вашего сервера |
| api.crm | A | IP вашего сервера |
| studio.crm | A | IP вашего сервера |
| n8n | A | IP вашего сервера |

---

## Шаг 7: Применение миграций базы данных

### 7.1 Установка Supabase CLI локально

```bash
# На вашем компьютере
npm install -g supabase
```

### 7.2 Применение миграций

```bash
cd /path/to/crm-project
supabase db push --db-url "postgresql://postgres:your_password@api.crm.yourdomain.ru:5432/postgres"
```

---

## Шаг 8: Настройка автозапуска и мониторинга

### 8.1 Автозапуск Docker контейнеров

Docker контейнеры с `restart: always` автоматически запустятся после перезагрузки сервера.

### 8.2 Настройка мониторинга (опционально)

```bash
# Установка Portainer для управления Docker
docker volume create portainer_data
docker run -d -p 9000:9000 --name portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data portainer/portainer-ce
```

---

## Шаг 9: Резервное копирование

### 9.1 Скрипт бэкапа базы данных

```bash
nano /opt/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="/opt/backups"

mkdir -p $BACKUP_DIR

# Бэкап PostgreSQL
docker exec supabase-db pg_dump -U postgres postgres > $BACKUP_DIR/db_$DATE.sql

# Бэкап n8n
tar -czf $BACKUP_DIR/n8n_$DATE.tar.gz /var/lib/docker/volumes/n8n_n8n_data

# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
chmod +x /opt/backup.sh
```

### 9.2 Добавление в cron

```bash
crontab -e
```

```
# Ежедневный бэкап в 3:00
0 3 * * * /opt/backup.sh >> /var/log/backup.log 2>&1
```

---

## Проверка развертывания

После выполнения всех шагов, проверьте доступность:

- 🌐 **CRM приложение:** https://crm.yourdomain.ru
- 🔧 **Supabase Studio:** https://studio.crm.yourdomain.ru
- ⚡ **n8n:** https://n8n.yourdomain.ru
- 📡 **API:** https://api.crm.yourdomain.ru

---

## Полезные команды

```bash
# Просмотр логов
docker compose logs -f

# Перезапуск сервисов
docker compose restart

# Обновление приложения
cd /opt/crm
git pull
docker compose up -d --build

# Статус контейнеров
docker ps

# Использование ресурсов
htop
```

---

## Troubleshooting

### Проблема: Контейнер не запускается

```bash
docker compose logs service_name
```

### Проблема: 502 Bad Gateway

Проверьте, что контейнер запущен и порт правильно проброшен:
```bash
docker ps
curl localhost:3000
```

### Проблема: SSL не работает

```bash
certbot certificates
certbot renew --dry-run
```

---

## Контакты для поддержки Beget

- 📞 Телефон: 8 800 700-06-08
- 💬 Чат: https://beget.com
- 📧 Email: support@beget.com
