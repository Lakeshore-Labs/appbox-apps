import { ExternalLink } from 'lucide-react'

/** A company's website as a link that opens in a new tab; a bare domain is taken as https. */
export function WebsiteLink({ website, className }: { website: string; className?: string }) {
  const href = /^https?:\/\//i.test(website) ? website : `https://${website}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex min-w-0 items-center gap-1 transition-colors hover:text-primary hover:underline ${className ?? ''}`}
    >
      <span className="truncate">{website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  )
}
