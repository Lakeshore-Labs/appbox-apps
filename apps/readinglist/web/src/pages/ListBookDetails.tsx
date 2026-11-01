import { KindPage } from '@appbox/platform-web'
import { BookDetailKind } from '@/gen/kinds.gen'

export function ListBookDetails() {
  return <KindPage kind={BookDetailKind} />
}
