import { useQuery } from '@tanstack/react-query'
import { listBooksOptions, listGoalsOptions } from '@/gen'
import { Card, CardContent, CardHeader, CardTitle } from '@appbox/platform-web'

export function Dashboard() {
  const books = useQuery(listBooksOptions())
  const goals = useQuery(listGoalsOptions())
  const refusal = books.error ?? goals.error

  const finishedIn = (y: number) =>
    books.data?.filter((b) => b.finishedAt && new Date(b.finishedAt).getFullYear() === y).length ?? 0

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {refusal && (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {refusal.message}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Books</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {books.data?.map((b) => (
              <li key={b.id} className="flex justify-between border-b pb-2">
                <span>{b.title}</span>
                <span className="text-muted-foreground">{b.status}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {goals.data?.map((g) => (
              <li key={g.id} className="flex justify-between border-b pb-2">
                <span>{g.year}</span>
                <span>
                  {finishedIn(g.year)} / {g.target} books
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
