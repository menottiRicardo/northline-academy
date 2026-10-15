import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ErrorState, PageHeader, PageSkeleton } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatWhen } from "@/lib/format"
import type { Course, Notice } from "@/lib/types"

export function NoticesPage() {
  const auth = useAuth()
  const query = useQuery({
    queryKey: ["notices", auth.user?.id],
    queryFn: () => api<{ notices: Notice[] }>("/notices"),
  })
  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const canPost = auth.user?.role === "teacher" || auth.user?.role === "admin"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Notices"
        title="What the school posted"
        description="School-wide notes reach every desk. A course note reaches the students in that section and their parents."
      />
      {canPost ? <Composer /> : null}
      <div className="flex flex-col gap-3">
        {query.data.notices.map((notice) => (
          <Card key={notice.id}>
            <CardHeader>
              <CardDescription>
                {notice.audience} · {notice.author_name} · {formatWhen(notice.created_at)}
              </CardDescription>
              <CardTitle>{notice.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-pretty">{notice.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Composer() {
  const auth = useAuth()
  const courses = useQuery({
    queryKey: ["courses", auth.user?.id],
    queryFn: () => api<{ courses: Course[] }>("/courses"),
  })
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState(auth.user?.role === "admin" ? "school" : "")
  const queryClient = useQueryClient()
  const post = useMutation({
    mutationFn: () =>
      api<{ notices: Notice[] }>("/notices", {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          course_id: (audience || selected) === "school" ? null : Number(audience || selected),
        }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["notices", auth.user?.id], data)
      setTitle("")
      setBody("")
      toast.success("Notice posted")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "The notice was not posted.")
    },
  })

  const list = courses.data?.courses ?? []
  const items = [
    ...(auth.user?.role === "admin" ? [{ label: "Whole school", value: "school" }] : []),
    ...list.map((course) => ({ label: course.name, value: String(course.id) })),
  ]
  const selected = audience || items[0]?.value || ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a notice</CardTitle>
        <CardDescription>
          {auth.user?.role === "admin"
            ? "Send it to the whole school, or to a single course."
            : "It will go to the students in the course you choose, and to a linked parent."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!selected) return
            if (audience === "") setAudience(selected)
            post.mutate()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="notice-title">Title</FieldLabel>
              <Input
                id="notice-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={3}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notice-body">Message</FieldLabel>
              <Textarea
                id="notice-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                minLength={8}
                rows={4}
              />
            </Field>
            <Field>
              <FieldLabel>Audience</FieldLabel>
              <Select
                items={items}
                value={selected}
                onValueChange={(value) => {
                  if (value) setAudience(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={post.isPending || !selected}>
            Post notice
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
