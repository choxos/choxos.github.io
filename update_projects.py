import json
import os
import requests

def get_github_projects(username):
    """
    Fetches public repositories for a given GitHub username.
    """
    url = f"https://api.github.com/users/{username}/repos"
    params = {'sort': 'updated', 'direction': 'desc'}
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        repos = response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching GitHub repositories: {e}")
        return []

    projects = []
    for repo in repos:
        if not repo.get('fork'):
            projects.append({
                'name': repo.get('name'),
                'description': repo.get('description', 'No description available.'),
                'url': repo.get('html_url'),
                'stars': repo.get('stargazers_count'),
                'forks': repo.get('forks_count'),
                'language': repo.get('language')
            })
    return projects

if __name__ == "__main__":
    github_username = "choxos"
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, 'data', 'projects.json')

    print(f"Fetching projects for {github_username} from GitHub...")
    project_data = get_github_projects(github_username)

    if project_data:
        os.makedirs(os.path.dirname(data_file), exist_ok=True)
        with open(data_file, 'w') as f:
            json.dump(project_data, f, indent=4)
        print(f"Successfully updated {len(project_data)} projects in {data_file}")
    else:
        print("No projects found or an error occurred.") 