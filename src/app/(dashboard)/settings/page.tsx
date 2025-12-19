'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Plus, Pencil, Trash2, GripVertical, Settings2, Percent, Columns3, Palette, Bot, Key, Webhook, Copy, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Column {
  id: string
  name: string
  position: number
  color: string | null
  is_success: boolean
}

interface Settings {
  executors_percent: number
  managers_percent: number
}

interface AISettings {
  id?: string
  openrouter_api_key: string
  transcription_api_key: string
  selected_model: string
  transcription_model: string
  temperature: number
  auto_process_webhooks: boolean
  auto_transcribe_calls: boolean
  system_prompt: string
}

interface WebhookSetting {
  id: string
  user_id: string
  webhook_type: 'novofon' | 'site' | 'email'
  webhook_url: string
  is_active: boolean
}

const COLUMN_COLORS = [
  { name: 'Серый', value: '#6b7280' },
  { name: 'Красный', value: '#ef4444' },
  { name: 'Оранжевый', value: '#f97316' },
  { name: 'Жёлтый', value: '#eab308' },
  { name: 'Зелёный', value: '#22c55e' },
  { name: 'Синий', value: '#3b82f6' },
  { name: 'Фиолетовый', value: '#8b5cf6' },
  { name: 'Розовый', value: '#ec4899' },
]

const AI_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o (Рекомендуется)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Быстрая)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (Быстрая)' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
]

const WHISPER_MODELS = [
  { id: 'openai/whisper-large-v3', name: 'Whisper Large V3 (Рекомендуется)' },
  { id: 'openai/whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo (Быстрая)' },
  { id: 'openai/whisper-1', name: 'Whisper V1' },
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [columns, setColumns] = useState<Column[]>([])
  const [settings, setSettings] = useState<Settings>({ executors_percent: 40, managers_percent: 10 })
  const [aiSettings, setAISettings] = useState<AISettings>({
    openrouter_api_key: '',
    transcription_api_key: '',
    selected_model: 'openai/gpt-4o-mini',
    transcription_model: 'openai/whisper-large-v3',
    temperature: 0.7,
    auto_process_webhooks: true,
    auto_transcribe_calls: false,
    system_prompt: `Ты - ассистент CRM системы клининговой компании.
Твоя задача - извлечь из текста заявки структурированные данные.

ВАЖНО: Текущая дата и время будет добавлено автоматически.

Извлеки следующие поля:
- client_name (имя клиента)
- client_phone (телефон в формате +7XXXXXXXXXX)
- address (полный адрес с улицей и номером)
- scheduled_at (дата в ISO формате: YYYY-MM-DDTHH:MM:SS)
- price (стоимость в рублях, только число)
- cleaning_type (тип уборки)

Верни ТОЛЬКО JSON без комментариев.`
  })
  const [webhookSettings, setWebhookSettings] = useState<WebhookSetting[]>([])
  const [copiedWebhook, setCopiedWebhook] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('salary')
  
  // Column dialog
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [deleteColumnDialogOpen, setDeleteColumnDialogOpen] = useState(false)
  const [selectedColumn, setSelectedColumn] = useState<Column | null>(null)
  const [columnForm, setColumnForm] = useState({ name: '', color: '#6b7280', is_success: false })

  const supabase = createClient()
  const router = useRouter()

  const checkAccess = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return false
    }

    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single()

    const hasAdmin = profile?.roles?.includes('admin')
    setIsAdmin(hasAdmin || false)
    
    if (!hasAdmin) {
      router.push('/dashboard')
      return false
    }
    
    return true
  }, [supabase, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Загружаем колонки
      const { data: columnsData } = await supabase
        .from('columns')
        .select('*')
        .order('position')
      
      setColumns(columnsData || [])

      // Загружаем настройки
      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')

      const settingsMap: Settings = { executors_percent: 40, managers_percent: 10 }
      settingsData?.forEach(s => {
        if (s.key === 'executors_percent') settingsMap.executors_percent = s.value as number
        if (s.key === 'managers_percent') settingsMap.managers_percent = s.value as number
      })
      setSettings(settingsMap)

      // Загружаем настройки AI
      const { data: aiData } = await supabase
        .from('ai_settings')
        .select('*')
        .single()

      if (aiData) {
        setAISettings({
          id: aiData.id,
          openrouter_api_key: aiData.openrouter_api_key || '',
          transcription_api_key: aiData.transcription_api_key || '',
          selected_model: aiData.selected_model || 'openai/gpt-4o-mini',
          transcription_model: aiData.transcription_model || 'openai/whisper-large-v3',
          temperature: aiData.temperature || 0.7,
          auto_process_webhooks: aiData.auto_process_webhooks ?? true,
          auto_transcribe_calls: aiData.auto_transcribe_calls ?? false,
          system_prompt: aiData.system_prompt || aiSettings.system_prompt
        })
      }

      // Загружаем webhook настройки
      const { data: webhooksData } = await supabase
        .from('webhook_settings')
        .select('*')
        .eq('user_id', currentUserId)
        .order('webhook_type')

      setWebhookSettings(webhooksData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, currentUserId])

  useEffect(() => {
    checkAccess().then(hasAccess => {
      if (hasAccess) {
        loadData()
      }
    })
  }, [checkAccess, loadData])

  // Settings handlers
  async function saveSettings() {
    setSaving(true)
    try {
      // Upsert each setting
      await supabase
        .from('settings')
        .upsert([
          { key: 'executors_percent', value: settings.executors_percent },
          { key: 'managers_percent', value: settings.managers_percent }
        ], { onConflict: 'key' })

      toast.success('Настройки зарплат сохранены')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  // AI Settings handlers
  async function saveAISettings() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('ai_settings')
        .upsert({
          id: aiSettings.id || undefined,
          openrouter_api_key: aiSettings.openrouter_api_key,
          transcription_api_key: aiSettings.transcription_api_key,
          selected_model: aiSettings.selected_model,
          transcription_model: aiSettings.transcription_model,
          temperature: aiSettings.temperature,
          auto_process_webhooks: aiSettings.auto_process_webhooks,
          auto_transcribe_calls: aiSettings.auto_transcribe_calls,
          system_prompt: aiSettings.system_prompt
        })

      if (error) throw error

      toast.success('Настройки AI сохранены')
      loadData()
    } catch (error) {
      console.error('Error saving AI settings:', error)
      toast.error('Ошибка сохранения настроек AI')
    } finally {
      setSaving(false)
    }
  }

  async function testAIConnection() {
    if (!aiSettings.openrouter_api_key) {
      toast.error('Введите API ключ OpenRouter')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: aiSettings.openrouter_api_key,
          model: aiSettings.selected_model
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('✅ Подключение к AI успешно!', {
          description: `Модель: ${data.model}`
        })
      } else {
        toast.error('Ошибка подключения к AI', {
          description: data.error
        })
      }
    } catch (error) {
      console.error('Error testing AI:', error)
      toast.error('Ошибка тестирования AI')
    } finally {
      setSaving(false)
    }
  }

  // Column handlers
  function openCreateColumnDialog() {
    setSelectedColumn(null)
    setColumnForm({ name: '', color: '#6b7280', is_success: false })
    setColumnDialogOpen(true)
  }

  function openEditColumnDialog(column: Column) {
    setSelectedColumn(column)
    setColumnForm({
      name: column.name,
      color: column.color || '#6b7280',
      is_success: column.is_success
    })
    setColumnDialogOpen(true)
  }

  function openDeleteColumnDialog(column: Column) {
    setSelectedColumn(column)
    setDeleteColumnDialogOpen(true)
  }

  async function handleSaveColumn() {
    if (!columnForm.name) return

    setSaving(true)
    try {
      if (selectedColumn) {
        // Update
        await supabase
          .from('columns')
          .update({
            name: columnForm.name,
            color: columnForm.color,
            is_success: columnForm.is_success
          })
          .eq('id', selectedColumn.id)
      } else {
        // Create
        const maxPosition = Math.max(0, ...columns.map(c => c.position))
        await supabase
          .from('columns')
          .insert({
            name: columnForm.name,
            color: columnForm.color,
            is_success: columnForm.is_success,
            position: maxPosition + 1
          })
      }

      setColumnDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Error saving column:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteColumn() {
    if (!selectedColumn) return

    setSaving(true)
    try {
      await supabase
        .from('columns')
        .delete()
        .eq('id', selectedColumn.id)

      setDeleteColumnDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Error deleting column:', error)
    } finally {
      setSaving(false)
    }
  }

  async function moveColumn(columnId: string, direction: 'up' | 'down') {
    const index = columns.findIndex(c => c.id === columnId)
    if (index === -1) return
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= columns.length) return

    const currentColumn = columns[index]
    const targetColumn = columns[newIndex]

    try {
      // Swap positions
      await Promise.all([
        supabase
          .from('columns')
          .update({ position: targetColumn.position })
          .eq('id', currentColumn.id),
        supabase
          .from('columns')
          .update({ position: currentColumn.position })
          .eq('id', targetColumn.id)
      ])

      loadData()
    } catch (error) {
      console.error('Error moving column:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-muted-foreground">Управление системными параметрами</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="salary" className="gap-2">
            <Percent className="h-4 w-4" />
            Зарплаты
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Интеграции
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="columns" className="gap-2">
            <Columns3 className="h-4 w-4" />
            Колонки канбана
          </TabsTrigger>
        </TabsList>

        {/* Salary Settings */}
        <TabsContent value="salary">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Настройки расчёта зарплат
              </CardTitle>
              <CardDescription>
                Глобальные проценты для автоматического расчёта зарплат при завершении сделки
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="executors_percent">% исполнителям от суммы сделки</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="executors_percent"
                      type="number"
                      min="0"
                      max="100"
                      value={settings.executors_percent}
                      onChange={(e) => setSettings({ ...settings, executors_percent: Number(e.target.value) })}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Эта сумма распределяется между всеми исполнителями сделки
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managers_percent">% менеджерам от суммы сделки</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="managers_percent"
                      type="number"
                      min="0"
                      max="100"
                      value={settings.managers_percent}
                      onChange={(e) => setSettings({ ...settings, managers_percent: Number(e.target.value) })}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Можно переопределить для каждого менеджера в его профиле
                  </p>
                </div>
              </div>

              <Separator />

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Пример расчёта</h4>
                <p className="text-sm text-muted-foreground">
                  При сделке на <strong>10 000 ₽</strong>:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Исполнителям: {(10000 * settings.executors_percent / 100).toFixed(0)} ₽ ({settings.executors_percent}%)</li>
                  <li>• Менеджеру: {(10000 * settings.managers_percent / 100).toFixed(0)} ₽ ({settings.managers_percent}%)</li>
                  <li>• Компании: {(10000 * (100 - settings.executors_percent - settings.managers_percent) / 100).toFixed(0)} ₽ ({100 - settings.executors_percent - settings.managers_percent}%)</li>
                </ul>
              </div>

              <Button onClick={saveSettings} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook/Integration Settings */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks интеграций
              </CardTitle>
              <CardDescription>
                Персональные URL для приёма заявок с разных источников
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Novofon */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      📞 Novofon (телефония)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Автоматическое создание заявок из входящих звонков через polling
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Polling</Badge>
                </div>
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs space-y-2">
                    <p className="font-medium">✅ Работает на localhost без публичного URL!</p>
                    <p className="text-muted-foreground">
                      Используется polling (опрос API каждые 2 минуты) вместо webhooks
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Статус поллера:</Label>
                    <div className="flex items-center justify-between p-3 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-sm">Для запуска используйте команду ниже</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Запуск поллера:</Label>
                    <div className="flex gap-2">
                      <Input
                        value="npx tsx src/scripts/start-novofon-poller.ts"
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText('npx tsx src/scripts/start-novofon-poller.ts')
                          setCopiedWebhook('novofon-cmd')
                          toast.success('Команда скопирована')
                          setTimeout(() => setCopiedWebhook(''), 2000)
                        }}
                      >
                        {copiedWebhook === 'novofon-cmd' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Настройка (.env.local):</p>
                    <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                      <li>Заполните <code className="bg-muted px-1 rounded">NOVOFON_APP_ID</code> и <code className="bg-muted px-1 rounded">NOVOFON_SECRET</code></li>
                      <li>Укажите внутренние номера в <code className="bg-muted px-1 rounded">NOVOFON_INTERNALS</code> (например: 100,101,102)</li>
                      <li>Привяжите внутренние номера к менеджерам в БД</li>
                      <li>Запустите поллер командой выше</li>
                    </ol>
                    <p className="text-xs text-primary hover:underline cursor-pointer mt-2" onClick={() => window.open('/TEST-NOVOFON.md', '_blank')}>
                      📖 Подробная инструкция по настройке →
                    </p>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded text-xs">
                    <p className="font-medium mb-1">⏱️ Задержка обработки:</p>
                    <p className="text-muted-foreground">Звонки обрабатываются с задержкой 2-5 минут (время опроса API)</p>
                  </div>
                </div>
              </div>

              {/* Site Form */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      🌐 Форма с сайта
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Приём заявок с форм обратной связи на сайте
                    </p>
                  </div>
                  <Badge variant="outline">Активен</Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Ваш webhook URL:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/site?user_id=${currentUserId}`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const url = `${window.location.origin}/api/webhooks/site?user_id=${currentUserId}`
                        navigator.clipboard.writeText(url)
                        setCopiedWebhook('site')
                        toast.success('Webhook URL скопирован')
                        setTimeout(() => setCopiedWebhook(''), 2000)
                      }}
                    >
                      {copiedWebhook === 'site' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 mt-2">
                    <p className="font-medium">Пример кода формы:</p>
                    <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
{`fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/site?user_id=${currentUserId}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Имя, телефон, адрес...' })
})`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      📧 Email
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Обработка заявок из почтовых ящиков
                    </p>
                  </div>
                  <Badge variant="outline">Активен</Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Ваш webhook URL:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/email?user_id=${currentUserId}`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const url = `${window.location.origin}/api/webhooks/email?user_id=${currentUserId}`
                        navigator.clipboard.writeText(url)
                        setCopiedWebhook('email')
                        toast.success('Webhook URL скопирован')
                        setTimeout(() => setCopiedWebhook(''), 2000)
                      }}
                    >
                      {copiedWebhook === 'email' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Настройте пересылку писем на этот webhook через сервис email-to-webhook
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">ℹ️ Как это работает</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Каждый webhook привязан к вашему аккаунту через <code>user_id</code></li>
                  <li>• При получении заявки автоматически создаётся сделка в колонке "Новые"</li>
                  <li>• AI извлекает информацию (имя, телефон, адрес) и заполняет поля</li>
                  <li>• Вы получаете уведомление о новой заявке в реальном времени</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Настройки AI
              </CardTitle>
              <CardDescription>
                Подключение OpenRouter для автоматической обработки заявок и звонков
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* API Key for requests processing */}
                <div className="space-y-2">
                  <Label htmlFor="openrouter_key" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    OpenRouter API Key (для обработки заявок)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="openrouter_key"
                      type="password"
                      placeholder="sk-or-v1-..."
                      value={aiSettings.openrouter_api_key}
                      onChange={(e) => setAISettings({ ...aiSettings, openrouter_api_key: e.target.value })}
                      className="font-mono"
                    />
                    <Button 
                      variant="outline" 
                      onClick={testAIConnection}
                      disabled={saving || !aiSettings.openrouter_api_key}
                    >
                      Проверить
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ключ для AI обработки входящих заявок и данных клиентов
                  </p>
                </div>

                {/* API Key for transcription */}
                <div className="space-y-2">
                  <Label htmlFor="transcription_key" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    OpenRouter API Key (для расшифровки звонков)
                  </Label>
                  <Input
                    id="transcription_key"
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={aiSettings.transcription_api_key}
                    onChange={(e) => setAISettings({ ...aiSettings, transcription_api_key: e.target.value })}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Отдельный ключ для транскрипции записей звонков через Whisper. Получить на <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">openrouter.ai/keys</a>
                  </p>
                </div>

                <Separator />

                {/* System Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="system_prompt">System Prompt (инструкция для AI)</Label>
                  <Textarea
                    id="system_prompt"
                    value={aiSettings.system_prompt}
                    onChange={(e) => setAISettings({ ...aiSettings, system_prompt: e.target.value })}
                    rows={10}
                    className="font-mono text-xs"
                    placeholder="Введите инструкцию для AI..."
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Совет: В промпт автоматически добавляется текущая дата и время. Используйте переменные:
                    <code className="ml-1">{'${currentDate}'}</code> и <code>{'${currentTime}'}</code>
                  </p>
                </div>

                <Separator />

                {/* Model Selection */}
                <div className="space-y-2">
                  <Label htmlFor="ai_model">Модель AI (для обработки заявок)</Label>
                  <Select
                    value={aiSettings.selected_model}
                    onValueChange={(value) => setAISettings({ ...aiSettings, selected_model: value })}
                  >
                    <SelectTrigger id="ai_model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Рекомендуется GPT-4o Mini для баланса скорости и качества
                  </p>
                </div>

                {/* Whisper Model Selection */}
                <div className="space-y-2">
                  <Label htmlFor="whisper_model">Модель Whisper (для расшифровки звонков)</Label>
                  <Select
                    value={aiSettings.transcription_model}
                    onValueChange={(value) => setAISettings({ ...aiSettings, transcription_model: value })}
                  >
                    <SelectTrigger id="whisper_model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WHISPER_MODELS.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Whisper Large V3 обеспечивает лучшее качество транскрипции на русском языке
                  </p>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Температура (креативность): {aiSettings.temperature}
                  </Label>
                  <Input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={aiSettings.temperature}
                    onChange={(e) => setAISettings({ ...aiSettings, temperature: Number(e.target.value) })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Точная (0)</span>
                    <span>Креативная (2)</span>
                  </div>
                </div>

                <Separator />

                {/* Auto Processing Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium">Автоматическая обработка</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto_webhooks">Автозаполнение при webhook</Label>
                      <p className="text-xs text-muted-foreground">
                        Автоматически парсить поля при поступлении заявок с сайта/email
                      </p>
                    </div>
                    <Switch
                      id="auto_webhooks"
                      checked={aiSettings.auto_process_webhooks}
                      onCheckedChange={(checked) => setAISettings({ ...aiSettings, auto_process_webhooks: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto_transcribe">Транскрипция звонков</Label>
                      <p className="text-xs text-muted-foreground">
                        Автоматически расшифровывать аудио звонков (требует URL записи)
                      </p>
                    </div>
                    <Switch
                      id="auto_transcribe"
                      checked={aiSettings.auto_transcribe_calls}
                      onCheckedChange={(checked) => setAISettings({ ...aiSettings, auto_transcribe_calls: checked })}
                    />
                  </div>
                </div>

                <Separator />

                {/* Info */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Возможности AI:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✅ Автоматическое извлечение имени, телефона, email из текста</li>
                    <li>✅ Определение суммы сделки и описания услуги</li>
                    <li>✅ Расшифровка аудио записей звонков</li>
                    <li>✅ Генерация кратких описаний заявок</li>
                    <li>📊 Анализ настроения клиента (скоро)</li>
                    <li>💬 Генерация ответов клиентам (скоро)</li>
                  </ul>
                </div>

                <Button onClick={saveAISettings} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить настройки AI'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kanban Columns */}
        <TabsContent value="columns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Columns3 className="h-5 w-5" />
                  Колонки канбан-доски
                </CardTitle>
                <CardDescription>
                  Управление этапами воронки продаж
                </CardDescription>
              </div>
              <Button onClick={openCreateColumnDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить колонку
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">№</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Цвет</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columns.map((column, index) => (
                    <TableRow key={column.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{column.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: column.color || '#6b7280' }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {COLUMN_COLORS.find(c => c.value === column.color)?.name || 'Кастомный'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {column.is_success ? (
                          <Badge variant="default" className="bg-green-600">Оплачено</Badge>
                        ) : (
                          <Badge variant="secondary">Обычная</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveColumn(column.id, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveColumn(column.id, 'down')}
                            disabled={index === columns.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditColumnDialog(column)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteColumnDialog(column)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {columns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Нет колонок. Нажмите «Добавить колонку» чтобы создать первую.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Column Dialog */}
      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedColumn ? 'Редактировать колонку' : 'Новая колонка'}
            </DialogTitle>
            <DialogDescription>
              {selectedColumn ? 'Измените параметры колонки' : 'Создайте новый этап воронки'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="column_name">Название *</Label>
              <Input
                id="column_name"
                placeholder="Например: В работе"
                value={columnForm.name}
                onChange={(e) => setColumnForm({ ...columnForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      columnForm.color === color.value 
                        ? 'border-primary scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setColumnForm({ ...columnForm, color: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_success">Колонка «Оплачено»</Label>
                <p className="text-xs text-muted-foreground">
                  При перемещении сделки сюда рассчитается зарплата
                </p>
              </div>
              <Switch
                id="is_success"
                checked={columnForm.is_success}
                onCheckedChange={(checked) => setColumnForm({ ...columnForm, is_success: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setColumnDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveColumn} disabled={saving || !columnForm.name}>
              {saving ? 'Сохранение...' : selectedColumn ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Dialog */}
      <Dialog open={deleteColumnDialogOpen} onOpenChange={setDeleteColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить колонку?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить колонку «{selectedColumn?.name}»? 
              Все сделки в этой колонке будут потеряны. Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteColumnDialogOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDeleteColumn} disabled={saving}>
              {saving ? 'Удаление...' : 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
