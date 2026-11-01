import { useQuery } from '@tanstack/react-query'
import { listBooksByOptions } from '@/gen'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@appbox/platform-web'

export function ListBooksBy({ author }: { author?: string }) {
  const { data: books } = useQuery(listBooksByOptions({ query: { author } }))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{author ? `Books by ${author}` : 'Books'}</CardTitle>
      </CardHeader>
      <CardContent>
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
                <TableCell>{b.title}</TableCell>
                <TableCell>{b.author}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
