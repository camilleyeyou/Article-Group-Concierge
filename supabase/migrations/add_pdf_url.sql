-- Migration: Add pdf_url column to documents table
-- This stores the URL to the original PDF for case studies

ALTER TABLE documents ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add comment
COMMENT ON COLUMN documents.pdf_url IS 'URL to the original PDF stored in Supabase Storage';
