const TOKEN_KEY = "northline.token"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function detailMessage(detail: unknown) {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String(item.msg)
        }
        return String(item)
      })
      .join(" ")
  }
  return "The register could not complete that request."
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set("Content-Type", "application/json")
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data = text ? (JSON.parse(text) as { detail?: unknown }) : null
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login")) {
      setToken(null)
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login")
      }
    }
    throw new ApiError(response.status, detailMessage(data?.detail))
  }
  return data as T
}
