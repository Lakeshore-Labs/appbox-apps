import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlarmClock, Check, Plus, Repeat, Trash2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  completeReminderMutation,
  createReminderMutation,
  deleteReminderMutation,
  listRemindersOptions,
  snoozeReminderMutation,
  type Reminder,
} from '@/gen'
import { listContactsOptions } from '@/gen/connections/contacts'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@appbox/platform-web'

const selectClass = 'h-9 rounded-md border bg-transparent px-3 text-sm'
const repeatLabel: Record<string, string> = { daily: 'every day', weekly: 'every week' }

export function ListReminders() {
  const reminders = useQuery({ ...listRemindersOptions(), refetchInterval: 15_000 })
  // The people are the Contacts app's, read through its operation, never copied here.
  const contacts = useQuery({ ...listContactsOptions({ body: {} }), select: (d) => d.result })
  const create = useMutation(createReminderMutation())
  const snooze = useMutation(snoozeReminderMutation())
  const complete = useMutation(completeReminderMutation())
  const remove = useMutation(deleteReminderMutation())
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const [contact, setContact] = useState('')
  const [repeat, setRepeat] = useState<Reminder['repeat']>('never')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  const refusal = reminders.error ?? create.error ?? snooze.error ?? complete.error ?? remove.error

  const people = contacts.data ?? []
  const personName = (id: number | null) =>
    id == null ? null : (people.find((p) => p.id === id)?.name ?? 'Unknown contact')
  const open = (reminders.data ?? []).filter((r) => r.doneAt == null).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const overdue = open.filter((r) => new Date(r.dueAt).getTime() <= now)
  const upcoming = open.filter((r) => new Date(r.dueAt).getTime() > now)
  const done = (reminders.data ?? [])
    .filter((r) => r.doneAt != null)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate(
      { body: { note, dueAt: new Date(due).toISOString(), contactId: contact ? Number(contact) : null, repeat } },
      {
        onSuccess: () => {
          setNote('')
          setDue('')
          setContact('')
          setRepeat('never')
        },
      },
    )
  }

  const row = (r: (typeof open)[number], late: boolean) => (
    <TableRow key={r.id}>
      <TableCell className="font-medium">
        {r.note}
        {late && (
          <Badge variant="destructive" className="ml-2">
            overdue
          </Badge>
        )}
      </TableCell>
      <TableCell>{personName(r.contactId) ?? <span className="text-muted-foreground">-</span>}</TableCell>
      <TableCell className={late ? 'text-destructive' : ''}>
        {format(new Date(r.dueAt), 'PPp')}
        <span className="ml-2 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(r.dueAt), { addSuffix: true })}
        </span>
      </TableCell>
      <TableCell>
        {r.repeat !== 'never' && (
          <Badge variant="secondary">
            <Repeat className="size-3" />
            {repeatLabel[r.repeat]}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={snooze.isPending}
            onClick={() => snooze.mutate({ path: { id: r.id } })}
          >
            <AlarmClock />
            Snooze 10 min
          </Button>
          <Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate({ path: { id: r.id } })}>
            <Check />
            Done
          </Button>
          <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => remove.mutate({ path: { id: r.id } })}>
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>
            You are told in Notifications when one comes due. Overdue first, then by due time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-md border p-4 md:grid-cols-4">
            <div className="flex flex-col gap-1 md:col-span-4">
              <Label htmlFor="r-note">What to do</Label>
              <Input
                id="r-note"
                placeholder="Call back about the quote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="r-due">Due</Label>
              <Input id="r-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="r-contact">About (optional)</Label>
              <select
                id="r-contact"
                className={selectClass}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              >
                <option value="">Nobody</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="r-repeat">Repeat</Label>
              <select
                id="r-repeat"
                className={selectClass}
                value={repeat}
                onChange={(e) => {
                  const r = e.target.value
                  if (r === 'never' || r === 'daily' || r === 'weekly') setRepeat(r)
                }}
              >
                <option value="never">Never</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </div>
            <div className="flex items-end justify-end">
              <Button type="submit" disabled={create.isPending}>
                <Plus />
                Add reminder
              </Button>
            </div>
          </form>

          {refusal && (
            <p role="alert" className="text-sm text-destructive">
              {refusal.message}
            </p>
          )}

          {reminders.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : open.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing to remember</EmptyTitle>
                <EmptyDescription>Add a reminder above.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Note</TableHead>
                  <TableHead>About</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Repeats</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdue.map((r) => row(r, true))}
                {upcoming.map((r) => row(r, false))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Done</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {done.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground line-through">{r.note}</TableCell>
                    <TableCell className="text-muted-foreground">{personName(r.contactId) ?? '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.doneAt && `done ${formatDistanceToNow(new Date(r.doneAt), { addSuffix: true })}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => remove.mutate({ path: { id: r.id } })}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
