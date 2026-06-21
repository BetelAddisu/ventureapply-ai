-- Add notification preferences and additional profile fields

-- Notification channel preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_telegram boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_whatsapp boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Additional profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;

-- Comments
COMMENT ON COLUMN public.profiles.notify_email IS 'Receive job alerts via email';
COMMENT ON COLUMN public.profiles.notify_telegram IS 'Receive job alerts via Telegram';
COMMENT ON COLUMN public.profiles.notify_whatsapp IS 'Receive job alerts via WhatsApp';
COMMENT ON COLUMN public.profiles.telegram_chat_id IS 'Telegram chat ID for notifications';
COMMENT ON COLUMN public.profiles.title IS 'Professional job title';
COMMENT ON COLUMN public.profiles.summary IS 'Professional summary or bio';
COMMENT ON COLUMN public.profiles.location IS 'User location for job filtering';

-- Grant permissions
GRANT UPDATE (notify_email, notify_telegram, notify_whatsapp, telegram_chat_id, title, summary, location) ON public.profiles TO authenticated;
