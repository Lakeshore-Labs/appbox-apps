import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCheck } from 'lucide-react'
import { inboxOptions, markAllReadMutation, markReadMutation, unreadCountOptions } from '@/gen'
import type { Notification } from '@/gen'
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  ItemTitle,
  Skeleton,
} from '@appbox/platform-web'

export function ListNotifications() {
  const inbox = useQuery(inboxOptions())
  const unread = useQuery(unreadCountOptions())
  const markRead = useMutation(markReadMutation())
  const markAll = useMutation(markAllReadMutation())
  const refusal = inbox.error ?? unread.error ?? markRead.error ?? markAll.error
  const count = unread.data?.unread ?? 0

  const open = (n: Notification) => {
    // A URL opens beside the inbox, a path of this host in its place; anything else, which the
    // schema refuses, goes nowhere, as does a control or space character a browser would drop.
    const go = () => {
      if (/[\s\p{Cc}]/u.test(n.link)) return
      if (/^https?:\/\//i.test(n.link)) window.open(n.link, '_blank', 'noopener')
      else if (/^\/($|[^/\\])/.test(n.link)) window.location.assign(n.link)
    }
    if (n.readAt) go()
    else markRead.mutate({ body: { id: n.id } }, { onSettled: go })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Inbox
          {count > 0 && <Badge>{count} unread</Badge>}
        </CardTitle>
        <CardDescription>What your apps have told you, unread first.</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={count === 0 || markAll.isPending}
            onClick={() => markAll.mutate({})}
          >
            <CheckCheck />
            Mark all read
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {refusal && (
          <p role="alert" className="text-sm text-destructive">
            {refusal.message}
          </p>
        )}
        {inbox.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : inbox.data?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bell />
              </EmptyMedia>
              <EmptyTitle>Nothing here</EmptyTitle>
              <EmptyDescription>When one of your apps has something for you, it shows up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {inbox.data?.map((n) => (
              <Item
                key={n.id}
                variant={n.readAt ? 'default' : 'outline'}
                role="button"
                tabIndex={0}
                className="cursor-pointer transition-colors hover:bg-muted"
                onClick={() => open(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') open(n)
                }}
              >
                <ItemContent>
                  <ItemTitle className={n.readAt ? 'font-normal text-muted-foreground' : 'font-semibold'}>
                    {n.message}
                  </ItemTitle>
                  <ItemDescription>
                    {n.sourceApp} · {formatDistanceToNow(new Date(n.postedAt), { addSuffix: true })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {n.readAt ? (
                    <Badge variant="secondary">read</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        markRead.mutate({ body: { id: n.id } })
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}
