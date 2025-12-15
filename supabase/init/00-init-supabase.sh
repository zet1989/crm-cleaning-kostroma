#!/bin/bash
set -e

# Create required roles for Supabase services
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create extensions schema
    CREATE SCHEMA IF NOT EXISTS extensions;
    
    -- Create extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;

    -- Create anon role
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
      END IF;
    END
    \$\$;

    -- Create authenticated role  
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
      END IF;
    END
    \$\$;

    -- Create service_role
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
      END IF;
    END
    \$\$;

    -- Create supabase_auth_admin for GoTrue
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}' NOINHERIT CREATEROLE CREATEDB;
      END IF;
    END
    \$\$;

    -- Create supabase_storage_admin for Storage
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}' NOINHERIT;
      END IF;
    END
    \$\$;

    -- Create authenticator role for PostgREST
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator LOGIN PASSWORD '${POSTGRES_PASSWORD}' NOINHERIT;
      END IF;
    END
    \$\$;

    -- Create supabase_admin
    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}' SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS;
      END IF;
    END
    \$\$;

    -- Grant roles to authenticator
    GRANT anon TO authenticator;
    GRANT authenticated TO authenticator;
    GRANT service_role TO authenticator;

    -- Grant roles to supabase_auth_admin
    GRANT anon TO supabase_auth_admin;
    GRANT authenticated TO supabase_auth_admin;

    -- Create auth schema
    CREATE SCHEMA IF NOT EXISTS auth;
    GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
    GRANT USAGE ON SCHEMA auth TO postgres;
    GRANT USAGE ON SCHEMA auth TO anon;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT USAGE ON SCHEMA auth TO service_role;

    -- Create storage schema
    CREATE SCHEMA IF NOT EXISTS storage;
    GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
    GRANT USAGE ON SCHEMA storage TO postgres;
    GRANT USAGE ON SCHEMA storage TO anon;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT USAGE ON SCHEMA storage TO service_role;

    -- Create realtime schema
    CREATE SCHEMA IF NOT EXISTS realtime;
    GRANT USAGE ON SCHEMA realtime TO postgres;
    GRANT USAGE ON SCHEMA realtime TO anon;
    GRANT USAGE ON SCHEMA realtime TO authenticated;
    GRANT USAGE ON SCHEMA realtime TO service_role;

    -- Grant extensions schema access
    GRANT USAGE ON SCHEMA extensions TO postgres;
    GRANT USAGE ON SCHEMA extensions TO anon;
    GRANT USAGE ON SCHEMA extensions TO authenticated;
    GRANT USAGE ON SCHEMA extensions TO service_role;

    -- Grant public schema access
    GRANT USAGE ON SCHEMA public TO anon;
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA public TO service_role;

    -- Default privileges for public schema
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
EOSQL

echo "Supabase roles and schemas created successfully!"
