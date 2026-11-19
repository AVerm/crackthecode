"""Build www/index.html, the whole game in one file, and www/404.html, from the sources in this folder.

Run: python3 src/build.py   (then node src/test.js)
The starter list is generated with a fixed seed, so the same sources always give the same page.
"""
import json, sys, random, re
from pathlib import Path
HERE = Path(__file__).resolve().parent; WWW = HERE.parent / "www"
sys.path.insert(0, str(HERE))
import generate_puzzles as G
lib = json.load(open(HERE / "library.json", encoding="utf-8")); tm = json.load(open(HERE / "tm_compat.json", encoding="utf-8"))
cards = {c[0]: c for c in lib["cards"]}; preds = lib["predicates"]; byid = {p["id"]: p for p in preds}
counts = {p["id"]: len(p["options"]) for p in preds}; num2card = {n: c[0] for c in lib["cards"] for n in c[1]}
LIB = {"preds": [{"id": p["id"], "text": p["text"], "o": [[o[0], o[1]] for o in p["options"]]} for p in preds], "cards": [[c[0], c[1], c[3]] for c in lib["cards"]]}
TM = {"criteria": {int(k): v for k, v in tm["criteria"].items()}, "numbers": {int(k): v for k, v in tm["numbers"].items()}}
ids = {p["id"] for p in preds}; rng = random.Random(2026)
# legacy pack: the 20 games printed in the Turing Machine manual, as (criteria card, verification number) pairs
TMGAMES = """4 447 9 646 11 566 14 322|3 564 7 355 10 635 14 720|4 677 9 217 13 634 17 528|3 662 8 790 15 404 16 509|2 413 6 532 14 596 17 537|2 437 7 405 10 378 13 797|8 356 12 695 15 329 17 618|3 631 5 252 9 219 15 349 16 374|1 357 7 610 10 463 12 399 17 393|2 224 6 543 8 793 12 757 15 687|5 445 10 639 11 289 15 406 17 484|4 335 9 362 18 421 20 747|11 279 16 515 19 770 21 523|2 585 13 228 17 647 20 268|5 763 14 598 18 223 19 317 20 520|2 778 7 654 12 614 16 640 19 751 22 485|21 341 31 432 37 706 39 495|23 681 28 244 41 440 48 737|19 237 24 353 30 204 31 423 38 606|11 287 22 533 30 389 33 486 34 547 40 615"""
TMBANK = []
for gi, g in enumerate(TMGAMES.split("|")):
    v = list(map(int, g.split())); pids, masks = [], []
    for crit, num in zip(v[0::2], v[1::2]):
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
data = "const LIB=" + json.dumps(LIB, ensure_ascii=False, separators=(",", ":")) + ";\nconst TM=" + json.dumps(TM, separators=(",", ":")) + ";\nconst BANK=" + json.dumps(BANK, separators=(",", ":")) + ",TMBANK=" + json.dumps(TMBANK, separators=(",", ":")) + ";\n"
assert "</" not in data
t = open(HERE / "template.html", encoding="utf-8").read(); css = open(HERE / "style.css", encoding="utf-8").read(); js = open(HERE / "app.js", encoding="utf-8").read()
t = re.sub(r"<style>.*?</style>", lambda m: "<style>\n" + css + "</style>", t, flags=re.S)
t = re.sub(r"<script>.*?</script>", lambda m: "<script>\n" + data + js + "</script>", t, flags=re.S)
out = Path(sys.argv[1]) if len(sys.argv) > 1 else WWW / "index.html"
open(out, "w", encoding="utf-8", newline="\n").write(t)
# the not-found page Pages shows for any missing address: same styles and theme, links back to the game
key = re.search(r"const KEY = '([^']+)'", js).group(1)
nf = open(HERE / "404.html", encoding="utf-8").read().replace("/*CSS*/", css).replace("/*KEY*/", repr(key))
if len(sys.argv) <= 1: open(WWW / "404.html", "w", encoding="utf-8", newline="\n").write(nf)
print(len(BANK), "starter +", len(TMBANK), "manual puzzles;", len(t), "bytes; data", len(data), "; css", len(css), "; js", len(js), "; list strings", sum(len(b) for b in BANK + TMBANK), "chars")
