import { useSyncExternalStore } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getConfirmSnapshot,
  resolveConfirm,
  subscribeConfirm,
} from '@/services/confirm';

export function ConfirmDialog() {
  const state = useSyncExternalStore(subscribeConfirm, getConfirmSnapshot, getConfirmSnapshot);

  return (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) resolveConfirm(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia
            className={state.danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}
          >
            {state.danger ? <AlertTriangle /> : <Info />}
          </AlertDialogMedia>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolveConfirm(false)}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant={state.danger ? 'destructive' : 'default'}
            onClick={() => resolveConfirm(true)}
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
