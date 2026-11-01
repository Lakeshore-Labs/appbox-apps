import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  createEvalCaseMutation,
  deleteEvalCaseMutation,
  listCasesOptions,
  listRunsOptions,
  listVerdictsOptions,
  runEvalCaseMutation,
  updateEvalCaseMutation,
} from '@/gen'
import type { EvalCase, Run, Verdict } from '@/gen'
import { listHostsOptions } from '@/gen/connections/apps'
import { listModelDetailsOptions } from '@/gen/connections/gateway'
import { getChatOptions } from '@/gen/connections/assistant'
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  Label,
  Markdown,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@appbox/platform-web'

const DEFAULT = '__default'

function modelName(m: string | null | undefined) {
  return m ?? 'Assistant default'
}

function Score({ run }: { run: Run }) {
  if (run.outcome === 'failed' && run.passed + run.failed === 0) return <Badge variant="destructive">failed</Badge>
  const total = run.passed + run.failed
  return (
    <Badge variant={run.failed === 0 ? 'default' : run.passed === 0 ? 'destructive' : 'secondary'}>
      {run.passed}/{total} passed
    </Badge>
  )
}

function useModels() {
  return useQuery({
    ...listModelDetailsOptions({ body: {} }),
    select: (d) => d.result.filter((m) => m.info.chatSupport !== 'unsupported').map((m) => m.model.name),
  })
}

type Draft = {
  id?: number
  title: string
  app: string
  request: string
  checks: string
  model: string
  nightly: boolean
}
const blank: Draft = { title: '', app: '', request: '', checks: '', model: DEFAULT, nightly: false }

function CaseForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [d, setD] = useState<Draft>(draft)
  const hosts = useQuery({ ...listHostsOptions({ body: {} }), select: (d) => d.result })
  const models = useModels()
  const create = useMutation(createEvalCaseMutation())
  const update = useMutation(updateEvalCaseMutation())
  const refusal = create.error ?? update.error
  const checks = d.checks
    .split('\n')
    .map((c) => c.trim())
    .filter((c) => c !== '')
  const body = {
    title: d.title,
    app: d.app,
    request: d.request,
    checks,
    model: d.model === DEFAULT ? null : d.model,
    nightly: d.nightly,
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (d.id != null) update.mutate({ path: { id: d.id }, body }, { onSuccess: onClose })
    else create.mutate({ body }, { onSuccess: onClose })
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-title">Title</Label>
        <Input
          id="c-title"
          placeholder="Remind me to call a contact"
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>App it is said on</Label>
          <Select value={d.app} onValueChange={(app) => setD({ ...d, app })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={hosts.isLoading ? 'Loading apps…' : 'Pick an app'} />
            </SelectTrigger>
            <SelectContent>
              {(hosts.data ?? []).map((h) => (
                <SelectItem key={h.name} value={h.name}>
                  {h.title || h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Model</Label>
          <Select value={d.model} onValueChange={(model) => setD({ ...d, model })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Assistant default</SelectItem>
              {(models.data ?? []).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-request">Request, as the person would say it</Label>
        <Textarea
          id="c-request"
          rows={3}
          placeholder="Remind me tomorrow at 9 to call Dana about the renewal."
          value={d.request}
          onChange={(e) => setD({ ...d, request: e.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="c-checks">Checks, one per line</Label>
        <Textarea
          id="c-checks"
          rows={4}
          placeholder={
            'A reminder is due tomorrow at 9:00\nThe reminder is about Dana\nThe answer confirms what was set'
          }
          value={d.checks}
          onChange={(e) => setD({ ...d, checks: e.target.value })}
          required
        />
      </div>
      <Label className="flex items-center gap-2 font-normal">
        <Checkbox checked={d.nightly} onCheckedChange={(v) => setD({ ...d, nightly: v === true })} />
        Run every night at 02:00 UTC
      </Label>
      {refusal && (
        <p role="alert" className="text-sm text-destructive">
          {refusal.message}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending || update.isPending || d.app === '' || checks.length === 0}>
          {d.id != null ? 'Save case' : 'Add case'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// callsOf is the operations a chat called, in order, as recorded in operations/case.go reads them:
// each tool call of its assistant messages, AG-UI's, among those it was offered, with what its
// tool message holds.
function callsOf(messages: Array<Record<string, unknown>>, offered: Array<{ name: string }>) {
  const results = new Map(messages.filter((m) => m.role === 'tool').map((m) => [m.toolCallId, m]))
  return messages
    .flatMap((m) => (m.role === 'assistant' && Array.isArray(m.toolCalls) ? m.toolCalls.filter(isToolCall) : []))
    .filter((c) => offered.some((o) => o.name === c.function.name))
    .map((c) => {
      const r = results.get(c.id)
      const text = r?.error ?? r?.content
      return {
        id: c.id,
        name: c.function.name,
        arguments: c.function.arguments,
        result: typeof text === 'string' ? text : undefined,
        outcome: !r ? 'running' : r.error ? 'failed' : 'succeeded',
      }
    })
}

function isToolCall(c: unknown): c is { id: string; function: { name: string; arguments: string } } {
  return typeof c === 'object' && c !== null && 'id' in c && 'function' in c
}

function RunSheet({
  run,
  kase,
  verdicts,
  onClose,
}: {
  run: Run
  kase: EvalCase | undefined
  verdicts: Verdict[]
  onClose: () => void
}) {
  const chat = useQuery({
    ...getChatOptions({ body: { chat: run.chat ?? '' } }),
    enabled: run.chat != null,
    select: (d) => d.result,
  })
  const calls = callsOf(chat.data?.messages ?? [], chat.data?.tools ?? [])
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{kase?.title ?? 'Run'}</SheetTitle>
          <SheetDescription>
            {modelName(run.model)} on {kase?.app}, {format(new Date(run.startedAt), 'PPp')},{' '}
            {run.trigger === 'nightly' ? 'nightly' : 'by hand'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <Score run={run} />
            <Badge variant="outline">{run.outcome ?? 'unknown'}</Badge>
            <Badge variant="outline">
              {run.turns} turn{run.turns === 1 ? '' : 's'}, {run.rounds} model round{run.rounds === 1 ? '' : 's'}
            </Badge>
            <Badge variant="outline">
              {run.tools.length} call{run.tools.length === 1 ? '' : 's'}
            </Badge>
          </div>
          {run.error && (
            <p role="alert" className="text-sm text-destructive">
              {run.error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label>The request</Label>
            <p className="text-sm whitespace-pre-wrap">{kase?.request}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>The assistant's answer</Label>
            <div className="rounded-md border p-3 text-sm">
              <Markdown>{run.answer ?? '—'}</Markdown>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Checks</Label>
            {verdicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not judged.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {verdicts.map((v) => (
                  <li key={v.id} className="flex items-start gap-2 text-sm">
                    <Badge variant={v.pass ? 'default' : 'destructive'}>{v.pass ? 'pass' : 'fail'}</Badge>
                    <div className="flex flex-col">
                      <span className="font-medium">{v.checkText}</span>
                      <span className="text-muted-foreground">{v.reason}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Label>Its calls, from the assistant's chat</Label>
            {run.chat == null ? (
              <p className="text-sm text-muted-foreground">The run never reached the assistant.</p>
            ) : chat.isLoading ? (
              <Skeleton className="h-24" />
            ) : chat.error ? (
              <p role="alert" className="text-sm text-destructive">
                {chat.error.message}
              </p>
            ) : calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">It called no operation.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {calls.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm">{c.name}</span>
                      <Badge variant={c.outcome === 'succeeded' ? 'secondary' : 'destructive'}>{c.outcome}</Badge>
                    </div>
                    <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{c.arguments}</pre>
                    {c.result !== undefined && (
                      <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{c.result}</pre>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Compare({ runs, verdicts, kase }: { runs: Run[]; verdicts: Verdict[]; kase: EvalCase }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {runs.map((r) => {
        const vs = verdicts.filter((v) => v.runId.id === r.id).sort((a, b) => a.position - b.position)
        return (
          <div key={r.id} className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{modelName(r.model)}</span>
              <Score run={r} />
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(r.startedAt), 'PPp')} · {r.turns} turn{r.turns === 1 ? '' : 's'} · {r.rounds} rounds ·{' '}
              {r.tools.length} calls
            </p>
            <div className="flex flex-wrap gap-1">
              {r.tools.map((t, i) => (
                <Badge key={i} variant="outline" className="font-mono">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="rounded-md border p-3 text-sm">
              <Markdown>{r.answer ?? r.error ?? '—'}</Markdown>
            </div>
            <ul className="flex flex-col gap-2">
              {kase.checks.map((c, i) => {
                const v = vs.find((x) => x.position === i + 1)
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant={v == null ? 'outline' : v.pass ? 'default' : 'destructive'}>
                      {v == null ? '—' : v.pass ? 'pass' : 'fail'}
                    </Badge>
                    <div className="flex flex-col">
                      <span>{c}</span>
                      {v && <span className="text-muted-foreground">{v.reason}</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function Index() {
  const cases = useQuery(listCasesOptions())
  const runs = useQuery(listRunsOptions())
  const verdicts = useQuery(listVerdictsOptions())
  const models = useModels()
  const run = useMutation(runEvalCaseMutation())
  const remove = useMutation(deleteEvalCaseMutation())
  const [editing, setEditing] = useState<Draft | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [compare, setCompare] = useState<number[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<EvalCase | null>(null)

  const allRuns = [...(runs.data ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const allVerdicts = verdicts.data ?? []
  const list = [...(cases.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const current = list.find((c) => c.id === selected) ?? list[0]
  const caseRuns = current ? allRuns.filter((r) => r.caseId.id === current.id) : []
  const openRun = allRuns.find((r) => r.id === open)
  const compared = caseRuns.filter((r) => compare.includes(r.id))
  const refusal = cases.error ?? runs.error ?? run.error ?? remove.error
  const runningCase = run.isPending ? run.variables?.path.id : undefined

  const start = (c: EvalCase, model?: string | null) => {
    setSelected(c.id)
    run.mutate({ path: { id: c.id }, body: model === undefined ? {} : { model } }, { onSuccess: (r) => setOpen(r.id) })
  }
  const toggleCompare = (id: number) =>
    setCompare((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2)))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
          <CardDescription>
            Each case is a request said to the assistant on one app, and the checks that say it went well. Run one to
            ask the assistant and have every check judged.
          </CardDescription>
          <CardAction>
            <Button onClick={() => setEditing(blank)}>
              <Plus />
              New case
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {refusal && (
            <p role="alert" className="text-sm text-destructive">
              {refusal.message}
            </p>
          )}
          {cases.isLoading ? (
            <Skeleton className="h-32" />
          ) : list.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No cases yet</EmptyTitle>
                <EmptyDescription>Write the first job you want the assistant to do well.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setEditing(blank)}>
                  <Plus />
                  New case
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Last result</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => {
                  const last = allRuns.find((r) => r.caseId.id === c.id)
                  return (
                    <TableRow
                      key={c.id}
                      data-state={current?.id === c.id ? 'selected' : undefined}
                      className="cursor-pointer transition-colors"
                      onClick={() => {
                        setSelected(c.id)
                        setCompare([])
                      }}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{c.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.checks.length} check{c.checks.length === 1 ? '' : 's'}
                            {c.nightly ? ' · nightly' : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.app}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{modelName(c.model)}</TableCell>
                      <TableCell>
                        {last ? (
                          <div className="flex items-center gap-2">
                            <Score run={last} />
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(last.startedAt), { addSuffix: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Never run</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" disabled={run.isPending}>
                                {runningCase === c.id ? <Spinner /> : <Play />}
                                {runningCase === c.id ? 'Running…' : 'Run'}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => start(c)}>
                                On its model ({modelName(c.model)})
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>On another model</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => start(c, null)}>Assistant default</DropdownMenuItem>
                              {(models.data ?? []).map((m) => (
                                <DropdownMenuItem key={m} onSelect={() => start(c, m)}>
                                  {m}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {c.role === 'editor' && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Edit"
                                onClick={() =>
                                  setEditing({
                                    id: c.id,
                                    title: c.title,
                                    app: c.app,
                                    request: c.request,
                                    checks: c.checks.join('\n'),
                                    model: c.model ?? DEFAULT,
                                    nightly: c.nightly,
                                  })
                                }
                              >
                                <Pencil />
                              </Button>
                              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDeleting(c)}>
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {current && (
        <Card>
          <CardHeader>
            <CardTitle>Runs of {current.title}</CardTitle>
            <CardDescription>
              On {current.app}: “{current.request}”. Tick two runs to see them side by side; open one for the answer and
              its calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {runs.isLoading ? (
              <Skeleton className="h-24" />
            ) : caseRuns.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Not run yet</EmptyTitle>
                  <EmptyDescription>Run the case to see how the assistant does.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button disabled={run.isPending} onClick={() => start(current)}>
                    <Play />
                    Run
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>When</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Turns</TableHead>
                    <TableHead>Calls</TableHead>
                    <TableHead>Checks</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseRuns.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer transition-colors" onClick={() => setOpen(r.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label="Compare"
                          checked={compare.includes(r.id)}
                          onCheckedChange={() => toggleCompare(r.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{format(new Date(r.startedAt), 'PPp')}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.trigger === 'nightly' ? 'nightly' : 'by hand'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{modelName(r.model)}</TableCell>
                      <TableCell className="text-sm">
                        {r.turns} <span className="text-muted-foreground">({r.rounds} rounds)</span>
                      </TableCell>
                      <TableCell className="text-sm" title={r.tools.join(', ')}>
                        {r.tools.length}
                      </TableCell>
                      <TableCell>
                        <Score run={r} />
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground"
                        title="The platform's assistant and gateway do not yet report a turn's tokens or cost to an app."
                      >
                        not reported
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {compared.length === 2 && <Compare runs={compared} verdicts={allVerdicts} kase={current} />}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={editing != null}
        onOpenChange={(o) => {
          if (!o) setEditing(null)
        }}
      >
        {editing && (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing.id != null ? 'Edit case' : 'New case'}</DialogTitle>
              <DialogDescription>
                Say the request exactly as a person would, and each check in plain words.
              </DialogDescription>
            </DialogHeader>
            <CaseForm draft={editing} onClose={() => setEditing(null)} />
          </DialogContent>
        )}
      </Dialog>

      {openRun && (
        <RunSheet
          run={openRun}
          kase={list.find((c) => c.id === openRun.caseId.id)}
          verdicts={allVerdicts.filter((v) => v.runId.id === openRun.id).sort((a, b) => a.position - b.position)}
          onClose={() => setOpen(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o: boolean) => {
            if (!o) setDeleting(null)
          }}
          title={`Delete “${deleting.title}”?`}
          description="Its runs and their verdicts go with it."
          confirmLabel="Delete"
          onConfirm={() => remove.mutate({ path: { id: deleting.id } }, { onSuccess: () => setDeleting(null) })}
        />
      )}
    </div>
  )
}
