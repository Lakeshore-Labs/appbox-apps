import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmAction,
  type Confirmation,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Label,
  Skeleton,
  StatusBadge as Badge,
} from '@appbox/platform-web'
import { GitBranch, LoaderCircle, Plus, RefreshCw, Search, Store as StoreIcon, Trash2, Upload } from 'lucide-react'
import {
  type InstalledApp,
  type Repository,
  createRepositoryMutation,
  deleteInstalledAppMutation,
  listInstalledAppsOptions,
  listRepositorysOptions,
  publishRepositoryMutation,
  syncRepositoryMutation,
} from '@/gen'

type Filter = 'all' | 'published' | 'failed'

function Tile({ title }: { title: string }) {
  const box = 'size-12 rounded-xl text-lg flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-sky-500 font-bold text-white shadow-xs'
  return <span className={box}>{title.slice(0, 1).toUpperCase()}</span>
}

function repoLabel(r: Repository) {
  return `${r.owner}/${r.name}`
}

function AddStore({ onClose, onAdded }: { onClose: () => void; onAdded: (r: Repository) => void }) {
  const [repository, setRepository] = useState('')
  const [branch, setBranch] = useState('main')
  const [directory, setDirectory] = useState('apps')
  const add = useMutation({ ...createRepositoryMutation(), onSuccess: (r) => onAdded(r) })
  const parts = repository.trim().split('/')
  const owner = parts[0] || ''
  const name = parts[1] || ''

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a repository</DialogTitle>
          <DialogDescription>Add a GitHub repository containing app directories. Ensure your GitHub connection has access to it.</DialogDescription>
        </DialogHeader>
        <form
          id="add-store"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate({ body: { owner, name, branch, path: directory, head: '' } })
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="repository">Repository (owner/repo)</Label>
            <Input id="repository" placeholder="owner/repository" value={repository} onChange={(e) => setRepository(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="branch">Branch</Label>
              <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="directory">Apps Directory</Label>
              <Input id="directory" value={directory} onChange={(e) => setDirectory(e.target.value)} />
            </div>
          </div>
          {add.error && (
            <Alert variant="destructive">
              <AlertTitle>Could not add repository</AlertTitle>
              <AlertDescription>{add.error.message}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-store" disabled={!owner || !name || add.isPending}>
            {add.isPending ? <LoaderCircle className="animate-spin" /> : 'Add Repository'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AppCard({
  app,
  repo,
  onPublish,
  isPublishing,
  onOpen,
}: {
  app: InstalledApp
  repo?: Repository
  onPublish: () => void
  isPublishing: boolean
  onOpen: () => void
}) {
  const isFailed = app.result.startsWith('failed')
  const isPublished = app.result.toLowerCase().includes('published')

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group flex cursor-pointer flex-col gap-4 rounded-2xl border bg-card p-5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start gap-3.5">
        <Tile title={app.app} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight">{app.app}</h3>
          <p className="truncate text-xs text-muted-foreground">{repo ? repoLabel(repo) : 'Repository'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/60 rounded-lg px-2.5 py-1.5">
        <span className="shrink-0 text-foreground font-medium">Head:</span>
        <span className="truncate">{app.head.slice(0, 8) || '—'}</span>
      </div>

      <div className="min-h-[2.5rem]">
        <Badge variant={isFailed ? 'destructive-light' : isPublished ? 'success-light' : 'info-light'}>
          {isFailed ? 'Failed' : isPublished ? 'Published' : 'Synced'}
        </Badge>
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{app.result || 'No sync result available.'}</p>
      </div>

      <div className="mt-auto pt-2 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={isPublishing}
          onClick={() => onPublish()}
        >
          {isPublishing ? <LoaderCircle className="animate-spin" /> : <Upload className="size-3.5" />}
          Publish
        </Button>
      </div>
    </article>
  )
}

function Details({
  app,
  repo,
  onPublish,
  isPublishing,
  onDelete,
  onClose,
}: {
  app: InstalledApp
  repo?: Repository
  onPublish: () => void
  isPublishing: boolean
  onDelete: () => void
  onClose: () => void
}) {
  const isFailed = app.result.startsWith('failed')
  const isPublished = app.result.toLowerCase().includes('published')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Tile title={app.app} />
            <div className="min-w-0 text-left">
              <DialogTitle className="text-xl">{app.app}</DialogTitle>
              <Badge variant={isFailed ? 'destructive-light' : isPublished ? 'success-light' : 'info-light'} className="mt-2">
                {isFailed ? 'Failed' : isPublished ? 'Published' : 'Synced'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl bg-muted/50 p-4 text-sm">
          <dt className="text-muted-foreground">Repository</dt>
          <dd className="truncate">{repo ? repoLabel(repo) : '—'}</dd>
          <dt className="text-muted-foreground">Branch</dt>
          <dd className="font-mono text-xs leading-5">{repo?.branch || 'main'}</dd>
          <dt className="text-muted-foreground">Directory</dt>
          <dd className="font-mono text-xs leading-5">{repo?.path}/{app.app}</dd>
          <dt className="text-muted-foreground">Commit SHA</dt>
          <dd className="font-mono text-xs leading-5 break-all">{app.head || '—'}</dd>
        </dl>

        <Alert variant={isFailed ? 'destructive' : 'default'}>
          <AlertTitle>Last Sync Result</AlertTitle>
          <AlertDescription className="wrap-anywhere whitespace-pre-wrap font-mono text-xs mt-1">
            {app.result || 'No output recorded.'}
          </AlertDescription>
        </Alert>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="size-4" /> Remove Record
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button disabled={isPublishing} onClick={onPublish}>
              {isPublishing ? <LoaderCircle className="animate-spin" /> : <Upload className="size-4" />}
              Publish to Store
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function Index() {
  const queryClient = useQueryClient()
  const reposQuery = useQuery(listRepositorysOptions())
  const appsQuery = useQuery(listInstalledAppsOptions())

  const [chosenRepoId, setChosenRepoId] = useState<number>()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [addingRepo, setAddingRepo] = useState(false)
  const [openAppId, setOpenAppId] = useState<number>()
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const reload = () => {
    void queryClient.invalidateQueries()
  }

  const syncRepo = useMutation({ ...syncRepositoryMutation(), onSettled: reload })
  const publishApp = useMutation({ ...publishRepositoryMutation(), onSettled: reload })
  const deleteApp = useMutation({ ...deleteInstalledAppMutation(), onSettled: reload })

  const repositories = reposQuery.data ?? []
  const activeRepo = repositories.find((r) => r.id === chosenRepoId) ?? repositories[0]

  useEffect(() => {
    if (activeRepo && activeRepo.id !== chosenRepoId) {
      setChosenRepoId(activeRepo.id)
    }
  }, [activeRepo, chosenRepoId])

  const installedApps = useMemo(() => {
    if (!activeRepo) return []
    return (appsQuery.data ?? []).filter((a) => a.repositoryId.id === activeRepo.id)
  }, [appsQuery.data, activeRepo])

  const shownApps = useMemo(() => {
    return installedApps.filter((a) => {
      const matchText = `${a.app} ${a.result} ${a.head}`.toLowerCase()
      if (search.trim() && !matchText.includes(search.trim().toLowerCase())) return false
      if (filter === 'published') return a.result.toLowerCase().includes('published')
      if (filter === 'failed') return a.result.startsWith('failed')
      return true
    })
  }, [installedApps, search, filter])

  const openApp = installedApps.find((a) => a.id === openAppId)
  const isSyncing = syncRepo.isPending && syncRepo.variables?.path.id === activeRepo?.id
  const failure = reposQuery.error ?? appsQuery.error ?? syncRepo.error ?? publishApp.error ?? deleteApp.error

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-8">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 p-6 text-white shadow-lg sm:p-10">
        <div aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">App Store</h1>
            <p className="mt-2 text-base text-white/85">
              Sync and refresh apps from GitHub repositories, install or update drafts, and publish builds back.
            </p>
          </div>
          {activeRepo && (
            <Button
              className="self-start bg-white text-blue-700 hover:bg-white/90 sm:self-auto font-medium shadow-xs"
              disabled={isSyncing}
              onClick={() => syncRepo.mutate({ path: { id: activeRepo.id } })}
            >
              <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing Store...' : 'Sync Store'}
            </Button>
          )}
        </div>

        {repositories.length > 0 && (
          <div className="relative mt-6 flex flex-wrap items-center gap-2">
            {repositories.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setChosenRepoId(r.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  r.id === activeRepo?.id ? 'bg-white text-blue-700 shadow-xs' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <GitBranch className="size-3.5" />
                {repoLabel(r)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAddingRepo(true)}
              className="flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-white/25"
            >
              <Plus className="size-3.5" /> Add store
            </button>
            {activeRepo?.syncedAt && (
              <span role="status" className="ml-auto text-sm text-white/80">
                {isSyncing ? 'Syncing repository...' : `Synced ${formatDistanceToNow(new Date(activeRepo.syncedAt), { addSuffix: true })}`}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Diagnostics / Error Alert */}
      {failure && (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription className="wrap-anywhere">{failure.message}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Area */}
      {reposQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : !activeRepo ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <StoreIcon />
            </EmptyMedia>
            <EmptyTitle>No App Stores configured</EmptyTitle>
            <EmptyDescription>Add a GitHub repository containing an apps directory to get started.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAddingRepo(true)}>
              <Plus /> Add a Store
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <section className="flex flex-col gap-5">
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-fit gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  ['all', `All (${installedApps.length})`],
                  ['published', 'Published'],
                  ['failed', 'Failed'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                    filter === value ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search apps"
                placeholder="Search apps..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Cards Grid */}
          {shownApps.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{installedApps.length ? 'No matching apps' : 'No apps synced yet'}</EmptyTitle>
                <EmptyDescription>
                  {installedApps.length
                    ? 'Try adjusting your search or filter.'
                    : 'Click "Sync Store" above to fetch and install apps from this repository.'}
                </EmptyDescription>
              </EmptyHeader>
              {!installedApps.length && (
                <EmptyContent>
                  <Button disabled={isSyncing} onClick={() => syncRepo.mutate({ path: { id: activeRepo.id } })}>
                    <RefreshCw className={isSyncing ? 'animate-spin' : ''} /> Sync Store Now
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shownApps.map((a) => (
                <AppCard
                  key={a.id}
                  app={a}
                  repo={activeRepo}
                  isPublishing={publishApp.isPending && publishApp.variables?.body.App === a.app}
                  onPublish={() => publishApp.mutate({ path: { id: activeRepo.id }, body: { App: a.app } })}
                  onOpen={() => setOpenAppId(a.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Add Store Dialog */}
      {addingRepo && (
        <AddStore
          onClose={() => setAddingRepo(false)}
          onAdded={(r) => {
            setAddingRepo(false)
            setChosenRepoId(r.id)
            reload()
            syncRepo.mutate({ path: { id: r.id } })
          }}
        />
      )}

      {/* App Details Modal */}
      {openApp && (
        <Details
          app={openApp}
          repo={activeRepo}
          isPublishing={publishApp.isPending && publishApp.variables?.body.App === openApp.app}
          onPublish={() => {
            if (activeRepo) {
              publishApp.mutate({ path: { id: activeRepo.id }, body: { App: openApp.app } })
            }
          }}
          onDelete={() => {
            setConfirmation({
              title: `Remove ${openApp.app} record?`,
              desc: 'This removes the record from the App Store index. It does not uninstall the draft from Builder.',
              confirmText: 'Remove',
              run: async () => {
                await deleteApp.mutateAsync({ path: { id: openApp.id } })
                setOpenAppId(undefined)
              },
            })
          }}
          onClose={() => setOpenAppId(undefined)}
        />
      )}

      <ConfirmAction confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}
