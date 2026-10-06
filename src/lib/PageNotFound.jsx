import { useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  const { data: authData, isFetched } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await base44.auth.me();
        return { user, isAuthenticated: true };
      } catch (error) {
        return { user: null, isAuthenticated: false };
      }
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
            <div className="mx-auto h-0.5 w-16 bg-border"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-foreground">Page Not Found</h2>
            <p className="leading-relaxed text-muted-foreground">
              The page <span className="font-medium text-foreground">"{pageName}"</span> could not be found in this application.
            </p>
          </div>
          {isFetched && authData.isAuthenticated && authData.user?.role === 'admin' && (
            <div className="mt-8 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Admin Note</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                This could mean that the AI hasn't implemented this page yet. Ask it to implement it in the chat.
              </p>
            </div>
          )}
          <div className="pt-6">
            <Button onClick={() => window.location.href = '/'}>
              <Home className="mr-2 h-4 w-4" /> Go Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}