'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, CreditCard, Calendar, CheckCircle2, AlertTriangle, Shield, Loader2 } from 'lucide-react';

interface AccountSettingsProps {
  userEmail: string;
  userRole: string;
  subscriptionData: any;
}

export function AccountSettingsClient({ userEmail, userRole, subscriptionData }: AccountSettingsProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (passwords.newPassword.length < 6) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setErrorMsg('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword
      });

      if (error) throw error;
      
      setSuccessMsg('Sua senha foi atualizada com sucesso!');
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  const planName = subscriptionData?.plan?.name || 'Trial / Inicial';
  const planMaxProfessionals = subscriptionData?.plan?.max_professionals;
  const endDate = subscriptionData?.current_period_end;
  const planStatus = subscriptionData?.status || 'trial';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* 1. Informações da Assinatura (Exclusivo para Admins) */}
      {userRole === 'admin' ? (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-500" />
              Meu Plano
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Informações sobre sua assinatura no Cabellos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Plano Atual
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {planName}
                  </p>
                </div>
                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  planStatus === 'active' 
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                    : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                }`}>
                  {planStatus === 'active' ? 'Ativo' : planStatus}
                </div>
              </div>

              {endDate && (
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>
                    Vencimento: <strong className="text-slate-900 dark:text-white">
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(endDate))}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              <p className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 
                {planMaxProfessionals ? `Até ${planMaxProfessionals} Profissionais` : 'Profissionais Ilimitados'}
              </p>
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Suporte VIP Cabellos
              </p>
            </div>

          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-dashed border-slate-300 dark:border-slate-700 shadow-none">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center h-full">
            <Shield className="h-10 w-10 text-slate-400 mb-3" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300">Acesso Restrito</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
              As informações de plano e pagamento são visíveis apenas para Administradores do Salão.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 2. Segurança: Trocar Senha */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Segurança da Conta
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Altere a senha de acesso do seu usuário ({userEmail}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nova Senha</label>
              <Input 
                type="password" 
                placeholder="Mínimo 6 caracteres"
                value={passwords.newPassword}
                onChange={(e) => setPasswords(prev => ({ ...prev, newPassword: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Confirme a Nova Senha</label>
              <Input 
                type="password" 
                placeholder="Repita a senha"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                required
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading || !passwords.newPassword || !passwords.confirmPassword}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-10"
            >
              {loading ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Atualizando...</span>
              ) : 'Atualizar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}
