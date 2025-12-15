#!/bin/bash
ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzM0MjYwODAwLCJleHAiOjE4OTE5NDA4MDB9.eFKp2_IZf2FFM9JnXzH3gITwGpC2Cx0nNfWO3bpI_i0'

echo "Testing auth health..."
curl -s -H "apikey: $ANON_KEY" http://localhost:8000/auth/v1/health
echo ""

echo "Testing login..."
curl -s -X POST "http://localhost:8000/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"email":"admin@crm-kostroma.ru","password":"admin123"}'
echo ""
