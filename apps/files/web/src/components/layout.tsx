import type { ReactNode } from 'react'
import { FolderIcon } from 'lucide-react'
import { TopNav } from '@appbox/platform-web'
import { app, pages } from '@/gen/kinds.gen'

const nav = [
  {
    pages: [{ ...pages.Index, title: app.title, icon: FolderIcon }],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => <TopNav nav={nav}>{children}</TopNav>
