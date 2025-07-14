import json
import os
from curl_cffi import requests
from bs4 import BeautifulSoup

def get_blog_posts():
    """
    Fetches blog posts from a Medium profile page.
    """
    url = "https://choxos.medium.com"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
    }

    try:
        response = requests.get(url, headers=headers, impersonate="chrome110")
        response.raise_for_status()
    except Exception as e:
        print(f"Error fetching page: {e}")
        return []

    soup = BeautifulSoup(response.content, 'html.parser')
    
    articles = soup.find_all("article")
    posts = []

    for article in articles:
        try:
            title_element = article.find("h2")
            # Find the first link within the article, which is usually the post link
            link_element = article.find("a")

            if title_element and link_element and link_element.has_attr('href'):
                title = title_element.get_text(strip=True)
                # Medium links are sometimes relative, so we need to construct the full URL
                link = link_element['href']
                if not link.startswith('http'):
                    link = "https://medium.com" + link

                posts.append({
                    "title": title,
                    "url": link
                })
        except Exception as e:
            print(f"Error extracting article details: {e}")
            continue
            
    return posts

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, 'data', 'blog_posts.json')

    print("Fetching blog posts from Medium...")
    blog_posts = get_blog_posts()

    if blog_posts:
        os.makedirs(os.path.dirname(data_file), exist_ok=True)
        with open(data_file, 'w') as f:
            json.dump(blog_posts, f, indent=4)
        print(f"Successfully updated {len(blog_posts)} blog posts in {data_file}")
    else:
        print("No blog posts found or an error occurred.") 