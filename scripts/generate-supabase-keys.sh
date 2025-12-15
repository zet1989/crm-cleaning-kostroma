#!/bin/bash

# Генерация ключей для Supabase Self-Hosted
# Запускать на сервере: bash scripts/generate-supabase-keys.sh

set -e

echo "🔐 Генерация ключей для Supabase..."

# Генерация JWT_SECRET (минимум 32 символа)
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')

# Текущее время
NOW=$(date +%s)
# Срок действия - 10 лет
EXP=$((NOW + 315360000))

# Payload для ANON ключа
ANON_PAYLOAD=$(cat <<EOF
{
  "role": "anon",
  "iss": "supabase",
  "iat": ${NOW},
  "exp": ${EXP}
}
EOF
)

# Payload для SERVICE_ROLE ключа
SERVICE_PAYLOAD=$(cat <<EOF
{
  "role": "service_role",
  "iss": "supabase",
  "iat": ${NOW},
  "exp": ${EXP}
}
EOF
)

# Функция для создания JWT
create_jwt() {
    local payload="$1"
    local secret="$2"
    
    # Header
    local header='{"alg":"HS256","typ":"JWT"}'
    local header_base64=$(echo -n "$header" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
    
    # Payload
    local payload_base64=$(echo -n "$payload" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
    
    # Signature
    local signature=$(echo -n "${header_base64}.${payload_base64}" | openssl dgst -sha256 -hmac "$secret" -binary | base64 -w 0 | tr '+/' '-_' | tr -d '=')
    
    echo "${header_base64}.${payload_base64}.${signature}"
}

ANON_KEY=$(create_jwt "$ANON_PAYLOAD" "$JWT_SECRET")
SERVICE_ROLE_KEY=$(create_jwt "$SERVICE_PAYLOAD" "$JWT_SECRET")

# Генерация пароля PostgreSQL
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')

echo ""
echo "=========================================="
echo "  СОХРАНИТЕ ЭТИ КЛЮЧИ В .env.supabase"
echo "=========================================="
echo ""
echo "JWT_SECRET=${JWT_SECRET}"
echo ""
echo "ANON_KEY=${ANON_KEY}"
echo ""
echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
echo ""
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo ""
echo "=========================================="
echo ""
echo "Для приложения Next.js (.env.local):"
echo "NEXT_PUBLIC_SUPABASE_URL=https://crm-kostroma.ru"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}"
echo "SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
echo ""
