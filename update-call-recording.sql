UPDATE calls 
SET recording_url = 'https://my.novofon.ru/system/media/talk/284059926/6ad610811810962b0abb27814fc71fdc/' 
WHERE external_id = '284059926' 
RETURNING id, client_phone, recording_url;
