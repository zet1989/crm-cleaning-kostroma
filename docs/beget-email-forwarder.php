<?php
/**
 * Скрипт для Beget хостинга
 * Проверяет почту info@клининг-кострома.рф и отправляет письма в CRM
 * 
 * Установка:
 * 1. Загрузите этот файл на Beget
 * 2. Настройте cron: */5 * * * * php /path/to/beget-email-forwarder.php
 * 3. Укажите правильные данные IMAP и API ключ
 */

// Настройки
$imapServer = '{imap.beget.com:993/imap/ssl}INBOX';
$email = 'info@клининг-кострома.рф';
$password = 'ваш_пароль_от_почты';
$crmWebhook = 'https://crm-kostroma.ru/api/webhooks/email';
$apiKey = 'ваш_api_ключ'; // Установите в .env как WEBHOOK_API_KEY

// Подключение к почте
$inbox = imap_open($imapServer, $email, $password);

if (!$inbox) {
    die('Не удалось подключиться к почте: ' . imap_last_error());
}

// Получаем непрочитанные письма
$emails = imap_search($inbox, 'UNSEEN');

if ($emails) {
    foreach ($emails as $emailNumber) {
        $header = imap_headerinfo($inbox, $emailNumber);
        $body = imap_fetchbody($inbox, $emailNumber, 1);
        
        // Извлекаем данные
        $subject = isset($header->subject) ? $header->subject : '';
        $from = isset($header->from[0]) ? $header->from[0]->mailbox . '@' . $header->from[0]->host : '';
        
        // Простое извлечение телефона из текста (регулярка)
        preg_match('/(\+7|8)?[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/', $body, $phoneMatches);
        $phone = $phoneMatches[0] ?? '';
        
        // Извлекаем имя (ищем "Имя:" или первую строку)
        preg_match('/(?:Имя|Name|ФИО):\s*(.+)/i', $body, $nameMatches);
        $name = $nameMatches[1] ?? 'Клиент';
        
        // Отправляем в CRM
        $data = [
            'name' => trim($name),
            'phone' => $phone,
            'email' => $from,
            'subject' => $subject,
            'message' => $body
        ];
        
        $ch = curl_init($crmWebhook);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'x-api-key: ' . $apiKey
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode == 201) {
            // Помечаем письмо как прочитанное
            imap_setflag_full($inbox, $emailNumber, "\\Seen");
            echo "Письмо #{$emailNumber} обработано: {$subject}\n";
        } else {
            echo "Ошибка обработки письма #{$emailNumber}: HTTP {$httpCode}\n";
        }
    }
}

imap_close($inbox);
echo "Готово\n";
?>
