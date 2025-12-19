#!/bin/bash
# Скрипт для добавления Novofon API ключей на production сервере
# Запустить на сервере: bash update-novofon-keys.sh

# Определяем путь к .env файлу
ENV_FILE="/home/a/alcompany/crm-kostroma.ru/.env"
ENV_FILE_ALT="/home/a/alcompany/crm-kostroma.ru/public_html/.env"

# Проверяем какой файл существует
if [ -f "$ENV_FILE" ]; then
    TARGET_FILE="$ENV_FILE"
elif [ -f "$ENV_FILE_ALT" ]; then
    TARGET_FILE="$ENV_FILE_ALT"
else
    echo "Файл .env не найден. Создаю новый..."
    TARGET_FILE="$ENV_FILE"
fi

# Добавляем или обновляем ключи Novofon
echo ""
echo "=== Обновление ключей Novofon ==="

# Проверяем, есть ли уже ключи в файле
if grep -q "NOVOFON_APP_ID" "$TARGET_FILE" 2>/dev/null; then
    echo "Обновляю существующие ключи..."
    sed -i 's/NOVOFON_APP_ID=.*/NOVOFON_APP_ID=appid_5038129/' "$TARGET_FILE"
    sed -i 's/NOVOFON_SECRET=.*/NOVOFON_SECRET=9pvj9p17nd6wigrl8w1jamkgmlm5askm257awmfw/' "$TARGET_FILE"
else
    echo "Добавляю новые ключи..."
    echo "" >> "$TARGET_FILE"
    echo "# Novofon Integration" >> "$TARGET_FILE"
    echo "NOVOFON_APP_ID=appid_5038129" >> "$TARGET_FILE"
    echo "NOVOFON_SECRET=9pvj9p17nd6wigrl8w1jamkgmlm5askm257awmfw" >> "$TARGET_FILE"
fi

echo "Готово! Ключи Novofon обновлены."
echo ""
echo "Перезапустите приложение:"
echo "  pm2 restart crm"
echo "  или"
echo "  docker-compose restart crm-next-app"
