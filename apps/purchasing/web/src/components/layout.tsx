import type { ReactNode } from 'react'
import { ShoppingCartIcon } from 'lucide-react'
import { TopNav } from '@appbox/platform-web'
import { pages } from '@/gen/kinds.gen'

const nav = [
  {
    pages: [{ ...pages.Purchasing, icon: ShoppingCartIcon }],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => <TopNav nav={nav}>{children}</TopNav>
