#!/usr/bin/env python3
"""QA's own rule-level diff of two built stylesheets (independent of the
Engineer's cssdiff.py). Walks braces, keeps the at-rule context of every
style rule, and prints the multiset difference as (context, selector, body)."""
import sys
from collections import Counter


def strip_comments(s):
    out, i = [], 0
    while i < len(s):
        if s.startswith('/*', i):
            j = s.find('*/', i + 2)
            i = len(s) if j < 0 else j + 2
        else:
            out.append(s[i])
            i += 1
    return ''.join(out)


def rules(css):
    css = strip_comments(css)
    res = []
    stack = []  # at-rule preludes
    buf = ''
    i = 0
    in_str = None
    while i < len(css):
        c = css[i]
        if in_str:
            buf += c
            if c == '\\':
                buf += css[i + 1]
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in '"\'':
            in_str = c
            buf += c
        elif c == '{':
            prelude = buf.strip()
            buf = ''
            if prelude.startswith('@') and not prelude.startswith('@font-face') and not prelude.startswith('@page'):
                stack.append(prelude)
            else:
                # read body to matching brace (style rule bodies may nest in native CSS nesting; treat flat)
                depth = 1
                j = i + 1
                while j < len(css) and depth:
                    if css[j] == '{':
                        depth += 1
                    elif css[j] == '}':
                        depth -= 1
                    j += 1
                body = css[i + 1:j - 1].strip()
                res.append((' > '.join(stack), prelude, body))
                i = j
                continue
        elif c == '}':
            if stack:
                stack.pop()
            buf = ''
        elif c == ';' and not stack and buf.strip().startswith('@'):
            res.append(('', buf.strip(), '(statement)'))
            buf = ''
        else:
            buf += c
        i += 1
    return res


def main(a, b):
    ra = Counter(rules(open(a, encoding='utf-8').read()))
    rb = Counter(rules(open(b, encoding='utf-8').read()))
    print(f'rules in A: {sum(ra.values())}, rules in B: {sum(rb.values())}')
    only_a = ra - rb
    only_b = rb - ra
    print(f'only in A (HEAD): {sum(only_a.values())}')
    for (ctx, sel, body), n in sorted(only_a.items()):
        print(f'  - [{ctx}] {sel} {{{body}}}' + (f' x{n}' if n > 1 else ''))
    print(f'only in B (worktree): {sum(only_b.values())}')
    for (ctx, sel, body), n in sorted(only_b.items()):
        print(f'  + [{ctx}] {sel} {{{body}}}' + (f' x{n}' if n > 1 else ''))
    # The utilities layer, compared on its own.
    ua = Counter(r for r in ra.elements() if 'layer utilities' in r[0])
    ub = Counter(r for r in rb.elements() if 'layer utilities' in r[0])
    print(f'utilities layer: A {sum(ua.values())} rules, B {sum(ub.values())} rules, identical: {ua == ub}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
