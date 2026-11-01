import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { addBookByTitleMutation, createBookMutation, finishBookMutation, listBooksOptions } from '@/gen'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@appbox/platform-web'

export function ListBooks() {
  const books = useQuery(listBooksOptions())
  const create = useMutation(createBookMutation())
  const byTitle = useMutation(addBookByTitleMutation()) // a refusal for want of a connection names it
  const finish = useMutation(finishBookMutation())
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [refused, setRefused] = useState<Error | null>(null) // the latest write's, cleared by the next one done
  const refusal = books.error ?? refused

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const added = {
      onError: setRefused,
      onSuccess: () => {
        setTitle('')
        setAuthor('')
        setRefused(null)
      },
    }
    if (author.trim()) create.mutate({ body: { title, author } }, added)
    else byTitle.mutate({ body: { title } }, added)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Books</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex gap-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input
            placeholder="Author (optional)"
            aria-label="Author (optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Button type="submit">Add</Button>
        </form>
        <p className="text-sm text-muted-foreground">Leave the author blank to look up the title in Book Catalog.</p>
        {refusal && (
          <p role="alert" className="text-sm text-destructive">
            {refusal.message}
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.data?.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.title}</TableCell>
                <TableCell>{b.author}</TableCell>
                <TableCell>
                  <Badge variant={b.status === 'finished' ? 'default' : 'secondary'}>{b.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {b.status !== 'finished' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        finish.mutate(
                          { path: { id: b.id } },
                          { onSuccess: () => setRefused(null), onError: setRefused },
                        )
                      }
                    >
                      Finish
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
