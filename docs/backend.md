# FIWFHT Backend Implementation Plan

## Overview
This document outlines the backend implementation strategy for the **FIWFHT (Friends, I'll Work From Home Tomorrow)** application using Supabase as the backend-as-a-service solution.

### Project Details
- **Supabase Project ID**: `ogbmvvqhgnnkuweapkpu`
- **Project URL**: `https://ogbmvvqhgnnkuweapkpu.supabase.co`
- **Region**: `eu-north-1`
- **Status**: `ACTIVE_HEALTHY`
- **PostgreSQL Version**: `17.4.1`

## Architecture Overview

```
Frontend (Vanilla JS/HTML) ←→ Supabase Client ←→ Supabase Backend
                                                   ├── PostgreSQL Database
                                                   ├── GoTrue (Auth)
                                                   ├── PostgREST (API)
                                                   ├── Realtime
                                                   └── Edge Functions
```

## Database Schema Design

### 1. Users Table
Leverages Supabase Auth with extended profile information.

```sql
-- Extended user profiles (auth.users is managed by Supabase)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    department TEXT,
    role TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Work From Home Schedules
Core table for tracking WFH schedules.

```sql
CREATE TABLE public.wfh_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_wfh BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one record per user per date
    UNIQUE(user_id, date)
);
```

### 3. Weekly Schedules (Aggregated View)
For easier weekly management and validation.

```sql
CREATE TABLE public.weekly_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL, -- Monday of the week
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    wfh_days INTEGER[] DEFAULT '{}', -- Array of day numbers (1=Mon, 5=Fri)
    max_wfh_days INTEGER DEFAULT 2,
    is_submitted BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one record per user per week
    UNIQUE(user_id, week_start)
);
```

### 4. Office Capacity & Holidays
For managing office capacity and holiday schedules.

```sql
CREATE TABLE public.office_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    max_capacity INTEGER DEFAULT 100,
    current_capacity INTEGER DEFAULT 0,
    is_holiday BOOLEAN DEFAULT false,
    holiday_name TEXT,
    notes TEXT
);

CREATE TABLE public.company_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Audit Trail
For tracking changes and compliance.

```sql
CREATE TABLE public.schedule_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'create', 'update', 'delete'
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Row Level Security (RLS) Policies

### User Profiles
```sql
-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles but only update their own
CREATE POLICY "Users can read all profiles" ON public.user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
```

### WFH Schedules
```sql
-- Enable RLS
ALTER TABLE public.wfh_schedules ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own schedules
CREATE POLICY "Users can manage own schedules" ON public.wfh_schedules
    FOR ALL USING (auth.uid() = user_id);

-- Everyone can read schedules (for office attendance view)
CREATE POLICY "Users can read all schedules" ON public.wfh_schedules
    FOR SELECT USING (true);
```

### Weekly Schedules
```sql
-- Enable RLS
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own weekly schedules
CREATE POLICY "Users can manage own weekly schedules" ON public.weekly_schedules
    FOR ALL USING (auth.uid() = user_id);

-- Everyone can read weekly schedules
CREATE POLICY "Users can read all weekly schedules" ON public.weekly_schedules
    FOR SELECT USING (true);
```

## Database Functions & Triggers

### 1. Auto-update Timestamps
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wfh_schedules_updated_at 
    BEFORE UPDATE ON public.wfh_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_schedules_updated_at 
    BEFORE UPDATE ON public.weekly_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Weekly Schedule Validation
```sql
CREATE OR REPLACE FUNCTION validate_weekly_wfh_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if WFH days exceed the limit
    IF array_length(NEW.wfh_days, 1) > NEW.max_wfh_days THEN
        RAISE EXCEPTION 'WFH days (%) exceed maximum allowed (%)', 
            array_length(NEW.wfh_days, 1), NEW.max_wfh_days;
    END IF;
    
    -- Ensure WFH days are valid weekdays (1-5)
    IF EXISTS (SELECT 1 FROM unnest(NEW.wfh_days) AS day WHERE day < 1 OR day > 5) THEN
        RAISE EXCEPTION 'Invalid WFH day. Must be between 1 (Monday) and 5 (Friday)';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_weekly_schedules 
    BEFORE INSERT OR UPDATE ON public.weekly_schedules
    FOR EACH ROW EXECUTE FUNCTION validate_weekly_wfh_limit();
```

### 3. Office Attendance Calculator
```sql
CREATE OR REPLACE FUNCTION get_office_attendance(target_date DATE)
RETURNS TABLE(
    user_id UUID,
    full_name TEXT,
    email TEXT,
    department TEXT,
    is_in_office BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.full_name,
        up.email,
        up.department,
        CASE 
            WHEN wfh.is_wfh IS NULL THEN true  -- Default to office if no schedule
            ELSE NOT wfh.is_wfh 
        END as is_in_office
    FROM public.user_profiles up
    LEFT JOIN public.wfh_schedules wfh ON up.id = wfh.user_id AND wfh.date = target_date
    WHERE EXTRACT(DOW FROM target_date) BETWEEN 1 AND 5  -- Monday to Friday
    ORDER BY up.full_name;
END;
$$ language 'plpgsql';
```

## Authentication Strategy

### 1. Google OAuth Setup
```javascript
// Supabase Auth Configuration
const supabaseConfig = {
    providers: {
        google: {
            enabled: true,
            hd: 'enhancefitness.com', // Restrict to company domain
            prompt: 'consent'
        }
    },
    redirectUrl: `${window.location.origin}/home.html`,
    allowSignUps: true // Only for company domain
}
```

### 2. Auth Helper Functions
```javascript
// Auth utilities to be implemented
class AuthManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }
    
    async signInWithGoogle() {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                hd: 'enhancefitness.com',
                redirectTo: `${window.location.origin}/home.html`
            }
        });
        return { data, error };
    }
    
    async getUser() {
        const { data: { user }, error } = await this.supabase.auth.getUser();
        return { user, error };
    }
    
    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        return { error };
    }
    
    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange(callback);
    }
}
```

## API Integration Layer

### 1. Schedule Management
```javascript
class ScheduleManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }
    
    async getWeeklySchedule(weekStart) {
        const { data, error } = await this.supabase
            .from('weekly_schedules')
            .select('*')
            .eq('week_start', weekStart)
            .eq('user_id', (await this.supabase.auth.getUser()).data.user.id)
            .single();
        
        return { data, error };
    }
    
    async saveWeeklySchedule(weekStart, wfhDays) {
        const user = await this.supabase.auth.getUser();
        
        const { data, error } = await this.supabase
            .from('weekly_schedules')
            .upsert({
                user_id: user.data.user.id,
                week_start: weekStart,
                year: new Date(weekStart).getFullYear(),
                week_number: this.getWeekNumber(new Date(weekStart)),
                wfh_days: wfhDays,
                is_submitted: true,
                submitted_at: new Date().toISOString()
            });
        
        return { data, error };
    }
    
    async getOfficeAttendance(date) {
        const { data, error } = await this.supabase
            .rpc('get_office_attendance', { target_date: date });
        
        return { data, error };
    }
    
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
}
```

### 2. Real-time Subscriptions
```javascript
class RealtimeManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.subscriptions = [];
    }
    
    subscribeToOfficeAttendance(callback) {
        const subscription = this.supabase
            .channel('office-attendance')
            .on('postgres_changes', 
                {
                    event: '*',
                    schema: 'public',
                    table: 'wfh_schedules'
                },
                callback
            )
            .subscribe();
        
        this.subscriptions.push(subscription);
        return subscription;
    }
    
    subscribeToWeeklySchedules(callback) {
        const subscription = this.supabase
            .channel('weekly-schedules')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'weekly_schedules'
                },
                callback
            )
            .subscribe();
        
        this.subscriptions.push(subscription);
        return subscription;
    }
    
    unsubscribeAll() {
        this.subscriptions.forEach(sub => {
            this.supabase.removeChannel(sub);
        });
        this.subscriptions = [];
    }
}
```

## Edge Functions

### 1. Weekly Reminder Function
```typescript
// functions/weekly-reminder/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        // Get users who haven't submitted schedules for next week
        const nextWeekStart = getNextWeekStart()
        
        const { data: users } = await supabase
            .from('user_profiles')
            .select('id, email, full_name')
            .not('id', 'in', 
                supabase
                    .from('weekly_schedules')
                    .select('user_id')
                    .eq('week_start', nextWeekStart)
                    .eq('is_submitted', true)
            )
        
        // Send reminder emails (integrate with email service)
        const results = await Promise.all(
            users?.map(user => sendReminderEmail(user)) || []
        )
        
        return new Response(
            JSON.stringify({ success: true, reminders_sent: results.length }),
            { headers: { 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})

function getNextWeekStart(): string {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const monday = new Date(nextWeek.setDate(nextWeek.getDate() - nextWeek.getDay() + 1))
    return monday.toISOString().split('T')[0]
}

async function sendReminderEmail(user: any) {
    // Implementation depends on email service (SendGrid, Resend, etc.)
    console.log(`Sending reminder to ${user.email}`)
    return true
}
```

### 2. Analytics Function
```typescript
// functions/analytics/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'month'
    
    // Generate analytics data
    const analytics = await generateAnalytics(supabase, period)
    
    return new Response(
        JSON.stringify(analytics),
        { headers: { 'Content-Type': 'application/json' } }
    )
})

async function generateAnalytics(supabase: any, period: string) {
    // Implementation for various analytics queries
    const [wfhTrends, officeCapacity, userStats] = await Promise.all([
        getWFHTrends(supabase, period),
        getOfficeCapacityStats(supabase, period),
        getUserStats(supabase, period)
    ])
    
    return {
        wfh_trends: wfhTrends,
        office_capacity: officeCapacity,
        user_stats: userStats,
        generated_at: new Date().toISOString()
    }
}
```

## Migration Scripts

### Initial Setup Migration
```sql
-- 001_initial_setup.sql
-- Create user profiles table
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    department TEXT,
    role TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create WFH schedules table
CREATE TABLE public.wfh_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_wfh BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create weekly schedules table
CREATE TABLE public.weekly_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    wfh_days INTEGER[] DEFAULT '{}',
    max_wfh_days INTEGER DEFAULT 2,
    is_submitted BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Create office capacity table
CREATE TABLE public.office_capacity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    max_capacity INTEGER DEFAULT 100,
    current_capacity INTEGER DEFAULT 0,
    is_holiday BOOLEAN DEFAULT false,
    holiday_name TEXT,
    notes TEXT
);

-- Create company holidays table
CREATE TABLE public.company_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit trail table
CREATE TABLE public.schedule_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfh_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_audit ENABLE ROW LEVEL SECURITY;
```

## Environment Configuration

### Frontend Environment Variables
```javascript
// config/supabase.js
const SUPABASE_CONFIG = {
    url: 'https://ogbmvvqhgnnkuweapkpu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYm12dnFoZ25ua3V3ZWFwa3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMDI1NjIsImV4cCI6MjA2NDc3ODU2Mn0.QdZ-HsiDqtC73QtYoIRqtB4soOv5FgC5i3U3HskoE1g',
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
}
```

## Security Considerations

### 1. Data Validation
- Implement client-side and server-side validation
- Use Postgres constraints and triggers
- Validate email domains (@enhancefitness.com)

### 2. Rate Limiting
- Implement rate limiting on API endpoints
- Use Supabase's built-in rate limiting features

### 3. Audit Logging
- Log all schedule changes
- Implement audit trails for compliance
- Monitor unusual activity patterns

### 4. Privacy & GDPR Compliance
- Implement data retention policies
- Provide data export/deletion capabilities
- Ensure proper consent mechanisms

## Performance Optimization

### 1. Database Indexes
```sql
-- Performance indexes
CREATE INDEX idx_wfh_schedules_user_date ON public.wfh_schedules(user_id, date);
CREATE INDEX idx_wfh_schedules_date ON public.wfh_schedules(date);
CREATE INDEX idx_weekly_schedules_user_week ON public.weekly_schedules(user_id, week_start);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
```

### 2. Caching Strategy
- Implement client-side caching for user profiles
- Cache office attendance data with short TTL
- Use Supabase's built-in caching features

### 3. Real-time Optimization
- Use selective real-time subscriptions
- Implement connection pooling
- Optimize payload sizes

## Deployment Checklist

### Database Setup
- [ ] Apply initial migration
- [ ] Set up RLS policies
- [ ] Create database functions
- [ ] Set up indexes
- [ ] Configure backups

### Authentication
- [ ] Configure Google OAuth
- [ ] Set up domain restrictions
- [ ] Test auth flows
- [ ] Configure session management

### API Integration
- [ ] Implement client libraries
- [ ] Set up error handling
- [ ] Configure rate limiting
- [ ] Test all endpoints

### Real-time Features
- [ ] Set up real-time subscriptions
- [ ] Test real-time updates
- [ ] Optimize connection handling

### Edge Functions
- [ ] Deploy reminder function
- [ ] Deploy analytics function
- [ ] Set up cron jobs
- [ ] Configure environment variables

### Monitoring & Analytics
- [ ] Set up logging
- [ ] Configure alerts
- [ ] Implement analytics tracking
- [ ] Set up performance monitoring

## Next Steps

1. **Phase 1: Core Database Setup** (Week 1)
   - Apply database migrations
   - Set up RLS policies
   - Implement basic CRUD operations

2. **Phase 2: Authentication Integration** (Week 2)
   - Configure Google OAuth
   - Implement auth flows in frontend
   - Test user management

3. **Phase 3: Schedule Management** (Week 3)
   - Implement schedule CRUD operations
   - Add real-time updates
   - Test weekly schedule logic

4. **Phase 4: Advanced Features** (Week 4)
   - Deploy Edge Functions
   - Add analytics
   - Implement notifications

5. **Phase 5: Testing & Optimization** (Week 5)
   - Performance testing
   - Security audit
   - User acceptance testing

---

**TL;DR**: Complete backend implementation plan for FIWFHT using Supabase, including database schema with 6 core tables, RLS policies, authentication with Google OAuth, real-time subscriptions, Edge Functions for notifications and analytics, and a 5-phase deployment strategy. Ready for immediate implementation with the existing Supabase project (ogbmvvqhgnnkuweapkpu). 