#!/usr/bin/env python3
"""
Smoke test for the built site: opens index.html in a headless browser, exercises every view and the
main controls, and fails if the page throws a JavaScript error or something essential is missing.

Usage
  python3 check_atlas.py --project camels            # checks camels/index.html
  python3 check_atlas.py --project camels --page other.html
  python3 check_atlas.py --project camels --chrome   # use the installed Google Chrome instead of Playwright's Chromium

The project's config.json ("check") names a paper title, a search word and an author used by the checks.

Requires: pip install playwright   (then, unless using --chrome: python -m playwright install chromium)
"""
import argparse
import json
import os
import pathlib
import re
import sys
from collections import Counter

from playwright.sync_api import sync_playwright

VIEWS = ["topics", "citations", "coauthors", "table", "trends"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="project name: a folder in projects/ (e.g. camels, quijote)")
    ap.add_argument("--page")
    ap.add_argument("--chrome", action="store_true", help="use the locally installed Google Chrome")
    args = ap.parse_args()
    CK = json.load(open(os.path.join("projects", args.project, "config.json"), encoding="utf-8"))["check"]
    args.page = args.page or os.path.join(args.project, "index.html")
    url = pathlib.Path(args.page).resolve().as_uri()
    errors, checks = [], []

    def check(name, ok, detail=""):
        checks.append((name, bool(ok), detail))

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome" if args.chrome else None)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        # outside requests (fonts, analytics) are irrelevant here and must not slow or break the test
        page.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        page.goto(url + "#topics")
        page.wait_for_timeout(800)

        stats = page.inner_text("#stats")
        n_papers = int(stats.split()[0])
        check("page shows papers", n_papers > 50, stats)

        for v in VIEWS:
            page.click(f"#m-{v}")
            page.wait_for_timeout(300)
            check(f"view '{v}' activates", page.get_attribute(f"#m-{v}", "aria-pressed") == "true")
        page.click("#m-table")
        page.wait_for_timeout(300)
        rows = page.locator("#tablewrap tbody tr").count()
        check("table lists every paper", rows == n_papers, f"{rows} rows")
        page.click("#m-trends")
        page.wait_for_timeout(300)
        check("trends chart drawn", page.locator("#trendswrap rect.tseg").count() > 0)

        for v in ("topics", "citations", "coauthors"):
            page.click(f"#m-{v}")
            page.click("#dispbtn")          # open the Display menu (it stays open while choosing)
            page.click("#d3")
            page.wait_for_timeout(300)
            page.click("#d2")
            page.wait_for_timeout(200)
            page.keyboard.press("Escape")    # close it
        check("2D/3D toggles in all map views", page.get_attribute("#d2", "aria-pressed") == "true")

        page.click("#fbtn")
        check("filters panel opens", page.is_visible("#fpanel"))
        page.select_option("#f-method", index=1)
        page.wait_for_timeout(200)
        check("filter narrows the papers", "of" in page.inner_text("#stats"), page.inner_text("#stats"))
        check("active-filter chip shown", page.locator("#active .achip").count() >= 1)
        page.click("#reset")
        page.wait_for_timeout(200)

        page.click("#m-topics")
        page.wait_for_timeout(300)
        page.locator("#panel [data-p]").first.click()
        page.wait_for_timeout(300)
        check("selecting a paper opens its panel", page.locator("#panel h2").count() == 1)
        check("selection is in the address", "paper=" in page.evaluate("location.hash"))

        page.fill("#q", CK["search"])
        page.wait_for_timeout(400)
        check("search finds papers", "match" in page.inner_text("#qcount"), page.inner_text("#qcount"))
        # ---- correctness of what the page shows, compared with the embedded data
        data = page.evaluate("JSON.parse(document.getElementById('atlas-data').textContent.replace(/<\\\\\\//g, '</'))")
        papers = data["papers"]
        page.fill("#q", ""); page.click("#reset"); page.wait_for_timeout(200)

        # search: an exact title is found and ranked first
        page.click("#m-table"); page.fill("#q", CK["title"]); page.wait_for_timeout(400)
        first = page.locator("#tablewrap tbody tr td").first.inner_text()
        check("search ranks the exact title first", first.startswith(CK["title"]), first[:50])
        page.fill("#q", ""); page.wait_for_timeout(300)

        # downloads: capture the files the page would save
        page.evaluate("""() => { window.__dl = []; URL.createObjectURL = b => { window.__dl.push(b); return 'blob:x'; };
                              HTMLAnchorElement.prototype.click = function () {}; }""")
        if not page.is_visible("#fpanel"):
            page.click("#fbtn")              # the tag filters live in the Filters panel
        page.select_option("#f-method", "Graph neural networks"); page.keyboard.press("Escape"); page.wait_for_timeout(300)
        shown = page.locator("#tablewrap tbody tr").count()
        expect = sum(1 for p in papers if p["tg"] and "Graph neural networks" in p["tg"]["m"])
        check("method filter shows exactly the tagged papers", shown == expect, f"{shown} shown, {expect} tagged")
        for fmt in ("bib", "csv"):
            page.click("#dlbtn"); page.click(f"[data-dl={fmt}]"); page.wait_for_timeout(200)
        bib, csv = page.evaluate("Promise.all(window.__dl.map(b => b.text()))")
        keys = re.findall(r"^@\w+\{([^,]+),", bib, re.M)
        check("BibTeX has one entry per paper shown", len(keys) == shown, f"{len(keys)} entries")
        check("BibTeX keys are unique", len(set(keys)) == len(keys))
        check("BibTeX braces are balanced", bib.count("{") == bib.count("}"))
        import csv as csvmod, io
        rows = list(csvmod.reader(io.StringIO(csv.lstrip("﻿"))))
        check("CSV has a header plus one row per paper shown", len(rows) == shown + 1 and len({len(r) for r in rows}) == 1,
              f"{len(rows) - 1} rows")
        page.click("#reset"); page.wait_for_timeout(200)

        # trends: bar totals per year equal the number of papers that year
        page.click("#m-trends"); page.wait_for_timeout(300)
        tot = [int(x) for x in page.locator("#trendswrap text.ttot").all_text_contents()]   # SVG text: use textContent
        by_year = sorted(Counter(p["y"] for p in papers).items())
        check("trend totals match papers per year", tot == [n for _, n in by_year], f"{tot}")

        # self-citation switch: the number of links drawn drops to the independent count
        page.click("#m-citations"); page.wait_for_timeout(300)
        n_all = sum(len(p["r"]) for p in papers)
        # in a person's atlas the owner (an author of every paper) does not make a citation a self-citation
        owner = {data["authors"].index(data["proj"]["owner"])} if data["proj"].get("owner") in data["authors"] else set()
        n_ind = sum(1 for i, p in enumerate(papers) for j in p["r"] if not (set(p["au"]) & set(papers[j]["au"])) - owner)
        page.click("#dispbtn"); page.click("#selfc"); page.keyboard.press("Escape"); page.wait_for_timeout(300)
        note = page.inner_text("#note")
        check("self-citation switch hides shared-author links", f"{n_ind} of {n_all}" in note, note)
        page.click("#dispbtn"); page.click("#selfc"); page.keyboard.press("Escape")

        # shareable link: opening it restores view, selection and filter
        link = "#coauthors&author=" + CK["author"].replace(" ", "%20") + "&method=CNN"
        page.goto(url + link); page.wait_for_timeout(700)
        check("shared link restores view", page.get_attribute("#m-coauthors", "aria-pressed") == "true")
        check("shared link restores author", CK["author"] in page.inner_text("#panel h2"))
        check("shared link restores filter", page.input_value("#f-method") == "CNN")
        browser.close()

    width = max(len(n) for n, _, _ in checks)
    for name, ok, detail in checks:
        print(f"{'ok  ' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
    for e in errors:
        print(f"JS ERROR  {e}")
    failed = [n for n, ok, _ in checks if not ok]
    if failed or errors:
        sys.exit(f"\ncheck failed: {len(failed)} failed check(s), {len(errors)} JavaScript error(s)")
    print(f"\nall {len(checks)} checks passed, no JavaScript errors")


if __name__ == "__main__":
    main()
