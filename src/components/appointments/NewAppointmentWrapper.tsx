'use client';

import { useState } from 'react';
import { Client, Professional, Service, PaymentMethod, ProfessionalService } from '@/types/database';
import { NewAppointmentForm } from './NewAppointmentForm';
import { QuickAppointmentForm } from './QuickAppointmentForm';
import { Zap, ListFilter } from 'lucide-react';

interface NewAppointmentWrapperProps {
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  paymentMethods: PaymentMethod[];
  professionalServices: ProfessionalService[];
}

export function NewAppointmentWrapper({
  clients,
  professionals,
  services,
  paymentMethods,
  professionalServices,
}: NewAppointmentWrapperProps) {
  const [mode, setMode] = useState<'quick' | 'manual'>('quick');

  return (
    <div className="space-y-6">
      {/* SELETOR DE MODO DE LANÇAMENTO */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md mx-auto sm:mx-0">
        <button
          type="button"
          onClick={() => setMode('quick')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mode === 'quick'
              ? 'bg-amber-500 text-slate-950 shadow-lg scale-[1.02]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Zap className="h-4 w-4" /> Atendimento Rápido (Texto)
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mode === 'manual'
              ? 'bg-amber-500 text-slate-950 shadow-lg scale-[1.02]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <ListFilter className="h-4 w-4" /> Atendimento Manual
        </button>
      </div>

      {mode === 'quick' ? (
        <QuickAppointmentForm
          clients={clients}
          professionals={professionals}
          services={services}
          paymentMethods={paymentMethods}
          professionalServices={professionalServices}
        />
      ) : (
        <NewAppointmentForm
          clients={clients}
          professionals={professionals}
          services={services}
          paymentMethods={paymentMethods}
          professionalServices={professionalServices}
        />
      )}
    </div>
  );
}
