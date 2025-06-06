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

    // Get all users' weekly office status for table display
    async getAllUsersWeeklyOfficeStatus(weekStart) {
        try {
            const weekStartDate = new Date(weekStart);
            
            // Get all user profiles
            const { data: users, error: usersError } = await this.supabase
                .from('user_profiles')
                .select('id, full_name, email, department')
                .order('full_name');

            if (usersError) throw usersError;

            // Get all WFH schedules for the week
            const endDate = new Date(weekStartDate);
            endDate.setDate(endDate.getDate() + 4); // Friday

            const { data: wfhSchedules, error: schedulesError } = await this.supabase
                .from('wfh_schedules')
                .select('user_id, date, is_wfh')
                .gte('date', weekStartDate.toISOString().split('T')[0])
                .lte('date', endDate.toISOString().split('T')[0]);

            if (schedulesError) throw schedulesError;

            // Get vacation status for all users in the week
            const userIds = users.map(user => user.id);
            const startDateStr = weekStartDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            const vacationMap = await this.getVacationStatusMap(userIds, startDateStr, endDateStr);

            // Create a map of user schedules for quick lookup
            const scheduleMap = {};
            wfhSchedules.forEach(schedule => {
                const userId = schedule.user_id;
                if (!scheduleMap[userId]) {
                    scheduleMap[userId] = {};
                }
                scheduleMap[userId][schedule.date] = schedule.is_wfh;
            });

            // Build the final data structure
            const weekDays = [];
            for (let i = 0; i < 5; i++) {
                const currentDate = new Date(weekStartDate);
                currentDate.setDate(weekStartDate.getDate() + i);
                weekDays.push({
                    date: currentDate.toISOString().split('T')[0],
                    dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
                    dayShort: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
                    dayNumber: i + 1 // 1 = Monday, 5 = Friday
                });
            }

            const usersWithStatus = users.map(user => {
                const userSchedule = scheduleMap[user.id] || {};
                const userVacationDates = vacationMap[user.id] || [];
                
                const dailyStatus = weekDays.map(day => {
                    const isWfh = userSchedule[day.date];
                    const isOnVacation = userVacationDates.includes(day.date);
                    
                    return {
                        date: day.date,
                        dayName: day.dayName,
                        dayShort: day.dayShort,
                        dayNumber: day.dayNumber,
                        isWfh: isWfh !== undefined ? isWfh : false, // Default to office if no schedule
                        isInOffice: isWfh !== undefined ? !isWfh : true, // Inverse of WFH
                        isOnVacation: isOnVacation,
                        hasSchedule: isWfh !== undefined
                    };
                });

                return {
                    user: {
                        id: user.id,
                        name: user.full_name,
                        email: user.email,
                        department: user.department
                    },
                    weekStart,
                    dailyStatus,
                    officeCount: dailyStatus.filter(day => day.isInOffice && !day.isOnVacation).length,
                    wfhCount: dailyStatus.filter(day => day.isWfh && !day.isOnVacation).length,
                    vacationCount: dailyStatus.filter(day => day.isOnVacation).length
                };
            });

            return { 
                data: {
                    weekDays,
                    users: usersWithStatus,
                    totalUsers: users.length,
                    weekStart
                }, 
                error: null 
            };
        } catch (error) {
            console.error('Get all users weekly office status error:', error);
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

    // ===============================
    // VACATION MANAGEMENT METHODS
    // ===============================

    // Get current active or upcoming vacation for the user
    async getCurrentVacation() {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await this.supabase
                .from('vacations')
                .select('*')
                .eq('user_id', user.id)
                .gte('end_date', today) // Only get current or future vacations
                .order('start_date', { ascending: true })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Get current vacation error:', error);
            return null;
        }
    }

    // Save vacation dates
    async saveVacation(startDate, endDate, notes = '') {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const vacationData = {
                user_id: user.id,
                start_date: startDate,
                end_date: endDate,
                notes: notes,
                status: 'approved' // Auto-approve for now
            };

            const { data, error } = await this.supabase
                .from('vacations')
                .upsert(vacationData, { onConflict: 'user_id,start_date' })
                .select()
                .single();

            return { data, error };
        } catch (error) {
            console.error('Save vacation error:', error);
            return { data: null, error };
        }
    }

    // Clear current vacation
    async clearVacation() {
        try {
            const { user } = await authManager.getUser();
            if (!user) throw new Error('User not authenticated');

            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await this.supabase
                .from('vacations')
                .delete()
                .eq('user_id', user.id)
                .gte('end_date', today); // Only delete current or future vacations

            return { data, error };
        } catch (error) {
            console.error('Clear vacation error:', error);
            return { data: null, error };
        }
    }

    // Check if a user is on vacation for a specific date
    async isUserOnVacation(userId, date) {
        try {
            const { data, error } = await this.supabase
                .from('vacations')
                .select('id')
                .eq('user_id', userId)
                .lte('start_date', date)
                .gte('end_date', date)
                .eq('status', 'approved')
                .limit(1);

            if (error) throw error;

            return data && data.length > 0;
        } catch (error) {
            console.error('Check vacation status error:', error);
            return false;
        }
    }

    // Get vacation status for multiple users and dates (for office table)
    async getVacationStatusMap(userIds, startDate, endDate) {
        try {
            const { data, error } = await this.supabase
                .from('vacations')
                .select('user_id, start_date, end_date')
                .in('user_id', userIds)
                .eq('status', 'approved')
                .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

            if (error) throw error;

            // Create a map of userId -> dates on vacation
            const vacationMap = {};
            
            data?.forEach(vacation => {
                const userId = vacation.user_id;
                if (!vacationMap[userId]) {
                    vacationMap[userId] = [];
                }

                // Generate all dates in the vacation range that overlap with our query range
                const vacStart = new Date(Math.max(new Date(vacation.start_date), new Date(startDate)));
                const vacEnd = new Date(Math.min(new Date(vacation.end_date), new Date(endDate)));

                for (let d = new Date(vacStart); d <= vacEnd; d.setDate(d.getDate() + 1)) {
                    vacationMap[userId].push(d.toISOString().split('T')[0]);
                }
            });

            return vacationMap;
        } catch (error) {
            console.error('Get vacation status map error:', error);
            return {};
        }
    }
}

// Global schedule manager instance
const scheduleManager = new ScheduleManager(supabase); 