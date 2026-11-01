import type { ReactNode } from 'react'
import { AlarmClockIcon } from 'lucide-react'
import { TopNav } from '@appbox/platform-web'
import { pages } from '@/gen/kinds.gen'

const nav = [
  {
    pages: [{ ...pages.ListReminders, icon: AlarmClockIcon }],
  },
]

export const Layout = ({ children }: { children: ReactNode }) => (
  <TopNav nav={nav} reading>
    {children}
  </TopNav>
)
