<#
.SYNOPSIS
    Настройка webhook для Novofon АТС

.DESCRIPTION
    Автоматически настраивает webhook для конкретного внутреннего номера АТС.
    Поддерживает несколько CRM под одним аккаунтом Novofon.

.EXAMPLE
    .\setup-novofon-webhook.ps1
#>

# === НАСТРОЙКИ ===
$NOVOFON_KEY = "appid_1834174"  # Замените на ваш Key из Novofon
$NOVOFON_SECRET = "YOUR_SECRET_HERE"  # Замените на ваш Secret
$WEBHOOK_URL = "https://your-domain.com/api/webhooks/novofon?user_id=YOUR_USER_ID"  # URL из CRM
$INTERNAL_NUMBER = "100"  # Внутренний номер АТС (100, 101, 102...)

# === ФУНКЦИИ ===

function Get-NovofonSignature {
    <#
    .SYNOPSIS
        Создаёт подпись для авторизации в Novofon API
    #>
    param(
        [string]$method,
        [hashtable]$params,
        [string]$secret
    )
    
    # Сортируем параметры по алфавиту
    $sortedParams = $params.GetEnumerator() | Sort-Object Name
    $queryString = ($sortedParams | ForEach-Object { 
        "$($_.Name)=$($_.Value)" 
    }) -join '&'
    
    # MD5 от строки параметров
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $md5Hash = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($queryString))
    $md5String = [System.BitConverter]::ToString($md5Hash).Replace("-", "").ToLower()
    
    # Строка для подписи: метод + параметры + MD5(параметры)
    $signString = $method + $queryString + $md5String
    
    # HMAC SHA1 с секретным ключом
    $hmac = New-Object System.Security.Cryptography.HMACSHA1
    $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($signString))
    
    # Base64
    return [Convert]::ToBase64String($hash)
}

function Set-NovofonWebhook {
    <#
    .SYNOPSIS
        Настраивает webhook для внутреннего номера
    #>
    param(
        [string]$InternalNumber,
        [string]$WebhookUrl,
        [string]$Events = "NOTIFY_END,NOTIFY_RECORD"
    )
    
    Write-Host "`n🔧 Настройка webhook для номера $InternalNumber..." -ForegroundColor Cyan
    Write-Host "   URL: $WebhookUrl" -ForegroundColor Gray
    Write-Host "   События: $Events" -ForegroundColor Gray
    
    $method = "/v1/pbx/internal/$InternalNumber/notify/"
    $params = @{
        url = $WebhookUrl
        events = $Events
    }
    
    try {
        $signature = Get-NovofonSignature -method $method -params $params -secret $NOVOFON_SECRET
        $authHeader = "${NOVOFON_KEY}:${signature}"
        
        $response = Invoke-RestMethod -Uri "https://api.novofon.com$method" `
            -Method Post `
            -Headers @{
                "Authorization" = $authHeader
                "Content-Type" = "application/x-www-form-urlencoded"
            } `
            -Body $params `
            -ErrorAction Stop
        
        if ($response.status -eq "success") {
            Write-Host "✅ Webhook успешно настроен!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Ошибка: $($response.message)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Ошибка запроса: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Get-NovofonInternalNumbers {
    <#
    .SYNOPSIS
        Получает список внутренних номеров АТС
    #>
    
    Write-Host "`n📋 Получение списка внутренних номеров..." -ForegroundColor Cyan
    
    $method = "/v1/pbx/internal/"
    $params = @{}
    
    try {
        $signature = Get-NovofonSignature -method $method -params $params -secret $NOVOFON_SECRET
        $authHeader = "${NOVOFON_KEY}:${signature}"
        
        $response = Invoke-RestMethod -Uri "https://api.novofon.com$method" `
            -Method Get `
            -Headers @{ "Authorization" = $authHeader } `
            -ErrorAction Stop
        
        if ($response.status -eq "success") {
            Write-Host "✅ Найдено номеров: $($response.numbers.Count)" -ForegroundColor Green
            $response.numbers | ForEach-Object {
                Write-Host "   - Номер: $_" -ForegroundColor Yellow
            }
            return $response.numbers
        } else {
            Write-Host "❌ Ошибка: $($response.message)" -ForegroundColor Red
            return @()
        }
    }
    catch {
        Write-Host "❌ Ошибка запроса: $($_.Exception.Message)" -ForegroundColor Red
        return @()
    }
}

# === ГЛАВНАЯ ЛОГИКА ===

Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║     Настройка Webhook для Novofon                         ║
╚═══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

# Проверка настроек
if ($NOVOFON_SECRET -eq "YOUR_SECRET_HERE" -or $WEBHOOK_URL -like "*YOUR_USER_ID*") {
    Write-Host "⚠️  ВНИМАНИЕ: Не забудьте заменить настройки в начале скрипта!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Необходимо указать:" -ForegroundColor White
    Write-Host "  - NOVOFON_KEY (ваш appid_xxx)" -ForegroundColor Gray
    Write-Host "  - NOVOFON_SECRET (секретный ключ)" -ForegroundColor Gray
    Write-Host "  - WEBHOOK_URL (URL из CRM → Настройки → Интеграции)" -ForegroundColor Gray
    Write-Host "  - INTERNAL_NUMBER (внутренний номер АТС: 100, 101...)" -ForegroundColor Gray
    Write-Host ""
    
    $continue = Read-Host "Продолжить со стандартными настройками? (y/N)"
    if ($continue -ne "y") {
        Write-Host "❌ Отменено" -ForegroundColor Red
        exit 1
    }
}

# Получаем список номеров
$numbers = Get-NovofonInternalNumbers

if ($numbers -and $numbers.Count -gt 0) {
    if ($numbers -notcontains $INTERNAL_NUMBER) {
        Write-Host ""
        Write-Host "⚠️  Номер $INTERNAL_NUMBER не найден в списке доступных номеров!" -ForegroundColor Yellow
        $continue = Read-Host "Продолжить настройку? (y/N)"
        if ($continue -ne "y") {
            Write-Host "❌ Отменено" -ForegroundColor Red
            exit 1
        }
    }
}

# Настраиваем webhook
$success = Set-NovofonWebhook -InternalNumber $INTERNAL_NUMBER -WebhookUrl $WEBHOOK_URL

if ($success) {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ ГОТОВО!                                               ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Теперь все звонки на внутренний номер $INTERNAL_NUMBER" -ForegroundColor White
    Write-Host "будут автоматически создавать заявки в вашей CRM!" -ForegroundColor White
    Write-Host ""
    Write-Host "📞 Сделайте тестовый звонок для проверки" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Не удалось настроить webhook" -ForegroundColor Red
    Write-Host ""
    Write-Host "Попробуйте:" -ForegroundColor Yellow
    Write-Host "  1. Проверить Key и Secret" -ForegroundColor Gray
    Write-Host "  2. Проверить что номер $INTERNAL_NUMBER существует" -ForegroundColor Gray
    Write-Host "  3. Обратиться в техподдержку Novofon" -ForegroundColor Gray
}

Write-Host ""
