import logging
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools import google_search
from app.core.config import configure_adk_env
from .schema import FinalSubsidyResult

configure_adk_env()

logger = logging.getLogger("subsidy_agent")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


search_agent = LlmAgent(
    name="GrantSearchAgent",
    model="gemini-2.5-flash",
    instruction=(
        "You are a research assistant. Given a grant name targeting displaced coal miners (e.g., POWER, ACC), "
        "use Google Search to find 5-10 relevant authoritative websites (government pages, application pages, "
        "guidelines). Return ONLY JSON in the schema: "
        "{ 'sources': [{'title': str, 'url': str, 'snippet': str}] }."
    ),
    description="Searches web for official grant-related websites and materials.",
    tools=[google_search],
    output_key="search_results",
)

refine_agent = LlmAgent(
    name="GrantEligibilityAgent",
    model="gemini-2.5-flash",
    instruction=(
        "You will receive:\n"
        "- User profile metadata (json)\n"
        "- User work_experience (string)\n"
        "- Web search results (json) from prior step\n\n"
        "Task: Generate a requirements checklist for the specified grant, indicating whether each requirement "
        "appears satisfied based on the user's metadata and work_experience. Use ONLY the schema EXACTLY:\n"
        "{ 'status': 'success'|'error', 'grant_name': str, 'checklist': [{'requirement': str, 'satisfied': bool, 'rationale': str?}], "
        "'sources': [{'title': str?, 'url': str, 'snippet': str?}], 'notes': str?, 'error_message': str? }\n\n"
        "Rules:\n"
        "- Populate 'grant_name' from the provided grant name input.\n"
        "- Checklist must be specific (e.g., 'Proof of coal industry employment', 'SSN', 'Residency in eligible region').\n"
        "- Mark 'satisfied' true/false using ONLY the provided user metadata and work_experience; "
        "if unknown, set false and explain in rationale.\n"
        "- Include the key sources you used from search_results in 'sources'.\n"
        "- Do not include any extra keys beyond the schema. Do not include prose outside JSON."
    ),
    description="Generates a grant requirements checklist with satisfaction status and cites sources.",
    output_schema=FinalSubsidyResult,
    output_key="final_subsidy",
)

root_agent = SequentialAgent(
    name="SubsidyPipeline",
    sub_agents=[search_agent, refine_agent],
    description="Finds grant info and produces an eligibility checklist using user profile context.",
)


