// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://ogbmvvqhgnnkuweapkpu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nYm12dnFoZ25ua3V3ZWFwa3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMDI1NjIsImV4cCI6MjA2NDc3ODU2Mn0.QdZ-HsiDqtC73QtYoIRqtB4soOv5FgC5i3U3HskoE1g',
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        global: {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }
    }
};

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, SUPABASE_CONFIG.options); 