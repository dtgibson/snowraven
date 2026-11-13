import json, sys
b = json.load(open(sys.argv[1])); a = json.load(open(sys.argv[2]))
B, A = b['configs'], a['configs']
assert set(B) == set(A), 'different configuration sets'
clean = [k for k in B if B[k]['over'] <= 0.5]
over = [k for k in B if B[k]['over'] > 0.5]
same, diff = [], []
for k in clean:
    (same if B[k] == A[k] else diff).append(k)
rows = sum(len(B[k]['rows']) for k in clean)
print(f"configurations: {len(B)} ({sum(1 for k in B if ' window ' in k)} window, {sum(1 for k in B if ' phone ' in k)} phone)")
print(f"no name overhang before: {len(clean)} configurations, {rows} life-list rows; identical after (every row height, cell, name box, name line boxes and mark boxes to 0.01px, and the list height): {len(same)}; differing: {len(diff)}")
for k in diff[:10]:
    for i, (rb, ra) in enumerate(zip(B[k]['rows'], A[k]['rows'])):
        if rb != ra: print('  DIFF', k, i, rb['name'], {f: (rb[f], ra[f]) for f in rb if rb[f] != ra[f]}); break
    else: print('  DIFF', k, 'listH', B[k]['listH'], A[k]['listH'])
print(f"name overhang before: {len(over)} configurations")
for k in sorted(over, key=lambda k: -B[k]['over']):
    print(f"  {k}: before {B[k]['over']}px, after {A[k]['over']}px")
print('requests:', {x: (b[x], a[x]) for x in ('ebirdBacked', 'otherEbird', 'refusedHosts')})
mx = max(A[k]['over'] for k in A)
print(f"worst name overhang after, every configuration: {mx}px")
