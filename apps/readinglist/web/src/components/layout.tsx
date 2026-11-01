import type { ReactNode } from 'react'
import {
  BookOpenIcon,
  ClipboardListIcon,
  GaugeIcon,
  NotebookPenIcon,
  TagIcon,
  TagsIcon,
  TargetIcon,
} from 'lucide-react'
import { Sections } from '@appbox/platform-web'
import { pages } from '@/gen/kinds.gen'

const nav = [
  {
    name: 'Library',
    pages: [
      { ...pages.ListBooks, icon: BookOpenIcon },
      { ...pages.ListNotes, icon: NotebookPenIcon },
      { ...pages.ListTags, icon: TagIcon },
      { ...pages.ListBookTags, icon: TagsIcon },
      { ...pages.ListBookDetails, icon: ClipboardListIcon },
    ],
  },
  {
    name: 'Progress',
    pages: [
      { ...pages.Dashboard, icon: GaugeIcon },
      { ...pages.ListGoals, icon: TargetIcon },
    ],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => <Sections nav={nav}>{children}</Sections>
