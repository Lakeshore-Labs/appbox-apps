import { KindPage } from '@appbox/platform-web'
import { TagKind } from '@/gen/kinds.gen'

export function ListTags() {
  return <KindPage kind={TagKind} />
}
