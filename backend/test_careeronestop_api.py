"""
Test script for CareerOneStop API integration.

This script tests the CareerOneStop API to verify:
1. Training programs search
2. API authentication
3. Response structure

Usage:
    python test_careeronestop_api.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from app.services.external_apis import careeronestop_search_training
from app.core.config import settings
import json

def test_training_programs():
    """Test fetching training programs from CareerOneStop."""
    
    print("=" * 60)
    print("CareerOneStop API Test")
    print("=" * 60)
    
    # Check if API key is configured
    if not settings.careeronestop_api_key:
        print("❌ ERROR: CAREERONESTOP_API_KEY not found in environment")
        print("   Please set CAREERONESTOP_API_KEY in your .env file")
        return False
    
    print(f"✓ API Key found: {settings.careeronestop_api_key[:10]}...")
    
    # Check for user_id in environment (if separate from API key)
    user_id = os.getenv("CAREERONESTOP_USER_ID")
    if user_id:
        print(f"✓ User ID found: {user_id}")
    else:
        print("ℹ Using API key as user ID")
    
    # Test cases
    test_cases = [
        {
            "occupation": "solar panel installer",
            "location": "25301",  # Charleston, WV
            "description": "Solar Panel Installer in Charleston, WV"
        },
        {
            "occupation": "wind turbine technician",
            "location": "25301",
            "description": "Wind Turbine Technician in Charleston, WV"
        },
        {
            "occupation": "electrician",
            "location": "25301",
            "description": "Electrician in Charleston, WV"
        }
    ]
    
    print("\n" + "=" * 60)
    print("Testing Training Programs Search")
    print("=" * 60)
    
    all_success = True
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n--- Test {i}: {test_case['description']} ---")
        print(f"Occupation: {test_case['occupation']}")
        print(f"Location: {test_case['location']}")
        
        try:
            result = careeronestop_search_training(
                occupation=test_case['occupation'],
                location=test_case['location'],
                user_id=user_id,
                max_results=5
            )
            
            if result["status"] == "success":
                programs = result.get("programs", [])
                print(f"✓ SUCCESS: Found {len(programs)} training programs")
                
                if programs:
                    print("\nSample program structure:")
                    # Show first program structure
                    first_program = programs[0]
                    if isinstance(first_program, dict):
                        print(json.dumps(first_program, indent=2)[:500] + "...")
                    else:
                        print(f"Program type: {type(first_program)}")
                        print(f"Program: {str(first_program)[:200]}...")
                    
                    # Show key fields if available
                    if isinstance(first_program, dict):
                        print("\nKey fields found:")
                        for key in ['ProgramName', 'ProviderName', 'Location', 'City', 'State', 
                                   'ProgramType', 'Duration', 'Cost', 'StartDate']:
                            if key in first_program:
                                print(f"  - {key}: {first_program[key]}")
                else:
                    print("⚠ No programs returned (may be normal if no programs available)")
            else:
                print(f"❌ ERROR: {result.get('error_message', 'Unknown error')}")
                all_success = False
                
        except Exception as e:
            print(f"❌ EXCEPTION: {str(e)}")
            import traceback
            traceback.print_exc()
            all_success = False
    
    print("\n" + "=" * 60)
    if all_success:
        print("✓ All tests completed")
    else:
        print("❌ Some tests failed")
    print("=" * 60)
    
    return all_success


if __name__ == "__main__":
    success = test_training_programs()
    sys.exit(0 if success else 1)




