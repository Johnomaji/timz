import Link from "next/link";
import { Compass } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-20">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-line bg-surface-2">
          <Compass className="size-6 text-muted" />
        </div>

        <p className="mt-6 font-mono text-sm text-faint">404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The page you are looking for has moved or never existed.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button>Back home</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Go to dashboard</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
