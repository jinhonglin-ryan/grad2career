"""
Seed learning resources to the database.

This module seeds the learning_resources table with:
- API resources: APIs that can be integrated for dynamic resource fetching
- Website resources: Static links to learning platforms and resources

API Resources:
- YouTube Data API: Already integrated via app/services/agents/resource_finder_agent/agent.py
- CareerOneStop Web API: Integration available via app/services/external_apis.py
- Credential Engine Registry API: Integration available via app/services/external_apis.py

To use API resources:
1. Register for API keys at the provider's website
2. Add API keys to your .env file (e.g., CAREERONESTOP_API_KEY=...)
3. Use the integration functions from app/services/external_apis.py
"""

import datetime
from app.core.supabase import get_supabase

resources = [
    {
        "title": "Youtube Data API",
        "url": "https://developers.google.com/youtube/v3/docs/search/list",
        "description": "Training videos and playlists. Already integrated in resource_finder_agent.",
        "source": "Youtube",
        "resource_type": "API",
        # Note: API key should be set as YOUTUBE_API_KEY in .env
    },
    {
        "title": "CareerOneStop Web API",
        "url": "https://api.careeronestop.org",
        "description": "State and local training programs, certifications, licenses, workforce boards, with filters for location, distance, program type, and more. Integrated via careeronestop_search_training() in app/services/external_apis.py and available in the resource_finder_agent for learning path generation.",
        "source": "CareerOneStop",
        "resource_type": "API",
        # Note: Register at https://www.careeronestop.org/Developers/WebAPI/registration.aspx and set CAREERONESTOP_API_KEY in .env
    },
    {
        "title": "Credential Engine Registry Search API",
        "url": "https://credreg.net/",
        "description": "Credentials, learning opportunities, and providers with metadata for cost, location, quality assurance, and alignment to competencies. Use credential_engine_search() from app/services/external_apis.py",
        "source": "Credential Engine Registry",
        "resource_type": "API",
        # Note: Register at the URL above and set CREDENTIAL_ENGINE_API_KEY in .env
    },
    {
        "title": "Clean Energy Training - IREC",
        "url": "https://cleanenergytraining.org/",
        "description": "Curated training content for workers interested in clean energy technologies and roles.",
        "source": "Clean Energy Training",
        "resource_type": "website"
    },
    {
        "title": "Map a Career in Energy",
        "url": "https://www.energy.gov/eere/jobs/map-career-energy?nrg_redirect=471186",
        "description": "Interactive career maps for renewable energy job pathways.",
        "source": "US Department of Energy",
        "resource_type": "website"
    },
    {
        "title": "Federal Energy & Manufacturing Workforce Training Programs",
        "url": "https://www.energy.gov/energysaver/federal-energy-and-manufacturing-workforce-training-programs",
        "description": "Comprehensive list of federal energy and manufacturing workforce training programs.",
        "source": "US Department of Energy",
        "resource_type": "website"
    },
]

def seed_learning_resources():
    supabase = get_supabase()
    for resource in resources:
        result = supabase.table("learning_resources").insert(resource).execute()
        print(result)

if __name__ == "__main__":
    seed_learning_resources()
    print("Seeded learning resources to Supabase!")
