// Authentication Manager Class
class AuthManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentUser = null;
        this.authCallbacks = [];
    }

    async signInWithGoogle() {
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    hd: 'enhancefitness.com', // Restrict to company domain
                    redirectTo: `${window.location.origin}/home.html`
                }
            });
            
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Sign in error:', error);
            return { data: null, error };
        }
    }

    async getUser() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error) {
                console.error('Get user error, trying to refresh session:', error);
                
                // Try to refresh the session
                const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession();
                if (refreshError) {
                    console.error('Session refresh failed:', refreshError);
                    throw error;
                }
                
                console.log('Session refreshed successfully');
                // Try getting user again
                const { data: { user: refreshedUser }, error: retryError } = await this.supabase.auth.getUser();
                if (retryError) throw retryError;
                
                this.currentUser = refreshedUser;
                return { user: refreshedUser, error: null };
            }
            
            this.currentUser = user;
            return { user, error: null };
        } catch (error) {
            console.error('Get user error:', error);
            return { user: null, error };
        }
    }

    async getUserProfile() {
        try {
            const { user, error: userError } = await this.getUser();
            if (userError || !user) {
                console.error('User authentication error:', userError);
                return { profile: null, error: userError };
            }

            console.log('Fetching profile for user:', user.id);
            
            // Add retry logic for the database query
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts) {
                attempts++;
                console.log(`Profile fetch attempt ${attempts}/${maxAttempts}`);
                
                const { data: profile, error } = await this.supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                if (!error) {
                    console.log('Profile fetch successful:', profile);
                    return { profile, error: null };
                }
                
                console.error(`Database query error (attempt ${attempts}):`, error);
                
                // If it's the last attempt, return the error
                if (attempts === maxAttempts) {
                    return { profile: null, error };
                }
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }

            return { profile: null, error: new Error('Max retry attempts reached') };
        } catch (error) {
            console.error('Get user profile error:', error);
            return { profile: null, error };
        }
    }

    async createOrUpdateProfile(userData) {
        try {
            const { user, error: userError } = await this.getUser();
            if (userError || !user) return { data: null, error: userError };

            const profileData = {
                id: user.id,
                email: user.email,
                full_name: userData.full_name || user.user_metadata?.full_name || '',
                department: userData.department || '',
                role: userData.role || '',
                avatar_url: userData.avatar_url || user.user_metadata?.avatar_url || ''
            };

            const { data, error } = await this.supabase
                .from('user_profiles')
                .upsert(profileData)
                .select()
                .single();

            return { data, error };
        } catch (error) {
            console.error('Create/update profile error:', error);
            return { data: null, error };
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            this.currentUser = null;
            window.location.href = '/index.html';
            return { error: null };
        } catch (error) {
            console.error('Sign out error:', error);
            return { error };
        }
    }

    onAuthStateChange(callback) {
        this.authCallbacks.push(callback);
        return this.supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session?.user || null;
            callback(event, session);
        });
    }

    async checkAuth() {
        try {
            // Check if we have a valid session
            const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
            
            if (sessionError) {
                console.error('Session error:', sessionError);
                window.location.href = '/index.html';
                return false;
            }
            
            if (!session) {
                console.log('No active session found');
                window.location.href = '/index.html';
                return false;
            }
            
            console.log('Session is valid, expires at:', new Date(session.expires_at * 1000));
            
            const { user } = await this.getUser();
            if (!user) {
                console.log('No user found despite valid session');
                window.location.href = '/index.html';
                return false;
            }
            
            console.log('Authentication successful for user:', user.email);
            return true;
        } catch (error) {
            console.error('Authentication check failed:', error);
            window.location.href = '/index.html';
            return false;
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }
}

// Global auth manager instance
const authManager = new AuthManager(supabase); 