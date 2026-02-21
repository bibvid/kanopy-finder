import requests
import json
import urllib.parse
import time
from pathlib import Path

WIKIDATA_URL = "https://query.wikidata.org/sparql"
BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "kanopy_data.json"

# P7985 = Kanopy
# P345  = IMDb
# P1258 = Rotten Tomatoes
# P1712 = Metacritic
# P6127 = Letterboxd
# P4947 = TMDB (Movie)
QUERY = """
SELECT ?kanopy ?imdb ?rt ?metacritic ?letterboxd ?tmdb ?wiki_slug WHERE {
  ?item wdt:P7985 ?kanopy.
  
  OPTIONAL { ?item wdt:P345 ?imdb. }
  OPTIONAL { ?item wdt:P1258 ?rt. }
  OPTIONAL { ?item wdt:P1712 ?metacritic. }
  OPTIONAL { ?item wdt:P6127 ?letterboxd. }
  OPTIONAL { ?item wdt:P4947 ?tmdb. }
  
  OPTIONAL {
    ?article schema:about ?item ; 
             schema:isPartOf <https://en.wikipedia.org/> .
    BIND(REPLACE(STR(?article), "https://en.wikipedia.org/wiki/", "") AS ?wiki_slug)
  }
}
"""

def build_database():
    headers = {'User-Agent': 'KanopyFinderBot/1.1', 'Accept': 'application/sparql-results+json'}
    
    print("📡 Pulling global movie IDs from Wikidata...")
    try:
        response = requests.get(WIKIDATA_URL, params={'query': QUERY, 'format': 'json'}, headers=headers)
        response.raise_for_status()
        data = response.json()
        results = data['results']['bindings']
        
        mapping = {}

        for row in results:
            kanopy_id = row['kanopy']['value']
            
            # These are all properties we want to use as keys
            properties = ['imdb', 'rt', 'metacritic', 'letterboxd', 'tmdb', 'wiki_slug']
            
            for prop in properties:
                if prop in row:
                    raw_val = row[prop]['value']
                    # Decode URL characters (crucial for Wiki slugs and RT IDs)
                    clean_val = urllib.parse.unquote(raw_val)
                    
                    # Create a complex key to prevent clashes (e.g., "rt:m/19154")
                    complex_key = f"{prop}:{clean_val}"
                    
                    # We map the external ID to the Kanopy ID
                    mapping[complex_key] = kanopy_id

        # Save pretty-printed JSON for better git diffs and sync efficiency
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(mapping, f, indent=2, sort_keys=True, ensure_ascii=False)
            
        print(f"✅ Success! Indexed {len(mapping)} total search keys.")

    except Exception as e:
        print(f"❌ Scraper failed: {e}")

if __name__ == "__main__":
    build_database()
