"""Checks for the parsing helpers in update_data.py. Run: python3 test_update_data.py"""
from update_data import decap, description_field, rank, readme_blurb

assert decap("MSR249 ASSESSING BIAS IN ANCHORED MAIC AND STC") == "MSR249 Assessing bias in anchored MAIC and STC"
assert decap("Already Mixed Case") == "Already Mixed Case"

preprint = {"type": "preprint", "doi": "https://doi.org/10.1101/x", "cites": 9}
article = {"type": "article", "doi": "https://doi.org/10.1/x", "cites": 1}
assert rank(article) > rank(preprint)
assert rank({**article, "cites": 5}) > rank(article)

desc = "Package: cpaic\nTitle: Component-Based Population-Adjusted\n    Indirect Comparison\nVersion: 0.1.0\n"
assert description_field(desc, "Title") == "Component-Based Population-Adjusted Indirect Comparison"
assert description_field(desc, "Version") == "0.1.0"

readme = "# Tool\n\n[![badge](x)](y)\n> **A [smart](http://x) tool** for things.\n"
assert readme_blurb(readme) == "A smart tool for things.", readme_blurb(readme)
print("ok")
