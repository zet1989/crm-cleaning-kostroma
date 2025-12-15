-- Create identity for admin user
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT 
    id,
    id,
    email,
    jsonb_build_object('sub', id::text, 'email', email),
    'email',
    now(),
    now(),
    now()
FROM auth.users 
WHERE email = 'admin@crm-kostroma.ru'
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Mark migration as applied
INSERT INTO auth.schema_migrations (version)
VALUES ('20221125140132')
ON CONFLICT DO NOTHING;
