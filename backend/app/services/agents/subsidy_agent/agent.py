import logging
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools import google_search
from app.core.config import configure_adk_env

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

GEMINI_MODEL = "gemini-2.5-flash"

# --- Agent 1: Research and Generate Eligibility Checklist ---
eligibility_agent = LlmAgent(
    name="EligibilityResearcher",
    model=GEMINI_MODEL,
    instruction=(
        "You are an expert grant eligibility researcher specializing in coal miner transition programs.\n\n"
        "Given a grant name and user profile information, use Google Search to find official eligibility requirements "
        "from government pages, application guidelines, and authoritative sources.\n\n"
        "Your task is to generate a COMPREHENSIVE eligibility checklist with 8-12 specific requirements.\n\n"
        "For each requirement, determine if the user satisfies it based on their profile information.\n\n"
        "Requirements to research and include (as applicable):\n"
        "- Employment history in coal/mining industry\n"
        "- Proof of displacement/layoff from coal industry\n"
        "- Residency requirements (specific states/regions)\n"
        "- Income thresholds or limits\n"
        "- Age requirements\n"
        "- Education level requirements\n"
        "- Citizenship or work authorization status\n"
        "- Application deadlines\n"
        "- Training program enrollment requirements\n"
        "- Documentation of industry experience (years)\n"
        "- Unemployment status requirements\n"
        "- Family size considerations\n\n"
        "Return ONLY valid JSON matching this schema EXACTLY:\n"
        "{\n"
        "  \"grant_name\": \"string\",\n"
        "  \"checklist\": [\n"
        "    {\n"
        "      \"requirement\": \"string (specific requirement description)\",\n"
        "      \"status\": \"satisfied\" | \"not_satisfied\" | \"pending\",\n"
        "      \"rationale\": \"string (explanation based on user profile)\"\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Generate at least 8 checklist items, preferably 10-12\n"
        "- Be specific about each requirement\n"
        "- Use status values:\n"
        "  * \"satisfied\" - user clearly meets this requirement based on their profile\n"
        "  * \"not_satisfied\" - user clearly does NOT meet this requirement\n"
        "  * \"pending\" - insufficient information in user profile to determine; needs verification\n"
        "- Do not include any text outside the JSON"
    ),
    description="Researches grant eligibility requirements and generates comprehensive checklist.",
    tools=[google_search],
    output_key="eligibility_result"
)

# --- Agent 2: Research and Generate Documentation List ---
documentation_agent = LlmAgent(
    name="DocumentationResearcher",
    model=GEMINI_MODEL,
    instruction=(
        "You are an expert grant documentation specialist for coal miner transition programs.\n\n"
        "Given a grant name, use Google Search to find the official documentation requirements "
        "from government pages, application forms, and authoritative sources.\n\n"
        "Your task is to generate a COMPREHENSIVE list of documents the applicant needs to bring/submit.\n\n"
        "Documents to research and include (as applicable):\n"
        "- Government-issued photo ID (driver's license, passport)\n"
        "- Social Security card or number\n"
        "- Proof of coal industry employment (pay stubs, W-2s, employment letters)\n"
        "- Layoff or termination notice\n"
        "- Proof of residency (utility bills, lease agreement)\n"
        "- Tax returns (specify years needed)\n"
        "- Birth certificate\n"
        "- Educational transcripts or diplomas\n"
        "- Resume or work history documentation\n"
        "- Bank statements\n"
        "- Training program enrollment confirmation\n"
        "- Unemployment insurance documentation\n"
        "- Any grant-specific forms\n\n"
        "Return ONLY valid JSON matching this schema EXACTLY:\n"
        "{\n"
        "  \"grant_name\": \"string\",\n"
        "  \"documents\": [\n"
        "    {\n"
        "      \"document_name\": \"string (name of document)\",\n"
        "      \"description\": \"string (what it proves/why needed)\",\n"
        "      \"required\": true | false,\n"
        "      \"how_to_obtain\": \"string (optional - where/how to get it)\"\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Generate at least 8-12 document items\n"
        "- Be specific about each document\n"
        "- Mark documents as required (true) or optional (false)\n"
        "- Include helpful tips on how to obtain documents when possible\n"
        "- Do not include any text outside the JSON"
    ),
    description="Researches required documentation for grant applications.",
    tools=[google_search],
    output_key="documentation_result"
)

# --- Agent 3: Combine Results into Final Response ---
merger_agent = LlmAgent(
    name="SubsidySynthesisAgent",
    model=GEMINI_MODEL,
    instruction=(
        "You are an AI Assistant responsible for combining grant research findings into a final structured response.\n\n"
        "You have access to the results from prior research steps stored in memory:\n"
        "- eligibility_result: Contains 'grant_name' and 'checklist' array\n"
        "- documentation_result: Contains 'grant_name' and 'documents' array\n\n"
        "Your task is to combine these into a single coherent response.\n\n"
        "Return ONLY valid JSON matching this schema EXACTLY:\n"
        "{\n"
        "  \"status\": \"success\",\n"
        "  \"grant_name\": \"string\",\n"
        "  \"checklist\": [\n"
        "    {\n"
        "      \"requirement\": \"string\",\n"
        "      \"status\": \"satisfied\" | \"not_satisfied\" | \"pending\",\n"
        "      \"rationale\": \"string\"\n"
        "    }\n"
        "  ],\n"
        "  \"documents\": [\n"
        "    {\n"
        "      \"document_name\": \"string\",\n"
        "      \"description\": \"string\",\n"
        "      \"required\": true | false,\n"
        "      \"how_to_obtain\": \"string\"\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Preserve ALL items from both the checklist and documents lists from memory\n"
        "- Extract the grant_name from either result\n"
        "- Set status to \"success\"\n"
        "- Do not add, remove, or modify the content from the input results\n"
        "- Do not include any text outside the JSON"
    ),
    description="Combines eligibility and documentation research into a unified response.",
)

# --- Sequential Pipeline ---
root_agent = SequentialAgent(
    name="SubsidyPipeline",
    sub_agents=[eligibility_agent, documentation_agent, merger_agent],
    description="Researches grant eligibility, documentation requirements, and synthesizes the results.",
)
