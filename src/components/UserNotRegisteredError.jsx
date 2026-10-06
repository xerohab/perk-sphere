import React from 'react';
import { ShieldAlert } from 'lucide-react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/40">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-foreground">Access Restricted</h1>
          <p className="mb-8 text-muted-foreground">
            You are not registered to use this application. Please contact the app administrator to request access.
          </p>
          <div className="rounded-md bg-secondary p-4 text-sm text-muted-foreground">
            <p>If you believe this is an error, you can:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the app administrator for access</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;