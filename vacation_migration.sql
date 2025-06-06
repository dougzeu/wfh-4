-- Migration: Add Vacation Management Table
-- Description: Creates vacation table for employee leave tracking
-- Date: 2025-01-31

-- Create vacations table
CREATE TABLE IF NOT EXISTS public.vacations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT vacations_date_order CHECK (end_date >= start_date),
    CONSTRAINT vacations_user_date_unique UNIQUE (user_id, start_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vacations_user_id ON public.vacations(user_id);
CREATE INDEX IF NOT EXISTS idx_vacations_dates ON public.vacations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vacations_user_status ON public.vacations(user_id, status);

-- Enable Row Level Security
ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read all vacation records (for office schedule visibility)
DROP POLICY IF EXISTS "Users can read all vacation records" ON public.vacations;
CREATE POLICY "Users can read all vacation records" ON public.vacations
    FOR SELECT
    USING (true);

-- Users can only insert their own vacation records
DROP POLICY IF EXISTS "Users can insert own vacation records" ON public.vacations;
CREATE POLICY "Users can insert own vacation records" ON public.vacations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own vacation records
DROP POLICY IF EXISTS "Users can update own vacation records" ON public.vacations;
CREATE POLICY "Users can update own vacation records" ON public.vacations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own vacation records
DROP POLICY IF EXISTS "Users can delete own vacation records" ON public.vacations;
CREATE POLICY "Users can delete own vacation records" ON public.vacations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_vacations_updated_at ON public.vacations;
CREATE TRIGGER update_vacations_updated_at
    BEFORE UPDATE ON public.vacations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.vacations TO authenticated;
GRANT ALL ON public.vacations TO anon; 