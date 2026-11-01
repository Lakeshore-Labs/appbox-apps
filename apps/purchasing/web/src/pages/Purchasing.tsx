import { useEffect, useState } from 'react'
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import {
  approvePurchaseOrderMutation,
  cancelPurchaseOrderMutation,
  createApproverMutation,
  createOrderLineMutation,
  createPurchaseOrderMutation,
  createSupplierMutation,
  deleteOrderLineMutation,
  deletePurchaseOrderMutation,
  deleteSupplierMutation,
  historyPurchaseOrderMutation,
  listApproversOptions,
  listOrderLinesOptions,
  listPurchaseOrdersOptions,
  listSuppliersOptions,
  myNotifications,
  readNotificationMutation,
  rejectPurchaseOrderMutation,
  submitPurchaseOrderMutation,
  updateApproverMutation,
  updateSupplierMutation,
  whoami,
  type Approver,
} from '@/gen'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  Label,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@appbox/platform-web'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive'

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'outline' },
  pending_manager: { label: 'Awaiting manager', variant: 'secondary' },
  pending_finance: { label: 'Awaiting finance director', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  closed: { label: 'Closed: rejected', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
}

const STAGE: Record<string, string> = { manager: 'Manager', finance: 'Finance director', automatic: 'Automatic' }

const ACTION: Record<string, BadgeVariant> = {
  submitted: 'outline',
  approved: 'default',
  rejected: 'destructive',
  closed: 'destructive',
  cancelled: 'secondary',
}

const money = (v: string | number) =>
  `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const when = (v: string) => new Date(v).toLocaleString()

const stageOf = (status: string) =>
  status === 'pending_manager' ? 'manager' : status === 'pending_finance' ? 'finance' : ''

const cancellable = (status: string) => ['draft', 'pending_manager', 'pending_finance', 'rejected'].includes(status)

const isMine = (requester: string, me: string) => me !== '' && (requester === me || requester.endsWith(':' + me))

// People are member ids; name them from the approvers list where it knows them.
function usePeople(me: string) {
  const approvers = useQuery(listApproversOptions())
  const name = (id: string) => {
    if (id === '') return ''
    if (id === 'system') return 'Automatic'
    const bare = id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id
    if (bare === me) return 'You'
    for (const a of approvers.data ?? []) {
      if (a.member === bare && a.memberName) return a.memberName
      if (a.backup === bare && a.backupName) return a.backupName
    }
    return bare.slice(0, 8)
  }
  const waitingOn = (status: string, escalated: boolean) => {
    const stage = stageOf(status)
    if (stage === '') return ''
    const a = approvers.data?.find((x) => x.stage === stage)
    if (!a) return `${STAGE[stage]} (not set up)`
    return escalated ? `${name(a.member)} or backup ${name(a.backup)}` : name(a.member)
  }
  const canAct = (status: string) => {
    const a = approvers.data?.find((x) => x.stage === stageOf(status))
    return !!a && (a.member === me || a.backup === me)
  }
  return { name, waitingOn, canAct }
}

const myNotificationsQuery = queryOptions({
  queryKey: ['myNotifications'],
  queryFn: async ({ signal }) => (await myNotifications({ signal, throwOnError: true })).data,
})

export function Purchasing() {
  const who = useQuery({
    queryKey: ['whoami'],
    queryFn: async ({ signal }) => (await whoami({ signal, throwOnError: true })).data,
  })
  const notes = useQuery(myNotificationsQuery)
  const me = who.data?.member ?? ''
  const unread = notes.data?.filter((n) => !n.read).length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchasing</CardTitle>
        <CardDescription>
          Purchase orders and their approvals: up to $1,000 is approved on submit, up to $10,000 needs a manager, above
          that a manager and then the finance director.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="orders" className="gap-4">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              Notifications
              {unread > 0 && <Badge>{unread}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="approvers">Approvers</TabsTrigger>
          </TabsList>
          <TabsContent value="orders">
            <Orders me={me} />
          </TabsContent>
          <TabsContent value="notifications">
            <Notifications />
          </TabsContent>
          <TabsContent value="suppliers">
            <Suppliers />
          </TabsContent>
          <TabsContent value="approvers">
            <Approvers me={me} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function Refusal({ error }: { error: Error | null | undefined }) {
  if (!error) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

function Orders({ me }: { me: string }) {
  const orders = useQuery(listPurchaseOrdersOptions())
  const suppliers = useQuery(listSuppliersOptions())
  const create = useMutation(createPurchaseOrderMutation())
  const people = usePeople(me)
  const [supplierId, setSupplierId] = useState('')
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  const supplierName = (id: number) => suppliers.data?.find((s) => s.id === id)?.name ?? `#${id}`
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate(
      { body: { supplierId: Number(supplierId), title } },
      {
        onSuccess: (o) => {
          setTitle('')
          setOpen(o.id)
        },
      },
    )
  }
  const sorted = [...(orders.data ?? [])].sort((a, b) => b.id - a.id)

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex gap-2">
        <select
          aria-label="Supplier"
          className="rounded-md border bg-transparent px-3 text-sm"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          required
        >
          <option value="">Supplier</option>
          {suppliers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="What is this order for?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Button type="submit" disabled={create.isPending}>
          New order
        </Button>
      </form>
      <Refusal error={orders.error ?? create.error} />
      {orders.isPending ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No purchase orders yet</EmptyTitle>
            <EmptyDescription>
              {suppliers.data?.length === 0
                ? 'Add a supplier under Suppliers, then start an order above.'
                : 'Pick a supplier and start an order above.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Waiting on</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((o) => (
              <TableRow key={o.id} className="cursor-pointer transition-colors" onClick={() => setOpen(o.id)}>
                <TableCell>
                  <div className="font-medium">{o.title}</div>
                  <div className="text-xs text-muted-foreground">PO #{o.id}</div>
                </TableCell>
                <TableCell>{supplierName(o.supplierId.id)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(o.total)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS[o.status]?.variant ?? 'outline'}>{STATUS[o.status]?.label ?? o.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">{people.waitingOn(o.status, o.escalated) || '—'}</TableCell>
                <TableCell className="text-sm">{people.name(o.requester.id)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline">
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {open !== null && <OrderDetail id={open} me={me} onGone={() => setOpen(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrderDetail({ id, me, onGone }: { id: number; me: string; onGone: () => void }) {
  const orders = useQuery(listPurchaseOrdersOptions())
  const suppliers = useQuery(listSuppliersOptions())
  const allLines = useQuery(listOrderLinesOptions())
  const history = useMutation(historyPurchaseOrderMutation())
  const readHistory = history.mutate
  const people = usePeople(me)
  const addLine = useMutation(createOrderLineMutation())
  const removeLine = useMutation(deleteOrderLineMutation())
  const remove = useMutation(deletePurchaseOrderMutation())
  const submit = useMutation(submitPurchaseOrderMutation())
  const approve = useMutation(approvePurchaseOrderMutation())
  const reject = useMutation(rejectPurchaseOrderMutation())
  const cancel = useMutation(cancelPurchaseOrderMutation())
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [reason, setReason] = useState('')

  const order = orders.data?.find((o) => o.id === id)
  // A row method locks the order and emits an event. An unchanged cached order must not call it again.
  useEffect(() => {
    if (order) readHistory({ path: { id } })
  }, [id, order, readHistory])
  if (!order) return <Loading />
  const lines = (allLines.data ?? []).filter((l) => l.orderId.id === id)
  const draft = order.status === 'draft'
  const supplier = suppliers.data?.find((s) => s.id === order.supplierId.id)
  const refusal =
    allLines.error ??
    history.error ??
    addLine.error ??
    removeLine.error ??
    remove.error ??
    submit.error ??
    approve.error ??
    reject.error ??
    cancel.error

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    addLine.mutate(
      { body: { orderId: id, description, quantity: Number(quantity), unitPrice } },
      {
        onSuccess: () => {
          setDescription('')
          setQuantity('1')
          setUnitPrice('')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          PO #{order.id}: {order.title}
          <Badge variant={STATUS[order.status]?.variant ?? 'outline'}>
            {STATUS[order.status]?.label ?? order.status}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          {supplier
            ? `${supplier.name} · ${supplier.contactEmail} · net ${supplier.paymentTermsDays} days`
            : 'Supplier'}{' '}
          · requested by {people.name(order.requester.id)}
          {order.rejections > 0 && ` · rejected ${order.rejections} of 3 times`}
          {stageOf(order.status) !== '' && ` · waiting on ${people.waitingOn(order.status, order.escalated)}`}
        </DialogDescription>
      </DialogHeader>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            {draft && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 && (
            <TableRow>
              <TableCell colSpan={draft ? 5 : 4} className="text-sm text-muted-foreground">
                No lines yet. Add what you are buying below.
              </TableCell>
            </TableRow>
          )}
          {lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.description}</TableCell>
              <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{money(l.unitPrice)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(l.quantity * Number(l.unitPrice))}</TableCell>
              {draft && (
                <TableCell className="text-right">
                  <Button size="xs" variant="ghost" onClick={() => removeLine.mutate({ path: { id: l.id } })}>
                    Remove
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right tabular-nums">{money(order.total)}</TableCell>
            {draft && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>

      {draft && (
        <form onSubmit={add} className="flex gap-2">
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <Input
            aria-label="Quantity"
            className="w-24"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            aria-label="Unit price"
            className="w-32"
            type="number"
            min={0}
            step="0.01"
            placeholder="Unit price $"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
          <Button type="submit" variant="secondary" disabled={addLine.isPending}>
            Add line
          </Button>
        </form>
      )}

      <Refusal error={refusal} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {draft && (
          <Button variant="ghost" onClick={() => remove.mutate({ path: { id } }, { onSuccess: onGone })}>
            Delete draft
          </Button>
        )}
        {cancellable(order.status) && isMine(order.requester.id, me) && (
          <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate({ path: { id } })}>
            Cancel order
          </Button>
        )}
        {(draft || order.status === 'rejected') && (
          <Button disabled={submit.isPending || lines.length === 0} onClick={() => submit.mutate({ path: { id } })}>
            {draft ? 'Submit' : 'Resubmit'}
          </Button>
        )}
      </div>

      {stageOf(order.status) !== '' && people.canAct(order.status) && (
        <div className="flex flex-col gap-2 rounded-md border p-4">
          <Label htmlFor="reason">Your decision as {STAGE[stageOf(order.status)].toLowerCase()}</Label>
          <Textarea
            id="reason"
            placeholder="Reason, required to reject"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              disabled={reject.isPending || reason.trim() === ''}
              onClick={() => reject.mutate({ path: { id }, body: { reason } }, { onSuccess: () => setReason('') })}
            >
              Reject
            </Button>
            <Button disabled={approve.isPending} onClick={() => approve.mutate({ path: { id } })}>
              Approve
            </Button>
          </div>
        </div>
      )}

      <Separator />
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">History</h3>
        {history.isIdle || history.isPending ? (
          <Loading />
        ) : (history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet: the order has not been submitted.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap">{when(e.at)}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION[e.action] ?? 'outline'}>{e.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{STAGE[e.stage] ?? ''}</TableCell>
                  <TableCell className="text-sm">{people.name(e.actor)}</TableCell>
                  <TableCell className="text-sm">{e.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function Notifications() {
  const notes = useQuery(myNotificationsQuery)
  const read = useMutation(readNotificationMutation())

  if (notes.isPending) return <Loading />
  if ((notes.data ?? []).length === 0)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No notifications</EmptyTitle>
          <EmptyDescription>Approval requests, reminders and decisions on your orders show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <div className="flex flex-col gap-2">
      <Refusal error={notes.error ?? read.error} />
      <Table>
        <TableBody>
          {notes.data?.map((n) => (
            <TableRow key={n.id} className={n.read ? 'text-muted-foreground' : ''}>
              <TableCell className="w-24">
                <Badge variant={n.read ? 'outline' : 'default'}>{n.read ? 'Read' : 'New'}</Badge>
              </TableCell>
              <TableCell className="text-sm whitespace-normal">{n.message}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">{when(n.createdAt)}</TableCell>
              <TableCell className="text-right">
                {!n.read && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={read.isPending}
                    onClick={() => read.mutate({ body: { id: n.id } })}
                  >
                    Mark read
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Suppliers() {
  const suppliers = useQuery(listSuppliersOptions())
  const create = useMutation(createSupplierMutation())
  const update = useMutation(updateSupplierMutation())
  const remove = useMutation(deleteSupplierMutation())
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [terms, setTerms] = useState('30')

  const reset = () => {
    setEditing(null)
    setName('')
    setEmail('')
    setTerms('30')
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const body = { name, contactEmail: email, paymentTermsDays: Number(terms) }
    if (editing === null) create.mutate({ body }, { onSuccess: reset })
    else update.mutate({ path: { id: editing }, body }, { onSuccess: reset })
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={save} className="flex gap-2">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          placeholder="Contact email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          aria-label="Payment terms in days"
          className="w-28"
          type="number"
          min={0}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          required
        />
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {editing === null ? 'Add supplier' : 'Save'}
        </Button>
        {editing !== null && (
          <Button type="button" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        )}
      </form>
      <Refusal error={suppliers.error ?? create.error ?? update.error ?? remove.error} />
      {suppliers.isPending ? (
        <Loading />
      ) : (suppliers.data ?? []).length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No suppliers yet</EmptyTitle>
            <EmptyDescription>Add the suppliers you buy from above.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact email</TableHead>
              <TableHead className="text-right">Payment terms</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.contactEmail}</TableCell>
                <TableCell className="text-right">{s.paymentTermsDays} days</TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(s.id)
                      setName(s.name)
                      setEmail(s.contactEmail)
                      setTerms(String(s.paymentTermsDays))
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate({ path: { id: s.id } })}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function Approvers({ me }: { me: string }) {
  const approvers = useQuery(listApproversOptions())
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Name each approver and their backup by member id; a backup is notified when an order has waited 5 minutes and
        can approve or reject it too. Your member id is <span className="font-mono text-foreground">{me || '…'}</span>.
      </p>
      <Refusal error={approvers.error} />
      {approvers.isPending ? (
        <Loading />
      ) : (
        (['manager', 'finance'] as const).map((stage) => (
          <StageApprover key={stage} stage={stage} current={approvers.data?.find((a) => a.stage === stage)} />
        ))
      )}
    </div>
  )
}

type ApproverRow = { id: number; member: string; memberName: string; backup: string; backupName: string }

function StageApprover({ stage, current }: { stage: Approver['stage']; current: ApproverRow | undefined }) {
  const create = useMutation(createApproverMutation())
  const update = useMutation(updateApproverMutation())
  const [member, setMember] = useState(current?.member ?? '')
  const [memberName, setMemberName] = useState(current?.memberName ?? '')
  const [backup, setBackup] = useState(current?.backup ?? '')
  const [backupName, setBackupName] = useState(current?.backupName ?? '')

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const body = { member: member.trim(), memberName, backup: backup.trim(), backupName }
    if (current) update.mutate({ path: { id: current.id }, body })
    else create.mutate({ body: { stage, ...body } })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{STAGE[stage]}</h3>
        {!current && <Badge variant="destructive">Not set up</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Approver's name" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
        <Input placeholder="Approver's member id" value={member} onChange={(e) => setMember(e.target.value)} required />
        <Input placeholder="Backup's name" value={backupName} onChange={(e) => setBackupName(e.target.value)} />
        <Input placeholder="Backup's member id" value={backup} onChange={(e) => setBackup(e.target.value)} required />
      </div>
      <Refusal error={create.error ?? update.error} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={create.isPending || update.isPending}>
          Save
        </Button>
      </div>
    </form>
  )
}
