// Schedule Manager Class
class ScheduleManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    // Weekly Schedule Management
    async getWeeklySchedule(weekStart) {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('weekly_schedules')
                .select('*')
                .eq('week_start', weekStart)
                .eq('user_id', user.id)
                .single();

            return { data, error };
        } catch (error) {
            console.error('Get weekly schedule error:', error);
            return { data: null, error };
        }
    }

    async saveWeeklySchedule(weekStart, wfhDays, notes = '') {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const weekStartDate = new Date(weekStart);
            const scheduleData = {
                user_id: user.id,
                week_start: weekStart,
                year: weekStartDate.getFullYear(),
                week_number: this.getWeekNumber(weekStartDate),
                wfh_days: wfhDays,
                is_submitted: true,
                submitted_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('weekly_schedules')
                .upsert(scheduleData)
                .select()
                .single();

            if (!error) {
                // Also update individual daily schedules
                await this.updateDailySchedules(weekStart, wfhDays);
            }

            return { data, error };
        } catch (error) {
            console.error('Save weekly schedule error:', error);
            return { data: null, error };
        }
    }

    async updateDailySchedules(weekStart, wfhDays) {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const weekStartDate = new Date(weekStart);
            const dailySchedules = [];

            // Create daily schedules for the work week (Monday to Friday)
            for (let i = 0; i < 5; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(weekStartDate.getDate() + i);
                
                const dayNumber = i + 1; // 1 = Monday, 5 = Friday
                const isWfh = wfhDays.includes(dayNumber);

                dailySchedules.push({
                    user_id: user.id,
                    date: currentDate.toISOString().split('T')[0],
                    is_wfh: isWfh
                });
            }

            const { data, error } = await this.supabase
                .from('wfh_schedules')
                .upsert(dailySchedules, { onConflict: 'user_id,date' });

            return { data, error };
        } catch (error) {
            console.error('Update daily schedules error:', error);
            return { data: null, error };
        }
    }

    // Office Attendance
    async getOfficeAttendance(date) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_office_attendance', { target_date: date });

            return { data, error };
        } catch (error) {
            console.error('Get office attendance error:', error);
            return { data: null, error };
        }
    }

    async getWeeklyOfficeAttendance(weekStart) {
        try {
            const weekStartDate = new Date(weekStart);
            const weekData = [];

            for (let i = 0; i < 5; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(weekStartDate.getDate() + i);
                const dateStr = currentDate.toISOString().split('T')[0];

                const { data: attendance } = await this.getOfficeAttendance(dateStr);
                weekData.push({
                    date: dateStr,
                    dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
                    attendance: attendance || []
                });
            }

            return { data: weekData, error: null };
        } catch (error) {
            console.error('Get weekly office attendance error:', error);
            return { data: null, error };
        }
    }

    // Individual Daily Schedule Management
    async getDailySchedule(date) {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('wfh_schedules')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', date)
                .single();

            return { data, error };
        } catch (error) {
            console.error('Get daily schedule error:', error);
            return { data: null, error };
        }
    }

    async updateDailySchedule(date, isWfh, notes = '') {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const scheduleData = {
                user_id: user.id,
                date: date,
                is_wfh: isWfh,
                notes: notes
            };

            const { data, error } = await this.supabase
                .from('wfh_schedules')
                .upsert(scheduleData, { onConflict: 'user_id,date' })
                .select()
                .single();

            return { data, error };
        } catch (error) {
            console.error('Update daily schedule error:', error);
            return { data: null, error };
        }
    }

    // Utility Functions
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    getWeekStart(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    }

    getNextWeekStart(date = new Date()) {
        const currentWeekStart = new Date(this.getWeekStart(date));
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        return currentWeekStart.toISOString().split('T')[0];
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Validation
    validateWfhDays(wfhDays, maxDays = 2) {
        if (!Array.isArray(wfhDays)) return false;
        if (wfhDays.length > maxDays) return false;
        if (wfhDays.some(day => day < 1 || day > 5)) return false;
        return true;
    }
}

// Global schedule manager instance
const scheduleManager = new ScheduleManager(supabase); 