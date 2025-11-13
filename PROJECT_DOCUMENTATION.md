# SkillBridge - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [Database Schema](#database-schema)
4. [Frontend-Backend Connection](#frontend-backend-connection)
5. [API Endpoints](#api-endpoints)
6. [Authentication Flow](#authentication-flow)
7. [User Workflow](#user-workflow)
8. [Data Flow](#data-flow)
9. [Key Components](#key-components)

---

## Project Overview

**SkillBridge** is an AI-powered career transition platform **specifically designed for Appalachian coal miners** transitioning to new careers. The platform helps displaced coal industry workers through:
- **Mining-specific skill assessment** using structured questionnaires and AI
- **Tailored career matching** focused on realistic transition paths (renewable energy, skilled trades, etc.)
- **Personalized learning paths** with local training programs, certifications, and online resources
- **Location-aware recommendations** showing commute distances and regional opportunities
- Progress tracking and SMS reminders (planned)

### Target Population
The platform is optimized for:
- **Appalachian coal miners** (West Virginia, Kentucky, Pennsylvania, Ohio, Virginia, Tennessee)
- Workers with **limited home internet access** (mobile-first design)
- Users seeking **local training opportunities** and **hands-on certifications**
- Career transitions to **renewable energy**, **skilled trades**, **transportation**, and **safety** fields

### Technology Stack

**Backend:**
- FastAPI (Python web framework)
- Supabase (PostgreSQL database)
- Google Gemini AI (for conversational assessment)
- JWT authentication
- Google OAuth 2.0

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- React Router v7 (routing)
- Ant Design (UI components)
- Axios (HTTP client)
- CSS Modules (styling)

---

## Project Structure

```
grad2career/
├── backend/                          # FastAPI Backend
│   ├── app/
│   │   ├── main.py                  # FastAPI application entry point
│   │   ├── api/                     # API routes
│   │   │   ├── router.py           # Main API router (includes all route modules)
│   │   │   └── routes/             # Individual route modules
│   │   │       ├── auth.py         # Authentication endpoints
│   │   │       ├── skills.py       # Skill assessment endpoints
│   │   │       ├── agent.py        # AI agent endpoints
│   │   │       ├── learning.py     # Learning path endpoints
│   │   │       ├── youtube.py      # YouTube resource endpoints
│   │   │       └── health.py       # Health check endpoints
│   │   ├── core/                    # Core configuration
│   │   │   ├── config.py           # Settings and environment variables
│   │   │   └── supabase.py         # Supabase client initialization
│   │   ├── db/                      # Database layer
│   │   │   ├── models.py           # Database models (currently empty)
│   │   │   ├── schemas.py          # Pydantic schemas (currently empty)
│   │   │   └── crud.py             # CRUD operations (currently empty)
│   │   ├── services/                # Business logic services
│   │   │   ├── conversational_assessment.py  # Skill assessment service
│   │   │   ├── session_manager.py  # Session management for assessments
│   │   │   ├── external_apis.py    # External API integrations
│   │   │   └── agents/             # AI agent implementations
│   │   └── utils/                   # Utility functions
│   ├── database_setup.sql           # Database schema SQL script
│   ├── requirements.txt             # Python dependencies
│   └── start_backend.sh             # Backend startup script
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── main.tsx                 # React application entry point
│   │   ├── App.tsx                  # Main app component with routing
│   │   ├── pages/                   # Page components
│   │   │   ├── Home.tsx             # Landing page
│   │   │   ├── LoginPage.tsx        # Login page
│   │   │   ├── SignUpPage.tsx       # Sign up page
│   │   │   ├── OAuthCallback.tsx    # OAuth callback handler
│   │   │   ├── OnboardingPage.tsx   # User onboarding flow
│   │   │   ├── Dashboard.tsx        # User dashboard
│   │   │   ├── Profile.tsx          # User profile page
│   │   │   ├── SkillAssessment.tsx  # Skill assessment chat interface
│   │   │   ├── CareerMatch.tsx      # Career matching page
│   │   │   ├── LearningPath.tsx     # Learning path visualization
│   │   │   └── VideoDetail.tsx      # Video resource detail page
│   │   ├── components/              # Reusable UI components
│   │   ├── context/                 # React contexts
│   │   │   └── AuthContext.tsx      # Authentication context provider
│   │   ├── services/                # API service layer
│   │   │   └── api.ts               # Axios instance with interceptors
│   │   ├── config/                  # Configuration
│   │   │   └── api.ts               # API endpoint constants
│   │   └── assets/                  # Static assets
│   ├── package.json                 # Node.js dependencies
│   └── vite.config.ts               # Vite configuration
│
└── README.md                         # Project README
```

---

## Database Schema

The database uses **PostgreSQL** (via Supabase). 

**Base tables** are defined in `backend/database_setup.sql`.

**Coal miner-specific extensions** are defined in `backend/database_setup_coal_miners.sql` (run this migration after the base schema).

### Database Migration Instructions

1. Run `backend/database_setup.sql` first (creates base tables)
2. Run `backend/database_setup_coal_miners.sql` second (adds coal miner-specific fields and tables)

### 1. `users` Table
Stores user account information and authentication data.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique user identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| `name` | VARCHAR(255) | NULL | User's display name |
| `picture` | TEXT | NULL | Profile picture URL (for OAuth users) |
| `auth_provider` | VARCHAR(50) | DEFAULT 'email' | Authentication method: 'email' or 'google' |
| `password_hash` | TEXT | NULL | Hashed password (for email auth) |
| `metadata` | JSONB | DEFAULT '{}' | Additional user data including onboarding info |
| `onboarding_completed` | BOOLEAN | DEFAULT FALSE | Whether user completed onboarding |
| `onboarding_completed_at` | TIMESTAMP WITH TIME ZONE | NULL | Timestamp when onboarding was completed |
| `phone_number` | VARCHAR(20) | NULL | **NEW:** Phone number for SMS reminders |
| `sms_opt_in` | BOOLEAN | DEFAULT FALSE | **NEW:** Whether user opted in to SMS reminders |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_users_email` on `email`
- `idx_users_auth_provider` on `auth_provider`

**Metadata JSONB Structure:**
```json
{
  "onboarding_completed": true,
  "current_zip_code": "12345",
  "travel_constraint": "none",
  "budget_constraint": "low",
  "scheduling": "flexible",
  "weekly_hours_constraint": 10,
  "transition_goal": "quick",
  "transition_goal_text": "Get back to work quickly (6 months)",
  "target_sector": "technology",
  "age": 35,
  "veteran_status": false,
  "onboarding_completed_at": "2024-01-15T10:30:00Z"
}
```

### 2. `user_profiles` Table
Stores detailed user skill profiles and career information.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `user_id` | UUID | PRIMARY KEY, REFERENCES users(id) ON DELETE CASCADE | Foreign key to users table |
| `skills` | JSONB | DEFAULT '[]' | Array of skill names extracted from assessment |
| `tools` | JSONB | DEFAULT '[]' | Array of tools and technologies |
| `certifications` | JSONB | DEFAULT '[]' | Array of certifications |
| `work_experience` | TEXT | NULL | Free-text description of work experience |
| `career_goals` | TEXT | NULL | User's career transition goals |
| `previous_job_title` | VARCHAR(255) | NULL | **NEW:** Last mining job title (e.g., "Continuous Miner Operator") |
| `mining_role` | VARCHAR(100) | NULL | **NEW:** Mining role category (e.g., "Operator", "Maintenance", "Supervisor") |
| `mining_type` | VARCHAR(50) | NULL | **NEW:** Type of mining ("underground", "surface", "both") |
| `years_mining_experience` | INTEGER | NULL | **NEW:** Years of experience in mining |
| `mining_questionnaire_responses` | JSONB | DEFAULT '{}' | **NEW:** Structured questionnaire responses |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Profile creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Example JSONB Data:**
```json
{
  "skills": ["Python programming", "Data analysis", "Project management"],
  "tools": ["Excel", "SQL", "Git"],
  "certifications": ["AWS Certified Solutions Architect"]
}
```

### 3. `career_matches` Table
Stores career matching results for users.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique match identifier |
| `user_id` | UUID | REFERENCES users(id) ON DELETE CASCADE | Foreign key to users table |
| `career_title` | VARCHAR(255) | NOT NULL | Name of the matched career |
| `match_score` | DECIMAL(5,2) | NULL | Match percentage (0-100) |
| `required_skills` | JSONB | DEFAULT '[]' | Array of required skills for this career |
| `missing_skills` | JSONB | DEFAULT '[]' | Array of skills user lacks |
| `salary_range` | VARCHAR(100) | NULL | Expected salary range |
| `growth_rate` | VARCHAR(50) | NULL | Job growth rate |
| `local_demand_rating` | VARCHAR(50) | NULL | **NEW:** Regional demand ("high", "medium", "low") |
| `commute_distance_miles` | DECIMAL(6,2) | NULL | **NEW:** Distance from user's zip code |
| `commute_time_minutes` | INTEGER | NULL | **NEW:** Estimated commute time |
| `local_job_growth` | TEXT | NULL | **NEW:** Regional growth information |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Match creation timestamp |

**Index:**
- `idx_career_matches_user_id` on `user_id`

### 4. `learning_paths` Table
Stores user learning paths with scheduled resources.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique path identifier |
| `user_id` | UUID | REFERENCES users(id) ON DELETE CASCADE | Foreign key to users table |
| `career_id` | UUID | REFERENCES career_matches(id) ON DELETE CASCADE | Foreign key to career match |
| `path_data` | JSONB | NOT NULL | Complete learning path structure |
| `status` | VARCHAR(50) | DEFAULT 'active' | Path status: 'active', 'completed', 'paused' |
| `progress_percentage` | DECIMAL(5,2) | DEFAULT 0 | Completion percentage (0-100) |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Path creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Index:**
- `idx_learning_paths_user_id` on `user_id`

**path_data JSONB Structure (Enhanced for Coal Miners):**
```json
{
  "career_title": "Wind Turbine Technician",
  "scheduled_items": [
    {
      "date": "2024-01-15",
      "type": "video",
      "video": {
        "videoId": "abc123",
        "title": "Introduction to Wind Energy",
        "url": "https://youtube.com/watch?v=abc123",
        "thumbnail": "https://...",
        "duration": "PT1H30M"
      },
      "completed": false,
      "completed_at": null,
      "notes": null
    },
    {
      "date": "2024-01-22",
      "type": "course",
      "course": {
        "program_id": "uuid-here",
        "program_name": "Wind Energy Technology Certification",
        "provider": "Mountain Community College",
        "location": {
          "address": "123 Main St",
          "city": "Charleston",
          "state": "WV",
          "zip": "25301",
          "distance_miles": 35.5,
          "drive_time_minutes": 45
        },
        "start_date": "2024-02-01",
        "enrollment_deadline": "2024-01-25",
        "cost": 2500.00,
        "contact_phone": "304-555-0123",
        "contact_email": "admissions@mcc.edu"
      },
      "completed": false,
      "completed_at": null,
      "notes": null
    },
    {
      "date": "2024-02-01",
      "type": "certification",
      "certification": {
        "name": "OSHA 10-Hour Safety",
        "provider": "OSHA Outreach",
        "online": true,
        "cost": 0,
        "url": "https://osha.gov/outreach"
      },
      "completed": false,
      "completed_at": null,
      "notes": null
    }
  ]
}
```

**Note:** The structure has been updated from `scheduled_videos` to `scheduled_items` to support multiple resource types (videos, courses, certifications).

### 5. `learning_progress` Table
Tracks detailed progress for individual learning resources.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique progress record identifier |
| `user_id` | UUID | REFERENCES users(id) ON DELETE CASCADE | Foreign key to users table |
| `learning_path_id` | UUID | REFERENCES learning_paths(id) ON DELETE CASCADE | Foreign key to learning path |
| `week_number` | INTEGER | NOT NULL | Week number in the learning path |
| `resource_id` | VARCHAR(255) | NULL | Identifier for the resource (e.g., video ID) |
| `completed` | BOOLEAN | DEFAULT FALSE | Whether resource is completed |
| `completed_at` | TIMESTAMP WITH TIME ZONE | NULL | Completion timestamp |
| `notes` | TEXT | NULL | User notes about the resource |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |

**Index:**
- `idx_learning_progress_user_id` on `user_id`

### 6. `assessment_sessions` Table
Stores conversational skill assessment sessions.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique session identifier |
| `user_id` | UUID | REFERENCES users(id) ON DELETE CASCADE | Foreign key to users table |
| `messages` | JSONB | DEFAULT '[]' | Conversation history (array of message objects) |
| `extracted_skills` | JSONB | DEFAULT '[]' | Skills extracted from the conversation |
| `status` | VARCHAR(50) | DEFAULT 'in_progress' | Session status: 'in_progress' or 'completed' |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Session creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Index:**
- `idx_assessment_sessions_user_id` on `user_id`

**messages JSONB Structure:**
```json
[
  {"role": "assistant", "content": "Welcome! Let's start..."},
  {"role": "user", "content": "I worked as a mechanic..."},
  {"role": "assistant", "content": "Great! Can you tell me..."}
]
```

**extracted_skills JSONB Structure:**
```json
[
  {
    "category": "Mechanical Skills",
    "user_phrase": "engine repair",
    "onet_task_codes": ["TASK_001", "TASK_002"]
  }
]
```

### 7. `learning_resources` Table
Stores learning resources (courses, videos, etc.).

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing resource ID |
| `title` | TEXT | NOT NULL | Resource title |
| `url` | TEXT | NOT NULL | Resource URL |
| `description` | TEXT | NULL | Resource description |
| `source` | TEXT | NULL | Source platform (e.g., "YouTube", "Coursera") |
| `resource_type` | VARCHAR(50) | NULL | Type of resource (e.g., "video", "course") |
| `resource_category` | VARCHAR(100) | NULL | **NEW:** Category ("video", "course", "certification", "program") |
| `provider_name` | VARCHAR(255) | NULL | **NEW:** Provider name (e.g., "Mountain Community College") |
| `provider_address` | TEXT | NULL | **NEW:** Provider street address |
| `provider_city` | VARCHAR(100) | NULL | **NEW:** Provider city |
| `provider_state` | VARCHAR(50) | NULL | **NEW:** Provider state |
| `provider_zip` | VARCHAR(20) | NULL | **NEW:** Provider ZIP code |
| `cost` | DECIMAL(10,2) | NULL | **NEW:** Cost in USD |
| `duration_weeks` | INTEGER | NULL | **NEW:** Duration in weeks |
| `duration_hours` | INTEGER | NULL | **NEW:** Duration in hours |
| `start_date` | DATE | NULL | **NEW:** Next available start date |
| `enrollment_deadline` | DATE | NULL | **NEW:** Enrollment deadline |
| `contact_phone` | VARCHAR(20) | NULL | **NEW:** Contact phone number |
| `contact_email` | VARCHAR(255) | NULL | **NEW:** Contact email |
| `online_only` | BOOLEAN | DEFAULT FALSE | **NEW:** Whether resource is online only |
| `in_person` | BOOLEAN | DEFAULT FALSE | **NEW:** Whether resource is in-person |
| `hybrid` | BOOLEAN | DEFAULT FALSE | **NEW:** Whether resource is hybrid |
| `certification_awarded` | VARCHAR(255) | NULL | **NEW:** Certification name (e.g., "OSHA 30-Hour") |
| `prerequisites` | TEXT | NULL | **NEW:** Required prerequisites |
| `target_careers` | JSONB | DEFAULT '[]' | **NEW:** Which careers this resource supports |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Resource creation timestamp |

### 8. `mining_questionnaire_responses` Table (NEW)
Stores structured questionnaire responses for mining-specific skill assessment.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique response identifier |
| `user_id` | UUID | REFERENCES users(id) | Foreign key to users table |
| `session_id` | UUID | REFERENCES assessment_sessions(id) | Foreign key to assessment session |
| `last_mining_job_title` | VARCHAR(255) | NULL | Last mining job title |
| `years_experience` | INTEGER | NULL | Years of mining experience |
| `mining_type` | VARCHAR(50) | NULL | "underground", "surface", or "both" |
| `operated_heavy_machinery` | BOOLEAN | DEFAULT FALSE | Whether user operated heavy machinery |
| `machinery_types` | JSONB | DEFAULT '[]' | Types of machinery operated |
| `performed_maintenance` | BOOLEAN | DEFAULT FALSE | Whether user performed maintenance |
| `maintenance_types` | JSONB | DEFAULT '[]' | Types of maintenance performed |
| `safety_training_completed` | BOOLEAN | DEFAULT FALSE | Whether user completed safety training |
| `safety_certifications` | JSONB | DEFAULT '[]' | Safety certifications (MSHA, OSHA, etc.) |
| `supervised_team` | BOOLEAN | DEFAULT FALSE | Whether user supervised a team |
| `team_size` | INTEGER | NULL | Size of team supervised |
| `welding_experience` | BOOLEAN | DEFAULT FALSE | Whether user has welding experience |
| `electrical_work` | BOOLEAN | DEFAULT FALSE | Whether user performed electrical work |
| `blasting_experience` | BOOLEAN | DEFAULT FALSE | Whether user has blasting experience |
| `cdl_license` | BOOLEAN | DEFAULT FALSE | Whether user has CDL license |
| `questionnaire_data` | JSONB | DEFAULT '{}' | Complete questionnaire responses |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Response creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_mining_questionnaire_user_id` on `user_id`
- `idx_mining_questionnaire_session_id` on `session_id`

### 9. `target_careers` Table (NEW)
Curated list of target careers for coal miner transitions.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique career identifier |
| `career_title` | VARCHAR(255) | UNIQUE, NOT NULL | Career title |
| `description` | TEXT | NULL | Career description |
| `category` | VARCHAR(100) | NULL | Category: "renewable_energy", "skilled_trades", "transportation", "safety", "construction" |
| `required_skills` | JSONB | DEFAULT '[]' | Required skills for this career |
| `transferable_mining_skills` | JSONB | DEFAULT '[]' | Which mining skills transfer well |
| `national_growth_rate` | VARCHAR(50) | NULL | National job growth rate |
| `median_salary_range` | VARCHAR(100) | NULL | Median salary range |
| `entry_level_education` | VARCHAR(100) | NULL | Required education level |
| `appalachian_demand_rating` | VARCHAR(50) | NULL | Demand in Appalachian region ("high", "medium", "low") |
| `appalachian_states` | JSONB | DEFAULT '[]' | States where this career is in demand |
| `required_certifications` | JSONB | DEFAULT '[]' | Required certifications/licenses |
| `certification_notes` | TEXT | NULL | Notes about certifications |
| `recommended_resources` | JSONB | DEFAULT '[]' | Recommended learning resource IDs |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Career creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Pre-populated Careers:**
- Wind Turbine Technician
- Solar Panel Installer
- Electrical Line Worker (Lineman)
- Heavy Equipment Operator
- Commercial Truck Driver
- Industrial Maintenance Technician
- Welder
- Safety Inspector / Compliance Officer

**Indexes:**
- `idx_target_careers_category` on `category`
- `idx_target_careers_appalachian_demand` on `appalachian_demand_rating`

### 10. `local_training_programs` Table (NEW)
Pre-populated list of local training programs in Appalachian region.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique program identifier |
| `program_name` | VARCHAR(255) | NOT NULL | Program name |
| `provider_name` | VARCHAR(255) | NOT NULL | Provider name |
| `provider_type` | VARCHAR(100) | NULL | "community_college", "trade_school", "union_training", "employer_program" |
| `address` | TEXT | NULL | Street address |
| `city` | VARCHAR(100) | NULL | City |
| `state` | VARCHAR(50) | NULL | State |
| `zip_code` | VARCHAR(20) | NULL | ZIP code |
| `latitude` | DECIMAL(10, 8) | NULL | Latitude for distance calculations |
| `longitude` | DECIMAL(11, 8) | NULL | Longitude for distance calculations |
| `description` | TEXT | NULL | Program description |
| `program_type` | VARCHAR(100) | NULL | "certification", "degree", "apprenticeship", "short_course" |
| `duration_weeks` | INTEGER | NULL | Duration in weeks |
| `duration_hours` | INTEGER | NULL | Duration in hours |
| `cost` | DECIMAL(10,2) | NULL | Cost in USD |
| `financial_aid_available` | BOOLEAN | DEFAULT FALSE | Whether financial aid is available |
| `start_dates` | JSONB | DEFAULT '[]' | Array of upcoming start dates |
| `enrollment_deadline` | DATE | NULL | Enrollment deadline |
| `schedule_type` | VARCHAR(50) | NULL | "full_time", "part_time", "evening", "weekend", "flexible" |
| `contact_phone` | VARCHAR(20) | NULL | Contact phone |
| `contact_email` | VARCHAR(255) | NULL | Contact email |
| `website_url` | TEXT | NULL | Website URL |
| `target_careers` | JSONB | DEFAULT '[]' | Careers this program supports |
| `certifications_awarded` | JSONB | DEFAULT '[]' | Certifications awarded |
| `prerequisites` | TEXT | NULL | Prerequisites |
| `minimum_education` | VARCHAR(100) | NULL | Minimum education required |
| `online_only` | BOOLEAN | DEFAULT FALSE | Online only delivery |
| `in_person` | BOOLEAN | DEFAULT FALSE | In-person delivery |
| `hybrid` | BOOLEAN | DEFAULT FALSE | Hybrid delivery |
| `active` | BOOLEAN | DEFAULT TRUE | Whether program is currently active |
| `verified` | BOOLEAN | DEFAULT FALSE | Whether program details are verified |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Program creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_local_training_state` on `state`
- `idx_local_training_zip` on `zip_code`
- `idx_local_training_active` on `active`

### 11. `user_certifications` Table (NEW)
Tracks user certifications and licenses.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique certification record identifier |
| `user_id` | UUID | REFERENCES users(id) | Foreign key to users table |
| `certification_name` | VARCHAR(255) | NOT NULL | Certification name |
| `issuing_organization` | VARCHAR(255) | NULL | Issuing organization |
| `certification_type` | VARCHAR(100) | NULL | "license", "certificate", "credential" |
| `issue_date` | DATE | NULL | Issue date |
| `expiration_date` | DATE | NULL | Expiration date |
| `certification_number` | VARCHAR(255) | NULL | Certification number |
| `status` | VARCHAR(50) | DEFAULT 'active' | "active", "expired", "pending", "in_progress" |
| `notes` | TEXT | NULL | Additional notes |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_user_certifications_user_id` on `user_id`
- `idx_user_certifications_status` on `status`

### 12. `sms_reminders` Table (NEW - For Future Implementation)
Tracks SMS reminders sent to users.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique reminder identifier |
| `user_id` | UUID | REFERENCES users(id) | Foreign key to users table |
| `learning_path_id` | UUID | REFERENCES learning_paths(id) | Foreign key to learning path |
| `reminder_type` | VARCHAR(50) | NULL | "learning_task", "enrollment_deadline", "certification_due", "general" |
| `scheduled_date` | DATE | NOT NULL | Scheduled date for reminder |
| `scheduled_time` | TIME | NULL | Scheduled time |
| `message_text` | TEXT | NOT NULL | Reminder message text |
| `sent` | BOOLEAN | DEFAULT FALSE | Whether reminder was sent |
| `sent_at` | TIMESTAMP WITH TIME ZONE | NULL | When reminder was sent |
| `phone_number` | VARCHAR(20) | NULL | Phone number (snapshot) |
| `status` | VARCHAR(50) | DEFAULT 'pending' | "pending", "sent", "failed", "cancelled" |
| `error_message` | TEXT | NULL | Error message if sending failed |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Reminder creation timestamp |

**Indexes:**
- `idx_sms_reminders_user_id` on `user_id`
- `idx_sms_reminders_scheduled_date` on `scheduled_date`
- `idx_sms_reminders_status` on `status`

---

## Frontend-Backend Connection

### Connection Architecture

```
┌─────────────────┐         HTTP/REST          ┌─────────────────┐
│   React App     │ ◄─────────────────────────► │   FastAPI       │
│   (Frontend)    │         (Axios)              │   (Backend)     │
│                 │                              │                 │
│  Port: 5173     │                              │  Port: 8000     │
└─────────────────┘                              └─────────────────┘
                                                          │
                                                          │ Supabase Client
                                                          ▼
                                                  ┌─────────────────┐
                                                  │   Supabase      │
                                                  │   (PostgreSQL)  │
                                                  └─────────────────┘
```

### Configuration

**Frontend API Configuration** (`frontend/src/config/api.ts`):
```typescript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
```

**Backend CORS Configuration** (`backend/app/main.py`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        settings.frontend_url
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Authentication Flow

1. **Frontend** sends requests with JWT token in `Authorization` header:
   ```typescript
   // frontend/src/services/api.ts
   api.interceptors.request.use((config) => {
     const token = localStorage.getItem('authToken');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```

2. **Backend** validates token and extracts user ID:
   ```python
   # backend/app/api/routes/auth.py
   def verify_jwt_token(token: str) -> dict:
       payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
       return payload  # Contains user_id and email
   ```

3. **Database queries** use the authenticated `user_id` to fetch user-specific data.

### Request/Response Flow

1. **User Action** → React component calls service function
2. **Service Layer** → `api.ts` makes HTTP request with Axios
3. **Backend Route** → FastAPI endpoint receives request
4. **Authentication** → JWT token validated, user_id extracted
5. **Business Logic** → Service layer processes request
6. **Database** → Supabase client queries PostgreSQL
7. **Response** → JSON response sent back to frontend
8. **State Update** → React component updates UI

---

## API Endpoints

### Authentication Endpoints (`/auth`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/auth/signup` | User registration | `{email, password, name?}` | `{token, user}` |
| `POST` | `/auth/login` | User login | `{email, password}` | `{token, user}` |
| `GET` | `/auth/google/login` | Initiate Google OAuth | - | `{url}` (OAuth URL) |
| `GET` | `/auth/google/callback` | Handle OAuth callback | Query: `code` | Redirect to frontend |
| `GET` | `/auth/me` | Get current user | Header: `Authorization: Bearer <token>` | `{id, email, name, ...}` |
| `POST` | `/auth/logout` | User logout | - | `{message}` |
| `GET` | `/auth/user/profile` | Get full user profile | Header: `Authorization` | `{user, profile, metadata}` |
| `PUT` | `/auth/user/profile` | Update user profile | Header: `Authorization`, Body: `{...}` | `{message, updated_fields}` |
| `POST` | `/auth/user/profile` | Save onboarding data | Header: `Authorization`, Body: `{...}` | `{message, onboarding_completed}` |

### Skill Assessment Endpoints (`/skills`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/skills/assess/start` | Start new assessment | `{user_id?}` | `{response, current_turn, session_id, ...}` |
| `POST` | `/skills/assess/conversation` | Send message in assessment | `{message, session_id?, user_id?}` | `{response, current_turn, is_complete, skill_profile?}` |
| `GET` | `/skills/assess/session/{session_id}` | Get session details | Query: `user_id` | `{session, messages, skill_profile}` |
| `DELETE` | `/skills/assess/session/{session_id}` | Delete session | Query: `user_id` | `{message}` |
| `GET` | `/skills/profile/{user_id}` | Get user skill profile | - | `{has_assessment, extracted_skills, ...}` |
| `POST` | `/skills/save` | Manually save skill profile | `{user_id, skill_profile}` | `{success, message}` |

### Agent Endpoints (`/agent`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/agent/ask` | Start agent job | `{query, user_id?, session_id?}` | `{job_id, status}` |
| `GET` | `/agent/status/{job_id}` | Get job status | - | `{status, steps, result, error?}` |

### Learning Path Endpoints (`/learning`)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/learning/learning-paths` | Create learning path | Header: `Authorization`, Body: `{career_title, scheduled_videos}` | `{success, data}` |
| `GET` | `/learning/learning-paths/current` | Get current active path | Header: `Authorization` | `{success, data}` |
| `GET` | `/learning/learning-paths` | Get all user paths | Header: `Authorization` | `{success, data: [...]}` |
| `PATCH` | `/learning/learning-paths/{path_id}/progress` | Update video progress | Header: `Authorization`, Body: `{videoId, date, completed, notes?}` | `{success, data, progress}` |
| `PATCH` | `/learning/learning-paths/{path_id}/status` | Update path status | Header: `Authorization`, Query: `status` | `{success, data}` |
| `DELETE` | `/learning/learning-paths/{path_id}` | Delete learning path | Header: `Authorization` | `{success, message}` |

### Health Check Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/health/supabase` | Check Supabase connection | `{status, message}` |

---

## Authentication Flow

### Email/Password Authentication

```
1. User enters email/password on LoginPage
   ↓
2. Frontend: api.post('/auth/login', {email, password})
   ↓
3. Backend: Verify user exists, check password (TODO: implement hashing)
   ↓
4. Backend: Generate JWT token with user_id and email
   ↓
5. Backend: Return {token, user} to frontend
   ↓
6. Frontend: Store token in localStorage, set user in AuthContext
   ↓
7. Frontend: Check onboarding_completed, redirect accordingly
```

### Google OAuth Authentication

```
1. User clicks "Sign in with Google"
   ↓
2. Frontend: api.get('/auth/google/login')
   ↓
3. Backend: Return Google OAuth URL
   ↓
4. Frontend: Redirect user to Google OAuth page
   ↓
5. User authorizes on Google
   ↓
6. Google redirects to: /auth/google/callback?code=...
   ↓
7. Backend: Exchange code for access token
   ↓
8. Backend: Get user info from Google API
   ↓
9. Backend: Find or create user in database
   ↓
10. Backend: Generate JWT token
    ↓
11. Backend: Redirect to frontend: /auth/callback?token=...&new_user=...
    ↓
12. Frontend: OAuthCallback page extracts token, stores it
    ↓
13. Frontend: Redirects to onboarding (if new_user) or dashboard
```

### JWT Token Structure

```json
{
  "user_id": "uuid-here",
  "email": "user@example.com",
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Token Expiration:** 7 days (10080 minutes)

---

## User Workflow

### 1. Registration/Login
- User visits landing page (`/`)
- Clicks "Sign Up" or "Log In"
- Authenticates via email/password or Google OAuth
- Receives JWT token stored in localStorage

### 2. Onboarding (New Users)
- New users redirected to `/onboarding`
- **Screen 1: Logistical Constraints**
  - Current zip code
  - Travel constraints
  - Budget constraints
  - Scheduling preferences
  - Weekly hours available
- **Screen 2: Motivation & Context**
  - Transition goal (quick/earnings/stable)
  - Target sector
  - Age (optional)
  - Veteran status (optional)
- Data saved to `users.metadata` and `user_profiles.career_goals`
- `onboarding_completed` flag set to `true`

### 3. Skill Assessment (Coal Miner-Specific)
- User navigates to `/assessment`
- **Two Assessment Options:**
  
  **Option A: Structured Questionnaire (Recommended for Coal Miners)**
  - Multi-step form with mining-specific questions:
    - Last mining job title (dropdown: Continuous Miner Operator, Roof Bolter, Longwall Miner, Shuttle Car Driver, etc.)
    - Years of mining experience
    - Mining type (underground, surface, both)
    - Equipment operation experience (checkboxes: continuous miner, shuttle car, scoop, etc.)
    - Maintenance experience (checkboxes: hydraulic systems, electrical, conveyor belts, pumps)
    - Safety training (MSHA, OSHA certifications)
    - Leadership experience (supervised team, team size)
    - Additional skills (welding, electrical work, blasting, CDL license)
  - Responses saved to `mining_questionnaire_responses` table
  - Skills automatically extracted and mapped to transferable skills
  - Profile updated in `user_profiles` with mining-specific fields
  
  **Option B: AI Conversational Assessment (Alternative)**
  - 4-Turn Conversational Assessment:
    - **Turn 1:** Professional Identity & Scope
    - **Turn 2:** Mechanical & Hydraulic Skills
    - **Turn 3:** Electrical & Diagnostics
    - **Turn 4:** Safety, Leadership, & Compliance
  - Each turn uses AI (Google Gemini) with mining-specific prompts
  - Conversation stored in `assessment_sessions.messages`
  
- Extracted skills saved to:
  - `assessment_sessions.extracted_skills` (detailed with O*NET codes)
  - `user_profiles.skills` (simple list)
  - `user_profiles.tools` (if applicable)
  - `user_profiles.previous_job_title`, `mining_role`, `mining_type`, `years_mining_experience`

### 4. Career Matching (Tailored for Coal Miners)
- User navigates to `/careers`
- System matches user mining skills to **curated target careers** from `target_careers` table
- **Target Careers Include:**
  - Wind Turbine Technician (renewable energy)
  - Solar Panel Installer (renewable energy)
  - Electrical Line Worker / Lineman (skilled trades)
  - Heavy Equipment Operator (construction)
  - Commercial Truck Driver (transportation)
  - Industrial Maintenance Technician (skilled trades)
  - Welder (skilled trades)
  - Safety Inspector / Compliance Officer (safety)
- Matching algorithm:
  - Maps mining skills to transferable skills for each target career
  - Calculates match score based on skill overlap
  - Identifies missing skills needed for transition
  - Considers user's location (zip code) for regional demand
- Displays career cards with:
  - Match score (percentage)
  - Transferable mining skills (highlighted)
  - Required skills
  - Missing skills (with learning path suggestions)
  - Salary range
  - National and regional growth rate
  - **Local demand rating** (high/medium/low for user's region)
  - **Commute distance** (if jobs available locally)
  - Required certifications/licenses
- Results saved to `career_matches` table with location context

### 5. Learning Path Creation (Enhanced with Local Resources)
- User selects a career match
- System generates comprehensive learning path including:
  - **Online Videos** (YouTube, tutorials) for foundational knowledge
  - **Local Training Programs** from `local_training_programs` table:
    - Community college courses
    - Trade school programs
    - Union training programs
    - Employer-sponsored programs
  - **Certification Steps** (OSHA, CDL, electrical licenses, etc.)
  - **Enrollment Deadlines** and start dates
- Path data structure (`learning_paths.path_data`) includes:
  ```json
  {
    "career_title": "Wind Turbine Technician",
    "scheduled_items": [
      {
        "date": "2024-01-15",
        "type": "video",
        "video": { "videoId": "...", "title": "Intro to Wind Energy" }
      },
      {
        "date": "2024-01-22",
        "type": "course",
        "course": {
          "program_id": "uuid",
          "program_name": "Wind Energy Technology Certification",
          "provider": "Mountain Community College",
          "location": {
            "address": "123 Main St",
            "city": "Charleston",
            "state": "WV",
            "distance_miles": 35.5,
            "drive_time_minutes": 45
          },
          "start_date": "2024-02-01",
          "enrollment_deadline": "2024-01-25",
          "cost": 2500.00,
          "contact_phone": "304-555-0123"
        }
      },
      {
        "date": "2024-02-01",
        "type": "certification",
        "certification": {
          "name": "OSHA 10-Hour Safety",
          "provider": "OSHA Outreach",
          "online": true,
          "cost": 0
        }
      }
    ]
  }
  ```
- Path saved to `learning_paths` table with:
  - Career title
  - Scheduled items (videos, courses, certifications)
  - Location context (distances, commute times)
  - Initial progress (0%)
  - Status: "active"

### 6. Learning Progress (Enhanced Tracking)
- User navigates to `/learning`
- Views week-by-week timeline of scheduled items:
  - Videos (with completion checkboxes)
  - Courses (with enrollment status, location map, contact info)
  - Certifications (with study resources, exam dates)
- **Location Features:**
  - Google Maps integration showing training locations
  - Distance and drive time from user's zip code
  - Directions to in-person training sites
- Marks items as completed
- Tracks certifications in `user_certifications` table
- Progress updates:
  - `learning_paths.progress_percentage` recalculated
  - `learning_paths.path_data.scheduled_items[].completed` updated
  - `learning_progress` table records detailed progress
  - Certification records created/updated

### 7. Dashboard
- User navigates to `/dashboard`
- Displays:
  - User profile summary
  - Recent skill assessment status
  - Active learning path progress
  - Quick actions

---

## Data Flow

### Skill Assessment Data Flow

```
User Input (Chat Message)
    ↓
Frontend: SkillAssessment.tsx
    ↓
POST /skills/assess/conversation
    ↓
Backend: skills.py → assess_conversation()
    ↓
Session Manager: Get/create session
    ↓
Assessment Service: Process with AI (Gemini)
    ↓
Extract Skills → O*NET Normalization
    ↓
When Complete:
    ├─→ Save to assessment_sessions table
    ├─→ Transform and save to user_profiles table
    └─→ Return skill_profile to frontend
    ↓
Frontend: Display extracted skills
```

### Learning Path Data Flow

```
User Selects Career Match
    ↓
Frontend: CareerMatch.tsx
    ↓
POST /learning/learning-paths
    Body: {career_title, scheduled_videos: [...]}
    ↓
Backend: learning.py → create_learning_path()
    ↓
Extract user_id from JWT token
    ↓
Calculate initial progress percentage
    ↓
Insert into learning_paths table
    ├─→ user_id
    ├─→ career_id (if valid UUID)
    ├─→ path_data (JSONB with videos)
    ├─→ status: "active"
    └─→ progress_percentage
    ↓
Return path data to frontend
    ↓
Frontend: LearningPath.tsx displays timeline
```

### Progress Update Data Flow

```
User Marks Video as Completed
    ↓
Frontend: LearningPath.tsx
    ↓
PATCH /learning/learning-paths/{path_id}/progress
    Body: {videoId, date, completed: true}
    ↓
Backend: learning.py → update_video_progress()
    ↓
Fetch current learning_path from database
    ↓
Update path_data.scheduled_videos[].completed
    ↓
Recalculate progress_percentage
    ↓
Update learning_paths table
    ↓
Insert record into learning_progress table
    ↓
Return updated path data
    ↓
Frontend: Update UI to show completed video
```

---

## Key Components

### Backend Services

#### 1. Conversational Assessment Service
**File:** `backend/app/services/conversational_assessment.py`
- Manages 4-turn conversation flow
- Integrates with Google Gemini AI
- Extracts and normalizes skills using O*NET taxonomies
- Returns structured skill profiles

#### 2. Session Manager
**File:** `backend/app/services/session_manager.py`
- In-memory session storage for assessment conversations
- Tracks current turn, messages, and skill profiles
- Session cleanup and management

#### 3. Supabase Client
**File:** `backend/app/core/supabase.py`
- Singleton Supabase client instance
- Uses service role key for database access
- Cached with `@lru_cache` decorator

### Frontend Components

#### 1. AuthContext
**File:** `frontend/src/context/AuthContext.tsx`
- Manages authentication state
- Provides `login`, `signup`, `logout`, `googleLogin` functions
- Stores JWT token in localStorage
- Tracks onboarding completion status

#### 2. API Service
**File:** `frontend/src/services/api.ts`
- Axios instance with base URL configuration
- Request interceptor: Adds JWT token to headers
- Response interceptor: Handles 401 errors (logout)

#### 3. Page Components
- **OnboardingPage:** Multi-step form for user constraints and goals
- **SkillAssessment:** Chat interface for conversational assessment
- **CareerMatch:** Displays matched careers with gap analysis
- **LearningPath:** Timeline visualization of scheduled videos
- **Dashboard:** User overview and quick actions

---

## Environment Variables

### Backend (.env)
```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# JWT
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=10080

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Google Gemini AI
GOOGLE_GENAI_USE_VERTEXAI=False
GOOGLE_API_KEY=your_api_key
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_CLOUD_LOCATION=us-central1

# YouTube API (optional)
YOUTUBE_API_KEY=your_youtube_key

# CareerOneStop API (optional)
CAREERONESTOP_API_KEY=your_key

# Credential Engine API (optional)
CREDENTIAL_ENGINE_API_KEY=your_key
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## Database Relationships

```
users (1) ──< (1) user_profiles
  │
  ├──< (many) career_matches
  │
  ├──< (many) learning_paths
  │      │
  │      └──< (many) learning_progress
  │
  └──< (many) assessment_sessions

career_matches (1) ──< (many) learning_paths
```

**Cascade Deletes:**
- Deleting a user deletes all related records (profiles, matches, paths, sessions)
- Deleting a career_match deletes related learning_paths
- Deleting a learning_path deletes related learning_progress records

---

## Important Notes

1. **Password Hashing:** Currently not implemented. The `password_hash` column exists but passwords are not hashed. This should be implemented using `bcrypt` or similar.

2. **Onboarding Column Fallback:** The code includes fallback logic to store `onboarding_completed` in `metadata` JSONB if the column doesn't exist in the database schema.

3. **Session Management:** Assessment sessions are stored in-memory. For production, consider using Redis or database-backed sessions.

4. **Error Handling:** Most endpoints include try-catch blocks and return appropriate HTTP status codes.

5. **CORS:** Backend is configured to allow requests from frontend development server (port 5173).

---

## Development Workflow

1. **Start Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Database Setup:**
   - Run `backend/database_setup.sql` in Supabase SQL Editor
   - Configure environment variables in `.env` files

4. **Testing:**
   - Backend: `pytest` (if tests are added)
   - Frontend: `npm run lint` and `npm run build`

---

## Coal Miner-Specific Features

### 1. Questionnaire-Based Skill Assessment

**Purpose:** Replace generic AI chat with structured questions tailored to mining experience.

**Implementation Approach:**
- Create new frontend component: `MiningQuestionnaire.tsx`
- Multi-step form with mining-specific questions
- Backend endpoint: `POST /skills/assess/questionnaire`
- Store responses in `mining_questionnaire_responses` table
- Map responses to transferable skills automatically
- Optionally use AI to summarize and infer additional skills after questionnaire

**Questionnaire Structure:**
1. **Basic Mining Background:**
   - Last mining job title (dropdown)
   - Years of experience
   - Mining type (underground/surface/both)

2. **Equipment & Machinery:**
   - Operated heavy machinery? (Yes/No)
   - Types: continuous miner, shuttle car, scoop, longwall equipment, etc.

3. **Maintenance & Repair:**
   - Performed maintenance? (Yes/No)
   - Types: hydraulic systems, electrical systems, conveyor belts, pumps, etc.

4. **Safety & Leadership:**
   - Safety training completed? (MSHA, OSHA, etc.)
   - Supervised team? (Yes/No, team size)

5. **Additional Skills:**
   - Welding experience
   - Electrical work
   - Blasting experience
   - CDL license

**Benefits:**
- Faster than conversational assessment
- Ensures critical mining skills are captured
- Reduces AI misinterpretation of mining jargon
- More reliable skill extraction

### 2. Tailored Career Matching

**Purpose:** Match miners to realistic transition careers with regional context.

**Implementation:**
- Pre-populate `target_careers` table with 8 curated careers
- Matching algorithm maps mining skills to transferable skills
- Calculate commute distances using Google Maps Distance Matrix API
- Filter by user's state/region for local demand
- Display regional growth information

**Target Careers:**
1. **Wind Turbine Technician** - High demand in Appalachia, leverages mechanical/electrical skills
2. **Solar Panel Installer** - Growing field, uses electrical and construction skills
3. **Electrical Line Worker** - Strong demand, safety training transfers well
4. **Heavy Equipment Operator** - Direct skill transfer from mining equipment
5. **Commercial Truck Driver** - Many miners already have CDL
6. **Industrial Maintenance Technician** - Maintenance skills highly transferable
7. **Welder** - Common mining skill, in demand
8. **Safety Inspector** - MSHA/OSHA training valuable

**Matching Logic:**
```python
# Pseudo-code for matching
for career in target_careers:
    transferable_skills = career.transferable_mining_skills
    user_skills = user_profile.skills
    
    overlap = calculate_skill_overlap(user_skills, transferable_skills)
    match_score = (overlap / len(career.required_skills)) * 100
    
    missing_skills = career.required_skills - user_skills
    
    # Add location context
    commute_distance = calculate_distance(user.zip_code, career.local_jobs)
    local_demand = get_regional_demand(career, user.state)
```

### 3. Enhanced Learning Paths with Local Resources

**Purpose:** Include local training programs, certifications, and practical resources.

**Implementation:**
- Pre-populate `local_training_programs` table with Appalachian programs
- Integrate Google Maps for location display
- Calculate distances using user's zip code
- Include enrollment deadlines and start dates
- Show cost, duration, and financial aid availability

**Resource Types in Learning Path:**
1. **Videos** - Online tutorials (YouTube, etc.) for foundational knowledge
2. **Courses** - Local community college or trade school programs
3. **Certifications** - Required licenses (CDL, OSHA, electrical, etc.)
4. **Programs** - Apprenticeships or employer-sponsored training

**Example Learning Path Structure:**
```
Week 1: Watch "Introduction to Wind Energy" video
Week 2: Enroll in Wind Energy Technology Certification at Mountain Community College
        (35 miles away, starts Feb 1, deadline Jan 25, $2,500, financial aid available)
Week 3-14: Attend classes + watch supplementary videos
Week 15: Complete OSHA 10-Hour Safety certification (online, free)
Week 16: Take certification exam
```

### 4. Location and Commute Context

**Purpose:** Make opportunities feel tangible and practical for users tied to their local area.

**Implementation:**
- Capture user zip code during onboarding (already in `users.metadata`)
- Use Google Maps Distance Matrix API to calculate:
  - Distance from user's zip to training program location
  - Estimated drive time
- Display on learning path page:
  - Map showing user location and training locations
  - Distance and drive time for each in-person resource
  - Filter by maximum commute distance (user preference)

**Google Maps Integration:**
- **Distance Matrix API:** Calculate distances and travel times
- **Embedded Maps:** Show locations visually
- **Geocoding:** Convert addresses to coordinates for distance calculations

**Cost Considerations:**
- Google Maps API has free tier (first $200/month free)
- For MVP, can pre-calculate distances for known programs
- Cache results to minimize API calls

### 5. SMS Reminder Recommendations

**Purpose:** Reach users with limited internet access and improve engagement.

**Implementation Strategy (Future):**

**Option 1: Twilio Integration (Recommended)**
```python
# Backend service: backend/app/services/sms_service.py
from twilio.rest import Client

def send_reminder(user_phone: str, message: str):
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    client.messages.create(
        body=message,
        from_=settings.twilio_phone_number,
        to=user_phone
    )
```

**Option 2: Supabase Edge Functions**
- Use Supabase Edge Functions with Twilio
- Trigger on scheduled dates from `sms_reminders` table
- Lower cost, serverless approach

**Reminder Types:**
1. **Learning Task Reminders:** "Your scheduled lesson on 'Intro to HVAC' is today. Good luck!"
2. **Enrollment Deadlines:** "Don't forget to sign up for the lineman training by Friday!"
3. **Certification Due:** "Your OSHA 10-Hour certification exam is scheduled for next week."
4. **General Check-ins:** "How's your learning path going? Need help?"

**Scheduling:**
- Create scheduled tasks (cron job or Supabase cron) that:
  - Query `sms_reminders` table for reminders due today
  - Send SMS to users who opted in (`users.sms_opt_in = TRUE`)
  - Update `sms_reminders.sent = TRUE` and `sent_at` timestamp

**Privacy & Opt-in:**
- Add phone number field to onboarding
- Add SMS opt-in checkbox
- Store in `users.phone_number` and `users.sms_opt_in`
- Allow users to opt out in profile settings

**Cost Estimate:**
- Twilio: ~$0.0075 per SMS in US
- For 100 users, 2 reminders/week: ~$15/month
- Free tier available for testing

**MVP Approach (Simplified):**
- For initial implementation, create the `sms_reminders` table
- Build the scheduling logic but log to console instead of sending
- Show reminder previews in UI
- Full SMS integration can be added later

---

## Implementation Priority

### Phase 1: Core Functionality (Immediate)
1. ✅ Database schema updates (migration script created)
2. ⚠️ Questionnaire-based assessment frontend/backend
3. ⚠️ Pre-populate `target_careers` table
4. ⚠️ Update career matching algorithm for mining skills
5. ⚠️ Enhanced learning path structure (support courses/certifications)

### Phase 2: Location Features (High Priority)
1. ⚠️ Google Maps integration for distance calculation
2. ⚠️ Display commute distances in career matches
3. ⚠️ Show training locations on learning path
4. ⚠️ Pre-populate `local_training_programs` with example data

### Phase 3: Enhanced Features (Medium Priority)
1. ⚠️ Certification tracking (`user_certifications` table)
2. ⚠️ Mobile-responsive design improvements
3. ⚠️ SMS reminder infrastructure (table + scheduling logic)
4. ⚠️ SMS opt-in during onboarding

### Phase 4: SMS Integration (Future)
1. ⚠️ Twilio integration
2. ⚠️ Automated reminder sending
3. ⚠️ Reminder management UI

---

## Database Migration Checklist

Before running the migration, ensure:
- [ ] Base schema (`database_setup.sql`) is already applied
- [ ] Backup your database
- [ ] Run `database_setup_coal_miners.sql` in Supabase SQL Editor
- [ ] Verify new columns were added to existing tables
- [ ] Verify new tables were created
- [ ] Check that sample `target_careers` data was inserted
- [ ] Test queries on new tables

**Migration Order:**
1. Run `backend/database_setup.sql` (if not already done)
2. Run `backend/database_setup_coal_miners.sql`
3. Verify with: `SELECT * FROM target_careers;` (should show 8 careers)

---

## Concerns and Recommendations

### 1. Scope Management
**Concern:** The list of features is extensive for a one-month timeline.

**Recommendation:**
- **Prioritize Phase 1** (core functionality) first
- **Phase 2** (location features) can use mock/static data initially
- **Phase 3-4** can be prototypes or mockups for demonstration
- Focus on making the questionnaire and career matching work well

### 2. Local Training Program Data
**Concern:** Finding and verifying real training programs takes time.

**Recommendation:**
- Start with **3-5 example programs** per target career
- Use realistic but placeholder data (e.g., "Mountain Community College" - verify later)
- Focus on structure and UI first, data accuracy can improve later
- Consider partnering with state workforce agencies for real data

### 3. Google Maps API Costs
**Concern:** API usage could incur costs.

**Recommendation:**
- Use free tier ($200/month credit)
- Cache distance calculations (don't recalculate every request)
- For MVP, pre-calculate distances for known programs
- Monitor usage and set budget alerts

### 4. Mobile-First Design
**Concern:** Many users have limited home internet.

**Recommendation:**
- Ensure responsive design works on mobile (test on actual devices)
- Optimize images and reduce page load times
- Consider Progressive Web App (PWA) for offline access (future)
- Large text, simple navigation, touch-friendly buttons

### 5. SMS Implementation Complexity
**Concern:** Full SMS integration requires external service and scheduling.

**Recommendation:**
- **For MVP:** Build the infrastructure (table, UI, scheduling logic) but log instead of sending
- Show reminder previews in the UI
- Document the integration path for future implementation
- This demonstrates the feature without full integration complexity

---

This documentation provides a comprehensive overview of the SkillBridge project structure, database schema, API endpoints, and data flows, **specifically adapted for Appalachian coal miners**. For specific implementation details, refer to the source code files mentioned in each section.

