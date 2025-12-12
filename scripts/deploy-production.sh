#!/bin/bash

# Скрипт для деплоя CRM на production сервер
# Использование: ./deploy-production.sh

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== CRM Deployment Script ===${NC}"

# Проверка наличия .env.production
if [ ! -f ".env.production" ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    echo "Please create .env.production file with production environment variables"
    exit 1
fi

# Загрузка переменных окружения
export $(cat .env.production | xargs)

# 1. Остановка текущих контейнеров
echo -e "${YELLOW}Stopping current containers...${NC}"
docker-compose -f docker-compose.prod.yml down || true

# 2. Создание бэкапа перед обновлением
echo -e "${YELLOW}Creating backup before update...${NC}"
if [ -f "./scripts/backup.sh" ]; then
    bash ./scripts/backup.sh
fi

# 3. Обновление кода (если используется git)
if [ -d ".git" ]; then
    echo -e "${YELLOW}Pulling latest changes from git...${NC}"
    git pull origin main
fi

# 4. Установка/обновление зависимостей
echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci --only=production

# 5. Сборка приложения
echo -e "${YELLOW}Building application...${NC}"
npm run build

# 6. Пересборка Docker образов
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# 7. Запуск контейнеров
echo -e "${YELLOW}Starting containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# 8. Ожидание готовности сервисов
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 15

# 9. Проверка статуса
echo -e "${YELLOW}Checking service status...${NC}"
docker-compose -f docker-compose.prod.yml ps

# 10. Проверка здоровья приложения
echo -e "${YELLOW}Health check...${NC}"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "failed")

if [ "$HEALTH_CHECK" == "200" ]; then
    echo -e "${GREEN}=== Deployment completed successfully! ===${NC}"
    echo -e "Application is running at: ${NEXT_PUBLIC_SITE_URL}"
else
    echo -e "${RED}=== Deployment completed with errors! ===${NC}"
    echo -e "Health check failed. Please check logs:"
    echo -e "docker-compose -f docker-compose.prod.yml logs -f next-app"
    exit 1
fi

# 11. Показать логи
echo -e "${YELLOW}Showing recent logs...${NC}"
docker-compose -f docker-compose.prod.yml logs --tail=50
