"""Tests for the LaTeX converter and the link check of the page (atlas.js), run with Node on the real code."""
import json
import os
import shutil
import subprocess

import pytest

from conftest import ROOT

NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(not NODE, reason="Node.js is not installed")

# the LaTeX helpers sit between these two markers in atlas.js; they need nothing else from the page
START, END = "const TEX_SYM", "P.forEach((p, i) => { p.i = i; p.tRaw"


def run_js(expr_by_case):
    src = open(os.path.join(ROOT, "atlas.js"), encoding="utf-8").read()
    i, j = src.index(START), src.index(END)
    k = src.index("const safeUrl")
    safe = src[k:src.index("\n", k)]
    script = src[i:j] + "\n" + safe + "\n" + \
        f"const cases = {json.dumps(expr_by_case)};\n" + \
        "console.log(JSON.stringify(cases.map(([fn, arg]) => (fn === 'tex' ? tex : safeUrl)(arg))));"
    out = subprocess.run([NODE, "-e", script], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


TEX = [
    # titles that used to be mangled
    (r"$\texttt{GENGARS}$: Accurate non-Gaussian initial conditions", "GENGARS: Accurate non-Gaussian initial conditions"),
    (r"${\rm S{\scriptsize IM}BIG}$: Mock Challenge", "SIMBIG: Mock Challenge"),
    (r"{\sc SimBIG}: Cosmological Constraints", "SimBIG: Cosmological Constraints"),
    (r"Breaking the $f_{\text{NL}}$--$b_φ$ degeneracy", "Breaking the fNL–bφ degeneracy"),
    # symbols, sub- and superscripts
    (r"predict $Ω_{\rm m}$ from halo catalogues", "predict Ωₘ from halo catalogues"),
    (r"optical depth and $σ_8$", "optical depth and σ₈"),
    (r"$k\sim~1~{\rm Mpc}^{-1}~h$", "k∼ 1 Mpc⁻¹ h"),
    (r"a factor of $\sim$5", "a factor of ∼5"),
    (r"to $\lesssim10\%$ at all radii", "to ≲10% at all radii"),
    (r"$1.2\times 10^6$ predictions", "1.2× 10⁶ predictions"),
    (r"in $\mathcal{O}(N^2)$ Time", "in O(N²) Time"),
    (r"$M_{\rm vir} \in [10^{11}, 10^{14.5}] M_{\odot}/h$", "Mᵥᵢᵣ ∈ [10¹¹, 10^14.5] M⊙/h"),
    (r"parameters $\{Ω_{\rm m}, σ_8\}$", "parameters {Ωₘ, σ₈}"),     # escaped braces are kept as set braces
    (r"inline \(\Omega_m\) math", "inline Ωₘ math"),
    # plain text is left alone
    ("Pair Counting without Binning", "Pair Counting without Binning"),
    ("syren_new: emulators", "syren_new: emulators"),               # _ outside math is not a subscript
    ("", ""),
]


def test_tex():
    got = run_js([["tex", s] for s, _ in TEX])
    for (src, want), out in zip(TEX, got):
        assert out == want, f"{src!r} -> {out!r}, expected {want!r}"


def test_safe_url():
    cases = ["https://arxiv.org/abs/1", "HTTP://x.org", "javascript:alert(1)", " javascript:x", "data:text/html,x", "", None, "/relative"]
    assert run_js([["safeUrl", c] for c in cases]) == ["https://arxiv.org/abs/1", "HTTP://x.org", "", "", "", "", "", ""]


def run_keep_on_screen(cases):
    src = open(os.path.join(ROOT, "atlas.js"), encoding="utf-8").read()
    k = src.index("const keepOnScreen")
    script = src[k:src.index("\n", k)] + "\n" + \
        f"console.log(JSON.stringify({json.dumps(cases)}.map(([x, w, W]) => keepOnScreen(x, w, W))));"
    return json.loads(subprocess.run([NODE, "-e", script], capture_output=True, text=True, check=True).stdout)


def test_topic_label_kept_on_screen():
    # a 300px-wide name centred 40px from the left of a 660px map (e.g. the atlas embedded in the docs) used to
    # be cut off: it must be moved so it starts inside the canvas; likewise at the right edge
    W = 660
    left, right, middle, panned = run_keep_on_screen([[40, 300, W], [640, 300, W], [330, 300, W], [-50, 300, W]])
    assert left - 150 >= 0 and right + 150 <= W
    assert middle == 330          # names that already fit are not moved
    assert panned == -50          # an island panned off screen keeps its place
