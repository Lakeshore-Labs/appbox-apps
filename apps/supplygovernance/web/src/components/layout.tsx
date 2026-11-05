import type { ReactNode } from "react";

// The modeling page supplies LayoutFrame's top slot from its live view state.
export function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
