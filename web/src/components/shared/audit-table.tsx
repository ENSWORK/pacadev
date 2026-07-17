'use client'

import { useState, useMemo } from 'react'
import { Search, Download, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type { AuditLog } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AuditTableProps {
  logs: AuditLog[]
  filters?: object
}

const ITEMS_PER_PAGE = 8

const actionColors: Record<string, string> = {
  deploy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rollback: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  backup: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  acknowledge_alert: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ai_config: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  approve: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

const uniqueActions = (logs: AuditLog[]) => {
  const actions = [...new Set(logs.map((l) => l.action))]
  return actions.sort()
}

const uniqueClients = (logs: AuditLog[]) => {
  const clients = [...new Set(logs.map((l) => l.client).filter(Boolean))] as string[]
  return clients.sort()
}

function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function exportToCSV(logs: AuditLog[]) {
  const headers = ['Utilisateur', 'Action', 'Client', 'Détails', 'Motif', 'Date']
  const rows = logs.map((l) => [
    l.user,
    l.action,
    l.client ?? '',
    l.details ?? '',
    l.reason ?? '',
    typeof l.createdAt === 'string' ? l.createdAt : l.createdAt.toISOString(),
  ])
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AuditTable({ logs }: AuditTableProps) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const actions = useMemo(() => uniqueActions(logs), [logs])
  const clients = useMemo(() => uniqueClients(logs), [logs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase()
        const matchesSearch =
          log.user.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          (log.client?.toLowerCase().includes(q) ?? false) ||
          (log.details?.toLowerCase().includes(q) ?? false) ||
          (log.reason?.toLowerCase().includes(q) ?? false)
        if (!matchesSearch) return false
      }

      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false

      // Client filter
      if (clientFilter !== 'all' && log.client !== clientFilter) return false

      return true
    })
  }, [logs, search, actionFilter, clientFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredLogs, safeCurrentPage])

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleActionFilterChange = (value: string) => {
    setActionFilter(value)
    setCurrentPage(1)
  }

  const handleClientFilterChange = (value: string) => {
    setClientFilter(value)
    setCurrentPage(1)
  }

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les logs..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={handleActionFilterChange}>
            <SelectTrigger size="sm" className="w-[140px]">
              <Filter className="size-3.5 mr-1" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={handleClientFilterChange}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => exportToCSV(filteredLogs)}
        >
          <Download className="size-3.5" />
          Exporter CSV
        </Button>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {filteredLogs.length} entrée{filteredLogs.length !== 1 ? 's' : ''} trouvée{filteredLogs.length !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Utilisateur</TableHead>
              <TableHead className="w-[110px]">Action</TableHead>
              <TableHead className="hidden md:table-cell w-[100px]">Client</TableHead>
              <TableHead className="hidden lg:table-cell">Détails</TableHead>
              <TableHead className="hidden xl:table-cell w-[140px]">Motif</TableHead>
              <TableHead className="w-[130px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Aucune entrée trouvée
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium text-xs">
                    <div className="truncate">{log.user}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] px-1.5 py-0 h-5',
                        actionColors[log.action] ?? 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300',
                      )}
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs">
                    <div className="truncate">{log.client ?? '—'}</div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">
                    <div className="truncate">{log.details ?? '—'}</div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs">
                    <div className="truncate">{log.reason ?? '—'}</div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((p) => Math.max(1, p - 1))
                }}
                className={cn(safeCurrentPage <= 1 && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
            {getPageNumbers().map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPage(page)
                  }}
                  isActive={page === safeCurrentPage}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }}
                className={cn(safeCurrentPage >= totalPages && 'pointer-events-none opacity-50')}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
