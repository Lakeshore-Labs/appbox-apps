import { KindPage } from '@appbox/platform-web'
import { NoteKind } from '@/gen/kinds.gen'

export function ListNotes() {
  return <KindPage kind={NoteKind} />
}
