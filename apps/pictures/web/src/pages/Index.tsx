import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, MessageCircleQuestion, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  askPictureMutation,
  listPicturesOptions,
  makePictureMutation,
  putPictureMutation,
  removePictureMutation,
  retitlePictureMutation,
} from '@/gen'
import {
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
  FilePicker,
  Input,
  Label,
  Skeleton,
  Textarea,
  fileURL,
} from '@appbox/platform-web'

// The bytes go to the platform's file service through putPicture; nothing keeps them here.
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
  const pictures = useQuery(listPicturesOptions())
  const refresh = () => qc.invalidateQueries()
  const make = useMutation({ ...makePictureMutation(), onSuccess: refresh })
  const put = useMutation({ ...putPictureMutation(), onSuccess: refresh })
  const retitle = useMutation({ ...retitlePictureMutation(), onSuccess: refresh })
  const ask = useMutation({ ...askPictureMutation(), onSuccess: refresh })
  const remove = useMutation({ ...removePictureMutation(), onSuccess: refresh })

  const [prompt, setPrompt] = useState('')
  const [picked, setPicked] = useState<string | File>('')
  const [reading, setReading] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [confirming, setConfirming] = useState(false)

  const list = [...(pictures.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  const open = list.find((p) => p.id === openId) ?? null
  const refusal = pictures.error ?? make.error ?? put.error

  const submitPrompt = (e: React.FormEvent) => {
    e.preventDefault()
    make.mutate({ body: { prompt } }, { onSuccess: () => setPrompt('') })
  }

  const submitFile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!(picked instanceof File)) return
    setReading(true)
    try {
      const content = await base64(picked)
      put.mutate(
        { body: { name: picked.name, contentType: picked.type, content } },
        {
          onSuccess: (p) => {
            setPicked('')
            show(p.id, p.title)
          },
        },
      )
    } finally {
      setReading(false)
    }
  }

  const show = (id: number, t: string | null) => {
    setOpenId(id)
    setTitle(t ?? '')
    setQuestion('')
    setConfirming(false)
    retitle.reset()
    ask.reset()
    remove.reset()
  }
  const close = () => {
    setOpenId(null)
    setConfirming(false)
  }
  const dialogRefusal = retitle.error ?? ask.error ?? remove.error

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Pictures</CardTitle>
          <CardDescription>
            Describe what you want to see and it is made for you, or put in a picture of your own. Open one to see it
            large.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <form onSubmit={submitPrompt} className="flex flex-col gap-2 rounded-md border p-4">
              <Label htmlFor="p-prompt">What do you want to see?</Label>
              <Textarea
                id="p-prompt"
                placeholder="A lighthouse at dusk, watercolour"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
              <Button type="submit" disabled={make.isPending || prompt.trim() === ''}>
                <Sparkles />
                {make.isPending ? 'Making it…' : 'Make the picture'}
              </Button>
            </form>
            <form onSubmit={submitFile} className="flex flex-col gap-2 rounded-md border p-4">
              <Label>Put in a picture of your own</Label>
              <FilePicker value={picked} onChange={setPicked} accept="image/*" required />
              <Button type="submit" variant="outline" disabled={!(picked instanceof File) || reading || put.isPending}>
                <ImagePlus />
                Put it in
              </Button>
            </form>
          </div>

          {refusal && !open && (
            <p role="alert" className="text-sm text-destructive">
              {refusal.message}
            </p>
          )}

          {pictures.isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No pictures yet</EmptyTitle>
                <EmptyDescription>Ask for one above, or put one in.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => show(p.id, p.title)}
                  className="group flex flex-col overflow-hidden rounded-md border text-left hover:ring-2 hover:ring-primary"
                >
                  <img
                    src={fileURL(p.file.id, 'pictures')}
                    alt={p.title ?? p.prompt ?? 'Picture'}
                    loading="lazy"
                    className="aspect-square w-full bg-muted object-cover"
                  />
                  <div className="flex flex-col gap-0.5 p-2">
                    <span className="truncate text-sm font-medium">{p.title ?? p.prompt ?? 'Untitled'}</span>
                    <span
                      className="truncate text-xs text-muted-foreground"
                      title={format(new Date(p.createdAt), 'PPpp')}
                    >
                      {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
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
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{open.title ?? 'Untitled'}</DialogTitle>
              <DialogDescription>
                {open.prompt ? 'Made' : 'Put in'} {format(new Date(open.createdAt), 'PPp')}
              </DialogDescription>
            </DialogHeader>
            <img
              src={fileURL(open.file.id, 'pictures')}
              alt={open.title ?? open.prompt ?? 'Picture'}
              className="max-h-[60vh] w-full rounded-md border bg-muted object-contain"
            />
            {open.prompt && (
              <div className="flex flex-col gap-1">
                <Label>Asked for</Label>
                <p className="text-sm">{open.prompt}</p>
              </div>
            )}
            {open.question && (
              <div className="flex flex-col gap-1">
                <Label>{open.question}</Label>
                <p className="text-sm whitespace-pre-wrap">{open.answer ?? '—'}</p>
              </div>
            )}
            {open.role === 'editor' && (
              <>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    retitle.mutate({ path: { id: open.id }, body: { title } })
                  }}
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <Label htmlFor="p-title">Title</Label>
                    <Input
                      id="p-title"
                      placeholder="Give it a title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={retitle.isPending || title === (open.title ?? '')}>
                    <Pencil />
                    Save title
                  </Button>
                </form>
                {!open.prompt && (
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      ask.mutate({ path: { id: open.id }, body: { question } }, { onSuccess: () => setQuestion('') })
                    }}
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <Label htmlFor="p-question">Ask about it</Label>
                      <Input
                        id="p-question"
                        placeholder="What is in this picture?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" variant="outline" disabled={ask.isPending || question.trim() === ''}>
                      <MessageCircleQuestion />
                      Ask
                    </Button>
                  </form>
                )}
              </>
            )}
            {dialogRefusal && (
              <p role="alert" className="text-sm text-destructive">
                {dialogRefusal.message}
              </p>
            )}
            {open.role === 'editor' && (
              <DialogFooter>
                {confirming ? (
                  <>
                    <Button variant="ghost" onClick={() => setConfirming(false)}>
                      Keep it
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ path: { id: open.id } }, { onSuccess: close })}
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
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
