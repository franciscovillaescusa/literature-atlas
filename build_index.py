#!/usr/bin/env python3
"""
Landing page (index.html at the root of the site): one card per project, with its name, description and
the counts of its built atlas. Generated from projects/<name>/config.json and <name>/index.html, so a new
project appears here as soon as it is built; the update job runs this after the builds.

  python3 build_index.py                 # writes ./index.html (only if it changed)
  python3 build_index.py --out page.html
"""
import argparse
import html
import json
import os

REPO_URL = "https://github.com/franciscovillaescusa/literature-atlas"

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Literature Atlases</title>
<meta name="description" content="Interactive maps of the {names}: topics, citations and collaborations.">
<style>
  :root {{ --bg: #f7f7f5; --surface: #ffffff; --ink: #1d2129; --ink-2: #555b66; --edge: #e2e3e0; --accent: #2f6fd0; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg: #12151c; --surface: #1a1e27; --ink: #e8eaee; --ink-2: #a3a9b4; --edge: #2c313c; --accent: #6ea4f2; }} }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
  main {{ max-width: 760px; margin: 0 auto; padding: 56px 16px; }}
  h1 {{ font-size: 30px; margin: 0 0 8px; letter-spacing: -0.01em; }}
  p.lead {{ color: var(--ink-2); margin: 0 0 32px; }}
  .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }}
  a.card {{ display: block; background: var(--surface); border: 1px solid var(--edge); border-radius: 12px; padding: 20px;
           color: inherit; text-decoration: none; transition: border-color .15s; }}
  a.card:hover, a.card:focus-visible {{ border-color: var(--accent); }}
  .card h2 {{ margin: 0 0 6px; font-size: 20px; }}
  .card p {{ margin: 0; color: var(--ink-2); font-size: 15px; }}
  .card p.stats {{ margin-top: 10px; font-size: 14px; font-variant-numeric: tabular-nums; }}
  .card span {{ display: inline-block; margin-top: 12px; color: var(--accent); font-weight: 600; font-size: 15px; }}
  footer {{ margin-top: 40px; color: var(--ink-2); font-size: 14px; }}
  footer a {{ color: var(--accent); }}
</style>
</head>
<body>
<main>
  <h1>Literature Atlases</h1>
  <p class="lead">Interactive maps of research papers: a topic map, the citation network,
    the co-author network, a searchable table and trends over time.</p>
  <div class="cards">
{cards}
  </div>
  <footer>Rebuilt automatically twice a month · <a href="{repo}">Source on GitHub</a></footer>
</main>
</body>
</html>
"""

CARD = """    <a class="card" href="{href}">
      <h2>{name}</h2>
      <p>{description}</p>
      <p class="stats">{stats}<br>Data as of {fetched}</p>
      <span>Open the atlas →</span>
    </a>"""


def page_data(path):
    h = open(path, encoding="utf-8").read()
    return json.loads(h.split('id="atlas-data">', 1)[1].split("</script>", 1)[0].replace("<\\/", "</"))


def build(root="."):
    """The landing page for every project in <root>/projects that has a built atlas."""
    cards, phrases = [], []
    for proj in sorted(os.listdir(os.path.join(root, "projects"))):
        cfg_path, site = os.path.join(root, "projects", proj, "config.json"), os.path.join(root, proj, "index.html")
        if not (os.path.exists(cfg_path) and os.path.exists(site)):
            continue   # not built yet
        cfg, D = json.load(open(cfg_path, encoding="utf-8")), page_data(site)
        years = [p["y"] for p in D["papers"]]
        stats = f"{len(D['papers'])} papers · {len(D['authors'])} authors · {min(years)}–{max(years)}"
        cards.append(CARD.format(href=html.escape(proj) + "/", name=html.escape(cfg.get("card_title", cfg["name"])),
                                 description=html.escape(cfg.get("description", "")), stats=html.escape(stats),
                                 fetched=html.escape(D["fetched"])))
        phrases.append(cfg.get("papers_phrase", f"papers that use the {cfg['name']} simulations"))
    sims = [p[len("papers that use the "):-len(" simulations")] for p in phrases
            if p.startswith("papers that use the ") and p.endswith(" simulations")]
    others = [p for p in phrases if p not in [f"papers that use the {s} simulations" for s in sims]]
    if sims:   # "papers that use the A, B and C simulations"
        others.insert(0, "papers that use the " + " and ".join([", ".join(sims[:-1]), sims[-1]] if len(sims) > 1 else sims) + " simulations")
    names_text = " and ".join([", ".join(others[:-1]), others[-1]] if len(others) > 1 else others)
    return PAGE.format(cards="\n".join(cards), names=html.escape(names_text), repo=REPO_URL)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="index.html")
    args = ap.parse_args()
    page = build()
    old = open(args.out, encoding="utf-8").read() if os.path.exists(args.out) else None
    if old == page:
        print(f"no changes: {args.out} left as it was")
        return
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
