SELECT client_name, client_phone, substring(notes, 1, 80) as notes_short 
FROM deals 
WHERE client_phone = '79001122334' 
ORDER BY created_at DESC 
LIMIT 1;
