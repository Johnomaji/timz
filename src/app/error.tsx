"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-20">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-danger/30 bg-danger/10">
          <AlertTriangle className="size-6 text-danger" />
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We hit an unexpected error loading this page. Your balance and investments are not
          affected.
        </p>

        {error.digest && (
          <p className="mt-4 font-mono text-xs text-faint">Reference: {error.digest}</p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={() => retry()}>
            <RotateCw className="size-4" />
            Try again
          </Button>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="size-4" />
              Back home
            </Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
