import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api, getToken, setToken } from "@/lib/api"
import type { Session, User } from "@/lib/types"

export type AuthSnapshot = {
  user: User | null
  term: string
  today: string
}

type AuthValue = AuthSnapshot & {
  ready: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export const authRef: { current: AuthSnapshot } = {
  current: { user: null, term: "Fall 2026", today: "" },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(authRef.current)
  const [ready, setReady] = useState(false)
  const started = useRef(false)

  function publish(next: AuthSnapshot) {
    authRef.current = next
    setSnapshot(next)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = getToken()
    if (!token) {
      setReady(true)
      return
    }
    api<Omit<Session, "token">>("/auth/me")
      .then((session) => {
        publish({ user: session.user, term: session.term, today: session.today })
      })
      .catch(() => {
        setToken(null)
      })
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      ...snapshot,
      ready,
      login: async (email, password) => {
        const session = await api<Session>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
        setToken(session.token)
        queryClient.clear()
        publish({ user: session.user, term: session.term, today: session.today })
        return session.user
      },
      logout: () => {
        setToken(null)
        queryClient.clear()
        publish({ user: null, term: snapshot.term, today: snapshot.today })
      },
    }),
    [queryClient, ready, snapshot],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("Auth is only available inside AuthProvider")
  return value
}
