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
        """
        state_names = {
            'west_virginia': 'West Virginia',
            'kentucky': 'Kentucky',
            'pennsylvania': 'Pennsylvania'
        }
        state_name = state_names.get(state, state)
        
        queries = [
            # Coal miner specific
            f"coal miner renewable energy training programs {state_name}",
            f"displaced coal worker solar wind training {state_name}",
            f"coal to clean energy transition programs {state_name}",
            f"appalachian coal miner retraining renewable energy",
            
            # General renewable energy
            f"solar installer certification training {state_name}",
            f"wind turbine technician program {state_name}",
            f"renewable energy training {state_name}",
            f"clean energy jobs training {state_name}",
            
            # Specific institutions
            f"community college solar training {state_name}",
            f"workforce development renewable energy {state_name}",
        ]
        
        return queries
    
    async def search_with_tavily(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Search using Tavily API (better for real-time web search)
        """
        try:
            from tavily import TavilyClient
            import os
            
            tavily_key = os.getenv('TAVILY_API_KEY')
            if not tavily_key:
                logger.warning("TAVILY_API_KEY not found")
                return []
            
            client = TavilyClient(api_key=tavily_key)
            response = client.search(
                query=query,
                search_depth="advanced",
                max_results=max_results,
                include_domains=["edu", "gov", "org"],  # Prioritize educational/govt sites
            )
            
            results = []
            for item in response.get('results', []):
                results.append({
                    'title': item.get('title', ''),
                    'url': item.get('url', ''),
                    'content': item.get('content', ''),
                    'score': item.get('score', 0)
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Tavily search error: {str(e)}")
            return []
    
    async def search_with_serper(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Search using Serper (Google Search API alternative)
        """
        try:
            import httpx
            import os
            
            serper_key = os.getenv('SERPER_API_KEY')
            if not serper_key:
                logger.warning("SERPER_API_KEY not found")
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
                    results.append({
                        'title': item.get('title', ''),
                        'url': item.get('link', ''),
                        'content': item.get('snippet', ''),
                        'score': item.get('position', 99)
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Serper search error: {str(e)}")
            return []
    
    async def search_programs(
        self, 
        state: str,
        max_programs: int = 15
    ) -> Dict[str, Any]:
        """
        Main search function - searches for training programs and extracts structured data
        """
        logger.info(f"Starting training program search for {state}")
        
        # Generate search queries
        queries = self.create_search_queries(state)
        
        # Collect search results
        all_search_results = []
        search_method_used = "none"
        
        # Try Tavily first (best for this use case)
        for query in queries[:4]:  # Limit to 4 queries to avoid rate limits
            logger.info(f"Searching with Tavily: {query}")
            results = await self.search_with_tavily(query, max_results=3)
            if results:
                all_search_results.extend(results)
                search_method_used = "tavily"
        
        # If Tavily didn't work, try Serper
        if not all_search_results:
            for query in queries[:4]:
                logger.info(f"Searching with Serper: {query}")
                results = await self.search_with_serper(query, max_results=3)
                if results:
                    all_search_results.extend(results)
                    search_method_used = "serper"
        
        # If no API available, return informative message
        if not all_search_results:
            logger.warning("No search API available (Tavily or Serper)")
            return {
                'success': False,
                'programs': [],
                'search_method': 'none',
                'message': 'No search API configured. Please set TAVILY_API_KEY or SERPER_API_KEY environment variable.'
            }
        
        logger.info(f"Found {len(all_search_results)} search results using {search_method_used}")
        
        # Now use LLM to extract structured training program data
        programs = await self.extract_programs_from_results(all_search_results, state)
        
        return {
            'success': True,
            'programs': programs,
            'search_method': search_method_used,
            'total_raw_results': len(all_search_results),
            'message': f'Found {len(programs)} training programs using {search_method_used} search'
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
            ("system", """You are an expert at extracting training program information from web search results.

Your task is to identify and extract REAL training programs for coal miners transitioning to renewable energy careers.

Focus on:
1. Programs specifically for COAL MINERS or displaced mining workers
2. Training in SOLAR, WIND, or other RENEWABLE ENERGY fields
3. Programs in or near {state}

Extract the following for each program you find:
- program_name: Official name of the training program
- provider: Organization/institution offering it
- location: City and state
- duration: How long the program takes
- cost: Price or if it's free/grant-funded
- description: What the program covers
- url: Website link
- is_coal_miner_specific: true if specifically for coal miners
- contact_info: Email or phone if available

IMPORTANT:
- Only extract programs that clearly exist (not just mentions)
- If a result talks about a program, extract its real details
- Skip generic articles or news stories
- Focus on actual training programs with clear information

{format_instructions}
"""),
            ("human", """Search Results for training programs in {state}:

{search_results}

Please extract all legitimate training programs from these search results.""")
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
            
            # Convert to dict format
            programs_list = []
            for prog in programs:
                if isinstance(prog, dict):
                    programs_list.append(prog)
                else:
                    programs_list.append(prog.dict())
            
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

