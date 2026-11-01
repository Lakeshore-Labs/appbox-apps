import type { ReactNode } from 'react'
import { BellIcon, BuildingIcon, ContactIcon } from 'lucide-react'
import { TopNav } from '@appbox/platform-web'
import { app, pages } from '@/gen/kinds.gen'

const nav = [
  {
    pages: [
      { ...pages.ListContacts, icon: ContactIcon },
      { ...pages.ListCompanies, icon: BuildingIcon },
      { ...pages.ListNudges, icon: BellIcon },
    ],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => (
  <TopNav nav={nav} reading footer={app.title}>
    {children}
  </TopNav>
)
