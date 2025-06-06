# FIWFHT Backend - Next Steps Guide

This guide will walk you through implementing the remaining features and deploying your FIWFHT system to production.

## 🚀 Immediate Next Steps (Production Ready)

### 1. Configure Google OAuth in Supabase

#### Step 1: Set up Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API and Google OAuth2 API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"

{"web":{"client_id":"94419069891-bl39elmfhsnsic6f64f25ujrkg16m5d8.apps.googleusercontent.com","project_id":"whf-3-461411","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"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"}}

#### Step 2: Configure OAuth Client
```
Application type: Web application
Name: FIWFHT App
Authorized JavaScript origins:
  - http://localhost:3000 (for development)
  - https://your-domain.com (for production)
Authorized redirect URIs:
  - https://ogbmvvqhgnnkuweapkpu.supabase.co/auth/v1/callback
```

#### Step 3: Configure Supabase
1. Go to your Supabase dashboard
2. Navigate to Authentication → Providers
3. Enable Google provider
4. Add your Google Client ID and Client Secret
5. Configure additional settings:
   ```
   Hosted Domain: enhancefitness.com
   Skip nonce verification: false
   ```

#### Step 4: Test Authentication
```javascript
// Test the OAuth flow
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    hd: 'enhancefitness.com',
    redirectTo: `${window.location.origin}/home.html`
  }
});
```

### 2. Email Service Integration

#### Option A: Resend (Recommended)
1. Sign up at [resend.com](https://resend.com)
2. Get your API key
3. Update your Edge Function:

```typescript
// functions/weekly-reminder/index.ts
import { Resend } from 'https://esm.sh/resend@2.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

async function sendReminderEmail(user: any, weekStart: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: 'FIWFHT <noreply@your-domain.com>',
      to: [user.email],
      subject: 'FIWFHT: Please Submit Your WFH Schedule for Next Week',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #A7EE43;">Hi ${user.full_name}!</h2>
          <p>This is a friendly reminder to submit your Work From Home schedule for the week of <strong>${weekStart}</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get('SITE_URL')}/home.html" 
               style="background: #A7EE43; color: #080F17; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Submit Your Schedule
            </a>
          </div>
          <p><strong>Remember:</strong> You can work from home up to 2 days per week.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            Best regards,<br>
            FIWFHT Team
          </p>
        </div>
      `
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error(`Failed to send email to ${user.email}:`, error);
    return { success: false, error: error.message };
  }
}
```

#### Option B: SendGrid
```typescript
import { SendGrid } from 'https://deno.land/x/sendgrid@0.0.3/mod.ts'

const sendgrid = new SendGrid(Deno.env.get('SENDGRID_API_KEY'))

async function sendReminderEmail(user: any, weekStart: string) {
  const msg = {
    to: user.email,
    from: 'noreply@your-domain.com',
    subject: 'FIWFHT: Please Submit Your WFH Schedule for Next Week',
    html: `...` // Same HTML content as above
  };
  
  return await sendgrid.send(msg);
}
```

#### Step 3: Set Environment Variables
In your Supabase dashboard → Project Settings → Edge Functions:
```
RESEND_API_KEY=your_resend_api_key
SITE_URL=https://your-domain.com
```

### 3. Production Deployment

#### Step 1: Domain Setup
1. Purchase a domain or use existing one
2. Set up DNS records:
   ```
   Type: CNAME
   Name: app (or www)
   Value: your-hosting-provider.com
   ```

#### Step 2: Hosting Options

**Option A: Vercel (Recommended for static sites)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd your-project-directory
vercel

# Set environment variables in Vercel dashboard
SUPABASE_URL=https://ogbmvvqhgnnkuweapkpu.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

**Option B: Netlify**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod

# Configure environment variables in Netlify dashboard
```

#### Step 3: Update Supabase Configuration
Update your redirect URLs in:
1. Supabase Auth settings
2. Google OAuth settings
3. Your `js/config.js` file

```javascript
// js/config.js (production version)
const SUPABASE_CONFIG = {
    url: 'https://ogbmvvqhgnnkuweapkpu.supabase.co',
    anonKey: 'your_production_anon_key',
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            redirectTo: 'https://your-domain.com/home.html'
        }
    }
};
```

## 📊 Enhanced Features

### 4. Admin Dashboard

Create an admin interface for system management.

#### Step 1: Create Admin Page
```html
<!-- admin.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FIWFHT - Admin Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold mb-8">FIWFHT Admin Dashboard</h1>
        
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Total Users</h3>
                <p class="text-3xl font-bold text-blue-600" id="total-users">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">This Week WFH</h3>
                <p class="text-3xl font-bold text-green-600" id="week-wfh">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Office Capacity</h3>
                <p class="text-3xl font-bold text-orange-600" id="office-capacity">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold text-gray-700">Pending Schedules</h3>
                <p class="text-3xl font-bold text-red-600" id="pending-schedules">-</p>
            </div>
        </div>
        
        <!-- Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-4">WFH Trends</h3>
                <canvas id="wfh-trends-chart"></canvas>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-4">Department Breakdown</h3>
                <canvas id="department-chart"></canvas>
            </div>
        </div>
        
        <!-- User Management -->
        <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b">
                <h3 class="text-lg font-semibold">User Management</h3>
            </div>
            <div class="p-6">
                <div class="overflow-x-auto">
                    <table class="min-w-full table-auto">
                        <thead>
                            <tr class="bg-gray-50">
                                <th class="px-4 py-2 text-left">Name</th>
                                <th class="px-4 py-2 text-left">Email</th>
                                <th class="px-4 py-2 text-left">Department</th>
                                <th class="px-4 py-2 text-left">This Week</th>
                                <th class="px-4 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="users-table">
                            <!-- Users will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <script src="js/config.js"></script>
    <script src="js/admin.js"></script>
</body>
</html>
```

#### Step 2: Create Admin JavaScript
```javascript
// js/admin.js
class AdminDashboard {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }
    
    async init() {
        await this.checkAdminAuth();
        await this.loadDashboardData();
        this.setupEventListeners();
    }
    
    async checkAdminAuth() {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            window.location.href = '/index.html';
            return;
        }
        
        // Check if user is admin (you can implement this logic)
        const { data: profile } = await this.supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();
            
        if (profile?.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = '/home.html';
            return;
        }
    }
    
    async loadDashboardData() {
        const [users, analytics] = await Promise.all([
            this.loadUsers(),
            this.loadAnalytics()
        ]);
        
        this.updateStatCards(users, analytics);
        this.renderCharts(analytics);
        this.renderUsersTable(users);
    }
    
    async loadUsers() {
        const { data: users } = await this.supabase
            .from('user_profiles')
            .select('*');
        return users || [];
    }
    
    async loadAnalytics() {
        const { data, error } = await this.supabase.functions.invoke('analytics', {
            body: { period: 'week' }
        });
        return data || {};
    }
    
    updateStatCards(users, analytics) {
        document.getElementById('total-users').textContent = users.length;
        document.getElementById('week-wfh').textContent = 
            analytics.wfh_trends?.average_wfh_percentage || 0;
        document.getElementById('office-capacity').textContent = 
            analytics.office_capacity?.average_office_utilization || 0;
        document.getElementById('pending-schedules').textContent = 
            users.length - (analytics.user_stats?.active_users || 0);
    }
    
    renderCharts(analytics) {
        // WFH Trends Chart
        const wfhCtx = document.getElementById('wfh-trends-chart').getContext('2d');
        new Chart(wfhCtx, {
            type: 'line',
            data: {
                labels: analytics.wfh_trends?.daily_trends?.map(t => t.date) || [],
                datasets: [{
                    label: 'WFH Percentage',
                    data: analytics.wfh_trends?.daily_trends?.map(t => t.wfh_percentage) || [],
                    borderColor: '#A7EE43',
                    backgroundColor: 'rgba(167, 238, 67, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        
        // Department Chart
        const deptCtx = document.getElementById('department-chart').getContext('2d');
        const departments = analytics.department_stats?.department_breakdown || [];
        new Chart(deptCtx, {
            type: 'pie',
            data: {
                labels: departments.map(d => d.department),
                datasets: [{
                    data: departments.map(d => d.wfh_percentage),
                    backgroundColor: [
                        '#A7EE43',
                        '#34A853',
                        '#4285F4',
                        '#FBBC05',
                        '#EA4335'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });
    }
    
    renderUsersTable(users) {
        const tbody = document.getElementById('users-table');
        tbody.innerHTML = users.map(user => `
            <tr class="border-b">
                <td class="px-4 py-2">${user.full_name}</td>
                <td class="px-4 py-2">${user.email}</td>
                <td class="px-4 py-2">${user.department || '-'}</td>
                <td class="px-4 py-2">
                    <span class="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        Submitted
                    </span>
                </td>
                <td class="px-4 py-2">
                    <button class="text-blue-600 hover:text-blue-800 mr-2">Edit</button>
                    <button class="text-red-600 hover:text-red-800">Suspend</button>
                </td>
            </tr>
        `).join('');
    }
    
    setupEventListeners() {
        // Add event listeners for admin actions
        setInterval(() => this.loadDashboardData(), 30000); // Refresh every 30 seconds
    }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    const admin = new AdminDashboard(supabase);
    admin.init();
});
```

### 5. Calendar Integration

#### Google Calendar Integration
```javascript
// js/calendar.js
class CalendarIntegration {
    constructor() {
        this.calendarAPI = 'https://www.googleapis.com/calendar/v3';
    }
    
    async syncToGoogleCalendar(schedules, accessToken) {
        for (const schedule of schedules) {
            if (schedule.is_wfh) {
                await this.createWFHEvent(schedule, accessToken);
            }
        }
    }
    
    async createWFHEvent(schedule, accessToken) {
        const event = {
            summary: '🏠 Working From Home',
            description: 'Scheduled WFH day via FIWFHT',
            start: {
                date: schedule.date
            },
            end: {
                date: schedule.date
            },
            colorId: '2' // Green color
        };
        
        const response = await fetch(`${this.calendarAPI}/calendars/primary/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });
        
        return response.json();
    }
}
```

### 6. Mobile App (React Native)

#### Step 1: Setup
```bash
# Install React Native CLI
npm install -g @react-native-community/cli

# Create new project
npx react-native init FIWFHTMobile
cd FIWFHTMobile

# Install dependencies
npm install @supabase/supabase-js react-native-url-polyfill
```

#### Step 2: Basic App Structure
```jsx
// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from './src/lib/supabase';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);
  
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {session ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## 🔧 Advanced Features

### 7. Slack Integration

```javascript
// functions/slack-notifications/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { schedules, webhook_url } = await req.json();
  
  const message = {
    text: "📅 Weekly WFH Schedule Update",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*This Week's WFH Schedule:*"
        }
      },
      ...schedules.map(schedule => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${schedule.user_name}: ${schedule.wfh_days.join(', ')}`
        }
      }))
    ]
  };
  
  await fetch(webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
  
  return new Response('OK');
});
```

### 8. Analytics Dashboard with Charts

```html
<!-- analytics.html -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/date-fns@2.29.3/index.min.js"></script>

<script>
class AnalyticsDashboard {
    async init() {
        const analytics = await this.fetchAnalytics();
        this.renderWFHTrends(analytics);
        this.renderOfficeUtilization(analytics);
        this.renderDepartmentBreakdown(analytics);
    }
    
    async fetchAnalytics() {
        const { data } = await supabase.functions.invoke('analytics', {
            body: { 
                period: 'month',
                start_date: '2025-01-01',
                end_date: '2025-01-31'
            }
        });
        return data;
    }
    
    renderWFHTrends(analytics) {
        const ctx = document.getElementById('wfh-trends').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: analytics.wfh_trends.daily_trends.map(t => 
                    new Date(t.date).toLocaleDateString()
                ),
                datasets: [{
                    label: 'WFH Percentage',
                    data: analytics.wfh_trends.daily_trends.map(t => t.wfh_percentage),
                    borderColor: '#A7EE43',
                    backgroundColor: 'rgba(167, 238, 67, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Work From Home Trends'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }
}
</script>
```

## 🚨 Security & Compliance

### 9. Data Backup Strategy

```sql
-- Set up automated backups
-- Run this in your Supabase SQL editor
CREATE OR REPLACE FUNCTION backup_user_data()
RETURNS void AS $$
BEGIN
    -- Create backup table with timestamp
    EXECUTE format('CREATE TABLE user_profiles_backup_%s AS SELECT * FROM user_profiles', 
                   to_char(now(), 'YYYY_MM_DD'));
    EXECUTE format('CREATE TABLE wfh_schedules_backup_%s AS SELECT * FROM wfh_schedules', 
                   to_char(now(), 'YYYY_MM_DD'));
    EXECUTE format('CREATE TABLE weekly_schedules_backup_%s AS SELECT * FROM weekly_schedules', 
                   to_char(now(), 'YYYY_MM_DD'));
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly backups (configure this in your infrastructure)
```

### 10. GDPR Compliance

```javascript
// js/gdpr.js
class GDPRCompliance {
    async exportUserData(userId) {
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        const { data: schedules } = await supabase
            .from('wfh_schedules')
            .select('*')
            .eq('user_id', userId);
            
        const { data: weeklySchedules } = await supabase
            .from('weekly_schedules')
            .select('*')
            .eq('user_id', userId);
            
        return {
            profile,
            schedules,
            weeklySchedules,
            exportDate: new Date().toISOString()
        };
    }
    
    async deleteUserData(userId) {
        // Delete in correct order due to foreign keys
        await supabase.from('wfh_schedules').delete().eq('user_id', userId);
        await supabase.from('weekly_schedules').delete().eq('user_id', userId);
        await supabase.from('schedule_audit').delete().eq('user_id', userId);
        await supabase.from('user_profiles').delete().eq('id', userId);
        
        // Also delete from auth.users (requires service role)
        await supabase.auth.admin.deleteUser(userId);
    }
}
```

## 📝 Implementation Checklist

### Phase 1: Production Essentials
- [ ] Configure Google OAuth in Supabase
- [ ] Set up email service (Resend/SendGrid)
- [ ] Deploy to production hosting
- [ ] Update redirect URLs and domains
- [ ] Test end-to-end authentication flow
- [ ] Set up monitoring and error tracking

### Phase 2: Enhanced Features
- [ ] Build admin dashboard
- [ ] Implement calendar integration
- [ ] Add Slack notifications
- [ ] Create mobile app (optional)
- [ ] Set up analytics dashboard
- [ ] Implement backup strategy

### Phase 3: Advanced Features
- [ ] Machine learning for WFH predictions
- [ ] Desk booking system integration
- [ ] Advanced reporting and insights
- [ ] Multi-company support
- [ ] API for third-party integrations

## 🆘 Troubleshooting

### Common Issues

**OAuth Redirect Issues**
```
Error: Invalid redirect URL
Solution: Ensure all redirect URLs are properly configured in both Supabase and Google Cloud Console
```

**Email Not Sending**
```
Error: Email service API error
Solution: Check API keys, verify domain verification, ensure CORS settings
```

**Database Connection Issues**
```
Error: Connection timeout
Solution: Check RLS policies, verify user permissions, test with service role key
```

### Getting Help

1. **Supabase Discord**: [discord.supabase.com](https://discord.supabase.com)
2. **Documentation**: [supabase.com/docs](https://supabase.com/docs)
3. **GitHub Issues**: Create issues for specific problems
4. **Stack Overflow**: Tag questions with `supabase`

---

**Ready to implement?** Start with Phase 1 to get your system production-ready, then gradually add enhanced features based on your team's needs! 🚀 