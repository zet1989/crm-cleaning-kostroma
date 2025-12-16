#!/bin/bash
ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzM0MjYwODAwLCJleHAiOjE4OTE5NDA4MDB9.eFKp2_IZf2FFM9JnXzH3gITwGpC2Cx0nNfWO3bpI_i0'

# Get access token
echo "Getting access token..."
TOKEN_RESPONSE=$(curl -s -X POST "http://localhost:8000/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"email":"admin@crm-kostroma.ru","password":"admin123"}')

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

echo "Access Token: ${ACCESS_TOKEN:0:50}..."

echo ""
echo "Testing columns..."
curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:8000/rest/v1/columns

echo ""
echo "Testing profiles..."
curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:8000/rest/v1/profiles
