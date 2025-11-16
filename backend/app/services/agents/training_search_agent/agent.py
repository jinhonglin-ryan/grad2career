"""
Training Search Agent using Google Search
Searches for coal miner renewable energy training programs using web search
"""

import logging
import json
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


def is_valid_training_program_url(url: str) -> bool:
    """
    Validate if URL is likely a legitimate training program page
    Filters out blogs, news sites, and generic pages
    """
    if not url:
        return True  # No URL is okay (some programs may not have websites)
    
    url_lower = url.lower()
    
    # Block blog and news domains
    blocked_domains = [
        'medium.com', 'wordpress.com', 'blogspot.com',
        'forbes.com', 'cnbc.com', 'reuters.com', 'bloomberg.com',
        'linkedin.com', 'facebook.com', 'twitter.com', 'reddit.com',
        'blog.', '/blog/', '/news/', '/article/', '/post/'
    ]
    
    if any(domain in url_lower for domain in blocked_domains):
        return False
    
    # Prefer educational and organizational domains
    preferred_indicators = [
        '.edu', '.gov', '.org',
        'training', 'program', 'certificate', 'course',
        'workforce', 'college', 'university', 'academy'
    ]
    
    # If URL has preferred indicators, it's likely good
    if any(indicator in url_lower for indicator in preferred_indicators):
        return True
    
    # Otherwise, be conservative
    return '.com' not in url_lower or any(ind in url_lower for ind in ['training', 'program', 'course'])


class TrainingProgramResult(BaseModel):
    """Structured training program information"""
    program_name: str = Field(description="Name of the training program")
    provider: str = Field(description="Organization or institution providing the program")
    location: str = Field(description="City and state where program is offered")
    duration: Optional[str] = Field(description="Program duration (e.g., '12 weeks', '6 months')", default=None)
    cost: Optional[str] = Field(description="Program cost or 'Free' or 'Grant-funded'", default=None)
    description: str = Field(description="Brief description of the program")
    url: Optional[str] = Field(description="Program website URL", default=None)
    is_coal_miner_specific: bool = Field(description="Whether program is specifically for coal miners", default=False)
    contact_info: Optional[str] = Field(description="Contact email or phone", default=None)


class TrainingSearchResults(BaseModel):
    """Collection of training programs"""
    programs: List[TrainingProgramResult] = Field(description="List of training programs found")
    search_summary: str = Field(description="Summary of search results")


class TrainingSearchAgent:
    """
    Agent that searches for coal miner renewable energy training programs
    using web search and LLM extraction
    """
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4o-mini"):
        self.llm = ChatOpenAI(
            model=model,
            temperature=0,
            api_key=openai_api_key
        )
        self.parser = JsonOutputParser(pydantic_object=TrainingSearchResults)
        
    def create_search_queries(self, state: str) -> List[str]:
        """
        Generate comprehensive search queries for training programs
        Focus on institutions and programs, not blog posts
        """
        state_names = {
            'west_virginia': 'West Virginia',
            'kentucky': 'Kentucky',
            'pennsylvania': 'Pennsylvania'
        }
        state_name = state_names.get(state, state)
        
        queries = [
            # Specific program searches (more likely to find real programs)
            f"site:edu solar installer training program {state_name}",
            f"site:edu wind turbine technician certification {state_name}",
            f"community college renewable energy certificate {state_name}",
            f"workforce development solar training enroll {state_name}",
            
            # Coal miner specific programs
            f"coal worker retraining program {state_name} apply",
            f"displaced miner clean energy training enrollment {state_name}",
            
            # Government and organization programs
            f"site:gov workforce training renewable energy {state_name}",
            f"site:org coal miner transition solar wind {state_name}",
        ]
        
        return queries
    
    async def search_with_serper(self, query: str, max_results: int = 5, serper_key: str = None) -> List[Dict[str, Any]]:
        """
        Search using Serper (Google Search API alternative)
        """
        try:
            import httpx
            
            if not serper_key:
                logger.warning("SERPER_API_KEY not provided")
                return []
            
            url = "https://google.serper.dev/search"
            payload = json.dumps({
                "q": query,
                "num": max_results
            })
            headers = {
                'X-API-KEY': serper_key,
                'Content-Type': 'application/json'
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, data=payload, timeout=10.0)
                
                if response.status_code != 200:
                    logger.error(f"Serper API error: {response.status_code}")
                    return []
                
                data = response.json()
                results = []
                
                for item in data.get('organic', []):
                    url = item.get('link', '')
                    # Filter out blogs immediately
                    if is_valid_training_program_url(url):
                        results.append({
                            'title': item.get('title', ''),
                            'url': url,
                            'content': item.get('snippet', ''),
                            'score': item.get('position', 99)
                        })
                    else:
                        logger.debug(f"Filtered search result (blog/news): {url}")
                
                return results
                
        except Exception as e:
            logger.error(f"Serper search error: {str(e)}")
            return []
    
    async def search_programs(
        self, 
        state: str,
        max_programs: int = 15,
        serper_key: str = None
    ) -> Dict[str, Any]:
        """
        Main search function - searches for training programs and extracts structured data
        Uses Serper (Google Search API)
        """
        logger.info(f"Starting training program search for {state}")
        
        # Generate search queries
        queries = self.create_search_queries(state)
        
        # Collect search results
        all_search_results = []
        
        # Search with Serper
        if not serper_key:
            logger.error("SERPER_API_KEY not provided")
            return {
                'success': False,
                'programs': [],
                'search_method': 'none',
                'message': 'SERPER_API_KEY not configured. Please set it in .env file.'
            }
        
        for query in queries[:6]:  # Use more queries for better coverage
            logger.info(f"Searching with Serper: {query}")
            results = await self.search_with_serper(query, max_results=5, serper_key=serper_key)
            if results:
                all_search_results.extend(results)
        
        # If no results found
        if not all_search_results:
            logger.warning("No search results found")
            return {
                'success': False,
                'programs': [],
                'search_method': 'serper',
                'message': 'No search results found. Try a different state or check API key.'
            }
        
        logger.info(f"Found {len(all_search_results)} search results using Serper")
        
        # Now use LLM to extract structured training program data
        programs = await self.extract_programs_from_results(all_search_results, state)
        
        return {
            'success': True,
            'programs': programs,
            'search_method': 'serper',
            'total_raw_results': len(all_search_results),
            'message': f'Found {len(programs)} training programs using Serper Google Search'
        }
    
    async def extract_programs_from_results(
        self, 
        search_results: List[Dict[str, Any]],
        state: str
    ) -> List[Dict[str, Any]]:
        """
        Use LLM to extract structured training program information from search results
        """
        # Prepare search results text
        results_text = ""
        for i, result in enumerate(search_results[:20], 1):  # Limit to top 20
            results_text += f"\n\n--- Result {i} ---\n"
            results_text += f"Title: {result.get('title', 'N/A')}\n"
            results_text += f"URL: {result.get('url', 'N/A')}\n"
            results_text += f"Content: {result.get('content', 'N/A')}\n"
        
        # Create extraction prompt
        extraction_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert at extracting REAL, ACTIONABLE training program information from web search results.

CRITICAL RULES - Only extract programs that meet ALL these criteria:
1. ✅ The program ACTUALLY EXISTS (not just an article about programs)
2. ✅ Has a CLEAR provider/institution name
3. ✅ Has enrollment/application information OR contact details
4. ✅ Is offered by: Community College, Technical School, University, Workforce Board, or Non-profit
5. ✅ Focuses on RENEWABLE ENERGY (solar, wind, clean energy) or COAL MINER TRANSITION

DO NOT EXTRACT:
❌ Blog posts or news articles ABOUT training programs
❌ General information pages without specific programs
❌ Programs outside the target state ({state})
❌ Programs that are just mentioned but no details provided
❌ Opinion pieces or editorials
❌ Job postings

VALIDATION - Each program MUST have:
- Specific program name (not generic like "training program")
- Named institution (college, org, etc.)
- Real location in {state}
- Either: URL to program page, OR contact info, OR application details

Extract the following for ONLY legitimate programs:
- program_name: Official specific name (e.g., "Solar PV Installation Certificate Program")
- provider: Exact organization name (e.g., "West Virginia Community College")
- location: City, State format (e.g., "Charleston, WV")
- duration: Program length if mentioned (e.g., "12 weeks", "6 months")
- cost: Price, "Free", "Grant-funded", or "Contact for pricing"
- description: Brief what-you-learn description (2-3 sentences max)
- url: Direct link to program page (not homepage)
- is_coal_miner_specific: true ONLY if explicitly for coal miners/displaced miners
- contact_info: Email or phone if provided

If you find ZERO legitimate programs, return an empty programs array. Do not fabricate programs.

{format_instructions}
"""),
            ("human", """Web Search Results for renewable energy training in {state}:

{search_results}

Extract ONLY real, enrollable training programs. Be strict and conservative.""")
        ])
        
        # Format prompt
        formatted_prompt = extraction_prompt.format_messages(
            state=state,
            search_results=results_text,
            format_instructions=self.parser.get_format_instructions()
        )
        
        try:
            # Call LLM
            logger.info("Extracting programs using LLM...")
            response = await self.llm.ainvoke(formatted_prompt)
            
            # Parse response
            extracted_data = self.parser.parse(response.content)
            
            if isinstance(extracted_data, dict):
                programs = extracted_data.get('programs', [])
            else:
                programs = extracted_data.programs if hasattr(extracted_data, 'programs') else []
            
            logger.info(f"Extracted {len(programs)} training programs")
            
            # Convert to dict format and validate URLs
            programs_list = []
            for prog in programs:
                if isinstance(prog, dict):
                    program_dict = prog
                else:
                    program_dict = prog.dict()
                
                # Validate URL (filter out blogs)
                if is_valid_training_program_url(program_dict.get('url', '')):
                    programs_list.append(program_dict)
                else:
                    logger.info(f"Filtered out blog/news: {program_dict.get('program_name', 'Unknown')}")
            
            logger.info(f"After URL filtering: {len(programs_list)} valid programs")
            return programs_list
            
        except Exception as e:
            logger.error(f"Error extracting programs: {str(e)}")
            return []


# Example usage
async def search_coal_miner_training(state: str, openai_api_key: str) -> Dict[str, Any]:
    """
    Convenience function to search for training programs
    """
    agent = TrainingSearchAgent(openai_api_key=openai_api_key)
    results = await agent.search_programs(state=state)
    return results

