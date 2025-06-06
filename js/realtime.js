// Real-time Manager Class
class RealtimeManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.subscriptions = [];
        this.isConnected = false;
    }

    // Office Attendance Real-time Updates
    subscribeToOfficeAttendance(callback) {
        const subscription = this.supabase
            .channel('office-attendance')
            .on('postgres_changes', 
                {
                    event: '*',
                    schema: 'public',
                    table: 'wfh_schedules'
                },
                (payload) => {
                    console.log('Office attendance update:', payload);
                    callback(payload);
                }
            )
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_profiles'
                },
                (payload) => {
                    console.log('User profile update:', payload);
                    callback(payload);
                }
            )
            .subscribe((status) => {
                console.log('Office attendance subscription status:', status);
                this.isConnected = status === 'SUBSCRIBED';
            });

        this.subscriptions.push({
            name: 'office-attendance',
            subscription: subscription
        });
        
        return subscription;
    }

    // Weekly Schedules Real-time Updates
    subscribeToWeeklySchedules(callback) {
        const subscription = this.supabase
            .channel('weekly-schedules')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'weekly_schedules'
                },
                (payload) => {
                    console.log('Weekly schedule update:', payload);
                    callback(payload);
                }
            )
            .subscribe((status) => {
                console.log('Weekly schedules subscription status:', status);
                this.isConnected = status === 'SUBSCRIBED';
            });

        this.subscriptions.push({
            name: 'weekly-schedules',
            subscription: subscription
        });
        
        return subscription;
    }

    // User-specific Schedule Updates
    subscribeToUserSchedules(userId, callback) {
        const subscription = this.supabase
            .channel(`user-schedules-${userId}`)
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'wfh_schedules',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('User schedule update:', payload);
                    callback(payload);
                }
            )
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'weekly_schedules',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('User weekly schedule update:', payload);
                    callback(payload);
                }
            )
            .subscribe((status) => {
                console.log('User schedules subscription status:', status);
                this.isConnected = status === 'SUBSCRIBED';
            });

        this.subscriptions.push({
            name: `user-schedules-${userId}`,
            subscription: subscription
        });
        
        return subscription;
    }

    // Team/Department Updates
    subscribeToTeamUpdates(department, callback) {
        const subscription = this.supabase
            .channel(`team-updates-${department}`)
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_profiles',
                    filter: `department=eq.${department}`
                },
                (payload) => {
                    console.log('Team update:', payload);
                    callback(payload);
                }
            )
            .subscribe((status) => {
                console.log('Team updates subscription status:', status);
                this.isConnected = status === 'SUBSCRIBED';
            });

        this.subscriptions.push({
            name: `team-updates-${department}`,
            subscription: subscription
        });
        
        return subscription;
    }

    // Presence System (for showing who's online)
    subscribeToPresence(channel, userId, userInfo, callback) {
        const subscription = this.supabase
            .channel(channel)
            .on('presence', { event: 'sync' }, () => {
                const presenceState = subscription.presenceState();
                console.log('Presence sync:', presenceState);
                callback({ event: 'sync', state: presenceState });
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('User joined:', key, newPresences);
                callback({ event: 'join', key, presences: newPresences });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('User left:', key, leftPresences);
                callback({ event: 'leave', key, presences: leftPresences });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await subscription.track({
                        user_id: userId,
                        ...userInfo,
                        online_at: new Date().toISOString()
                    });
                }
            });

        this.subscriptions.push({
            name: `presence-${channel}`,
            subscription: subscription
        });
        
        return subscription;
    }

    // Utility Methods
    unsubscribe(subscriptionName) {
        const index = this.subscriptions.findIndex(sub => sub.name === subscriptionName);
        if (index !== -1) {
            const { subscription } = this.subscriptions[index];
            this.supabase.removeChannel(subscription);
            this.subscriptions.splice(index, 1);
            console.log(`Unsubscribed from ${subscriptionName}`);
        }
    }

    unsubscribeAll() {
        this.subscriptions.forEach(({ subscription, name }) => {
            this.supabase.removeChannel(subscription);
            console.log(`Unsubscribed from ${name}`);
        });
        this.subscriptions = [];
        this.isConnected = false;
    }

    getSubscriptionStatus() {
        return {
            isConnected: this.isConnected,
            activeSubscriptions: this.subscriptions.map(sub => sub.name),
            count: this.subscriptions.length
        };
    }

    // Connection Health Check
    async checkConnection() {
        try {
            const { data, error } = await this.supabase
                .from('user_profiles')
                .select('count')
                .limit(1);
            
            return { healthy: !error, error };
        } catch (error) {
            return { healthy: false, error };
        }
    }

    // Retry Connection
    async reconnectAll() {
        console.log('Reconnecting all subscriptions...');
        const currentSubs = [...this.subscriptions];
        this.unsubscribeAll();
        
        // Wait a bit before reconnecting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Note: This is a simplified reconnection - in a real app you'd want to 
        // store the original callback functions and parameters to properly reconnect
        console.log('Reconnection would need to be handled by the calling code');
    }
}

// Global realtime manager instance
const realtimeManager = new RealtimeManager(supabase);

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
    realtimeManager.unsubscribeAll();
}); 