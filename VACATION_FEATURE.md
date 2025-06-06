# Vacation Management Feature

## Overview
The vacation management feature allows employees to set their vacation/leave dates and displays vacation status in the office attendance table.

## Features Implemented

### 1. Vacation Section
- **Location**: Between WFH section and office table on home page
- **Components**:
  - Current vacation status display
  - "Set Leave" button to open vacation modal
  - Vacation status indicator (active/upcoming/none)

### 2. Date Picker Modal
- **Features**:
  - Start date and end date inputs
  - Optional notes field
  - Real-time vacation summary
  - Save/Clear/Cancel actions
  - Form validation

### 3. Office Table Integration
- **Vacation Status Display**:
  - 🏖️ Orange indicator for vacation days
  - 🏢 Green indicator for office days
  - 🏠 Gray indicator for WFH days
  - Status legend above the table

### 4. Database Structure
- **Table**: `public.vacations`
- **Columns**:
  - `id` (UUID, primary key)
  - `user_id` (UUID, foreign key to auth.users)
  - `start_date` (DATE)
  - `end_date` (DATE)
  - `notes` (TEXT, optional)
  - `status` (VARCHAR, default 'approved')
  - `created_at`, `updated_at` (timestamps)

## Technical Implementation

### Frontend Components
1. **Vacation Modal** (`#vacationModal`)
   - Date inputs with validation
   - Summary calculation
   - Loading states

2. **Status Display** (`#vacationStatus`)
   - Current vacation indicator
   - Date range display
   - Day count

3. **Office Table Updates**
   - Vacation status integration
   - Color-coded indicators
   - Mobile-responsive cards

### Backend Methods
Added to `ScheduleManager` class:
- `getCurrentVacation()` - Get user's current/upcoming vacation
- `saveVacation(startDate, endDate, notes)` - Save vacation dates
- `clearVacation()` - Remove vacation
- `getVacationStatusMap(userIds, startDate, endDate)` - Get vacation status for multiple users

### Database Migration
Run the `vacation_migration.sql` file to create:
- `vacations` table with proper constraints
- RLS policies for data security
- Indexes for performance
- Triggers for timestamp updates

## Usage Instructions

### Setting Vacation
1. Click "Set Leave" button in vacation section
2. Select start and end dates
3. Add optional notes
4. Review vacation summary
5. Click "Save Vacation"

### Viewing Office Status
- Office table now shows three status types:
  - 🏢 In Office (green)
  - 🏠 Work from Home (gray)  
  - 🏖️ On Vacation (orange)

### Clearing Vacation
1. Open vacation modal
2. Click "Clear Vacation" button
3. Confirm action

## Data Flow
1. User sets vacation dates in modal
2. Data saved to `vacations` table
3. Office table queries include vacation status
4. Real-time updates refresh table display
5. Vacation status shows in both user's view and team table

## Security Features
- Row Level Security (RLS) enabled
- Users can only modify their own vacations
- All users can view vacation status (for team visibility)
- Proper authentication checks

## Mobile Support
- Responsive design for all screen sizes
- Touch-friendly date inputs
- Mobile-optimized table display
- Accessible navigation

## Integration Points
- Integrates with existing WFH scheduling system
- Uses same authentication and user management
- Follows established UI/UX patterns
- Compatible with real-time updates system 