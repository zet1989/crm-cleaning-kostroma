#!/bin/bash

# Скрипт для резервного копирования CRM
# Использование: ./backup.sh

set -e

BACKUP_DIR="/opt/backups/crm"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/opt/crm"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== CRM Backup Script ===${NC}"
echo -e "Backup date: ${DATE}"

# Создаём директорию для бэкапов
mkdir -p $BACKUP_DIR

# 1. Бэкап базы данных
echo -e "${YELLOW}Backing up database...${NC}"
docker exec crm-postgres pg_dump -U postgres crm | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 2. Бэкап загруженных файлов (записи звонков и т.д.)
echo -e "${YELLOW}Backing up uploaded files...${NC}"
if [ -d "$PROJECT_DIR/uploads" ]; then
    tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $PROJECT_DIR uploads
fi

# 3. Бэкап конфигурации
echo -e "${YELLOW}Backing up configuration...${NC}"
tar -czf $BACKUP_DIR/config_$DATE.tar.gz -C $PROJECT_DIR .env.production docker-compose.prod.yml

# 4. Удаление старых бэкапов (старше 30 дней)
echo -e "${YELLOW}Cleaning old backups...${NC}"
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +30 -delete

# 5. Подсчёт размера бэкапов
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)

echo -e "${GREEN}=== Backup completed ===${NC}"
echo -e "Backup location: $BACKUP_DIR"
echo -e "Total backup size: $BACKUP_SIZE"
echo -e "Files:"
ls -lh $BACKUP_DIR/*$DATE*
