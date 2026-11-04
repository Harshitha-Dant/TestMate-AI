import { Compass } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/States";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page not found · TestMate AI";
  }, []);
  return (
    <Card>
      <EmptyState
        icon={<Compass className="size-5" aria-hidden />}
        title="Page not found"
        description="That address doesn't match any page in TestMate AI."
        action={
          <Link to="/" className="text-sm text-accent hover:underline">
            Go to dashboard
          </Link>
        }
      />
    </Card>
  );
}
