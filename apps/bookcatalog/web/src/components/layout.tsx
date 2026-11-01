import type { ReactNode } from 'react'
import { BookOpenIcon, UsersIcon } from 'lucide-react'
import { TopNav } from '@appbox/platform-web'
import { pages } from '@/gen/kinds.gen'

const nav = [
  {
    pages: [
      { ...pages.ListBooks, icon: BookOpenIcon },
      { ...pages.ListBooksBy, title: 'By author', icon: UsersIcon },
    ],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => <TopNav nav={nav}>{children}</TopNav>
