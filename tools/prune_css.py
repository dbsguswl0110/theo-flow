#!/usr/bin/env python3
"""Drop CSS rules whose selectors only target the given (now rewritten) classes.

Usage: python3 tools/prune_css.py FILE PATTERN
PATTERN is a regex; a selector is dead when it matches. A rule with a mix of live and dead selectors keeps
the live ones. Nested at-rules (@media) are pruned recursively and removed when they end up empty.
"""
import re
import sys


def split_top(text, sep):
    parts, depth, cur = [], 0, ""
    for ch in text:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return parts


def blocks(css):
    """Yield (prelude, body-or-None, raw) for each top-level statement."""
    i, n = 0, len(css)
    while i < n:
        if css[i].isspace():
            i += 1
            continue
        if css.startswith("/*", i):
            end = css.index("*/", i) + 2
            yield "", None, css[i:end]  # comments are kept as they are, never mistaken for selectors
            i = end
            continue
        j = i
        while j < n and css[j] not in "{;":
            j += 1
        if j >= n:
            yield css[i:], None, css[i:]
            return
        if css[j] == ";":
            yield css[i:j], None, css[i:j + 1]
            i = j + 1
            continue
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        yield css[i:j], css[j + 1:k - 1], css[i:k]
        i = k


def prune(css, dead, stats):
    out = []
    for prelude, body, raw in blocks(css):
        head = prelude.strip()
        if body is None or head.startswith("@font-face") or head.startswith("@keyframes"):
            out.append(raw)
        elif head.startswith("@"):
            inner = prune(body, dead, stats).strip()
            if inner:
                out.append(f"{prelude.rstrip()} {{\n{inner}\n}}\n")
            else:
                stats["rules"] += 1
        else:
            selectors = [s.strip() for s in split_top(head, ",") if s.strip()]
            keep = [s for s in selectors if not dead.search(s)]
            if len(keep) == len(selectors):
                out.append(raw)
            else:
                stats["rules"] += 1
                if keep:
                    out.append(f"{', '.join(keep)} {{{body}}}\n")
    return "\n".join(x.strip("\n") for x in out if x.strip())


if __name__ == "__main__":
    path, pattern = sys.argv[1], sys.argv[2]
    css = open(path, encoding="utf-8").read()
    stats = {"rules": 0}
    result = prune(css, re.compile(pattern), stats)
    open(path, "w", encoding="utf-8").write(result + "\n")
    print(f"{path}: removed {stats['rules']} rules, {len(css)} -> {len(result)} bytes")
