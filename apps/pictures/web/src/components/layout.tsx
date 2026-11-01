import type { ReactNode } from 'react'
import { ImageIcon } from 'lucide-react'
import { TopNav } from '@appbox/platform-web'
import { app, pages } from '@/gen/kinds.gen'

const nav = [
  {
    pages: [{ ...pages.Index, title: app.title, icon: ImageIcon }],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => <TopNav nav={nav}>{children}</TopNav>
