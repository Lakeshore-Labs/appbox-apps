import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Plus, Search, X } from 'lucide-react'
import { listCompaniesOptions, listContactsOptions } from '@/gen'
import type { Company } from '@/gen'
import { CompanyKind } from '@/gen/kinds.gen'
import {
  Button,
  ContentSection,
  DataGrid,
  DataGridColumnHeader,
  DataGridContainer,
  DataGridPagination,
  DataGridScrollArea,
  DataGridTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Form,
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
  dataGridFeatures,
  useNavigate,
  useTable,
} from '@appbox/platform-web'
import type { ColumnDef } from '@appbox/platform-web'
import { PersonAvatar, Refusal } from '@/components/people'
import { WebsiteLink } from '@/components/web'

export function ListCompanies() {
  const companies = useQuery(listCompaniesOptions())
  const contacts = useQuery(listContactsOptions())
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const go = useNavigate()

  const people = useMemo(() => {
    const counts = new Map<number, number>()
    for (const c of contacts.data ?? [])
      if (c.companyId) counts.set(c.companyId.id, (counts.get(c.companyId.id) ?? 0) + 1)
    return counts
  }, [contacts.data])
  const needle = q.trim().toLowerCase()
  const rows = useMemo(
    () =>
      (companies.data ?? []).filter(
        (c) => !needle || c.name.toLowerCase().includes(needle) || (c.website ?? '').toLowerCase().includes(needle),
      ),
    [companies.data, needle],
  )

  const columns = useMemo<ColumnDef<typeof dataGridFeatures, Company, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (c) => c.name.toLowerCase(),
        header: ({ column }) => <DataGridColumnHeader column={column} title="Company" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <PersonAvatar name={row.original.name} size="sm" />
            <span className="truncate font-medium">{row.original.name}</span>
          </div>
        ),
        size: 300,
        meta: { fillWidth: true },
      },
      {
        id: 'website',
        accessorFn: (c) => c.website ?? '',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Website" />,
        cell: ({ row }) =>
          row.original.website ? (
            <WebsiteLink website={row.original.website} className="text-sm" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 240,
      },
      {
        id: 'people',
        accessorFn: (c) => people.get(c.id) ?? 0,
        header: ({ column }) => <DataGridColumnHeader column={column} title="People" />,
        cell: ({ row }) => <span className="tabular-nums">{people.get(row.original.id) ?? 0}</span>,
        size: 120,
      },
    ],
    [people],
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (c) => String(c.id),
    initialState: { sorting: [{ id: 'name', desc: false }], pagination: { pageIndex: 0, pageSize: 25 } },
  })
  const shown = table.getRowModel().rows.map((r) => r.original)
  const total = companies.data?.length ?? 0

  return (
    <ContentSection
      wide
      title="Companies"
      desc="Where your contacts work, and who you know at each."
      actions={
        <Button onClick={() => setAdding(true)}>
          <Plus />
          Add company
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {total > 0 && (
          <InputGroup className="sm:max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search companies"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search companies"
            />
            {q && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQ('')}>
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        )}
        <Refusal error={companies.error} title="Companies could not be loaded" />
        {companies.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">{needle ? <Search /> : <Building2 />}</EmptyMedia>
              <EmptyTitle>{needle ? 'No company matches' : 'No companies yet'}</EmptyTitle>
              <EmptyDescription>
                {needle
                  ? 'Try another name or website.'
                  : 'Add the companies your contacts work at, then pick one on a contact.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {needle ? (
                <Button variant="outline" onClick={() => setQ('')}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => setAdding(true)}>
                  <Plus />
                  Add company
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <DataGrid
            table={table}
            recordCount={rows.length}
            onRowClick={(c) => go(`/companies/${c.id}`)}
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
              {shown.map((c) => {
                const n = people.get(c.id) ?? 0
                return (
                  <Item key={c.id} asChild variant="outline">
                    <Link to={`/companies/${c.id}`} className="transition-colors hover:bg-muted">
                      <ItemMedia>
                        <PersonAvatar name={c.name} />
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="truncate">{c.name}</ItemTitle>
                        <ItemDescription>
                          {n === 1 ? '1 person' : `${n} people`}
                          {c.website ? ` · ${c.website.replace(/^https?:\/\//i, '')}` : ''}
                        </ItemDescription>
                      </ItemContent>
                    </Link>
                  </Item>
                )
              })}
            </ItemGroup>
            {rows.length > 25 && <DataGridPagination />}
          </DataGrid>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New company</DialogTitle>
            <DialogDescription>Every member of the app sees the companies.</DialogDescription>
          </DialogHeader>
          {adding && <Form kind={CompanyKind} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
    </ContentSection>
  )
}
