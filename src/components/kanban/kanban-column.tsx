'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Column, Deal, Executor, Profile } from '@/lib/supabase/database.types'
import { DealCard } from './deal-card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Download, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExportDialog } from './export-dialog'

type DealWithRelations = Deal & {
  executor: Executor | null
  manager: Profile | null
}

interface KanbanColumnProps {
  column: Column
  deals: DealWithRelations[]
  onAddDeal: () => void
  onEditDeal: (deal: DealWithRelations) => void
}

export function KanbanColumn({ column, deals, onAddDeal, onEditDeal }: KanbanColumnProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
  })

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col w-80 bg-muted/50 rounded-lg transition-colors',
          isOver && 'bg-muted'
        )}
      >
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: column.color }}
            />
            <h3 className="font-medium">{column.name}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {deals.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Экспорт в CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAddDeal}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Cards */}
        <ScrollArea className="flex-1 p-2">
          <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 min-h-[100px]">
              {deals.map(deal => (
                <DealCard 
                  key={deal.id} 
                  deal={deal} 
                  onClick={() => onEditDeal(deal)}
                />
              ))}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        columnId={column.id}
        columnName={column.name}
      />
    </>
  )
}
