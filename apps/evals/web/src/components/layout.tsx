import type { ReactNode } from 'react'
import { FlaskConicalIcon } from 'lucide-react'
import { TopNav } from '@appbox/platform-web'
import { pages } from '@/gen/kinds.gen'

const nav = [
  {
    pages: [{ ...pages.index, icon: FlaskConicalIcon }],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => <TopNav nav={nav}>{children}</TopNav>
