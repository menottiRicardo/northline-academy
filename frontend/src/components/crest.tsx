import { cn } from "cn"

export function Crest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-10", className)} aria-hidden>
      <rect
        x="3.5"
        y="3.5"
        width="41"
        height="41"
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15 34V14h8.2L33 34V14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
    </svg>
  )
}
