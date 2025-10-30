import datetime
from app.core.supabase import get_supabase

resources = [
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
        "resource_type": "webpage"
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
