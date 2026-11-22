"""Tests for build_index.py (the generated landing page)."""
import json
import os

import build_index


def make_project(root, name, cfg, papers=None):
    os.makedirs(os.path.join(root, "projects", name))
    json.dump(cfg, open(os.path.join(root, "projects", name, "config.json"), "w"))
    if papers is not None:   # a built atlas: only the embedded data matters here
        os.makedirs(os.path.join(root, name))
        data = {"papers": papers, "authors": ["A", "B", "C"], "fetched": "2026-11-20"}
        blob = json.dumps(data).replace("</", "<\\/")
        open(os.path.join(root, name, "index.html"), "w").write(f'<script type="application/json" id="atlas-data">{blob}</script>')


def test_landing_page(tmp_path):
    root = str(tmp_path)
    make_project(root, "alpha", {"name": "Alpha", "description": "Sims <for> \"tests\" & more."}, [{"y": 2021}, {"y": 2024}])
    make_project(root, "beta", {"name": "Beta", "description": "Not built yet."})          # no atlas yet: skipped
    make_project(root, "gamma", {"name": "Gamma"}, [{"y": 2019}])
    page = build_index.build(root)
    assert page.count('class="card"') == 2 and "Beta" not in page
    assert 'href="alpha/"' in page and 'href="gamma/"' in page
    assert "2 papers · 3 authors · 2021–2024" in page and "1 papers · 3 authors · 2019–2019" in page
    assert "Data as of 2026-11-20" in page
    assert "Sims &lt;for&gt; &quot;tests&quot; &amp; more." in page and "<for>" not in page   # escaped
    assert "papers that use the Alpha and Gamma simulations" in page


def test_landing_page_with_a_person(tmp_path):
    root = str(tmp_path)
    make_project(root, "alpha", {"name": "Alpha"}, [{"y": 2021}])
    make_project(root, "ann", {"name": "Doe", "card_title": "Ann Doe", "papers_phrase": "papers by Ann Doe"}, [{"y": 2020}])
    page = build_index.build(root)
    assert "<h2>Ann Doe</h2>" in page and "<h2>Alpha</h2>" in page
    assert "Interactive maps of the papers that use the Alpha simulations and papers by Ann Doe:" in page


def test_landing_page_matches_this_repository():
    # the committed index.html is what build_index.py makes from the committed configs and sites
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assert build_index.build(root) == open(os.path.join(root, "index.html"), encoding="utf-8").read()
