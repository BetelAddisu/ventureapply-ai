
CREATE OR REPLACE FUNCTION public.prevent_client_tier_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := current_setting('request.jwt.claim.role', true);
  IF NEW.current_tier IS DISTINCT FROM OLD.current_tier
     AND COALESCE(jwt_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'current_tier can only be modified by the server'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_tier ON public.profiles;
CREATE TRIGGER trg_profiles_protect_tier
BEFORE UPDATE OF current_tier ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_tier_change();
