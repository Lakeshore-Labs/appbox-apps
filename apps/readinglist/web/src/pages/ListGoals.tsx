import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createGoalMutation, listBooksOptions, listGoalsOptions } from '@/gen'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@appbox/platform-web'

export function ListGoals() {
  const goals = useQuery(listGoalsOptions())
  const books = useQuery(listBooksOptions())
  const create = useMutation(createGoalMutation())
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [target, setTarget] = useState('12')
  const refusal = goals.error ?? books.error ?? create.error

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate({ body: { year: Number(year), target: Number(target) } })
  }

  const finishedIn = (y: number) =>
    books.data?.filter((b) => b.finishedAt && new Date(b.finishedAt).getFullYear() === y).length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="flex gap-2">
          <Input type="number" aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)} required />
          <Input
            type="number"
            aria-label="Target"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
          <Button type="submit">Set goal</Button>
        </form>
        {refusal && (
          <p role="alert" className="text-sm text-destructive">
            {refusal.message}
          </p>
        )}
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
  )
}
