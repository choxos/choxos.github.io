import json
from scholarly import scholarly
import os

def get_scholar_data():
    # Fetch author details
    author = scholarly.search_author_id('gTWPaFYAAAAJ')
    author = scholarly.fill(author, sections=['basics', 'indices', 'publications'])

    publications = []
    for pub in author['publications']:
        # Fetch detailed publication information
        pub_filled = scholarly.fill(pub)
        
        # Handle author data, which may be a string or a list
        authors_data = pub_filled.get('bib', {}).get('author')
        if isinstance(authors_data, list):
            authors_str = ', '.join(authors_data)
        elif isinstance(authors_data, str):
            authors_str = authors_data
        else:
            authors_str = 'N/A'

        # Get journal/venue information
        journal = pub_filled.get('bib', {}).get('venue')
        if not journal:
            journal = pub_filled.get('bib', {}).get('journal')
        if not journal:
            journal = pub_filled.get('bib', {}).get('booktitle')
        if not journal:
            journal = pub_filled.get('bib', {}).get('publisher')
        
        # Get citation count
        citation_count = pub_filled.get('num_citations', 0)
        
        # Get year and convert to int if possible
        year = pub_filled.get('bib', {}).get('pub_year')
        try:
            year = int(year) if year else None
        except (ValueError, TypeError):
            year = None

        publications.append({
            'title': pub_filled.get('bib', {}).get('title'),
            'authors': authors_str,
            'journal': journal,
            'year': year,
            'url': pub_filled.get('pub_url'),
            'abstract': pub_filled.get('bib', {}).get('abstract'),
            'citations': citation_count
        })
    
    # Sort publications by year (newest first), then by citation count
    publications.sort(key=lambda x: (x['year'] if x['year'] else 0, x['citations']), reverse=True)
    
    stats = {
        'hindex': author.get('hindex'),
        'i10index': author.get('i10index'),
        'total_citations': author.get('citedby')
    }

    return publications, stats

if __name__ == "__main__":
    # Get the directory of the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Define paths for data files
    pubs_data_file = os.path.join(script_dir, 'data', 'publications.json')
    stats_data_file = os.path.join(script_dir, 'data', 'scholar_stats.json')

    print("Fetching data from Google Scholar...")
    pubs, scholar_stats = get_scholar_data()

    # Save publications data
    with open(pubs_data_file, 'w') as f:
        json.dump(pubs, f, indent=2)

    # Save scholar stats
    with open(stats_data_file, 'w') as f:
        json.dump(scholar_stats, f, indent=2)

    print(f"Publications data saved to {pubs_data_file}")
    print(f"Scholar stats saved to {stats_data_file}")
    print(f"Total publications: {len(pubs)}")
    print(f"Total citations: {scholar_stats.get('total_citations', 'N/A')}")
    print(f"H-index: {scholar_stats.get('hindex', 'N/A')}")
    print(f"i10-index: {scholar_stats.get('i10index', 'N/A')}") 