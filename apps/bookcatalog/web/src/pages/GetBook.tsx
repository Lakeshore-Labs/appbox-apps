import { useQuery } from '@tanstack/react-query'
import { getBookOptions } from '@/gen'
import { Card, CardContent, CardHeader, CardTitle } from '@appbox/platform-web'

export function GetBook({ id }: { id: number }) {
  const { data: book } = useQuery(getBookOptions({ path: { id } }))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{book?.title}</CardTitle>
      </CardHeader>
      <CardContent>{book?.author}</CardContent>
    </Card>
  )
}
