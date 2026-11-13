import json, sys
runs = {n: json.load(open(p))['configs'] for n, p in (('b1', sys.argv[1]), ('b2', sys.argv[2]), ('a1', sys.argv[3]), ('a2', sys.argv[4]))}
keys = runs['b1'].keys()
clean = [k for k in keys if runs['b1'][k]['over'] <= 0.5]
def sizes(fp):
    # Everything a position on the page cannot move: row heights and widths,
    # every box's width and height, the name's line count, the list height.
    return (fp['listH'], [(r['h'], r['w'], r['cell'][2:], r['box'][2:], r['link'][2:], len(r['lines']), [l[2:] for l in r['lines']], [m[2:] for m in r['marks']]) for r in fp['rows']])
size_diff = [k for k in clean if len({json.dumps(sizes(runs[n][k])) for n in runs}) > 1]
# A shift the rule caused is one both after runs agree on, both before runs
# agree on, and that differs between the pair.
consistent = [k for k in clean if runs['b1'][k] == runs['b2'][k] and runs['a1'][k] == runs['a2'][k] and runs['b1'][k] != runs['a1'][k]]
noise = {f'{x} vs {y}': sum(1 for k in clean if runs[x][k] != runs[y][k]) for x, y in (('b1', 'b2'), ('a1', 'a2'), ('b1', 'a1'), ('b2', 'a2'))}
def maxdelta(x, y):
    m = 0
    for k in clean:
        for rb, ra in zip(runs[x][k]['rows'], runs[y][k]['rows']):
            for f in ('cell', 'box', 'link'):
                m = max(m, max(abs(p - q) for p, q in zip(rb[f], ra[f])))
            for lb, la in zip(rb['lines'] + rb['marks'], ra['lines'] + ra['marks']):
                m = max(m, max(abs(p - q) for p, q in zip(lb, la)))
    return round(m, 3)
eng = {e: sum(1 for k in clean if k.startswith(e) and any(runs[x][k] != runs[y][k] for x, y in (('b1','b2'),('a1','a2'),('b1','a1')))) for e in ('chromium', 'webkit')}
print(f'configurations with no overhang before: {len(clean)} ({sum(len(runs["b1"][k]["rows"]) for k in clean)} rows)')
print('sizes (row heights and widths, every box width and height, line counts, list height) differing across the four runs:', len(size_diff))
print('configurations differing, per pair of runs:', noise)
print('largest position difference, same build twice (pre-fix):', maxdelta('b1', 'b2'), 'px; (fixed):', maxdelta('a1', 'a2'), 'px; pre-fix against fixed:', maxdelta('b1', 'a1'), 'px')
print('configurations with any difference in any pair, by engine:', eng)
print('consistent shifts (both before runs agree, both after runs agree, the pairs differ):', len(consistent), consistent[:5])
