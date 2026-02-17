-- Enable unaccent extension for accent-insensitive text search
-- This allows searching for "rever" to match "rêver" in the database
-- Run this migration on your PostgreSQL database

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Test that it works (optional)
-- SELECT unaccent('rêver'); -- Should return 'rever'
-- SELECT unaccent('cinéma'); -- Should return 'cinema'
