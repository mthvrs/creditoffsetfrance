-- Enable pg_trgm extension for GIN indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create IMMUTABLE wrapper for unaccent to allow functional indexing
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent($1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Add GIN functional indexes for accent-insensitive substring search on title and original_title
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON movies USING GIN (immutable_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_movies_original_title_trgm ON movies USING GIN (immutable_unaccent(lower(original_title)) gin_trgm_ops);
