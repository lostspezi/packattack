"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      code="500"
      title="Pack machine broke!"
      description="Something went wrong while opening your pack. Our engineers are tightening the bolts."
      symbol="⚡"
      packText="ERROR"
      showRetry={true}
      onRetry={reset}
    />
  );
}
