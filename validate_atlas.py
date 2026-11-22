#!/usr/bin/env python3
"""
Validation tests for the data of one literature atlas (one project in projects/).

Checks the data embedded in index.html against the downloaded sources (atlas_cache/) and against
itself. Key results (self-citations, co-author links, similar papers, trends, author merging) are
recomputed here independently instead of trusting the build code.

Usage
  python3 validate_atlas.py --project camels            # offline: camels/index.html vs atlas_cache/camels/
  python3 validate_atlas.py --project camels --online   # also re-fetch the publications page and spot-check ADS

Exit code 1 if any check fails.
"""
import argparse
import html as html_mod
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date

import numpy as np

RESULTS = []
WARNINGS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))


def norm_title(t):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", t).lower())


def norm_name(s):
    s = unicodedata.normalize("NFKD", s)
    return re.sub(r"[^a-z]", "", "".join(c for c in s if not unicodedata.combining(c)).lower())


def load(args):
    h = open(args.page, encoding="utf-8").read()
    D = json.loads(h.split('id="atlas-data">', 1)[1].split("</script>", 1)[0].replace("<\\/", "</"))
    c = lambda f: json.load(open(os.path.join(args.cache, f)))
    cache = {k: c(f) for k, f in [("entries", "entries.json"), ("arxiv", "arxiv.json"), ("s2", "s2.json"),
                                  ("ads", "ads.json"), ("ads_rec", "ads_records.json"), ("ads_refs", "ads_refs.json")]}
    pos = json.load(open(args.positions))
    tags = json.load(open(args.tags))
    ov = json.load(open(args.overrides)) if os.path.exists(args.overrides) else {}
    return h, D, cache, pos, tags, ov


def main():
    try:
        run()
    except Exception as e:   # a crash means the data is broken in a way no single check anticipated
        import traceback
        check("validator ran to completion", False, f"{type(e).__name__}: {e} (line {traceback.extract_tb(e.__traceback__)[-1].lineno})")
    report()


def run():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="project name: a folder in projects/ (e.g. camels, quijote)")
    ap.add_argument("--page")
    ap.add_argument("--cache")
    ap.add_argument("--positions")
    ap.add_argument("--tags")
    ap.add_argument("--overrides")
    ap.add_argument("--online", action="store_true")
    args = ap.parse_args()
    pdir = os.path.join("projects", args.project)
    CFG = json.load(open(os.path.join(pdir, "config.json"), encoding="utf-8"))
    args.page = args.page or os.path.join(args.project, "index.html")
    args.cache = args.cache or os.path.join("atlas_cache", args.project)
    args.positions = args.positions or os.path.join(pdir, "positions.json")
    args.tags = args.tags or os.path.join(pdir, "tags.json")
    args.overrides = args.overrides or os.path.join(pdir, "overrides.json")
    h, D, C, POS, TAGS, OV = load(args)
    P, AU, TOP = D["papers"], D["authors"], D["topics"]
    N = len(P)
    E = C["entries"]
    hidden = {k for k, v in OV.items() if not k.startswith("_") and v.get("hide")}
    # papers that keep an earlier ID through an "id" override (key: their ID from the source, or their title)
    alias = {}
    for key, v in OV.items():
        if not key.startswith("_") and "id" in v:
            alias[key] = alias["title:" + norm_title(key)[:80]] = str(v["id"])
    site_uid = lambda e: (lambda u: alias.get(u, u))(e["arxiv"] or e["bibcode"] or "title:" + norm_title(e["title"])[:80])

    # ------------------------------------------------------------------ 1. completeness vs the source list
    titles_src = Counter(norm_title(e["title"]) for e in E)
    n_unique = len({e["arxiv"] or e["bibcode"] or "title:" + norm_title(e["title"])[:80] for e in E})   # duplicates count once
    check("every entry on the publications page is on the site",
          N == n_unique - len(hidden), f"{N} papers, {len(E)} entries ({len(E) - n_unique} duplicates), {len(hidden)} hidden by overrides")
    check("every link is http(s)", all(re.match(r"https?://", p["url"]) for p in P if p["url"]),
          f"{[p['url'][:40] for p in P if p['url'] and not re.match(r'https?://', p['url'])][:3]}")
    for n_ in D.get("notes", []):   # problems on the publications page that a person should fix
        WARNINGS.append(f"publications page: {n_}")
    ids_src = {e["arxiv"] for e in E if e["arxiv"]}
    ids_site = {p["id"] for p in P if re.fullmatch(r"\d{4}\.\d{4,5}", p["id"])}
    check("site arXiv IDs == publications page arXiv IDs", ids_site == ids_src,
          f"missing {sorted(ids_src - ids_site)[:3]}, extra {sorted(ids_site - ids_src)[:3]}")
    check("no duplicate papers", len({p["id"] for p in P}) == N and len({norm_title(p["t"]) for p in P}) == N)

    # ------------------------------------------------------------------ 2. paper metadata vs arXiv / ADS
    ax = C["arxiv"]
    bad_t = [p["id"] for p in P if p["id"] in ax and p["t"] != ax[p["id"]]["title"]]
    check("titles match arXiv", not bad_t, f"{len(bad_t)} mismatches {bad_t[:3]}")
    bad_ab = [p["id"] for p in P if p["id"] in ax and p["ab"] != ax[p["id"]]["abstract"]]
    check("arXiv abstracts published in full and unchanged", not bad_ab, f"{len(bad_ab)} mismatches")
    bad_d = [p["id"] for p in P if p["id"] in ax and p["d"] != ax[p["id"]]["published"]]
    check("dates of arXiv papers = first arXiv submission", not bad_d, f"{bad_d[:3]}")
    ex = [p for p in P if p["abx"]]
    check("only non-arXiv journal abstracts are excerpted",
          all(p["id"] not in ax for p in ex) and all(len(p["ab"]) < 400 for p in ex), f"{len(ex)} excerpts")
    for b, rec in C["ads_rec"].items():
        p = next((q for q in P if q["id"] == b), None)
        if not p or p["dq"]:
            continue
        issue = rec.get("pubdate", "")[:7].replace("-00", "")
        entry = (rec.get("entry_date") or "")[:10]
        check(f"ADS-only paper dated by first appearance ({b[:19]})", p["d"] == min(x for x in (issue, entry) if x),
              f"{p['d']} vs issue {issue}, listed {entry}")
    yrs = [p["y"] for p in P]
    check("years are plausible", min(yrs) >= CFG["first_year"] and max(yrs) <= date.today().year, f"{min(yrs)}-{max(yrs)}")
    check("year field agrees with date", all(str(p["y"]) == p["d"][:4] for p in P))
    check("only papers without any date are marked estimated",
          all(not p["dq"] or (p["id"] not in ax and p["id"] not in C["ads_rec"]) for p in P),
          f"{sum(p['dq'] for p in P)} estimated")
    check("every paper has authors", all(p["au"] for p in P))

    # ------------------------------------------------------------------ 3. citation counts
    ads = C["ads"]
    bad_c = [p["id"] for p in P if p["id"] in ads and (p["c"], p["cs"], p["bib"]) != (ads[p["id"]]["citations"], 0, ads[p["id"]]["bibcode"])]
    check("ADS citation counts and bibcodes copied correctly", not bad_c, f"{bad_c[:3]}")
    check("citation source flags are consistent", all((p["cs"] == 0) == bool(p["bib"]) for p in P))
    check("header count of ADS-sourced papers", D["nads"] == sum(p["cs"] == 0 for p in P))

    # ------------------------------------------------------------------ 4. citation links
    links = [(i, j) for i, p in enumerate(P) for j in p["r"]]
    check("citation links point to existing papers", all(0 <= j < N for _, j in links))
    links = [(i, j) for i, j in links if 0 <= j < N]   # later checks use only valid links
    check("no paper cites itself", all(i != j for i, j in links))
    check("no duplicate citation links", all(len(p["r"]) == len(set(p["r"])) for p in P))
    check("link-source summary adds up", sum(D["refsrc"].values()) == len(links),
          f"{D['refsrc']} vs {len(links)}")
    # independent recomputation from the cached reference lists
    by = {}
    for i, p in enumerate(P):
        by[p["id"]] = i
        if p["bib"]:
            by[p["bib"]] = i
            for ident in (C["ads_refs"].get(p["bib"]) or {}).get("ids", []):
                by.setdefault(ident, i)
    s2_by_id = {}
    for e, s in zip(E, C["s2"]):
        uid = site_uid(e)   # same IDs as the build
        if s and uid in by:
            s2_by_id[by[uid]] = s
    pid = {s["paperId"]: i for i, s in s2_by_id.items() if s.get("paperId")}
    for i, s in s2_by_id.items():
        ext = s.get("externalIds") or {}
        if ext.get("ArXiv") in by:
            pid.setdefault(("ax", ext["ArXiv"]), by[ext["ArXiv"]])
    expect = set()
    for i, s in s2_by_id.items():
        for ref in s.get("references") or []:
            ext = ref.get("externalIds") or {}
            j = pid.get(ref.get("paperId"))
            j = j if j is not None else by.get(ext.get("ArXiv"))
            if j is not None and j != i:
                expect.add((i, j))
    for i, p in enumerate(P):
        for b in (C["ads_refs"].get(p["bib"]) or {}).get("refs", []) if p["bib"] else []:
            j = by.get(b)
            if j is not None and j != i:
                expect.add((i, j))
    got = set(links)
    check("citation links reproduce exactly from the raw reference lists", got == expect,
          f"{len(got)} links, {len(expect - got)} expected-but-missing, {len(got - expect)} unexplained")
    late = [(i, j) for i, j in links if P[j]["y"] > P[i]["y"] + 1]
    check("cited papers are not from a later year (allowing preprint updates)", len(late) <= 0.02 * len(links),
          f"{len(late)} of {len(links)} links cite a paper >1 year newer")
    own = {AU.index(D["proj"]["owner"])} if D["proj"].get("owner") in AU else set()   # a person's atlas: not counted
    check("the owner (if set) is an author of every paper", not D["proj"].get("owner") or (own and all(own <= set(p["au"]) for p in P)))
    nself = sum(1 for i, j in links if (set(P[i]["au"]) & set(P[j]["au"])) - own)
    check("self-citation share recomputed", 0 < nself < len(links), f"{nself} of {len(links)} links share an author")

    # ------------------------------------------------------------------ 5. authors and co-author network
    check("author names are unique", len(set(AU)) == len(AU))
    keys = Counter(norm_name(a) for a in AU)
    check("no two authors differ only by accents/punctuation", all(v == 1 for v in keys.values()),
          f"{[k for k, v in keys.items() if v > 1][:3]}")
    used = Counter(a for p in P for a in set(p["au"]))
    check("every author has at least one paper", len(used) == len(AU) and all(0 <= a < len(AU) for a in used))
    raw = {re.sub(r"\s+", " ", n) for i in ax for n in ax[i]["authors"] if norm_name(n)}   # the build drops names without letters
    lost = [n for n in raw if norm_name(n) not in {norm_name(a) for a in AU}
            and not any(norm_name(a).endswith(norm_name(n.split()[-1])) for a in AU)]
    check("every arXiv author name is represented", not lost, f"{lost[:3]}")
    pairs = {(min(a, b), max(a, b)) for p in P for a in p["au"] for b in p["au"] if a != b}
    check("co-author pairs recomputed", len(pairs) > len(AU), f"{len(pairs)} pairs")
    co = D["co"]["1"]
    # papers with more than coauthor_max authors add no co-author links; authors with only such papers have no position
    cmax = CFG.get("coauthor_max")
    owner_i = AU.index(CFG["owner"]) if CFG.get("owner") in AU else None
    PC = [{"au": p["au"] if cmax is None or len(p["au"]) <= cmax else p["au"][:cmax] + ([owner_i] if owner_i in p["au"][cmax:] else [])} for p in P]
    in_net = {a for p in PC for a in p["au"]}
    check("every author in the co-author network has a position (and only they)",
          all((isinstance(v, list) and len(v) == 3) == (a in in_net) for a, v in enumerate(co)),
          f"{len(in_net)} of {len(AU)} authors" + (f"; papers with > {cmax} authors: first {cmax} counted" if cmax else ""))
    check("coauthor_max reaches the page", D["proj"].get("coauthor_max") == cmax)
    # small isolated teams must be drawn together (their links near the intended length)
    cnt = Counter((min(a, b), max(a, b)) for p in PC for a in p["au"] for b in p["au"] if a < b)
    par = list(range(len(AU)))
    def root(x):
        while par[x] != x:
            par[x] = par[par[x]]; x = par[x]
        return x
    for a_, b_ in cnt:
        par[root(a_)] = root(b_)
    size = Counter(root(i) for i in in_net)
    for key in ("co", "co2d"):
        X = np.array([v or [np.nan] * (3 if key == "co" else 2) for v in D[key]["1"]], float)
        st = [np.linalg.norm(X[a_] - X[b_]) / (60 / math.sqrt(c)) for (a_, b_), c in cnt.items() if size[root(a_)] <= 5]
        check(f"small co-author teams drawn together ({key})", max(st, default=0) <= 2.0, f"longest link {max(st, default=0):.1f}x its intended length")

    # ------------------------------------------------------------------ 6. topics, overrides, tags
    check("every paper has a valid topic", all(0 <= p["k"] < len(TOP) for p in P))
    seed = {k: int(v) for k, v in CFG.get("topic_seed", {}).items()}
    check("topic names on the page = config",
          TOP == [t["name"] for t in CFG["topics"]] + ["Unassigned (new papers)"])
    check("project name and publications page on the page = config",
          D["proj"]["name"] == CFG["name"] and D["proj"]["pubs"] == CFG["pubs_url"])
    ovt = {}
    for key, v in OV.items():
        if key.startswith("_") or "topic" not in v:
            continue
        p = next((q for q in P if q["id"] == key or norm_title(q["t"]) == norm_title(key)), None)
        if p:
            ovt[p["id"]] = TOP.index(v["topic"])
    bad = [p["id"] for p in P if p["id"] in seed and p["id"] not in ovt and p["k"] != seed[p["id"]]]
    check("hand-checked topics are kept (TOPIC_SEED)", not bad, f"{len(seed)} seeded, {len(bad)} changed {bad[:3]}")
    ids = {p["id"] for p in P}
    check("ID overrides are applied", all(a in ids for a in alias.values()), f"{sorted(set(alias.values()) - ids)[:3]}")
    orphans = sorted(k for k in TAGS if k not in ids)
    if orphans:   # renamed or removed papers: the build log suggests the overrides.json line that keeps their tags
        WARNINGS.append(f"{len(orphans)} tags.json entr{'y' if len(orphans) == 1 else 'ies'} match no paper: {orphans[:3]}")
    check("topic overrides are applied", all(next(q for q in P if q["id"] == i)["k"] == k for i, k in ovt.items()),
          f"{len(ovt)} overrides")
    check("tag vocabulary on the page = config", D["tagaxes"] == CFG["tag_axes"])
    allowed = {ax_: set(v) for ax_, v in D["tagaxes"].items()}
    bad_tag = [(p["id"], t) for p in P if p["tg"] for ax_, s in (("suite", "s"), ("data", "d"), ("method", "m")) for t in p["tg"][s] if t not in allowed[ax_]]
    check("all tags are from the allowed vocabulary", not bad_tag, f"{bad_tag[:3]}")
    check("tags on the site match atlas_tags.json",
          all(p["tg"]["m"] == [t for t in TAGS[p["id"]]["method"] if t in allowed["method"]] for p in P if p["tg"] and p["id"] in TAGS))
    untagged = [p["t"][:50] for p in P if not p["tg"]]
    if untagged:   # new papers wait for tagging (see CLAUDE.md); that must not block publishing
        WARNINGS.append(f"{len(untagged)} paper(s) not tagged yet: {untagged[:3]}")

    # ------------------------------------------------------------------ 7. similar papers (recomputed from embeddings)
    emb = {}
    for e, s in zip(E, C["s2"]):
        uid = site_uid(e)   # same IDs as the build
        if s and s.get("embedding") and uid in by:
            v = np.array(s["embedding"]["vector"], float)
            emb[by[uid]] = v / np.linalg.norm(v)
    ok_sim, worst = 0, 0.0
    for i, p in enumerate(P):
        if p["sim"]["k"] != "e" or i not in emb:
            continue
        cand = [j for j in emb if j != i]
        sims = sorted(((float(emb[i] @ emb[j]), j) for j in cand), reverse=True)[:5]
        mine = [j for j, _ in p["sim"]["l"]]
        if mine == [j for _, j in sims]:
            ok_sim += 1
        worst = max(worst, max(abs(s - sc) for (s, _), (_, sc) in zip(sims, p["sim"]["l"])))
    n_e = sum(1 for p in P if p["sim"]["k"] == "e" and P.index(p) in emb)
    check("'most similar papers' lists recomputed from embeddings", ok_sim >= 0.98 * n_e and worst < 2e-3,
          f"{ok_sim}/{n_e} identical, largest score difference {worst:.4f}")
    check("similar-paper lists exclude the paper itself and are sorted",
          all(i not in [j for j, _ in p["sim"]["l"]] and [s for _, s in p["sim"]["l"]] == sorted([s for _, s in p["sim"]["l"]], reverse=True)
              for i, p in enumerate(P)))

    # ------------------------------------------------------------------ 8. stored layouts
    for key, n_exp in (("topics2d", N), ("topics3d_graph", N), ("citations", N), ("citations2d", N),
                       ("coauthors1", len(in_net)), ("coauthors1_2d", len(in_net))):
        v = POS.get(key, {})
        finite = all(all(math.isfinite(x) for x in xy) for xy in v.values())
        check(f"layout '{key}' complete and finite", len(v) == n_exp and finite, f"{len(v)} of {n_exp}")
    check("page positions = stored positions",
          all([round(p["x"], 4), round(p["yy"], 4)] == POS["topics2d"][p["id"]] for p in P))

    # ------------------------------------------------------------------ 9. "New" badges
    fs = POS.get("first_seen", {})
    fetched = date.fromisoformat(D["fetched"])
    on_site = {p["id"] for p in P}   # first_seen also keeps papers that left the site (or changed ID)
    exp_new = {u for u, s in fs.items() if u in on_site and s != "launch" and (fetched - date.fromisoformat(s)).days <= 30}
    check("'New' badges match first-seen dates", {p["id"] for p in P if p["nw"]} == exp_new, f"{len(exp_new)} new")

    # ------------------------------------------------------------------ 10. page-level facts
    ga = CFG.get("ga_id", "")
    check("Google Analytics tag present iff the config sets ga_id",
          (f"googletagmanager.com/gtag/js?id={ga}" in h) if ga else ("googletagmanager" not in h))
    check("link-preview image declared and present", f'og:image" content="{CFG["site_url"]}preview.png"' in h
          and os.path.exists(os.path.join(os.path.dirname(os.path.abspath(args.page)), "preview.png")))
    check("no claude.ai-only markup left", "claude:" not in h)

    # ------------------------------------------------------------------ 11. optional: compare with live sources
    if args.online:
        import requests
        page = requests.get(CFG["pubs_url"], timeout=60).text
        n_live = len(re.findall(r'<li><div class="line-block">', page))
        check("site covers the live publications page", N >= n_live - len(hidden) - 2,
              f"site {N}, live page {n_live} (a few new entries are fine until the next update)")
        tok = os.environ.get("ADS_TOKEN") or (open(os.path.expanduser("~/.ads/dev_key")).read().strip()
                                               if os.path.exists(os.path.expanduser("~/.ads/dev_key")) else "")
        if tok:
            sample = [p for p in sorted(P, key=lambda p: -p["c"])[:5] if p["bib"]]
            q = "bibcode:(" + " OR ".join(f'"{p["bib"]}"' for p in sample) + ")"
            r = requests.get("https://api.adsabs.harvard.edu/v1/search/query", timeout=60,
                             headers={"Authorization": f"Bearer {tok}"}, params={"q": q, "fl": "bibcode,citation_count"}).json()
            live = {d["bibcode"]: d.get("citation_count", 0) for d in r["response"]["docs"]}
            drift = [(p["c"], live.get(p["bib"])) for p in sample]
            check("top citation counts agree with live ADS (within 10%)",
                  all(l is not None and abs(l - c) <= max(3, 0.1 * l) for c, l in drift), f"site vs live: {drift}")



def report():
    width = max(len(n) for n, _, _ in RESULTS)
    for name, ok, detail in RESULTS:
        print(f"{'ok  ' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
    for w in WARNINGS:
        print(f"warn  {w}")
    failed = [n for n, ok, _ in RESULTS if not ok]
    if failed:
        sys.exit(f"\n{len(failed)} of {len(RESULTS)} checks FAILED")
    print(f"\nall {len(RESULTS)} checks passed")


if __name__ == "__main__":
    main()
