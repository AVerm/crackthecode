"""Build www/index.html, the whole game in one file, and www/404.html, from the sources in this folder.

Run: python3 src/build.py   (then node src/test.js)
The starter list is generated with a fixed seed, so the same sources always give the same page.
"""
import json, sys, random, re
from pathlib import Path
HERE = Path(__file__).resolve().parent; WWW = HERE.parent / "www"
sys.path.insert(0, str(HERE))
import generate_puzzles as G
src = lambda name: (HERE / name).read_text(encoding="utf-8")   # a source file's text
lib = json.loads(src("library.json")); tm = json.loads(src("tm_compat.json"))
cards = {c[0]: c for c in lib["cards"]}; preds = lib["predicates"]; byid = {p["id"]: p for p in preds}
counts = {p["id"]: len(p["options"]) for p in preds}; num2card = {n: c[0] for c in lib["cards"] for n in c[1]}
LIB = {"preds": [{"id": p["id"], "text": p["text"], "o": [[o[0], o[1]] + o[3:4] for o in p["options"]]} for p in preds], "cards": [[c[0], c[1], c[3]] for c in lib["cards"]]}
TM = {"criteria": {int(k): v for k, v in tm["criteria"].items()}, "numbers": {int(k): v for k, v in tm["numbers"].items()}}

# Turing Machine verification numbers ship as a computation, not a 380-entry table. On every TM verification card
# two numbers come from a rising sequence and two from a falling one, taken in pairs: the card with the k-th lowest
# rising pair has the k-th highest falling pair. Sorted together, the numbers alternate rising, falling, ... except
# at the two TM_BREAKS. So the page needs only which numbers are used (a bit each, in hex), the breaks, and our card
# for each TM card (two hex digits each). tm_unpack mirrors tmNumbers() in app.js; the build stops if the packed
# form does not give back tm_compat.json exactly.
TM_BREAKS = (282, 733)
def tm_rising(rank, n): return (rank % 2 == 0) != (n in TM_BREAKS)
def tm_pack(numbers):
    used = sorted(numbers); lo = used[0]
    up = [n for r, n in enumerate(used) if tm_rising(r, n)]
    down = sorted((n for r, n in enumerate(used) if not tm_rising(r, n)), reverse=True)
    assert len(up) == len(down) and len(up) % 2 == 0, "TM numbers: rising and falling sequences differ in length"
    cards = []
    for k in range(0, len(up), 2):
        c = numbers[up[k]]
        assert numbers[up[k + 1]] == numbers[down[k]] == numbers[down[k + 1]] == c, ("TM numbers break the pairing rule at", up[k])
        assert 0 < c < 256, c
        cards.append(c)
    bits = [0] * (used[-1] - lo + 1)
    for n in used: bits[n - lo] = 1
    bits += [0] * (-len(bits) % 4)
    hexbits = "".join(format(sum(bits[i + j] << j for j in range(4)), "x") for i in range(0, len(bits), 4))
    return {"from": lo, "used": hexbits, "breaks": list(TM_BREAKS), "cards": "".join(format(c, "02x") for c in cards)}
def tm_unpack(p):
    used = [p["from"] + i for i in range(len(p["used"]) * 4) if int(p["used"][i >> 2], 16) >> (i & 3) & 1]
    up = [n for r, n in enumerate(used) if (r % 2 == 0) != (n in p["breaks"])]
    down = [n for r, n in enumerate(used) if (r % 2 == 0) == (n in p["breaks"])][::-1]
    card = lambda r: int(p["cards"][(r >> 1) * 2:(r >> 1) * 2 + 2], 16)
    return {**{n: card(r) for r, n in enumerate(up)}, **{n: card(r) for r, n in enumerate(down)}}
TM_PACK = tm_pack(TM["numbers"])
assert tm_unpack(TM_PACK) == TM["numbers"], "packed TM numbers do not reproduce tm_compat.json"
ids = {p["id"] for p in preds}; rng = random.Random(2026)
# legacy pack: the 20 games printed in the Turing Machine manual, as (criteria card, verification number) pairs
TMGAMES = """4 447 9 646 11 566 14 322|3 564 7 355 10 635 14 720|4 677 9 217 13 634 17 528|3 662 8 790 15 404 16 509|2 413 6 532 14 596 17 537|2 437 7 405 10 378 13 797|8 356 12 695 15 329 17 618|3 631 5 252 9 219 15 349 16 374|1 357 7 610 10 463 12 399 17 393|2 224 6 543 8 793 12 757 15 687|5 445 10 639 11 289 15 406 17 484|4 335 9 362 18 421 20 747|11 279 16 515 19 770 21 523|2 585 13 228 17 647 20 268|5 763 14 598 18 223 19 317 20 520|2 778 7 654 12 614 16 640 19 751 22 485|21 341 31 432 37 706 39 495|23 681 28 244 41 440 48 737|19 237 24 353 30 204 31 423 38 606|11 287 22 533 30 389 33 486 34 547 40 615"""
TMBANK = []
for gi, g in enumerate(TMGAMES.split("|")):
    v = list(map(int, g.split())); pids, masks = [], []
    for crit, num in zip(v[0::2], v[1::2], strict=True):
        pid = TM["criteria"][crit]; card = TM["numbers"][num]; opts = byid[pid]["options"]
        j = [j for j, o in enumerate(opts) if o[1] == card]; assert len(j) == 1, ("TM game", gi + 1, crit, num)
        pids.append(pid); masks.append(1 << j[0])
    TMBANK.append(G.game_code(counts, pids, masks))
# starter puzzles: a few for each of the eight mode combinations, the all-modes-on ones first
BANK = []
for multi in (False, True):
    for overlap in (False, True):
        for lo, hi in ((1, 1), (2, 4)):
            for k in ((4, 4, 5, 5, 6, 6) if not multi and not overlap and hi == 1 else (4, 5, 6)):   # six for the default, all-modes-on setting
                while True:
                    pz = G.generate(lib, k, ids, lo, hi, hi > 1, 6, rng, False, multi)
                    if pz["game"] not in BANK and pz["game"] not in TMBANK and pz["overlap"] == overlap: BANK.append(pz["game"]); break
data = "const LIB=" + json.dumps(LIB, ensure_ascii=False, separators=(",", ":")) + ";\nconst TM=" + json.dumps({"criteria": TM["criteria"], "pack": TM_PACK}, separators=(",", ":")) + ";\nconst BANK=" + json.dumps(BANK, separators=(",", ":")) + ",TMBANK=" + json.dumps(TMBANK, separators=(",", ":")) + ";\n"
assert "</" not in data
t = src("template.html"); css = src("style.css"); js = src("app.js")
t = re.sub(r"<style>.*?</style>", lambda m: "<style>\n" + css + "</style>", t, flags=re.S)
# BUILD names this release: it changes whenever anything that goes into the page or the worker changes
import hashlib
sw = src("sw.js")
BUILD = hashlib.sha256((data + css + js + t + sw).encode("utf-8")).hexdigest()[:8]
data += 'const BUILD = "' + BUILD + '";\n'
t = re.sub(r"<script>.*?</script>", lambda m: "<script>\n" + data + js + "</script>", t, flags=re.S)
out = Path(sys.argv[1]) if len(sys.argv) > 1 else WWW / "index.html"
out.write_text(t, encoding="utf-8", newline="\n")
# the not-found page Pages shows for any missing address: same styles and theme, links back to the game
key = re.search(r"const KEY = '([^']+)'", js).group(1)
nf = src("404.html").replace("/*CSS*/", css).replace("/*KEY*/", repr(key))
if len(sys.argv) <= 1:
    (WWW / "404.html").write_text(nf, encoding="utf-8", newline="\n")
    (WWW / "sw.js").write_text(sw.replace("/*BUILD*/", BUILD), encoding="utf-8", newline="\n")
print("build", BUILD, ";", len(BANK), "starter +", len(TMBANK), "manual puzzles;", len(t), "bytes; data", len(data), "; css", len(css), "; js", len(js), "; list strings", sum(len(b) for b in BANK + TMBANK), "chars")
