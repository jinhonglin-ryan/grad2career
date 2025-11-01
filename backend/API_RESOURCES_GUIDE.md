# API Resources Guide

This guide explains how to store, process, and use the API resources in the application.

## Overview

The application has several API resources that can be used to dynamically fetch learning opportunities, training programs, and credentials:

1. **YouTube Data API** - Already integrated ✅
2. **CareerOneStop Web API** - Integration ready (requires API key)
3. **Credential Engine Registry API** - Integration ready (requires API key)

## Storage

### Database Storage

Resources are stored in the `learning_resources` table in Supabase:

```sql
CREATE TABLE learning_resources (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    source TEXT,
    resource_type VARCHAR(50),  -- 'API' or 'website'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Seeding Resources

To seed resources to the database:

```bash
cd backend
python -m app.db.seed_resources
```

This will insert all resources from `app/db/seed_resources.py` into the database.

### API Key Storage

**⚠️ Security Best Practice**: API keys should be stored in environment variables, NOT in the database or code.

1. Add API keys to your `.env` file:
```bash
# Existing
YOUTUBE_API_KEY=your_youtube_api_key_here

# New APIs
CAREERONESTOP_API_KEY=your_careeronestop_api_key_here
CREDENTIAL_ENGINE_API_KEY=your_credential_engine_api_key_here
```

2. The `Settings` class in `app/core/config.py` automatically loads these from `.env`

3. **Never commit `.env` to Git** - it should be in `.gitignore`

## Processing & Usage

### 1. YouTube Data API

**Status**: ✅ Already integrated

**Usage**:
- Functions available in `app/services/agents/resource_finder_agent/agent.py`:
  - `youtube_search_playlists(skill: str, max_results: int)`
  - `youtube_get_playlist_items(playlist_id: str, max_results: int)`
- Used by the `ResourceFinderPipeline` agent

**Example**:
```python
from app.services.agents.resource_finder_agent.agent import youtube_search_playlists

result = youtube_search_playlists("Python programming", max_results=5)
if result["status"] == "success":
    playlists = result["playlists"]
```

### 2. CareerOneStop Web API

**Status**: 🔧 Integration ready (requires API key)

**Getting an API Key**:
1. Register at: https://www.careeronestop.org/Developers/WebAPI/registration.aspx
2. Add the key to `.env` as `CAREERONESTOP_API_KEY`

**Usage**:
```python
from app.services.external_apis import careeronestop_search_training

# Search for training programs
result = careeronestop_search_training(
    location="New York, NY",
    program_type="certification",  # optional
    distance=25,  # optional, in miles
    max_results=10
)

if result["status"] == "success":
    programs = result["programs"]
    for program in programs:
        print(f"{program['name']} - {program['location']}")
else:
    print(f"Error: {result['error_message']}")
```

**What it provides**:
- State and local training programs
- Certifications and licenses
- Workforce boards
- Filterable by location, distance, program type

### 3. Credential Engine Registry API

**Status**: 🔧 Integration ready (requires API key)

**Getting an API Key**:
1. Register at: https://credreg.net/
2. Add the key to `.env` as `CREDENTIAL_ENGINE_API_KEY`

**Usage**:
```python
from app.services.external_apis import credential_engine_search

# Search for credentials and learning opportunities
result = credential_engine_search(
    query="Python programming certification",
    credential_type="certificate",  # optional
    location="California",  # optional
    max_results=10
)

if result["status"] == "success":
    credentials = result["credentials"]
    for cred in credentials:
        print(f"{cred['name']} - ${cred.get('cost', 'N/A')}")
else:
    print(f"Error: {result['error_message']}")
```

**What it provides**:
- Credentials and learning opportunities
- Providers with metadata
- Cost information
- Location data
- Quality assurance indicators
- Alignment to competencies

### Check API Availability

```python
from app.services.external_apis import get_available_apis

apis = get_available_apis()
for api_name, info in apis.items():
    status = "✅ Configured" if info["configured"] else "❌ Not configured"
    print(f"{api_name}: {status}")
    print(f"  Description: {info['description']}")
    print(f"  URL: {info['url']}\n")
```

## Integration Patterns

### Pattern 1: Use in Agents

Similar to how YouTube API is used in the resource finder agent, you can add the new APIs:

```python
from google.adk.agents import LlmAgent
from app.services.external_apis import (
    careeronestop_search_training,
    credential_engine_search
)

# Add as tools to an agent
training_agent = LlmAgent(
    name="TrainingFinderAgent",
    model="gemini-2.5-flash",
    instruction="Find training programs for the user's skills...",
    tools=[careeronestop_search_training, credential_engine_search],
    output_key="training_results",
)
```

### Pattern 2: Use in API Routes

Create API endpoints to expose these functions:

```python
from fastapi import APIRouter, HTTPException
from app.services.external_apis import careeronestop_search_training

router = APIRouter()

@router.post("/api/training/search")
async def search_training(
    location: str,
    program_type: str = None,
    distance: int = None
):
    """Search for training programs"""
    result = careeronestop_search_training(
        location=location,
        program_type=program_type,
        distance=distance
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["error_message"])
    
    return result
```

### Pattern 3: Use in Learning Path Generation

Integrate API results into learning path generation:

```python
from app.services.external_apis import credential_engine_search

def enrich_learning_path(skills: list, location: str):
    """Add credential search results to learning path"""
    resources = []
    
    for skill in skills:
        result = credential_engine_search(
            query=skill,
            location=location,
            max_results=5
        )
        
        if result["status"] == "success":
            resources.extend(result["credentials"])
    
    return resources
```

## Important Notes

### API Endpoint URLs

⚠️ **Note**: The actual API endpoint URLs in `app/services/external_apis.py` are placeholders. You need to:

1. Review the official API documentation for each provider
2. Update the endpoint URLs to match the actual API structure
3. Adjust request parameters and headers as needed
4. Handle authentication method (Bearer token, API key in params, etc.)

### Error Handling

All API functions return a consistent format:
```python
{
    "status": "success" | "error",
    # On success:
    "programs" | "credentials" | "playlists": [...],
    # On error:
    "error_message": str
}
```

Always check the `status` field before using the results.

### Rate Limiting

Be aware of API rate limits:
- YouTube API: 10,000 units/day (check quotas)
- CareerOneStop: Check their documentation
- Credential Engine: Check their documentation

Consider implementing:
- Caching for frequently requested queries
- Rate limiting in your application
- Retry logic with exponential backoff

## Next Steps

1. **Register for API Keys**: Get API keys for CareerOneStop and Credential Engine
2. **Test the Integrations**: Use the functions with test queries
3. **Update Endpoint URLs**: Verify and update API endpoints based on official docs
4. **Integrate into Agents**: Add the functions as tools to your agents
5. **Create API Endpoints**: Expose the functionality through your REST API
6. **Monitor Usage**: Track API calls and implement rate limiting as needed

## Files Reference

- **Configuration**: `backend/app/core/config.py` - API key settings
- **API Functions**: `backend/app/services/external_apis.py` - Integration functions
- **Resource Seeding**: `backend/app/db/seed_resources.py` - Database seeding
- **YouTube Integration**: `backend/app/services/agents/resource_finder_agent/agent.py` - Example integration
- **Database Schema**: `backend/database_setup.sql` - Table structure


