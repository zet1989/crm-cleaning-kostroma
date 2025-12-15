-- Fix null fields for admin user
UPDATE auth.users SET
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    phone = '',
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    recovery_token = ''
WHERE email = 'admin@crm-kostroma.ru';
