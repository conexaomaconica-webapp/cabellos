'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { renewClientPackageAction, cancelClientPackageAction } from '@/app/(dashboard)/pacotes/actions';
import { Button } from '@/components/ui/button';
import { RefreshCw, Ban } from 'lucide-react';

interface ClientPackageActionButtonsProps {
  clientPackageId: string;
  clientId: string;
  status: string;
}

export function ClientPackageActionButtons({ clientPackageId, clientId, status }: ClientPackageActionButtonsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRenew = () => {
    if (!confirm('Deseja renovar este pacote para o cliente com as configurações comerciais atuais?')) return;

    startTransition(async () => {
      const res = await renewClientPackageAction(clientPackageId);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Pacote renovado com sucesso!');
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    const reason = prompt('Informe o motivo do cancelamento do contrato:');
    if (reason === null) return;

    startTransition(async () => {
      const res = await cancelClientPackageAction(clientPackageId, reason);
      if (res.error) {
        alert(res.error);
      } else {
        alert('Contrato cancelado.');
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleRenew}
        disabled={isPending}
        className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs gap-1.5"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Renovar Pacote
      </Button>

      {status !== 'cancelled' && (
        <Button
          onClick={handleCancel}
          disabled={isPending}
          variant="outline"
          className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs gap-1.5"
        >
          <Ban className="w-3.5 h-3.5" />
          Cancelar Contrato
        </Button>
      )}
    </div>
  );
}
