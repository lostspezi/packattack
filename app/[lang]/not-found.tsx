import { ErrorPage } from "@/components/ui/error-page";

export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="This pack is empty!"
      description="Looks like there's nothing inside this pack. The page you're looking for doesn't exist or has been moved."
      symbol="?"
      packText="EMPTY"
    />
  );
}
