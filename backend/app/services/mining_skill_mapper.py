"""
Mining Skill Mapping Service

Maps mining-specific skills and experiences to transferable skills for target careers.
"""
from typing import Dict, List, Any, Set
import logging

logger = logging.getLogger(__name__)

# Mapping of mining job titles to skill categories
MINING_JOB_SKILL_MAP = {
    "Continuous Miner Operator": {
        "equipment_operation": ["Heavy machinery operation", "Equipment control systems"],
        "mechanical": ["Hydraulic systems", "Mechanical troubleshooting"],
        "safety": ["Underground safety protocols", "Hazard awareness"]
    },
    "Roof Bolter": {
        "mechanical": ["Drilling operations", "Equipment installation"],
        "safety": ["Roof support systems", "Safety inspections"],
        "physical": ["Physical stamina", "Working in confined spaces"]
    },
    "Longwall Miner": {
        "equipment_operation": ["Complex machinery operation", "Automated systems"],
        "mechanical": ["Conveyor systems", "Hydraulic maintenance"],
        "safety": ["Underground safety", "Emergency procedures"]
    },
    "Shuttle Car Driver": {
        "equipment_operation": ["Vehicle operation", "Material transport"],
        "mechanical": ["Basic vehicle maintenance", "Equipment troubleshooting"],
        "safety": ["Transport safety", "Traffic management"]
    },
    "Maintenance Technician": {
        "mechanical": ["Hydraulic systems", "Electrical systems", "Conveyor belts", "Pumps"],
        "electrical": ["Electrical troubleshooting", "Motor repair", "Control systems"],
        "safety": ["Lockout/tagout procedures", "Safety compliance"]
    },
    "Electrician": {
        "electrical": ["Electrical systems", "Motor control", "Troubleshooting", "Wiring"],
        "safety": ["Electrical safety", "MSHA compliance", "Lockout procedures"]
    },
    "Supervisor": {
        "leadership": ["Team management", "Safety oversight", "Training"],
        "safety": ["Safety compliance", "Incident investigation", "Regulatory compliance"],
        "communication": ["Communication", "Documentation", "Reporting"]
    }
}

# Mapping of mining equipment to transferable skills
EQUIPMENT_SKILL_MAP = {
    "continuous miner": ["Heavy machinery operation", "Automated systems", "Hydraulic systems"],
    "shuttle car": ["Vehicle operation", "Material handling", "Transport logistics"],
    "scoop": ["Heavy equipment operation", "Material handling"],
    "longwall equipment": ["Complex machinery", "Automated systems", "Process control"],
    "conveyor belt": ["Material handling systems", "Mechanical systems", "Maintenance"],
    "roof bolter": ["Drilling operations", "Equipment installation", "Safety systems"]
}

# Mapping of maintenance types to transferable skills
MAINTENANCE_SKILL_MAP = {
    "hydraulic systems": ["Hydraulic repair", "Fluid systems", "Mechanical troubleshooting"],
    "electrical systems": ["Electrical troubleshooting", "Motor repair", "Control systems"],
    "conveyor belts": ["Material handling systems", "Mechanical maintenance", "Belt systems"],
    "pumps": ["Pump systems", "Fluid mechanics", "Mechanical repair"]
}

# Transferable skills extraction based on questionnaire responses
def extract_transferable_skills(questionnaire_data: Dict[str, Any]) -> List[str]:
    """
    Extract transferable skills from mining questionnaire responses.
    
    Args:
        questionnaire_data: Dictionary containing questionnaire responses
        
    Returns:
        List of transferable skill names
    """
    skills = set()
    
    # Extract from job title
    job_title = questionnaire_data.get("last_mining_job_title", "")
    if job_title in MINING_JOB_SKILL_MAP:
        for category, skill_list in MINING_JOB_SKILL_MAP[job_title].items():
            skills.update(skill_list)
    
    # Extract from equipment operation
    if questionnaire_data.get("operated_heavy_machinery", False):
        machinery_types = questionnaire_data.get("machinery_types", [])
        for machinery in machinery_types:
            machinery_lower = machinery.lower()
            for equipment, skill_list in EQUIPMENT_SKILL_MAP.items():
                if equipment in machinery_lower:
                    skills.update(skill_list)
        # General equipment operation skill
        skills.add("Heavy machinery operation")
        skills.add("Equipment troubleshooting")
    
    # Extract from maintenance experience
    if questionnaire_data.get("performed_maintenance", False):
        maintenance_types = questionnaire_data.get("maintenance_types", [])
        for maint_type in maintenance_types:
            maint_lower = maint_type.lower()
            for maint_key, skill_list in MAINTENANCE_SKILL_MAP.items():
                if maint_key in maint_lower:
                    skills.update(skill_list)
        # General maintenance skills
        skills.add("Preventive maintenance")
        skills.add("Equipment repair")
        skills.add("Troubleshooting")
    
    # Extract from safety training
    if questionnaire_data.get("safety_training_completed", False):
        skills.add("Safety protocols")
        skills.add("Hazard identification")
        skills.add("Safety compliance")
        safety_certs = questionnaire_data.get("safety_certifications", [])
        if "MSHA" in str(safety_certs):
            skills.add("MSHA compliance")
            skills.add("Mine safety")
        if "OSHA" in str(safety_certs):
            skills.add("OSHA compliance")
            skills.add("Workplace safety")
    
    # Extract from leadership
    if questionnaire_data.get("supervised_team", False):
        skills.add("Team leadership")
        skills.add("Supervision")
        skills.add("Training")
        skills.add("Communication")
    
    # Extract from additional skills
    if questionnaire_data.get("welding_experience", False):
        skills.add("Welding")
        skills.add("Metal fabrication")
    
    if questionnaire_data.get("electrical_work", False):
        skills.add("Electrical work")
        skills.add("Electrical troubleshooting")
        skills.add("Wiring")
    
    if questionnaire_data.get("blasting_experience", False):
        skills.add("Explosives handling")
        skills.add("Safety protocols")
        skills.add("Regulatory compliance")
    
    if questionnaire_data.get("cdl_license", False):
        skills.add("Commercial driving")
        skills.add("CDL")
        skills.add("Transportation")
    
    # Add general mining skills
    if questionnaire_data.get("years_experience", 0) > 0:
        skills.add("Industrial experience")
        skills.add("Physical work")
        skills.add("Working in challenging conditions")
    
    return sorted(list(skills))


def map_mining_skills_to_career(
    user_skills: List[str],
    target_career: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Map user's mining skills to a target career and calculate match.
    
    Args:
        user_skills: List of user's transferable skills
        target_career: Target career dictionary with required_skills and transferable_mining_skills
        
    Returns:
        Dictionary with match_score, transferable_skills, missing_skills
    """
    user_skills_set = set(skill.lower() for skill in user_skills)
    required_skills = target_career.get("required_skills", [])
    transferable_mining_skills = target_career.get("transferable_mining_skills", [])
    
    # Find skills that match required skills
    matching_skills = []
    for req_skill in required_skills:
        req_lower = req_skill.lower()
        for user_skill in user_skills:
            user_lower = user_skill.lower()
            # Check for exact match or keyword match
            if req_lower == user_lower or any(
                keyword in user_lower for keyword in req_lower.split() if len(keyword) > 3
            ):
                matching_skills.append(req_skill)
                break
    
    # Find transferable mining skills that user has
    transferable_found = []
    for trans_skill in transferable_mining_skills:
        trans_lower = trans_skill.lower()
        for user_skill in user_skills:
            user_lower = user_skill.lower()
            if trans_lower == user_lower or any(
                keyword in user_lower for keyword in trans_lower.split() if len(keyword) > 3
            ):
                transferable_found.append(trans_skill)
                break
    
    # Calculate match score
    # Weight: 60% for required skills match, 40% for transferable skills
    required_match_score = (len(matching_skills) / len(required_skills) * 100) if required_skills else 0
    transferable_match_score = (len(transferable_found) / len(transferable_mining_skills) * 100) if transferable_mining_skills else 0
    
    match_score = (required_match_score * 0.6) + (transferable_match_score * 0.4)
    
    # Find missing skills
    missing_skills = [
        skill for skill in required_skills
        if skill.lower() not in [s.lower() for s in matching_skills]
    ]
    
    return {
        "match_score": round(match_score, 2),
        "transferable_skills": transferable_found,
        "matching_required_skills": matching_skills,
        "missing_skills": missing_skills,
        "skill_overlap_count": len(matching_skills),
        "transferable_count": len(transferable_found)
    }

