'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/supabase/database.types'
import { SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { 
  LayoutDashboard, 
  Kanban, 
  BarChart3, 
  Users, 
  Phone, 
  Settings,
  UserCog
} from 'lucide-react'

interface MobileSidebarProps {
  profile: Profile | null
}

const navigation = [
  { name: 'Обзор', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Канбан', href: '/kanban', icon: Kanban },
  { name: 'Аналитика', href: '/analytics', icon: BarChart3, adminOnly: false, analyticsRequired: true },
  { name: 'Исполнители', href: '/executors', icon: Users, adminOnly: true },
  { name: 'Звонки', href: '/calls', icon: Phone },
  { name: 'Менеджеры', href: '/managers', icon: UserCog, adminOnly: true },
  { name: 'Настройки', href: '/settings', icon: Settings, adminOnly: true },
]

export function MobileSidebar({ profile }: MobileSidebarProps) {
  const pathname = usePathname()
  
  const isAdmin = profile?.roles?.includes('admin')
  const canViewAnalytics = profile?.can_view_analytics || isAdmin

  const filteredNavigation = navigation.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    if (item.analyticsRequired && !canViewAnalytics) return false
    return true
  })

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="p-6 border-b">
        <SheetTitle className="flex items-center gap-2">
          <span className="text-2xl">🧹</span>
          <span>CRM Клининг</span>
        </SheetTitle>
      </SheetHeader>

      <nav className="flex-1 space-y-1 p-4">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium">
              {profile?.full_name?.[0] || profile?.email?.[0] || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {profile?.full_name || 'Пользователь'}
            </p>
            <p className="text-xs text-muted-foreground">
              {profile?.roles?.includes('admin') ? 'Администратор' : 'Менеджер'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
