import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Globe, Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { deleteCompanyMutation, getCompanyOptions, listContactsOptions, listNudgesOptions } from '@/gen'
import { CompanyKind } from '@/gen/kinds.gen'
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  ContentSection,
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
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Link,
  Skeleton,
  StatusBadge,
  toast,
  useNavigate,
} from '@appbox/platform-web'
import { ContactDialog, PersonAvatar, Refusal, ago } from '@/components/people'
import { WebsiteLink } from '@/components/web'

export function GetCompany({ id }: { id: number }) {
  const company = useQuery(getCompanyOptions({ path: { id } }))
  const contacts = useQuery(listContactsOptions())
  const nudges = useQuery(listNudgesOptions())
  const remove = useMutation(deleteCompanyMutation())
  const go = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [adding, setAdding] = useState(false)

  if (company.isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }
  if (company.error || !company.data) {
    return (
      <ContentSection title="Company" back={{ label: 'Companies', onClick: () => go('/companies') }}>
        <Refusal
          error={company.error ?? new Error('This company does not exist.')}
          title="This company cannot be shown"
        />
      </ContentSection>
    )
  }
  const co = company.data
  const isEditor = co.role === 'editor'
  const people = (contacts.data ?? [])
    .filter((c) => c.companyId?.id === id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const quiet = new Set((nudges.data ?? []).map((n) => n.contactId.id))

  return (
    <ContentSection
      wide
      title={co.name}
      desc={people.length === 1 ? '1 person you know here' : `${people.length} people you know here`}
      icon={<PersonAvatar name={co.name} size="lg" />}
      back={{ label: 'Companies', onClick: () => go('/companies') }}
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
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              People
            </CardTitle>
            <CardDescription>The contacts you can see who work at {co.name}.</CardDescription>
            <CardAction>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <UserPlus />
                Add person
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Refusal error={contacts.error} title="People could not be loaded" />
            {contacts.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : people.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>No people here yet</EmptyTitle>
                  <EmptyDescription>
                    Add someone who works at {co.name}, or pick this company on a contact.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setAdding(true)}>
                    <UserPlus />
                    Add person
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <ItemGroup className="flex flex-col gap-2">
                {people.map((c) => (
                  <Item key={c.id} asChild variant="outline">
                    <Link to={`/contacts/${c.id}`} className="transition-colors hover:bg-muted">
                      <ItemMedia>
                        <PersonAvatar name={c.name} />
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle className="flex w-full flex-wrap items-center gap-2">
                          <span className="truncate">{c.name}</span>
                          {quiet.has(c.id) && (
                            <StatusBadge variant="warning-light" size="sm">
                              Gone quiet
                            </StatusBadge>
                          )}
                        </ItemTitle>
                        <ItemDescription className="truncate">
                          {[c.email, c.phone].filter(Boolean).join(' · ') || 'No email or phone'}
                        </ItemDescription>
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          {c.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                          <span className="text-xs text-muted-foreground">
                            {c.lastNotedAt ? `Last note ${ago(c.lastNotedAt)}` : 'No notes yet'}
                          </span>
                        </div>
                      </ItemContent>
                    </Link>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>Every member of the app sees this company.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-start gap-3">
            <Globe className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted-foreground">Website</span>
              {co.website ? (
                <WebsiteLink website={co.website} className="text-sm" />
              ) : (
                <span className="text-sm text-muted-foreground">Not given</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ContactDialog open={adding} onOpenChange={setAdding} companyId={id} />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {co.name}</DialogTitle>
            <DialogDescription>Its name and website, as everyone in the app sees them.</DialogDescription>
          </DialogHeader>
          {editing && (
            <Form kind={CompanyKind} row={co} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        title={`Delete ${co.name}?`}
        description="The people at it stay in your contacts, without a company. This cannot be undone."
        confirmLabel="Delete company"
        isLoading={remove.isPending}
        onConfirm={() =>
          remove.mutate(
            { path: { id } },
            {
              onSuccess: () => {
                toast.success(`${co.name} deleted`)
                go('/companies')
              },
              onError: (err) => {
                setDeleting(false)
                toast.error('The company was not deleted', { description: err.message })
              },
            },
          )
        }
      />
    </ContentSection>
  )
}
