import type { ReactNode } from 'react'

export const Layout = ({ children }: { children: ReactNode }) => <div className="h-dvh overflow-y-auto">{children}</div>
