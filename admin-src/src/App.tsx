import { ThemeProvider } from 'next-themes';
import { RouterProvider } from 'react-router-dom';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { router } from '@/router';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme" disableTransitionOnChange>
      <TooltipProvider>
        <RouterProvider router={router} />
        <ConfirmDialog />
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
