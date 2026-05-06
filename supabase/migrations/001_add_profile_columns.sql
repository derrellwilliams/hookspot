-- Migration: add display_name, avatar_url, and favorites columns to profiles
-- Run this in the Supabase SQL editor for existing databases

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorites jsonb DEFAULT '[]';
