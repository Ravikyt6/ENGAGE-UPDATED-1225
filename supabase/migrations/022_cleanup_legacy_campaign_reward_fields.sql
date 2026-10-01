-- Final cleanup for the package-balance campaign model.
-- Keep historical qualification reward columns because existing admin/reporting RPCs may read them.
-- Remove only obsolete campaign-creation RPCs; package definitions and milestone systems remain.

drop function if exists public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer);
drop function if exists public.create_campaign_with_package(text,uuid,uuid,text,text,uuid);
