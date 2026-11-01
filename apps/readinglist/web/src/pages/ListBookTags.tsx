import { KindPage } from '@appbox/platform-web'
import { BookTagKind } from '@/gen/kinds.gen'

export function ListBookTags() {
  return <KindPage kind={BookTagKind} />
}
