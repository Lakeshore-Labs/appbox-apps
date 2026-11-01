import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { X } from 'lucide-react'
import { addContactMutation, listContactsOptions, updateContactMutation } from '@/gen'
import type { Contact } from '@/gen'
import { CompanyKind } from '@/gen/kinds.gen'
import {
  initials,
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Picker,
  toast,
  useNavigate,
} from '@appbox/platform-web'

export function PersonAvatar({ name, size }: { name: string; size?: 'sm' | 'default' | 'lg' }) {
  return (
    <Avatar size={size}>
      <AvatarFallback>{initials(name.replace(/@.*/, ''), /[\s._-]+/)}</AvatarFallback>
    </Avatar>
  )
}

/** How long ago an instant the server answered was, "3 minutes ago". */
export function ago(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true })
}

export function Refusal({ error, title }: { error: Error | null | undefined; title?: string }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertTitle>{title ?? 'That did not work'}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

const tagsOf = (text: string) => [
  ...new Set(
    text
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  ),
]

function ContactFields({ contact, companyId, onDone }: { contact?: Contact; companyId?: number; onDone: () => void }) {
  const all = useQuery(listContactsOptions())
  const add = useMutation(addContactMutation())
  const update = useMutation(updateContactMutation())
  const go = useNavigate()
  const [name, setName] = useState(contact?.name ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [company, setCompany] = useState(
    contact?.companyId ? String(contact.companyId.id) : companyId != null ? String(companyId) : '',
  )
  const [tags, setTags] = useState(contact?.tags.join(', ') ?? '')
  const chosen = tagsOf(tags)
  const known = [...new Set((all.data ?? []).flatMap((c) => c.tags))].filter((t) => !chosen.includes(t)).sort()
  const pending = add.isPending || update.isPending
  const error = add.error ?? update.error

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const fields = { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, tags: chosen }
    const companyValue = company ? Number(company) : null
    if (contact) {
      update.mutate(
        { path: { id: contact.id }, body: { ...fields, companyId: companyValue } },
        {
          onSuccess: () => {
            toast.success('Contact saved')
            onDone()
          },
        },
      )
    } else {
      add.mutate(
        { body: { ...fields, company: companyValue } },
        {
          onSuccess: (c) => {
            toast.success(`${c.name} added`)
            onDone()
            go(`/contacts/${c.id}`)
          },
        },
      )
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            autoFocus
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-phone">Phone</Label>
          <Input
            id="contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+44 20 7946 0000"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Company</Label>
          <div className="flex gap-2">
            <Picker kind={CompanyKind} value={company} onChange={setCompany} className="flex-1" />
            {company && (
              <Button type="button" variant="ghost" size="icon" aria-label="No company" onClick={() => setCompany('')}>
                <X />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="contact-tags">Tags</Label>
          <Input
            id="contact-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="customer, press"
          />
          {known.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-muted-foreground">Add:</span>
              {known.slice(0, 12).map((t) => (
                <Badge key={t} asChild variant="outline">
                  <button
                    type="button"
                    className="cursor-pointer transition-colors hover:bg-muted"
                    onClick={() => setTags([...chosen, t].join(', '))}
                  >
                    {t}
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <Refusal error={error} title="The contact was not saved" />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !name.trim()}>
          {contact ? 'Save changes' : 'Add contact'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Adds a contact, or with contact changes it; companyId prefills a new one's company. */
export function ContactDialog({
  open,
  onOpenChange,
  contact,
  companyId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  companyId?: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? `Edit ${contact.name}` : 'New contact'}</DialogTitle>
          <DialogDescription>
            {contact ? 'Who they are and how to reach them.' : 'Only you see a new contact until you share it.'}
          </DialogDescription>
        </DialogHeader>
        {open && <ContactFields contact={contact} companyId={companyId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
