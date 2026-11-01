import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createBookMutation, listBooksOptions } from '@/gen'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@appbox/platform-web'

export function ListBooks() {
  const { data: books } = useQuery(listBooksOptions())
  const create = useMutation(createBookMutation())
  const [title, setTitle] = useState(''),
    [author, setAuthor] = useState('')
  return (
    <Card>
      <CardHeader>
        <CardTitle>Books</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {books?.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Link to={`/books/${b.id}`} className="underline underline-offset-4">
                    {b.title}
                  </Link>
                </TableCell>
                <TableCell>{b.author}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate(
              { body: { title, author } },
              {
                onSuccess: () => {
                  setTitle('')
                  setAuthor('')
                },
              },
            )
          }}
        >
          <Input
            aria-label="Title"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            aria-label="Author"
            placeholder="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
          />
          <Button type="submit">Add</Button>
        </form>
      </CardContent>
    </Card>
  )
}
