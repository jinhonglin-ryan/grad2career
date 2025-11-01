"""
Conversational Skill Assessment Service

Implements the 4-turn dialogue flow as specified in CONVERSATIONAL_SKILL.md
Uses Gemini 2.5 Flash for the LLM interaction.
"""
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from google.genai import Client
from google.genai import types
from app.core.config import configure_adk_env, settings

# Configure ADK environment for Gemini
configure_adk_env()

logger = logging.getLogger(__name__)

# System instruction as per specification
SYSTEM_INSTRUCTION = """You are the SkillBridge Advisor. Your tone is practical, respectful, and focused on industrial work. Your sole function is to guide the user through a structured, 4-turn interview to extract concrete work experience. 

IMPORTANT GUIDELINES:
- DO NOT use corporate jargon (e.g., synergy, paradigm)
- DO NOT infer skills not mentioned by the user
- DO NOT ask for user IDs, timestamps, or any technical metadata - these are handled automatically
- DO NOT ask the user to provide JSON or structured data
- Focus on natural conversation - ask about their actual work experiences, tools, and tasks
- If a user response is vague, ask for more specific detail about a tool, a number, or a procedure
- During the conversation, just have a normal dialogue. Do not mention schemas, JSON, or technical terms
- After Turn 4 is complete, YOU (the AI) should automatically extract and format the information as JSON behind the scenes - the user should not see this or be asked to provide it

After the final turn (Turn 4), when the user has provided their final response, you must output ONLY a valid JSON object that strictly adheres to the SkillProfileSchema. This JSON should be at the end of your response, and you should NOT ask the user for this information - extract it from the conversation.

SkillProfileSchema (for YOUR output only, not to ask the user):
{
  "user_id": "will_be_provided_by_system",
  "raw_job_title": "extract from Turn 1 conversation",
  "raw_experience_summary": "summary of all user responses from Turns 1-4",
  "extraction_timestamp": "will_be_provided_by_system",
  "extracted_skills": [
    {
      "category": "Mechanical/Maintenance" | "Electrical/Diagnostic" | "Safety/Compliance",
      "user_phrase": "the actual phrase or description the user provided",
      "onet_task_codes": ["49-9041.00 Task", "49-2092.00 Task", ...]
    }
  ]
}

O*NET Code Mapping Guide (use internally when creating the JSON):
- "Fixing a broken fan motor" → ["49-2092.00 Task"] (Diagnose Malfunctions - Electrical)
- "Adjusting the conveyor belt" → ["49-9041.00 DWA"] (Adjust equipment)
- "Checking MSHA rules" → ["2.B.2.c"] (Quality Control Analysis / Inspection)
- "Used a multi-meter" → ["49-2094.00 Tool"] (Electrical and Electronic Measuring Devices)

Remember: The user should experience a natural conversation, not be asked for technical data or JSON formats.
"""

# Turn-specific prompts
TURN_PROMPTS = {
    1: "Welcome. Just tell us, in your own words, what was your main job title and what was the toughest problem you solved last year?",
    2: "Let's talk machinery. What was the most common hydraulic or mechanical fault you corrected on the biggest piece of equipment, and what specific tool did you use?",
    3: "Coal work means high-voltage. Describe the most complex wiring or circuitry issue you diagnosed. What kind of meter did you use to find the fault?",
    4: "Safety is paramount. Describe a time you had to stop a job because of a hazard. What rule did you enforce, and how did you communicate it to your team?"
}

TURN_FOCUS_AREAS = {
    1: "Professional Identity & Scope",
    2: "Mechanical & Hydraulic",
    3: "Electrical & Diagnostics",
    4: "Safety, Leadership, & Compliance"
}


class ConversationalAssessmentService:
    """Service for managing the 4-turn conversational skill assessment."""
    
    def __init__(self):
        """Initialize the service (client is lazy-loaded)."""
        self.client = None
    
    def _get_client(self):
        """Lazy-load and return the Gemini client."""
        if self.client is not None:
            return self.client
        
        try:
            # Use Gemini API key if available
            if settings.google_api_key:
                self.client = Client(api_key=settings.google_api_key)
            else:
                # Try to get from environment (set by configure_adk_env)
                import os
                api_key = os.getenv("GOOGLE_API_KEY")
                if api_key:
                    self.client = Client(api_key=api_key)
                else:
                    raise ValueError(
                        "Google API key is required. Set GOOGLE_API_KEY environment variable "
                        "or configure google_api_key in settings."
                    )
            logger.info("Gemini client initialized successfully")
            return self.client
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            raise
    
    def get_initial_message(self) -> str:
        """Get the initial prompt for Turn 1."""
        return TURN_PROMPTS[1]
    
    def get_turn_prompt(self, turn: int) -> Optional[str]:
        """Get the prompt for a specific turn (1-4)."""
        return TURN_PROMPTS.get(turn)
    
    async def process_message(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        current_turn: int,
        user_id: str,
        session_id: str
    ) -> Dict[str, Any]:
        """
        Process a user message and return the assistant's response.
        
        Args:
            user_message: The user's message
            conversation_history: List of previous messages in format [{"role": "user|assistant", "content": "..."}]
            current_turn: Current turn number (1-4)
            user_id: User identifier
            session_id: Session identifier
            
        Returns:
            Dict with:
            - response: Assistant's text response
            - next_turn: Next turn number (or None if complete)
            - skill_profile: SkillProfileSchema JSON if assessment is complete
            - is_complete: Boolean indicating if all 4 turns are done
        """
        try:
            # Build conversation history for Gemini
            contents = []
            
            # Add system instruction at the start
            contents.append(types.Content(
                role="model",
                parts=[types.Part(text=SYSTEM_INSTRUCTION)]
            ))
            
            # Add conversation history
            for msg in conversation_history:
                role = "model" if msg["role"] == "assistant" else "user"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part(text=msg["content"])]
                ))
            
            # Add current user message
            contents.append(types.Content(
                role="user",
                parts=[types.Part(text=user_message)]
            ))
            
            # Generate response using Gemini API
            # Get the client (lazy-loaded)
            client = self._get_client()
            
            # Use the models.generate_content method - all arguments are keyword-only
            # Use gemini-2.0-flash-exp or fallback to gemini-1.5-flash
            model_name = "gemini-2.0-flash-exp"
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=0.7,
                        top_p=0.95,
                        max_output_tokens=2048,
                    )
                )
            except Exception as e:
                # Try fallback model if the experimental one doesn't work
                logger.warning(f"Failed with {model_name}, trying fallback: {e}")
                response = client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=0.7,
                        top_p=0.95,
                        max_output_tokens=2048,
                    )
                )
            
            # Extract text from response
            assistant_response = ""
            # The response object has a 'text' property
            if response.text:
                assistant_response = response.text.strip()
            elif hasattr(response, 'candidates') and response.candidates:
                # Fallback: try to extract from candidates
                for candidate in response.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        if hasattr(candidate.content, 'parts') and candidate.content.parts:
                            for part in candidate.content.parts:
                                if hasattr(part, 'text') and part.text:
                                    assistant_response = part.text.strip()
                                    break
                    if assistant_response:
                        break
                
            if not assistant_response:
                logger.error(f"Failed to extract response. Response type: {type(response)}")
                logger.error(f"Response attributes: {dir(response)}")
                raise ValueError("Failed to extract response text from Gemini API")
            
            # Check if this is the final turn
            is_complete = current_turn >= 4
            next_turn = current_turn + 1 if not is_complete else None
            
            # If complete, try to extract SkillProfileSchema from response
            skill_profile = None
            if is_complete:
                skill_profile = self._extract_skill_profile(
                    assistant_response, 
                    conversation_history,
                    user_id
                )
            
            return {
                "response": assistant_response,
                "next_turn": next_turn,
                "current_turn": current_turn,
                "is_complete": is_complete,
                "skill_profile": skill_profile
            }
            
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            raise
    
    def _extract_skill_profile(
        self,
        final_response: str,
        conversation_history: List[Dict[str, str]],
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Extract SkillProfileSchema from the final LLM response.
        Looks for JSON in the response and validates it.
        """
        try:
            # Try to find JSON in the response
            # The LLM might wrap JSON in markdown code blocks or provide it directly
            json_text = final_response
            
            # Try to extract JSON from markdown code blocks
            if "```json" in final_response:
                start = final_response.find("```json") + 7
                end = final_response.find("```", start)
                if end > start:
                    json_text = final_response[start:end].strip()
            elif "```" in final_response:
                start = final_response.find("```") + 3
                end = final_response.find("```", start)
                if end > start:
                    json_text = final_response[start:end].strip()
            
            # Parse JSON
            profile = json.loads(json_text)
            
            # Validate and structure according to schema
            if not isinstance(profile, dict):
                raise ValueError("Skill profile must be a JSON object")
            
            # Ensure required fields - always override with system-provided values
            profile["user_id"] = user_id
            profile["extraction_timestamp"] = datetime.utcnow().isoformat() + "Z"
            
            # Clean up any placeholder text the LLM might have included
            if profile.get("user_id") in ["will_be_provided_by_system", "string", ""]:
                profile["user_id"] = user_id
            if profile.get("extraction_timestamp") in ["will_be_provided_by_system", "timestamp", ""]:
                profile["extraction_timestamp"] = datetime.utcnow().isoformat() + "Z"
            
            # Extract raw job title and experience from conversation if not provided
            if "raw_job_title" not in profile or profile.get("raw_job_title") in ["", "string", "extract from Turn 1 conversation"]:
                # Try to extract from Turn 1 user response
                for msg in conversation_history:
                    if msg["role"] == "user" and len(msg["content"]) > 10:
                        profile["raw_job_title"] = msg["content"][:100]  # Truncate if too long
                        break
                # Fallback if no user message found
                if "raw_job_title" not in profile or not profile.get("raw_job_title"):
                    profile["raw_job_title"] = "Not specified"
            
            if "raw_experience_summary" not in profile or profile.get("raw_experience_summary") in ["", "summary of all user responses from Turns 1-4"]:
                # Combine all user messages as summary
                user_messages = [m["content"] for m in conversation_history if m["role"] == "user"]
                profile["raw_experience_summary"] = " ".join(user_messages)[:500] if user_messages else "No experience provided"
            
            # Ensure extracted_skills is a list
            if "extracted_skills" not in profile:
                profile["extracted_skills"] = []
            
            return profile
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON from response: {e}")
            logger.warning(f"Response text: {final_response[:500]}")
            # Return a basic profile structure even if JSON parsing fails
            user_messages = [m["content"] for m in conversation_history if m["role"] == "user"]
            return {
                "user_id": user_id,
                "raw_job_title": user_messages[0] if user_messages else "Unknown",
                "raw_experience_summary": " ".join(user_messages)[:500],
                "extraction_timestamp": datetime.utcnow().isoformat() + "Z",
                "extracted_skills": []
            }
        except Exception as e:
            logger.error(f"Error extracting skill profile: {e}", exc_info=True)
            return None


