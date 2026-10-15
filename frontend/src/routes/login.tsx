import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Crest } from "@/components/crest"
import { ErrorState } from "@/components/page"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { DemoAccount } from "@/lib/types"

export function LoginPage() {
  const auth = useAuth()
  const demos = useQuery({
    queryKey: ["demos"],
    queryFn: () =>
      api<{ password: string; accounts: DemoAccount[]; term: string }>("/auth/demos"),
    placeholderData: {
      password: "northline",
      term: "Fall 2026",
      accounts: [
        { role: "admin", full_name: "Elena Voss", email: "elena.voss@northline.edu", detail: "Registrar", featured: true },
        { role: "teacher", full_name: "Marcus Hale", email: "marcus.hale@northline.edu", detail: "Mathematics", featured: true },
        { role: "student", full_name: "Avery Chen", email: "avery.chen@northline.edu", detail: "Grade 11 · Rowan", featured: true },
        { role: "parent", full_name: "Diane Chen", email: "diane.chen@northline.edu", detail: "Avery's mother", featured: true },
      ],
    },
  })
  const [email, setEmail] = useState("avery.chen@northline.edu")
  const [password, setPassword] = useState("northline")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showMore, setShowMore] = useState(false)

  async function signIn(nextEmail: string, nextPassword: string) {
    setPending(true)
    setError(null)
    try {
      await auth.login(nextEmail, nextPassword)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.")
    } finally {
      setPending(false)
    }
  }

  const accounts = demos.data?.accounts ?? []
  const featured = accounts.filter((account) => account.featured)
  const rest = accounts.filter((account) => !account.featured)

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-sidebar px-10 py-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <Crest />
          <div>
            <p className="font-heading text-2xl leading-none">Northline Academy</p>
            <p className="text-sm text-sidebar-foreground/70">Upper school · {demos.data?.term ?? "Fall 2026"}</p>
          </div>
        </div>
        <div className="flex max-w-lg flex-col gap-4">
          <h1 className="font-heading text-5xl leading-[1.05] font-medium text-balance">
            One register for the classroom and the kitchen table.
          </h1>
          <p className="text-lg text-sidebar-foreground/80 text-pretty">
            Students see their own marks. A parent sees one child. Teachers keep the gradebook
            for the courses they teach.
          </p>
        </div>
        <p className="text-sm text-sidebar-foreground/70">Grades 9–12 · Harbor Hill</p>
      </section>
      <section className="flex h-svh flex-col overflow-y-auto px-4 py-8">
        <div className="mx-auto my-auto flex w-full max-w-md flex-col gap-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Crest className="text-primary" />
            <div>
              <p className="font-heading text-2xl leading-none">Northline Academy</p>
              <p className="text-sm text-muted-foreground">Upper school register</p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Use a school address, or open a demo desk. The shared password is northline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void signIn(email, password)
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <FieldDescription>Demo password: northline</FieldDescription>
                  </Field>
                </FieldGroup>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Open the register
                </Button>
              </form>
            </CardContent>
          </Card>
          {demos.isError ? <ErrorState error={demos.error} onRetry={() => void demos.refetch()} /> : null}
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Open a demo desk</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {featured.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start px-3 py-3"
                  disabled={pending}
                  onClick={() => void signIn(account.email, demos.data?.password ?? "northline")}
                >
                  <span className="flex flex-col items-start gap-0.5">
                    <span>{account.full_name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{account.detail}</span>
                  </span>
                </Button>
              ))}
            </div>
            {rest.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setShowMore((value) => !value)}>
                {showMore ? "Hide the rest of the roll" : "More faculty and students"}
              </Button>
            ) : null}
            {showMore ? (
              <div className="grid gap-2">
                {rest.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    className="justify-between"
                    disabled={pending}
                    onClick={() => void signIn(account.email, demos.data?.password ?? "northline")}
                  >
                    <span>{account.full_name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{account.detail}</span>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
