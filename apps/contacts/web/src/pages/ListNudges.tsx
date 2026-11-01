import { useMutation, useQuery } from '@tanstack/react-query'
import { BellRing, CheckCheck, MessageSquarePlus, X } from 'lucide-react'
import { deleteNudgeMutation, listNudgesOptions } from '@/gen'
import {
  Button,
  ContentSection,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Link,
  Skeleton,
  StatusBadge,
  toast,
} from '@appbox/platform-web'
import { PersonAvatar, Refusal, ago } from '@/components/people'

export function ListNudges() {
  const nudges = useQuery(listNudgesOptions())
  const dismiss = useMutation(deleteNudgeMutation())
  const sorted = [...(nudges.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const dismissable = sorted.filter((n) => n.role === 'editor')

  const dismissAll = async () => {
    try {
      for (const n of dismissable) await dismiss.mutateAsync({ path: { id: n.id } })
      toast.success('All caught up')
    } catch (err) {
      toast.error('Not every nudge was dismissed', { description: err instanceof Error ? err.message : undefined })
    }
  }

  return (
    <ContentSection
      title="Reach out"
      desc="Contacts with no note for 2 minutes. A note starts their clock again."
      actions={
        dismissable.length > 1 ? (
          <Button variant="outline" disabled={dismiss.isPending} onClick={dismissAll}>
            <CheckCheck />
            Dismiss all
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <Refusal error={nudges.error ?? dismiss.error} title="Nudges could not be loaded" />
        {nudges.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCheck />
              </EmptyMedia>
              <EmptyTitle>All caught up</EmptyTitle>
              <EmptyDescription>
                Nobody has gone quiet. When a contact has no note for 2 minutes, they show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="flex flex-col gap-2">
            {sorted.map((n) => {
              const name = n.contactId.name ?? 'A contact'
              return (
                <Item key={n.id} variant="outline" className="flex-wrap sm:flex-nowrap">
                  <ItemMedia>
                    <PersonAvatar name={name} />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex w-full flex-wrap items-center gap-2">
                      <Link
                        to={`/contacts/${n.contactId.id}`}
                        className="truncate transition-colors hover:text-primary hover:underline"
                      >
                        {name}
                      </Link>
                      <StatusBadge variant="warning-light" size="sm">
                        <BellRing />
                        Gone quiet
                      </StatusBadge>
                    </ItemTitle>
                    <ItemDescription>
                      {n.message} · {ago(n.createdAt)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="w-full justify-end sm:w-auto">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/contacts/${n.contactId.id}`}>
                        <MessageSquarePlus />
                        Add a note
                      </Link>
                    </Button>
                    {n.role === 'editor' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={dismiss.isPending}
                        onClick={() =>
                          dismiss.mutate(
                            { path: { id: n.id } },
                            { onSuccess: () => toast.success(`Nudge about ${name} dismissed`) },
                          )
                        }
                      >
                        <X />
                        Dismiss
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        )}
      </div>
    </ContentSection>
  )
}
