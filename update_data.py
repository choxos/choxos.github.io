#!/usr/bin/env python3
"""Refresh everything under data/ from public sources. Standard library only.

    python3 update_data.py            # all sources
    GITHUB_TOKEN=... python3 update_data.py   # recommended: repos without a description
                                              # cost one README call each (60/hr anonymous)

Sources: OpenAlex (publications, citation stats), GitHub (repositories),
CRAN + cranlogs (R packages), Medium RSS (articles).
"""
import json
import os
import re
import sys
import urllib.request
from datetime import date
from email.utils import parsedate_to_datetime
from html import unescape

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
MAILTO = "a.sofimahmudi@gmail.com"
GITHUB_USER = "choxos"
OPENALEX_AUTHORS = ["A5075399321", "A5021430777", "A5113944425"]
ME = "A5075399321"

# CRAN name -> links. The retraction repository is private, so it links to its site only.
CRAN_PACKAGES = {
    "mlumr": {"repo": "choxos/mlumr", "site": "https://choxos.github.io/mlumr/"},
    "respondeR": {"repo": "choxos/respondeR", "site": "https://choxos.github.io/respondeR/"},
    "krt": {"repo": "choxos/krt", "site": "https://choxos.github.io/krt/"},
    "retraction": {"repo": None, "site": "https://choxos.github.io/retraction/"},
    "rfair": {"repo": "choxos/rfair", "site": "https://choxos.github.io/rfair/"},
    "rtransparency": {"repo": "choxos/rtransparency", "site": "https://choxos.github.io/rtransparency/"},
    "sysreqr": {"repo": "choxos/sysreqR", "site": "https://choxos.github.io/sysreqR/"},
}
DEV_PACKAGES = {
    "cpaic": {"repo": "choxos/cpaic", "site": "https://choxos.github.io/cpaic/"},
    "ggextreme": {"repo": "choxos/ggextreme", "site": "https://choxos.github.io/ggextreme/"},
}
HIDDEN_REPOS = {"choxos", "choxos.github.io", "choxos.r-universe.dev"}

# Posts from before the RSS window (the feed only carries the latest 10).
OLDER_POSTS = [
    ("2023-10-21", "[Dentistry] Brush Last Thing at Night and on One Other Occasion: The Evidence Behind", "c0ef22d97dfd"),
    ("2023-10-19", "[Dentistry] Brush Your Teeth Twice Daily: The Evidence Behind", "d01b55059b5a"),
    ("2023-10-16", "[Dentistry] Five Simple Practices to Keep Teeth Healthy, and Their Evidence Base", "a85cf6cc9ccf"),
    ("2023-10-13", "[Research] Using ChatGPT to summarize the latest articles in your field of interest", "fb902a63f245"),
    ("2023-10-10", "[R] Working with APIs in R (and how to automate the process)", "a1d6f218d5e6"),
    ("2023-10-07", "[Reviews] Searching: What about non-English databases?", "2e88fd75d71f"),
    ("2023-10-04", "[R] Using emojis in R and Python", "1430f509b0f5"),
    ("2023-10-01", "[Reviews] The Great Database Dilemma: Where Should We Search for Information?", "c85603f91188"),
]

KEEP_TYPES = {"article", "review", "preprint", "book-chapter", "letter", "editorial", "conference-abstract"}


def get(url, headers=None, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": f"choxos.github.io ({MAILTO})", **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode("utf-8")
    return body if raw else json.loads(body)


def save(name, obj):
    with open(os.path.join(DATA, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    print(f"  wrote data/{name}")


def decap(title):
    """Sentence-case titles that arrive in ALL CAPS, keeping acronyms and codes."""
    if not title.isupper():
        return title
    words = title.split()
    keep = lambda w: any(c.isdigit() for c in w) or w.strip("():,") in ACRONYMS
    out = [w if keep(w) else w.lower() for w in words]
    first = next((i for i, w in enumerate(out) if not keep(words[i])), 0)
    out[first] = out[first][:1].upper() + out[first][1:]
    return " ".join(out)


ACRONYMS = {"MAIC", "STC", "NMA", "ML-NMR", "ITC", "ITCS", "RCT", "RCTS", "GBD", "QCI", "COVID-19", "HTA", "IPD", "AGD", "TTE", "UK", "US", "USA"}


def rank(rec):
    """Among copies of one title, prefer the published version, then the better-cited one."""
    return (rec["type"] != "preprint", rec["doi"] is not None, rec["cites"])


def readme_blurb(text):
    """First prose line of a README, for repositories without a description."""
    for line in text.splitlines():
        line = re.sub(r"^[>\s]+", "", line).strip()
        if not line or line.startswith(("#", "<", "![", "[![", "|", "---", "```", "=")):
            continue
        line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)
        line = re.sub(r"[*_`]", "", line).strip()
        return line if len(line) <= 160 else line[:157].rsplit(" ", 1)[0] + "..."
    return ""


def norm(title):
    return re.sub(r"[^a-z0-9]", "", (title or "").lower())[:80]


def publications():
    ids = "|".join(OPENALEX_AUTHORS)
    works, cursor = [], "*"
    while cursor:
        page = get(f"https://api.openalex.org/works?filter=author.id:{ids}&per-page=200&cursor={cursor}&mailto={MAILTO}")
        works += page["results"]
        cursor = page["meta"].get("next_cursor") if page["results"] else None

    best = {}
    for w in works:
        if w["type"] not in KEEP_TYPES or not w.get("title"):
            continue
        auths = w.get("authorships") or []
        pos = next((i for i, a in enumerate(auths) if (a["author"]["id"] or "").endswith(tuple(OPENALEX_AUTHORS))), None)
        src = (w.get("primary_location") or {}).get("source") or {}
        venue = src.get("display_name") or ""
        if venue in {"PubMed", "DOAJ (DOAJ: Directory of Open Access Journals)"} or venue.startswith("Archive ouverte"):
            venue = ""
        rec = {
            "title": decap(unescape(re.sub(r"<[^>]+>", "", w["title"]))),
            "date": w["publication_date"],
            "year": w["publication_year"],
            "venue": venue,
            "type": w["type"],
            "doi": w.get("doi"),
            "url": w.get("doi") or (w.get("primary_location") or {}).get("landing_page_url"),
            "cites": w["cited_by_count"],
            "oa": bool((w.get("open_access") or {}).get("is_oa")),
            "n_authors": len(auths),
            "pos": pos,
            "authors": [a["author"]["display_name"] for a in auths[:6]],
        }
        key = norm(rec["title"])
        old = best.get(key)
        if old is None or rank(rec) > rank(old):
            best[key] = rec
    pubs = sorted(best.values(), key=lambda r: r["date"], reverse=True)
    save("publications.json", pubs)

    a = get(f"https://api.openalex.org/authors/{ME}?mailto={MAILTO}")
    s = a.get("summary_stats") or {}
    save("stats.json", {
        "updated": date.today().isoformat(),
        "citations": a["cited_by_count"],
        "h_index": s.get("h_index"),
        "i10_index": s.get("i10_index"),
        "works": len(pubs),
        "first_author": sum(1 for p in pubs if p["pos"] == 0),
        "by_year": sorted(({"year": c["year"], "cites": c["cited_by_count"], "works": c["works_count"]}
                           for c in a.get("counts_by_year") or []), key=lambda c: c["year"]),
    })


def projects():
    tok = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json", **({"Authorization": f"Bearer {tok}"} if tok else {})}
    repos, page = [], 1
    while True:
        batch = get(f"https://api.github.com/users/{GITHUB_USER}/repos?per_page=100&type=owner&page={page}", headers)
        repos += batch
        if len(batch) < 100:
            break
        page += 1
    out = [{
        "name": r["name"],
        "description": r.get("description") or "",
        "url": r["html_url"],
        "homepage": r.get("homepage") or "",
        "language": r.get("language") or "",
        "stars": r["stargazers_count"],
        "forks": r["forks_count"],
        "topics": r.get("topics") or [],
        "created": r["created_at"][:10],
        "updated": r["pushed_at"][:10],
    } for r in repos if not r["fork"] and not r["private"] and not r["archived"] and r["name"] not in HIDDEN_REPOS]
    for r in out:
        if not r["description"]:
            try:
                r["description"] = readme_blurb(get(f"https://api.github.com/repos/{GITHUB_USER}/{r['name']}/readme",
                                                    {**headers, "Accept": "application/vnd.github.raw"}, raw=True))
            except Exception:  # no README
                pass
    out.sort(key=lambda r: r["updated"], reverse=True)
    save("projects.json", out)


def description_field(text, field):
    m = re.search(rf"^{field}:\s*(.+?)(?=^\S|\Z)", text, re.M | re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def rpackages():
    names = ",".join(CRAN_PACKAGES)
    dl = {d["package"]: d["downloads"] for d in get(f"https://cranlogs.r-pkg.org/downloads/total/2015-01-01:last-day/{names}")}
    out = []
    for name, links in CRAN_PACKAGES.items():
        d = get(f"https://crandb.r-pkg.org/{name}")
        out.append({
            "name": name, "cran": True, "version": d["Version"],
            "title": re.sub(r"\s+", " ", d["Title"]),
            "published": d["Date/Publication"][:10],
            "downloads": dl.get(name, 0),
            "cran_url": f"https://cran.r-project.org/package={name}",
            "repo": f"https://github.com/{links['repo']}" if links["repo"] else None,
            "site": links["site"],
        })
    for name, links in DEV_PACKAGES.items():
        desc = get(f"https://raw.githubusercontent.com/{links['repo']}/HEAD/DESCRIPTION", raw=True)
        out.append({
            "name": name, "cran": False, "version": description_field(desc, "Version"),
            "title": description_field(desc, "Title"),
            "published": None, "downloads": None, "cran_url": None,
            "repo": f"https://github.com/{links['repo']}", "site": links["site"],
        })
    save("rpackages.json", out)


def articles():
    xml = get("https://choxos.medium.com/feed", {"User-Agent": "Mozilla/5.0"}, raw=True)
    posts = []
    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title = re.search(r"<title><!\[CDATA\[(.*?)\]\]></title>", item, re.S).group(1)
        link = re.search(r"<link>(.*?)</link>", item).group(1).split("?")[0]
        pub = re.search(r"<pubDate>(.*?)</pubDate>", item).group(1)
        d = parsedate_to_datetime(pub).date().isoformat()
        tags = re.findall(r"<category><!\[CDATA\[(.*?)\]\]></category>", item)
        posts.append({"date": d, "title": unescape(title), "url": link, "tags": tags})
    seen = {norm(p["title"]) for p in posts}
    posts += [{"date": d, "title": t, "url": f"https://medium.com/p/{pid}", "tags": []}
              for d, t, pid in OLDER_POSTS if norm(t) not in seen]
    posts.sort(key=lambda p: p["date"], reverse=True)
    save("articles.json", posts)


if __name__ == "__main__":
    os.makedirs(DATA, exist_ok=True)
    failed = []
    for step in (publications, projects, rpackages, articles):
        print(f"{step.__name__}...")
        try:
            step()
        except Exception as e:  # keep the previous snapshot for this source
            failed.append(step.__name__)
            print(f"  failed: {e}", file=sys.stderr)
    sys.exit(1 if failed else 0)
