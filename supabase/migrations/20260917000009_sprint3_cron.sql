-- Migration 9: Supabase Cron Job for Daily Return Alert Updates

-- 1. HABILITAR EXTENSÃO PG_CRON SE DISPONÍVEL NO SUPABASE
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. FUNÇÃO WRAPPER GLOBAL PARA EXECUTAR A ATUALIZAÇÃO EM TODAS AS ORGANIZAÇÕES ATIVAS
CREATE OR REPLACE FUNCTION public.run_daily_return_alert_updates()
RETURNS VOID AS $$
DECLARE
    v_org RECORD;
BEGIN
    FOR v_org IN SELECT organizations.id FROM public.organizations WHERE is_active = TRUE LOOP
        PERFORM public.update_return_alert_statuses(v_org.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.run_daily_return_alert_updates FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_daily_return_alert_updates FROM authenticated;

-- 3. AGENDAR JOB PERIÓDICO NO PG_CRON (EXECUTA DIARIAMENTE ÀS 03:00 AM UTC)
-- Nome do Job: cabellos_daily_return_alerts_update
-- Frequência: 0 3 * * * (Diariamente às 03:00 AM)
-- Função Chamada: public.run_daily_return_alert_updates() -> public.update_return_alert_statuses(p_org_id)
-- Idempotência: Operação baseada em comparação de datas (NOW() vs expected_return_at), pode ser executada repetidamente sem duplicação ou corrupção.

DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remover agendamento anterior se houver para evitar duplicidade
        PERFORM cron.unschedule('cabellos_daily_return_alerts_update')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cabellos_daily_return_alerts_update');

        -- Agendar novo job
        PERFORM cron.schedule(
            'cabellos_daily_return_alerts_update',
            '0 3 * * *',
            'SELECT public.run_daily_return_alert_updates()'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Se pg_cron não for suportado no ambiente local/sandbox, o fallback dinâmico no carregamento da página /retornos continuará garantindo a integridade dos dados.
        NULL;
END $do$;
