import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { BellRing, Building2, Mail, MessageSquarePlus, Pencil, Phone, Tag, Trash2, UserPlus, X } from 'lucide-react'
import { listSharesOptions, share as give, unshare as take, type Share } from '@appbox/organization-web'
import {
  addNoteContactMutation,
  deleteContactMutation,
  deleteNudgeMutation,
  getContactOptions,
  listNotesOptions,
  listNudgesOptions,
} from '@/gen'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  ContentSection,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  PrincipalPicker,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Label,
  Link,
  Separator,
  Skeleton,
  StatusBadge,
  Textarea,
  toast,
  useNavigate,
} from '@appbox/platform-web'
import { ContactDialog, PersonAvatar, Refusal, ago } from '@/components/people'

function Sharing({ id }: { id: number }) {
  const path = { kind: 'contacts_Contact', id: String(id) }
  const shares = useQuery(listSharesOptions({ path }))
  const share = useMutation({
    mutationFn: async (body: Share) => (await give({ path, body, throwOnError: true })).data,
  })
  const unshare = useMutation({
    mutationFn: async (body: Share) => (await take({ path, body, throwOnError: true })).data,
  })
  const list = shares.data?.shares ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4" />
          Shared with
        </CardTitle>
        <CardDescription>
          A colleague you share with sees this contact and adds notes, but cannot change who it is.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <PrincipalPicker
          who="member"
          onChange={(h) =>
            share.mutate(
              { principal: { kind: 'member', id: h.id }, role: 'viewer' },
              {
                onSuccess: () => toast.success(`Shared with ${h.name || 'your colleague'}`),
                onError: (e) => toast.error('Not shared', { description: e.message }),
              },
            )
          }
        />
        <Refusal error={shares.error} title="Who has access could not be loaded" />
        {shares.isLoading ? (
          <Skeleton className="h-10" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Only you can see this contact.</p>
        ) : (
          <ItemGroup className="flex flex-col gap-1">
            {list.map((s) => (
              <Item key={`${s.principal.kind}:${s.principal.id}:${s.role}`} size="sm" className="px-0">
                <ItemMedia>
                  <PersonAvatar name={s.principal.name || s.principal.id} size="sm" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="truncate">{s.principal.name || s.principal.id}</ItemTitle>
                  <ItemDescription>{s.role === 'viewer' ? 'Sees and adds notes' : s.role}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Stop sharing with ${s.principal.name || s.principal.id}`}
                    disabled={unshare.isPending}
                    onClick={() =>
                      unshare.mutate(
                        { principal: { kind: s.principal.kind, id: s.principal.id }, role: s.role },
                        {
                          onSuccess: () => toast.success('Access removed'),
                          onError: (e) => toast.error('Access not removed', { description: e.message }),
                        },
                      )
                    }
                  >
                    <X />
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="min-w-0 break-words text-sm">{children}</div>
      </div>
    </div>
  )
}

export function GetContact({ id }: { id: number }) {
  const contact = useQuery(getContactOptions({ path: { id } }))
  const notes = useQuery(listNotesOptions())
  const nudges = useQuery(listNudgesOptions())
  const addNote = useMutation(addNoteContactMutation())
  const remove = useMutation(deleteContactMutation())
  const dismiss = useMutation(deleteNudgeMutation())
  const go = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [body, setBody] = useState('')
  const [when, setWhen] = useState('')

  if (contact.isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }
  if (contact.error || !contact.data) {
    return (
      <ContentSection title="Contact" back={{ label: 'Contacts', onClick: () => go('/contacts') }}>
        <Refusal
          error={contact.error ?? new Error('This contact does not exist, or it is not shared with you.')}
          title="This contact cannot be shown"
        />
      </ContentSection>
    )
  }
  const c = contact.data
  const isEditor = c.role === 'editor'
  const log = (notes.data ?? []).filter((n) => n.contactId.id === id).sort((a, b) => b.notedAt.localeCompare(a.notedAt))
  const nudge = (nudges.data ?? []).find((n) => n.contactId.id === id)

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!body.trim()) return
    addNote.mutate(
      { path: { id }, body: { body, notedAt: when ? parseISO(when).toISOString() : null } },
      {
        onSuccess: () => {
          setBody('')
          setWhen('')
          toast.success('Note added')
        },
        onError: (err) => toast.error('The note was not added', { description: err.message }),
      },
    )
  }

  return (
    <ContentSection
      wide
      title={c.name}
      desc={[c.companyId?.name, c.email].filter(Boolean).join(' · ') || undefined}
      icon={<PersonAvatar name={c.name} size="lg" />}
      back={{ label: 'Contacts', onClick: () => go('/contacts') }}
      actions={
        isEditor ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              Edit
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(true)}>
              <Trash2 />
              Delete
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {nudge && (
          <Alert variant="warning">
            <BellRing />
            <AlertTitle>{c.name} has gone quiet</AlertTitle>
            <AlertDescription>
              No note for 2 minutes — reach out, then write down what you talked about.
            </AlertDescription>
            {nudge.role === 'editor' && (
              <AlertAction>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={dismiss.isPending}
                  onClick={() =>
                    dismiss.mutate({ path: { id: nudge.id } }, { onSuccess: () => toast.success('Nudge dismissed') })
                  }
                >
                  Dismiss
                </Button>
              </AlertAction>
            )}
          </Alert>
        )}
        <Refusal error={dismiss.error} title="The nudge was not dismissed" />

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Log</CardTitle>
              <CardDescription>What you and your colleagues talked about with {c.name}, newest first.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <form onSubmit={submit} className="flex flex-col gap-3">
                <Textarea
                  aria-label="Note"
                  placeholder={`What did you talk about with ${c.name}?`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
                  }}
                  className="min-h-24"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="note-when" className="text-xs text-muted-foreground">
                      When it happened — empty for now
                    </Label>
                    <Input
                      id="note-when"
                      type="datetime-local"
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      className="sm:w-60"
                    />
                  </div>
                  <Button type="submit" disabled={addNote.isPending || !body.trim()}>
                    <MessageSquarePlus />
                    Add note
                  </Button>
                </div>
                <Refusal error={addNote.error} title="The note was not added" />
              </form>
              <Separator />
              {notes.isLoading ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : log.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageSquarePlus />
                    </EmptyMedia>
                    <EmptyTitle>No notes yet</EmptyTitle>
                    <EmptyDescription>
                      Write down your first conversation above; it starts the 2-minute quiet clock again.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ol className="flex flex-col gap-6">
                  {log.map((n) => (
                    <li key={n.id} className="flex gap-3">
                      <PersonAvatar name={n.addedBy.email ?? n.addedBy.id} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{n.addedBy.email ?? 'A colleague'}</span>
                          <time dateTime={n.notedAt} title={format(parseISO(n.notedAt), 'PPpp')}>
                            {format(parseISO(n.notedAt), 'PP, p')} · {ago(n.notedAt)}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  {nudge ? (
                    <StatusBadge variant="warning-light">Gone quiet</StatusBadge>
                  ) : c.lastNotedAt ? (
                    <StatusBadge variant="success-light">In touch</StatusBadge>
                  ) : (
                    <StatusBadge variant="info-light">No notes yet</StatusBadge>
                  )}
                  {!isEditor && <StatusBadge variant="info-outline">Shared with you</StatusBadge>}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Detail icon={<Mail />} label="Email">
                  {c.email ? (
                    <a className="transition-colors hover:text-primary hover:underline" href={`mailto:${c.email}`}>
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not given</span>
                  )}
                </Detail>
                <Detail icon={<Phone />} label="Phone">
                  {c.phone ? (
                    <a
                      className="tabular-nums transition-colors hover:text-primary hover:underline"
                      href={`tel:${c.phone}`}
                    >
                      {c.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not given</span>
                  )}
                </Detail>
                <Detail icon={<Building2 />} label="Company">
                  {c.companyId ? (
                    <Link
                      to={`/companies/${c.companyId.id}`}
                      className="transition-colors hover:text-primary hover:underline"
                    >
                      {c.companyId.name ?? 'Company'}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </Detail>
                <Detail icon={<Tag />} label="Tags">
                  {c.tags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </Detail>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Added by {c.addedBy.email ?? 'a colleague'}
                  {c.lastNotedAt ? ` · last note ${ago(c.lastNotedAt)}` : ''}
                </p>
              </CardContent>
            </Card>
            {isEditor && <Sharing id={id} />}
          </div>
        </div>
      </div>

      {isEditor && <ContactDialog open={editing} onOpenChange={setEditing} contact={c} />}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        title={`Delete ${c.name}?`}
        description="Their notes and nudges are deleted with them, for you and everyone you shared them with. This cannot be undone."
        confirmLabel="Delete contact"
        isLoading={remove.isPending}
        onConfirm={() =>
          remove.mutate(
            { path: { id } },
            {
              onSuccess: () => {
                toast.success(`${c.name} deleted`)
                go('/contacts')
              },
              onError: (err) => {
                setDeleting(false)
                toast.error('The contact was not deleted', { description: err.message })
              },
            },
          )
        }
      />
    </ContentSection>
  )
}
