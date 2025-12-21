UPDATE auth.users SET encrypted_password = crypt('admin123', gen_salt('bf')) WHERE email = 'admin@crm-kostroma.ru';
