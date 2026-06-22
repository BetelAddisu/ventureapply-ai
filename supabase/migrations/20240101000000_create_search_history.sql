-- Create search_history table for tracking user searches
CREATE TABLE IF NOT EXISTS search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  location_type TEXT DEFAULT 'any',
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own searches
CREATE POLICY "Users can view own search history" ON search_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own searches
CREATE POLICY "Users can insert own searches" ON search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_keyword ON search_history(keyword);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC);
