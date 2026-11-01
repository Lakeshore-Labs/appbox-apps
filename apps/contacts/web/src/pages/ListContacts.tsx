import { type MouseEvent, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRing, Building2, Plus, Search, Users, X } from 'lucide-react'
import { listContactsOptions, listNudgesOptions, searchContactsOptions } from '@/gen'
import type { Contact } from '@/gen'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ContentSection,
  DataGrid,
  DataGridColumnHeader,
  DataGridContainer,
  DataGridPagination,
  DataGridScrollArea,
  DataGridTable,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Link,
  Skeleton,
  StatusBadge,
  dataGridFeatures,
  useNavigate,
  useTable,
} from '@appbox/platform-web'
import type { ColumnDef } from '@appbox/platform-web'
import { ContactDialog, PersonAvatar, Refusal, ago } from '@/components/people'

export function ListContacts() {
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [adding, setAdding] = useState(false)
  const go = useNavigate()

  const found = useQuery({
    ...searchContactsOptions({ query: { q: q || undefined, tag: tag || undefined } }),
    placeholderData: (previous) => previous,
  })
  const all = useQuery(listContactsOptions())
  const nudges = useQuery(listNudgesOptions())

  const quiet = useMemo(() => new Set((nudges.data ?? []).map((n) => n.contactId.id)), [nudges.data])
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of all.data ?? []) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [all.data])
  const rows = found.data ?? []
  const filtered = q !== '' || tag !== ''
  const total = all.data?.length ?? 0

  const columns = useMemo<ColumnDef<typeof dataGridFeatures, Contact, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (c) => c.name.toLowerCase(),
        header: ({ column }) => <DataGridColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <PersonAvatar name={row.original.name} size="sm" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.name}</span>
              {row.original.email && (
                <span className="truncate text-xs text-muted-foreground">{row.original.email}</span>
              )}
            </div>
          </div>
        ),
        size: 280,
        meta: { fillWidth: true },
      },
      {
        id: 'company',
        accessorFn: (c) => c.companyId?.name?.toLowerCase() ?? '',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Company" />,
        cell: ({ row }) => {
          const co = row.original.companyId
          return co ? (
            <Link
              to={`/companies/${co.id}`}
              onClick={(e: MouseEvent) => e.stopPropagation()}
              className="transition-colors hover:text-primary hover:underline"
            >
              {co.name ?? 'Company'}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
        size: 180,
      },
      {
        id: 'phone',
        accessorFn: (c) => c.phone ?? '',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Phone" />,
        cell: ({ row }) =>
          row.original.phone ? (
            <span className="tabular-nums">{row.original.phone}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 160,
      },
      {
        id: 'tags',
        header: 'Tags',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tags.map((t) => (
              <Badge key={t} asChild variant={t === tag ? 'default' : 'secondary'}>
                <button
                  type="button"
                  className="cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    setTag(t === tag ? '' : t)
                  }}
                >
                  {t}
                </button>
              </Badge>
            ))}
          </div>
        ),
        size: 200,
      },
      {
        id: 'lastNote',
        accessorFn: (c) => c.lastNotedAt ?? '',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Last note" />,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {row.original.lastNotedAt ? ago(row.original.lastNotedAt) : 'Never'}
            </span>
            {quiet.has(row.original.id) && <StatusBadge variant="warning-light">Gone quiet</StatusBadge>}
          </div>
        ),
        size: 200,
      },
    ],
    [quiet, tag],
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (c) => String(c.id),
    initialState: { sorting: [{ id: 'name', desc: false }], pagination: { pageIndex: 0, pageSize: 25 } },
  })
  const shown = table.getRowModel().rows.map((r) => r.original)

  return (
    <ContentSection
      wide
      title="Contacts"
      desc="Your people, and the ones colleagues shared with you."
      actions={
        <Button onClick={() => setAdding(true)}>
          <Plus />
          Add contact
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {(nudges.data?.length ?? 0) > 0 && (
          <Alert variant="warning">
            <BellRing />
            <AlertTitle>
              {nudges.data?.length === 1
                ? 'One contact has gone quiet'
                : `${nudges.data?.length} contacts have gone quiet`}
            </AlertTitle>
            <AlertDescription>
              <span>
                No note for 2 minutes.{' '}
                <Link to="/nudges" className="font-medium underline">
                  See who to reach out to
                </Link>
              </span>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <InputGroup className="sm:max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search name, email or company"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search contacts"
            />
            {q && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQ('')}>
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          {tagCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
              <Button size="xs" variant={tag === '' ? 'secondary' : 'ghost'} onClick={() => setTag('')}>
                All <span className="text-muted-foreground tabular-nums">{total}</span>
              </Button>
              {tagCounts.map(([t, n]) => (
                <Button
                  key={t}
                  size="xs"
                  variant={tag === t ? 'secondary' : 'ghost'}
                  onClick={() => setTag(tag === t ? '' : t)}
                >
                  {t} <span className="text-muted-foreground tabular-nums">{n}</span>
                </Button>
              ))}
            </div>
          )}
        </div>

        <Refusal error={found.error ?? nudges.error} title="Contacts could not be loaded" />

        {found.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">{filtered ? <Search /> : <Users />}</EmptyMedia>
              <EmptyTitle>{filtered ? 'No contact matches' : 'No contacts yet'}</EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? 'Try another name, or clear the search and tag.'
                  : 'Add the first person you work with, then keep a log of what you talk about.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {filtered ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ('')
                    setTag('')
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setAdding(true)}>
                  <Plus />
                  Add contact
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <DataGrid
            table={table}
            recordCount={rows.length}
            onRowClick={(c) => go(`/contacts/${c.id}`)}
            tableLayout={{ headerBackground: true, rowBorder: true }}
          >
            <div className="hidden md:block">
              <DataGridContainer>
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </DataGridContainer>
            </div>
            <ItemGroup className="flex flex-col gap-2 md:hidden">
              {shown.map((c) => (
                <Item key={c.id} asChild variant="outline">
                  <Link to={`/contacts/${c.id}`} className="transition-colors hover:bg-muted">
                    <ItemMedia>
                      <PersonAvatar name={c.name} />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="flex w-full items-center gap-2">
                        <span className="truncate">{c.name}</span>
                        {quiet.has(c.id) && (
                          <StatusBadge variant="warning-light" size="sm">
                            Gone quiet
                          </StatusBadge>
                        )}
                      </ItemTitle>
                      <ItemDescription className="flex flex-wrap items-center gap-x-2">
                        {c.companyId && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="size-3" />
                            {c.companyId.name}
                          </span>
                        )}
                        <span>{c.lastNotedAt ? `Last note ${ago(c.lastNotedAt)}` : 'No notes yet'}</span>
                      </ItemDescription>
                      {c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {c.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </ItemContent>
                  </Link>
                </Item>
              ))}
            </ItemGroup>
            {rows.length > 25 && <DataGridPagination />}
          </DataGrid>
        )}
      </div>
      <ContactDialog open={adding} onOpenChange={setAdding} />
    </ContentSection>
  )
}
