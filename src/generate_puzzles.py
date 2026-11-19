#!/usr/bin/env python3
"""Generate puzzles for Crack the Code! from library.json.

Each puzzle is printed as a game code (paste it into the game's setup screen)
plus the predicate and checker numbers it stands for. By default a puzzle has
exactly one solution, one active option per predicate, and no predicate that
could be dropped. Solutions are hidden unless you pass --reveal.

Examples:
  python3 generate_puzzles.py                        # five 5-predicate puzzles
  python3 generate_puzzles.py -n 10 -k 6 --seed 42   # repeatable
  python3 generate_puzzles.py --pool new             # only predicates beyond the classic 48
  python3 generate_puzzles.py --solutions 2-4        # several solutions
  python3 generate_puzzles.py --answer-overlap no    # the answer fits exactly one option on every predicate
  python3 generate_puzzles.py --multi-active         # some predicates have two active options
  python3 generate_puzzles.py --one-code             # every puzzle has an option like "three 3s"
  python3 generate_puzzles.py --codes-only           # just the game codes, one per line
"""
import argparse, json, random, sys
from pathlib import Path

CLASSIC = {101, 103, 108, 109, 116, 117, 118, 122, 124, 125, 127, 128, 132, 133, 134, 141, 144, 146, 148,
           154, 155, 156, 157, 158, 159, 160, 161, 162, 168, 169, 170, 172, 173, 175, 176, 177, 179, 180,
           181, 182, 183, 184, 186, 187, 188, 192, 193, 194}   # predicates that mirror the older game's 48 cards
CODES = [f"{x}{y}{z}" for x in range(1, 6) for y in range(1, 6) for z in range(1, 6)]
FULL = (1 << 125) - 1
A32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
CODE_VERSION, NPRED_V1, PID0 = "1", 95, 101


def game_code(option_counts, pids, masks, dashes=True):
    """The reversible game code. option_counts maps predicate id -> number of options;
    masks holds, per predicate, a bit mask of its active options (bit 0 = first option)."""
    v, mult = 0, 1
    def push(d, radix):
        nonlocal v, mult
        v += d * mult; mult *= radix
    push(len(pids) - 1, 8)
    for pid, m in zip(pids, masks):
        push(pid - PID0, NPRED_V1); push(m - 1, (1 << option_counts[pid]) - 1)
    digits = []
    while True:
        digits.insert(0, v % 32); v //= 32
        if v == 0: break
    chk = 7
    for i, d in enumerate(digits): chk = (chk + (2 * i + 1) * d) % 32
    s = CODE_VERSION + "".join(A32[(d + (i + 1) * (2 * chk + 1) + 13) % 32] for i, d in enumerate(digits)) + A32[(chk * 5 + 9) % 32]
    return "-".join(s[i:i + 4] for i in range(0, len(s), 4)) if dashes else s


def solutions_of(mask):
    return [CODES[i] for i in range(125) if mask >> (124 - i) & 1]


def generate(lib, k, pool, lo, hi, allow_redundant, max_options, rng, one_code=False, multi_active=False, tries=400000):
    cards = {c[0]: c for c in lib["cards"]}
    tmask = {cid: int(c[3], 2) for cid, c in cards.items()}
    counts = {p["id"]: len(p["options"]) for p in lib["predicates"]}
    preds = [p for p in lib["predicates"] if p["id"] in pool and len(p["options"]) <= max_options]
    if len(preds) < k:
        sys.exit("Not enough predicates in that pool for a puzzle of this size.")
    for _ in range(tries):
        pick = sorted(rng.sample(preds, k), key=lambda p: p["id"])
        active = [[rng.randrange(len(p["options"]))] for p in pick]            # option indexes per predicate
        if multi_active:
            wide = [i for i, p in enumerate(pick) if len(p["options"]) >= 3]
            if not wide: continue
            for i in rng.sample(wide, rng.randint(1, min(2, len(wide)))):
                active[i] = sorted(rng.sample(range(len(pick[i]["options"])), 2))
        single = any(len(a) == 1 and bin(tmask[p["options"][a[0]][1]]).count("1") == 1 for p, a in zip(pick, active))
        if one_code:
            holders = [(i, j) for i, p in enumerate(pick) for j, o in enumerate(p["options"]) if bin(tmask[o[1]]).count("1") == 1]
            if not holders: continue
            hi_, hj = rng.choice(holders); target = tmask[pick[hi_]["options"][hj][1]]
            ok = True
            for i, p in enumerate(pick):
                if i == hi_: active[i] = [hj]; continue
                fits = [j for j, o in enumerate(p["options"]) if tmask[o[1]] & target]
                if not fits: ok = False; break
                active[i] = [rng.choice(fits)]
            if not ok: continue
            single = True
        pm = []
        for p, a in zip(pick, active):
            m = 0
            for j in a: m |= tmask[p["options"][j][1]]
            pm.append(m)
        if len(set(pm)) < k or any(m == FULL for m in pm):
            continue
        sol = FULL
        for m in pm: sol &= m
        n = bin(sol).count("1")
        if not lo <= n <= hi:
            continue
        if not allow_redundant and not single:
            def without(j):
                rest = FULL
                for i, m in enumerate(pm):
                    if i != j: rest &= m
                return rest
            if any(without(j) == sol for j in range(k)):
                continue
        pids = [p["id"] for p in pick]; masks = [sum(1 << j for j in a) for a in active]
        return {"game": game_code(counts, pids, masks),
                "predicates": pids,
                "checkers": [[rng.choice(cards[p["options"][j][1]][1]) for j in a] for p, a in zip(pick, active)],
                "texts": [p["text"] for p in pick],
                "active": [" OR ".join(p["options"][j][0] for j in a) for p, a in zip(pick, active)],
                "solutions": solutions_of(sol),
                "multi_active": any(len(a) > 1 for a in active),
                "overlap": any(sum(tmask[o[1]] >> (124 - i) & 1 for o in p["options"]) > 1 for i in range(125) if sol >> (124 - i) & 1 for p in pick)}
    sys.exit("No puzzle found with those settings. Try fewer predicates or a wider --solutions range.")


def main():
    ap = argparse.ArgumentParser(description="Generate puzzles for Crack the Code!")
    ap.add_argument("-n", "--count", type=int, default=5, help="how many puzzles (default 5)")
    ap.add_argument("-k", "--predicates", type=int, default=5, help="predicates per puzzle, 2 to 8 (default 5)")
    ap.add_argument("--pool", choices=["all", "new", "classic"], default="all", help="which predicates to draw from")
    ap.add_argument("--solutions", default="1", help="number of solutions, e.g. 1 or 2-4 (default 1)")
    ap.add_argument("--answer-overlap", choices=["any", "no", "yes"], default="any",
                    help="whether the answer may fit more than one listed option on some predicate (default any)")
    ap.add_argument("--multi-active", action="store_true", help="one or two predicates get two active options")
    ap.add_argument("--one-code", action="store_true", help='every puzzle includes an option only one code satisfies, such as "three 3s"')
    ap.add_argument("--allow-redundant", action="store_true", help="allow predicates that add nothing")
    ap.add_argument("--max-options", type=int, default=6, help="skip predicates with more options than this (default 6)")
    ap.add_argument("--seed", type=int, help="make the output repeatable")
    ap.add_argument("--reveal", action="store_true", help="also print the active options and the solution")
    ap.add_argument("--json", action="store_true", help="print JSON instead of text")
    ap.add_argument("--codes-only", action="store_true", help="print only the game codes")
    ap.add_argument("--library", default=str(Path(__file__).with_name("library.json")), help="path to library.json")
    a = ap.parse_args()
    if not 2 <= a.predicates <= 8:
        sys.exit("--predicates must be between 2 and 8.")
    lo, _, hi = a.solutions.partition("-")
    lo, hi = int(lo), int(hi or lo)
    if lo < 1 or hi < lo:
        sys.exit("--solutions must be a number or a range such as 2-4, starting at 1 or more.")
    try:
        lib = json.loads(Path(a.library).read_text(encoding="utf-8"))
    except OSError:
        sys.exit(f"Cannot read {a.library}. Put library.json next to this script or pass --library.")
    ids = {p["id"] for p in lib["predicates"]}
    pool = ids if a.pool == "all" else ids & CLASSIC if a.pool == "classic" else ids - CLASSIC
    rng = random.Random(a.seed)
    seen, out = set(), []
    while len(out) < a.count:
        pz = generate(lib, a.predicates, pool, lo, hi, a.allow_redundant or hi > 1, a.max_options, rng, a.one_code, a.multi_active)
        if pz["game"] in seen or (a.answer_overlap != "any" and pz["overlap"] != (a.answer_overlap == "yes")):
            continue
        seen.add(pz["game"]); out.append(pz)
    if a.codes_only:
        print("\n".join(p["game"] for p in out)); return
    if a.json:
        keep = ("game", "predicates", "checkers", "multi_active", "overlap") + (("active", "solutions") if a.reveal else ())
        print(json.dumps([{k: p[k] for k in keep} for p in out], ensure_ascii=False, indent=1)); return
    for p in out:
        print(f"Game {p['game']}")
        print("  Solutions   " + ("one" if len(p["solutions"]) == 1 else "more than one"))
        print("  Active      " + ("two options on some predicate" if p["multi_active"] else "one option per predicate"))
        print("  Answer fits " + ("more than one listed option on at least one predicate" if p["overlap"] else "exactly one listed option on every predicate"))
        for i, (pid, chk, text) in enumerate(zip(p["predicates"], p["checkers"], p["texts"])):
            print(f"    {'PQRSTUVW'[i]}  {pid}  {' '.join(map(str, chk)):<10} {text}" + (f"   ->  {p['active'][i]}" if a.reveal else ""))
        if a.reveal:
            print("  Solution    " + ", ".join(p["solutions"]))
        print()


if __name__ == "__main__":
    main()
