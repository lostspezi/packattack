"use client";

import { ErrorPage } from "@/components/ui/error-page";
import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <ErrorPage
        code="500"
        title="Something went wrong"
        description="An unexpected error occurred. Don't worry — our pack machines are being repaired."
        showHomeButton={true}
        showBackButton={false}
      />
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <Button variant="secondary" size="md" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
