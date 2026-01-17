-- Migration: Add thumbnail_url to documents table
-- Run this in Supabase SQL Editor

-- Add thumbnail_url column for case study card images
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add hero_image_url column for detail page hero images
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS hero_image_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN documents.thumbnail_url IS 'URL for case study card thumbnail image';
COMMENT ON COLUMN documents.hero_image_url IS 'URL for case study detail page hero image';
