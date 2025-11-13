-- SkillBridge Database Schema - Coal Miner Focused
-- Run this migration script in Supabase SQL Editor to add coal miner-specific features
-- This extends the existing schema with new fields and tables

-- ============================================================================
-- 1. ADD MINING-SPECIFIC FIELDS TO EXISTING TABLES
-- ============================================================================

-- Add phone number to users table (for SMS reminders)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT FALSE;

-- Add mining background fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS previous_job_title VARCHAR(255), -- e.g., "Continuous Miner Operator", "Roof Bolter"
ADD COLUMN IF NOT EXISTS mining_role VARCHAR(100), -- e.g., "Operator", "Maintenance", "Supervisor"
ADD COLUMN IF NOT EXISTS mining_type VARCHAR(50), -- "underground" or "surface"
ADD COLUMN IF NOT EXISTS years_mining_experience INTEGER,
ADD COLUMN IF NOT EXISTS mining_questionnaire_responses JSONB DEFAULT '{}'::jsonb; -- Store structured questionnaire answers

-- Add location context to career_matches
ALTER TABLE career_matches
ADD COLUMN IF NOT EXISTS local_demand_rating VARCHAR(50), -- "high", "medium", "low" for user's region
ADD COLUMN IF NOT EXISTS commute_distance_miles DECIMAL(6,2), -- Distance from user's zip code
ADD COLUMN IF NOT EXISTS commute_time_minutes INTEGER,
ADD COLUMN IF NOT EXISTS local_job_growth TEXT; -- Regional growth information

-- Enhance learning_resources table for local programs
ALTER TABLE learning_resources
ADD COLUMN IF NOT EXISTS resource_category VARCHAR(100), -- "video", "course", "certification", "program"
ADD COLUMN IF NOT EXISTS provider_name VARCHAR(255), -- e.g., "Mountain Community College"
ADD COLUMN IF NOT EXISTS provider_address TEXT,
ADD COLUMN IF NOT EXISTS provider_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS provider_state VARCHAR(50),
ADD COLUMN IF NOT EXISTS provider_zip VARCHAR(20),
ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2), -- Cost in USD
ADD COLUMN IF NOT EXISTS duration_weeks INTEGER,
ADD COLUMN IF NOT EXISTS duration_hours INTEGER,
ADD COLUMN IF NOT EXISTS start_date DATE, -- Next available start date
ADD COLUMN IF NOT EXISTS enrollment_deadline DATE,
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS online_only BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS in_person BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hybrid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS certification_awarded VARCHAR(255), -- e.g., "OSHA 30-Hour", "CDL License"
ADD COLUMN IF NOT EXISTS prerequisites TEXT, -- Required prerequisites
ADD COLUMN IF NOT EXISTS target_careers JSONB DEFAULT '[]'::jsonb; -- Which careers this resource supports

-- Add location fields to learning_paths path_data structure
-- (This is stored in JSONB, so no schema change needed, but document the new structure)

-- ============================================================================
-- 2. NEW TABLE: MINING_QUESTIONNAIRE_RESPONSES
-- ============================================================================
-- Stores structured questionnaire responses for mining-specific assessment

CREATE TABLE IF NOT EXISTS mining_questionnaire_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    
    -- Basic mining background
    last_mining_job_title VARCHAR(255), -- e.g., "Continuous Miner Operator"
    years_experience INTEGER,
    mining_type VARCHAR(50), -- "underground", "surface", "both"
    
    -- Equipment and machinery experience
    operated_heavy_machinery BOOLEAN DEFAULT FALSE,
    machinery_types JSONB DEFAULT '[]'::jsonb, -- ["continuous miner", "shuttle car", "scoop", etc.]
    
    -- Maintenance and repair experience
    performed_maintenance BOOLEAN DEFAULT FALSE,
    maintenance_types JSONB DEFAULT '[]'::jsonb, -- ["hydraulic systems", "electrical", "conveyor belts", etc.]
    
    -- Safety and leadership
    safety_training_completed BOOLEAN DEFAULT FALSE,
    safety_certifications JSONB DEFAULT '[]'::jsonb, -- ["MSHA", "OSHA", etc.]
    supervised_team BOOLEAN DEFAULT FALSE,
    team_size INTEGER,
    
    -- Additional skills
    welding_experience BOOLEAN DEFAULT FALSE,
    electrical_work BOOLEAN DEFAULT FALSE,
    blasting_experience BOOLEAN DEFAULT FALSE,
    cdl_license BOOLEAN DEFAULT FALSE,
    
    -- Responses stored as structured JSON
    questionnaire_data JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mining_questionnaire_user_id ON mining_questionnaire_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_mining_questionnaire_session_id ON mining_questionnaire_responses(session_id);

-- ============================================================================
-- 3. NEW TABLE: TARGET_CAREERS
-- ============================================================================
-- Curated list of target careers for coal miner transitions

CREATE TABLE IF NOT EXISTS target_careers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    career_title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100), -- "renewable_energy", "skilled_trades", "transportation", "safety", "construction"
    
    -- Skill requirements (mapped from mining skills)
    required_skills JSONB DEFAULT '[]'::jsonb,
    transferable_mining_skills JSONB DEFAULT '[]'::jsonb, -- Which mining skills transfer well
    
    -- Market data
    national_growth_rate VARCHAR(50), -- e.g., "Much faster than average"
    median_salary_range VARCHAR(100), -- e.g., "$45,000 - $65,000"
    entry_level_education VARCHAR(100), -- e.g., "High school diploma or equivalent"
    
    -- Regional data (for Appalachian focus)
    appalachian_demand_rating VARCHAR(50), -- "high", "medium", "low"
    appalachian_states JSONB DEFAULT '[]'::jsonb, -- ["WV", "KY", "PA", etc.]
    
    -- Certification/licensing requirements
    required_certifications JSONB DEFAULT '[]'::jsonb, -- ["CDL", "OSHA 30", "Electrical License", etc.]
    certification_notes TEXT,
    
    -- Learning resources that support this career
    recommended_resources JSONB DEFAULT '[]'::jsonb, -- Array of resource IDs
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_target_careers_category ON target_careers(category);
CREATE INDEX IF NOT EXISTS idx_target_careers_appalachian_demand ON target_careers(appalachian_demand_rating);

-- ============================================================================
-- 4. NEW TABLE: LOCAL_TRAINING_PROGRAMS
-- ============================================================================
-- Pre-populated list of local training programs in Appalachian region

CREATE TABLE IF NOT EXISTS local_training_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_name VARCHAR(255) NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(100), -- "community_college", "trade_school", "union_training", "employer_program"
    
    -- Location
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    latitude DECIMAL(10, 8), -- For distance calculations
    longitude DECIMAL(11, 8),
    
    -- Program details
    description TEXT,
    program_type VARCHAR(100), -- "certification", "degree", "apprenticeship", "short_course"
    duration_weeks INTEGER,
    duration_hours INTEGER,
    cost DECIMAL(10,2),
    financial_aid_available BOOLEAN DEFAULT FALSE,
    
    -- Scheduling
    start_dates JSONB DEFAULT '[]'::jsonb, -- Array of upcoming start dates
    enrollment_deadline DATE,
    schedule_type VARCHAR(50), -- "full_time", "part_time", "evening", "weekend", "flexible"
    
    -- Contact
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    website_url TEXT,
    
    -- Target careers this program supports
    target_careers JSONB DEFAULT '[]'::jsonb, -- Array of career IDs or titles
    
    -- Certifications awarded
    certifications_awarded JSONB DEFAULT '[]'::jsonb,
    
    -- Prerequisites
    prerequisites TEXT,
    minimum_education VARCHAR(100),
    
    -- Delivery method
    online_only BOOLEAN DEFAULT FALSE,
    in_person BOOLEAN DEFAULT FALSE,
    hybrid BOOLEAN DEFAULT FALSE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE, -- Whether program details have been verified
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_local_training_state ON local_training_programs(state);
CREATE INDEX IF NOT EXISTS idx_local_training_zip ON local_training_programs(zip_code);
CREATE INDEX IF NOT EXISTS idx_local_training_active ON local_training_programs(active);

-- ============================================================================
-- 5. NEW TABLE: USER_CERTIFICATIONS
-- ============================================================================
-- Track user certifications and licenses

CREATE TABLE IF NOT EXISTS user_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    issuing_organization VARCHAR(255),
    certification_type VARCHAR(100), -- "license", "certificate", "credential"
    issue_date DATE,
    expiration_date DATE,
    certification_number VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active', -- "active", "expired", "pending", "in_progress"
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_certifications_user_id ON user_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_certifications_status ON user_certifications(status);

-- ============================================================================
-- 6. NEW TABLE: SMS_REMINDERS (for future SMS implementation)
-- ============================================================================
-- Track SMS reminders sent to users

CREATE TABLE IF NOT EXISTS sms_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    learning_path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50), -- "learning_task", "enrollment_deadline", "certification_due", "general"
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    message_text TEXT NOT NULL,
    sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    phone_number VARCHAR(20), -- Snapshot at time of creation
    status VARCHAR(50) DEFAULT 'pending', -- "pending", "sent", "failed", "cancelled"
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_reminders_user_id ON sms_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_reminders_scheduled_date ON sms_reminders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sms_reminders_status ON sms_reminders(status);

-- ============================================================================
-- 7. UPDATE TRIGGERS FOR NEW TABLES
-- ============================================================================

CREATE TRIGGER update_mining_questionnaire_updated_at BEFORE UPDATE ON mining_questionnaire_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_target_careers_updated_at BEFORE UPDATE ON target_careers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_local_training_programs_updated_at BEFORE UPDATE ON local_training_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_certifications_updated_at BEFORE UPDATE ON user_certifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. SAMPLE DATA FOR TARGET CAREERS
-- ============================================================================
-- Insert curated target careers for coal miner transitions

INSERT INTO target_careers (career_title, description, category, required_skills, transferable_mining_skills, national_growth_rate, median_salary_range, entry_level_education, appalachian_demand_rating, appalachian_states, required_certifications) VALUES
('Wind Turbine Technician', 'Install, maintain, and repair wind turbines. Work at heights and in various weather conditions.', 'renewable_energy', 
 '["Electrical troubleshooting", "Mechanical repair", "Safety protocols", "Equipment operation", "Hydraulic systems"]'::jsonb,
 '["Heavy machinery operation", "Electrical maintenance", "Safety training", "Equipment troubleshooting"]'::jsonb,
 'Much faster than average (68% growth)', '$45,000 - $70,000', 'Postsecondary nondegree award',
 'high', '["WV", "KY", "PA", "OH"]'::jsonb, '["OSHA 10", "Climbing certification", "Electrical safety"]'::jsonb),

('Solar Panel Installer', 'Install and maintain solar panel systems on residential and commercial buildings.', 'renewable_energy',
 '["Electrical installation", "Roofing safety", "Basic construction", "Tool operation"]'::jsonb,
 '["Electrical work", "Safety training", "Tool proficiency", "Physical work"]'::jsonb,
 'Much faster than average (52% growth)', '$40,000 - $60,000', 'High school diploma or equivalent',
 'high', '["WV", "KY", "PA", "OH", "VA"]'::jsonb, '["OSHA 10", "Electrical safety certification"]'::jsonb),

('Electrical Line Worker (Lineman)', 'Install and maintain electrical power lines and systems.', 'skilled_trades',
 '["Electrical systems", "Safety protocols", "Heavy equipment operation", "Climbing", "Emergency response"]'::jsonb,
 '["Electrical knowledge", "Safety training", "Heavy equipment operation", "Working in hazardous conditions"]'::jsonb,
 'As fast as average (6% growth)', '$50,000 - $85,000', 'High school diploma or equivalent',
 'high', '["WV", "KY", "PA", "OH", "VA", "TN"]'::jsonb, '["CDL", "Lineman certification", "OSHA 10"]'::jsonb),

('Heavy Equipment Operator', 'Operate heavy machinery in construction, mining, or infrastructure projects.', 'construction',
 '["Equipment operation", "Safety protocols", "Basic maintenance", "Site coordination"]'::jsonb,
 '["Heavy machinery operation", "Safety training", "Equipment familiarity", "Site awareness"]'::jsonb,
 'As fast as average (5% growth)', '$40,000 - $65,000', 'High school diploma or equivalent',
 'medium', '["WV", "KY", "PA", "OH", "VA"]'::jsonb, '["CDL", "Equipment certification"]'::jsonb),

('Commercial Truck Driver', 'Transport goods over long distances using commercial vehicles.', 'transportation',
 '["Driving", "Safety protocols", "Vehicle maintenance", "Logistics", "Time management"]'::jsonb,
 '["CDL (if already have)", "Safety awareness", "Equipment operation", "Long hours experience"]'::jsonb,
 'As fast as average (4% growth)', '$45,000 - $75,000', 'High school diploma or equivalent',
 'high', '["WV", "KY", "PA", "OH", "VA", "TN"]'::jsonb, '["CDL Class A or B"]'::jsonb),

('Industrial Maintenance Technician', 'Maintain and repair industrial machinery and equipment.', 'skilled_trades',
 '["Mechanical repair", "Electrical troubleshooting", "Hydraulic systems", "Preventive maintenance", "Diagnostics"]'::jsonb,
 '["Equipment maintenance", "Hydraulic systems", "Electrical work", "Troubleshooting", "Mechanical aptitude"]'::jsonb,
 'As fast as average (5% growth)', '$45,000 - $70,000', 'Postsecondary nondegree award or associate degree',
 'medium', '["WV", "KY", "PA", "OH", "VA"]'::jsonb, '["OSHA 10", "Electrical certification (varies)"]'::jsonb),

('Welder', 'Join metal parts using various welding techniques for construction, manufacturing, or repair.', 'skilled_trades',
 '["Welding techniques", "Blueprint reading", "Safety protocols", "Metal fabrication"]'::jsonb,
 '["Welding experience (if applicable)", "Safety training", "Physical work", "Tool proficiency"]'::jsonb,
 'As fast as average (3% growth)', '$35,000 - $60,000', 'High school diploma or equivalent',
 'medium', '["WV", "KY", "PA", "OH", "VA"]'::jsonb, '["Welding certification", "OSHA 10"]'::jsonb),

('Safety Inspector / Compliance Officer', 'Inspect workplaces and ensure compliance with safety regulations.', 'safety',
 '["Safety regulations", "Inspection procedures", "Documentation", "Communication", "Problem identification"]'::jsonb,
 '["MSHA/OSHA training", "Safety awareness", "Hazard identification", "Regulatory knowledge"]'::jsonb,
 'As fast as average (4% growth)', '$50,000 - $80,000', 'Bachelor''s degree (some positions require)',
 'medium', '["WV", "KY", "PA", "OH", "VA"]'::jsonb, '["OSHA 30", "Safety certification", "Inspector certification"]'::jsonb)

ON CONFLICT (career_title) DO NOTHING;

-- ============================================================================
-- 9. NOTES ON LEARNING_PATHS.PATH_DATA STRUCTURE
-- ============================================================================
-- The path_data JSONB field now supports enhanced structure:
/*
{
  "career_title": "Wind Turbine Technician",
  "scheduled_items": [
    {
      "date": "2024-01-15",
      "type": "video", // or "course", "certification", "enrollment"
      "video": { ... }, // Only if type is "video"
      "course": { // Only if type is "course"
        "program_id": "uuid",
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
        "contact_phone": "304-555-0123"
      },
      "certification": { // Only if type is "certification"
        "name": "OSHA 10-Hour Safety",
        "provider": "OSHA Outreach",
        "online": true,
        "cost": 0,
        "url": "https://..."
      },
      "completed": false,
      "completed_at": null,
      "notes": null
    }
  ]
}
*/

