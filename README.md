# FIWFHT - Work From Home Tracker

FIWFHT is a simple web application that helps employees schedule their work-from-home days and see who's in the office on any given day.

## ✨ Features

### 🔐 Authentication
- Google OAuth integration for secure login
- Corporate email authentication (@enhancefitness domain)
- Persistent login with "Remember me" option

### 📅 Work From Home Scheduling
- **Weekly Calendar View**: Navigate through weeks with intuitive date controls
- **Flexible Day Selection**: Choose up to 2 days per week to work from home
- **Visual Feedback**: Selected days are highlighted with a distinctive green accent
- **Automatic Week Progression**: The system automatically moves to the next week but allows manual adjustments

### 👥 Office Attendance Tracking
- **Real-time Office Presence**: See who's currently working in the office
- **Employee Directory**: View all team members with their email addresses
- **Visual Employee Cards**: Clean, organized display of office attendees

### 🎨 Modern Design
- **Dark Theme**: Professional black background with green accents (#A7EE43)
- **Responsive Layout**: Works on desktop and mobile devices
- **Smooth Animations**: Hover effects and transitions for better UX
- **Typography**: Plus Jakarta Sans font for a modern, clean look

## 🏗️ Technical Architecture

### Frontend Technologies
- **HTML5**: Semantic markup with accessibility considerations
- **CSS**: Tailwind CSS for utility-first styling
- **JavaScript**: Vanilla JS for interactive functionality
- **SVG Icons**: Custom vector graphics for UI elements

### Key Components
1. **Login Page** (`index.html`): Authentication interface with Google OAuth
2. **Home Dashboard** (`home.html`): Main application with scheduling and office tracking

### File Structure
```
wfh-4/
├── index.html          # Login page
├── home.html          # Main dashboard
└── README.md          # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Web server (for local development)

### Installation & Setup

1. **Clone or download** the project files
2. **Serve the files** using a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have live-server installed)
   npx live-server
   
   # Using PHP
   php -S localhost:8000
   ```
3. **Access the application** at `http://localhost:8000`

### Usage

1. **Login**: Open `index.html` and authenticate with your corporate email
2. **Schedule**: On the home page, select up to 2 days per week for working from home
3. **Navigate**: Use the arrow buttons to move between weeks
4. **Save**: Click the save button to confirm your work-from-home schedule
5. **View Office Attendance**: See who's working in the office in the lower section

## 🎯 User Experience

### Login Flow
- Enter your @enhancefitness email address
- Click "Login with Google" or use the Google button
- System validates and redirects to the main dashboard

### Scheduling Workflow
- View the current week (May 25-30, 2025 by default)
- Click on up to 2 weekdays to select work-from-home days
- Selected days turn green and display with black text
- Navigate weeks using left/right arrows
- Save your selection with the prominent Save button

### Office Tracking
- Automatically displays current office attendees
- Shows employee names and email addresses
- Updates in real-time based on who's not working from home

## 🎨 Design System

### Color Palette
- **Primary Background**: `#080F17` (black)
- **Accent Color**: `#A7EE43` (bright green)
- **Text Primary**: `#D6DDE6` (light gray)
- **Text Secondary**: `rgba(214, 221, 230, 0.4)` (muted gray)
- **Borders**: `rgba(214, 221, 230, 0.2)` (subtle gray)

### Typography
- **Font Family**: Plus Jakarta Sans
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)

### Interactive Elements
- Hover effects on buttons and clickable elements
- Smooth transitions (0.3s ease)
- Clear visual feedback for selected states
- Accessible button styling with proper contrast

## 📱 Responsive Design

The application is built with mobile-first principles:
- Flexible grid layouts using CSS Flexbox
- Responsive typography scaling
- Touch-friendly button sizes
- Optimized for both desktop and mobile viewports

## 🔧 Customization

### Adding New Employees
Edit the employee list in `home.html` around lines 251-450 to add or modify team members.

### Changing Color Scheme
Update the Tailwind CSS configuration in the `<script>` tag to modify the color palette.

### Adjusting Work-From-Home Limits
Modify the `maxSelections` variable in the JavaScript section to change the maximum allowed work-from-home days.

## 🌟 Future Enhancements

- **Backend Integration**: Connect to a real database for user authentication and data persistence
- **Admin Dashboard**: Allow HR/managers to view team schedules
- **Calendar Integration**: Sync with Outlook/Google Calendar
- **Mobile App**: Native iOS/Android applications
- **Notifications**: Email/Slack reminders for schedule changes
- **Analytics**: Reporting on work-from-home patterns
- **Team Collaboration**: See team members' schedules for planning meetings

## 📄 License

This project is for internal use within the organization. All rights reserved.

---

**TL;DR**: FIWFHT is a modern, responsive web app for scheduling work-from-home days and tracking office attendance. Built with HTML, CSS (Tailwind), and vanilla JavaScript, it features Google OAuth login, weekly calendar navigation, and a clean dark theme design. 