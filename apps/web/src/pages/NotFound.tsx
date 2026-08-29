import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That route doesn&apos;t exist in the console.
      </p>
      <Button asChild className="mt-6">
        <Link to="/clusters">Back to clusters</Link>
      </Button>
    </div>
  );
}
