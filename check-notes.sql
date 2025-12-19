SELECT substring(notes, 1, 200) as notes_preview 
FROM deals 
WHERE client_phone = '79001122334' 
LIMIT 1;
