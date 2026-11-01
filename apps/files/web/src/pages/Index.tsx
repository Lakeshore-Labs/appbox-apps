import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileIcon, Pencil, Search, Trash2, Upload as UploadIcon } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { putFileMutation, removeFileMutation, searchFilesOptions } from '@/gen'
import { updateFile } from '@/gen/connections/file'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FileLink,
  FilePicker,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  fileURL,
} from '@appbox/platform-web'

const selectClass = 'h-9 rounded-md border bg-transparent px-3 text-sm'

function size(n: number) {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

// The bytes go to the platform's file service through putFile; nothing keeps them here.
function base64(f: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })
}

export function Index() {
  const qc = useQueryClient()
  const [app, setApp] = useState('')
  const [q, setQ] = useState('')
  const files = useQuery(searchFilesOptions({ query: { app: app || undefined, q: q || undefined } }))
  const refresh = () => qc.invalidateQueries()
  const put = useMutation({ ...putFileMutation(), onSuccess: refresh })
  const remove = useMutation({ ...removeFileMutation(), onSuccess: refresh })
  const rename = useMutation({
    mutationFn: async (v: { id: string; name: string }) => (await updateFile({ body: v, throwOnError: true })).data,
    onSuccess: refresh,
  })

  const [picked, setPicked] = useState<string | File>('')
  const [label, setLabel] = useState('')
  const [reading, setReading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [confirming, setConfirming] = useState(false)

  const list = files.data?.files ?? []
  const apps = files.data?.apps ?? []
  const open = list.find((f) => f.id === openId) ?? null
  const refusal = files.error ?? put.error ?? remove.error ?? rename.error

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!(picked instanceof File)) return
    setReading(true)
    try {
      const content = await base64(picked)
      put.mutate(
        { body: { name: picked.name, contentType: picked.type || 'application/octet-stream', content, label } },
        {
          onSuccess: () => {
            setPicked('')
            setLabel('')
          },
        },
      )
    } finally {
      setReading(false)
    }
  }

  const show = (id: string, name: string) => {
    setOpenId(id)
    setNewName(name)
    setConfirming(false)
    rename.reset()
    remove.reset()
  }
  const close = () => {
    setOpenId(null)
    setConfirming(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            Every file your apps hold. Open one to see it, download it, rename it or delete it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-md border p-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="flex flex-col gap-1">
              <Label>File</Label>
              <FilePicker value={picked} onChange={setPicked} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="f-label">What it is</Label>
              <Input
                id="f-label"
                placeholder="Signed contract, March"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={!(picked instanceof File) || reading || put.isPending}>
                <UploadIcon />
                Put in
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <select aria-label="App" className={selectClass} value={app} onChange={(e) => setApp(e.target.value)}>
              <option value="">All apps</option>
              {apps.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Search by name"
                className="pl-8"
                placeholder="Search by name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {refusal && !openId && (
            <p role="alert" className="text-sm text-destructive">
              {refusal.message}
            </p>
          )}

          {files.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : list.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No files</EmptyTitle>
                <EmptyDescription>
                  {app || q ? 'Nothing matches; widen the search.' : 'Put a file in above, or add one in any app.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Put there by</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer" onClick={() => show(f.id, f.name)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <FileIcon className="size-4 text-muted-foreground" />
                        {f.name}
                      </span>
                      {f.label && <span className="text-xs text-muted-foreground">{f.label}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.contentType}</TableCell>
                    <TableCell>{size(f.size)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{f.app}</Badge>
                    </TableCell>
                    <TableCell>{f.createdByEmail ?? f.createdBy}</TableCell>
                    <TableCell title={format(new Date(f.createdAt), 'PPpp')}>
                      {formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open != null}
        onOpenChange={(o) => {
          if (!o) close()
        }}
      >
        {open && (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{open.name}</DialogTitle>
              <DialogDescription>
                {open.label ? `${open.label} · ` : ''}
                {open.contentType} · {size(open.size)} · {open.app} · {open.createdByEmail ?? open.createdBy},{' '}
                {format(new Date(open.createdAt), 'PPp')}
              </DialogDescription>
            </DialogHeader>
            {open.contentType.startsWith('image/') ? (
              <div className="flex justify-center rounded-md border p-2">
                <FileLink file={open} at={open.app} picture />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border p-4">
                <FileLink file={open} at={open.app} />
              </div>
            )}
            <Button variant="outline" asChild>
              <a href={fileURL(open.id, open.app)} download={open.name}>
                <Download />
                Download
              </a>
            </Button>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                rename.mutate({ id: open.id, name: newName })
              }}
            >
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="f-name">Name</Label>
                <Input id="f-name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={rename.isPending || newName.trim() === '' || newName === open.name}
              >
                <Pencil />
                Rename
              </Button>
            </form>
            {(rename.error ?? remove.error) && (
              <p role="alert" className="text-sm text-destructive">
                {(rename.error ?? remove.error)?.message}
              </p>
            )}
            <DialogFooter>
              {confirming ? (
                <>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    Keep it
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ body: { id: open.id } }, { onSuccess: close })}
                  >
                    <Trash2 />
                    Delete for good
                  </Button>
                </>
              ) : (
                <Button variant="destructive" onClick={() => setConfirming(true)}>
                  <Trash2 />
                  Delete
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
