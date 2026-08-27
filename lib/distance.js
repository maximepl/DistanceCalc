// Distance logic ported directly from the VoidTrek / Astro Empires calc_distance() source.
// Coord format: Gxx:rr:ss:aa  e.g. "B39:56:17:40"
//   char 0-2  galaxy  (letter + two digits)   -> gal0, gal1, gal2
//   char 4-5  region                          -> reg0, reg1
//   char 7-8  system                          -> sys0, sys1
//   char 10-11 asteroid                        -> ast0, ast1

export function parseCoord(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  // Accept "B39:56:17:40" with exactly this shape.
  const m = s.match(/^([A-Za-z])(\d)(\d):(\d)(\d):(\d)(\d):(\d)(\d)$/);
  if (!m) return null;
  return {
    raw: s,
    gal0: m[1],
    gal1: Number(m[2]),
    gal2: Number(m[3]),
    reg0: Number(m[4]),
    reg1: Number(m[5]),
    sys0: Number(m[6]),
    sys1: Number(m[7]),
    ast0: Number(m[8]),
    ast1: Number(m[9]),
  };
}

// Returns the distance between two parsed coords, matching calc_distance().
// ae_serie changes the cross-galaxy math; same-galaxy distances are identical
// regardless of ae_serie, so it only matters when galaxies differ.
export function distance(a, b, aeSerie = 5) {
  const s_sys_x = a.reg1 * 10 + a.sys1;
  const s_sys_y = a.reg0 * 10 + a.sys0;
  const t_sys_x = b.reg1 * 10 + b.sys1;
  const t_sys_y = b.reg0 * 10 + b.sys0;

  const var_gal = Math.abs((a.gal1 - b.gal1) * 19 + a.gal2 - b.gal2);
  const var_sys = Math.ceil(
    Math.sqrt(Math.pow(t_sys_x - s_sys_x, 2) + Math.pow(t_sys_y - s_sys_y, 2))
  );
  const var_ast0 = Math.abs(b.ast0 - a.ast0);

  // Cross-galaxy only applies when both are in the same galaxy letter.
  // (The game treats galaxy as the letter+digits; if letters differ the
  // numeric var_gal below still drives it, matching the original code.)
  if (var_gal) {
    if (aeSerie >= 5) {
      if (b.gal1 === a.gal1) return var_gal * 200;
      return Math.min(
        a.gal2 * 200 + 1000 + b.gal2 * 200,
        (9 - a.gal2) * 200 + 1000 + (9 - b.gal2) * 200
      );
    } else {
      if (b.gal1 === a.gal1) return var_gal * 200;
      if (b.gal1 > a.gal1) return (9 - a.gal2) * 200 + 2000 + b.gal2 * 200;
      return a.gal2 * 200 + 2000 + (9 - b.gal2) * 200;
    }
  }

  if (var_sys) return var_sys;
  if (var_ast0) return var_ast0 / 5;
  return 0.1;
}

// Split a big textarea blob into candidate lines, keeping any label the user
// pasted alongside the coord. Returns [{ label, coordRaw, coord }].
export function parseLines(blob) {
  const out = [];
  const lines = (blob || "").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    // Find the coord token anywhere in the line.
    const cm = t.match(/[A-Za-z]\d\d:\d\d:\d\d:\d\d/);
    if (!cm) {
      out.push({ label: t, coordRaw: null, coord: null, invalid: true });
      continue;
    }
    const coordRaw = cm[0];
    const coord = parseCoord(coordRaw);
    // Everything that isn't the coord becomes the label (trim separators).
    let label = t.replace(coordRaw, "").replace(/\s{2,}/g, " ").trim();
    label = label.replace(/[\t|,;–—-]+\s*$/, "").replace(/^\s*[\t|,;–—-]+/, "").trim();
    out.push({ label: label || null, coordRaw, coord, invalid: !coord });
  }
  return out;
}

// Minimum-weight perfect (or near-perfect) matching.
// Returns { pairs: [{a, b, dist}], leftover: entry|null, total, average }.
// entries: [{ label, coordRaw, coord }] (already parsed, valid only).
// Uses exact DP over bitmask for n <= 18, greedy-improve fallback above that.
export function bestMatching(entries, aeSerie = 5) {
  const n = entries.length;
  if (n < 2) return { pairs: [], leftover: entries[0] || null, total: 0, average: 0 };

  const d = (i, j) => distance(entries[i].coord, entries[j].coord, aeSerie);

  if (n <= 18) {
    const result = exactMatch(n, d);
    return finalize(result, entries, d);
  }
  const result = greedyMatch(n, d);
  return finalize(result, entries, d);
}

function finalize(idxResult, entries, d) {
  const pairs = idxResult.pairs.map(([i, j]) => ({
    a: entries[i],
    b: entries[j],
    dist: d(i, j),
  }));
  pairs.sort((x, y) => x.dist - y.dist);
  const total = pairs.reduce((s, p) => s + p.dist, 0);
  const leftover =
    idxResult.leftover != null ? entries[idxResult.leftover] : null;
  return {
    pairs,
    leftover,
    total,
    average: pairs.length ? total / pairs.length : 0,
  };
}

// Exact min-weight matching via bitmask DP. If n is odd, tries leaving each
// vertex out and keeps the best.
function exactMatch(n, d) {
  const full = (1 << n) - 1;
  const memo = new Map();

  function solve(mask) {
    if (mask === full) return { cost: 0, pairs: [] };
    if (memo.has(mask)) return memo.get(mask);
    let i = 0;
    while (mask & (1 << i)) i++;
    let best = null;
    for (let j = i + 1; j < n; j++) {
      if (mask & (1 << j)) continue;
      const sub = solve(mask | (1 << i) | (1 << j));
      const cost = d(i, j) + sub.cost;
      if (!best || cost < best.cost) {
        best = { cost, pairs: [[i, j], ...sub.pairs] };
      }
    }
    memo.set(mask, best);
    return best;
  }

  if (n % 2 === 0) {
    const r = solve(0);
    return { pairs: r.pairs, leftover: null };
  }

  // Odd: leave one out, pick the cheapest total.
  let best = null;
  for (let out = 0; out < n; out++) {
    memo.clear();
    const startMask = 1 << out;
    const r = solve(startMask);
    if (!best || r.cost < best.cost) {
      best = { cost: r.cost, pairs: r.pairs, leftover: out };
    }
  }
  return { pairs: best.pairs, leftover: best.leftover };
}

// Greedy nearest-pair + local 2-opt improvement for large n.
function greedyMatch(n, d) {
  const used = new Array(n).fill(false);
  const pairs = [];
  const edges = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) edges.push([i, j, d(i, j)]);
  edges.sort((a, b) => a[2] - b[2]);
  for (const [i, j] of edges) {
    if (used[i] || used[j]) continue;
    used[i] = used[j] = true;
    pairs.push([i, j]);
  }
  let leftover = null;
  for (let i = 0; i < n; i++) if (!used[i]) leftover = i;

  // 2-opt: try swapping partners between pairs to reduce total.
  let improved = true;
  while (improved) {
    improved = false;
    for (let p = 0; p < pairs.length; p++) {
      for (let q = p + 1; q < pairs.length; q++) {
        const [a, b] = pairs[p];
        const [c, e] = pairs[q];
        const cur = d(a, b) + d(c, e);
        const opt1 = d(a, c) + d(b, e);
        const opt2 = d(a, e) + d(b, c);
        if (opt1 < cur && opt1 <= opt2) {
          pairs[p] = [a, c];
          pairs[q] = [b, e];
          improved = true;
        } else if (opt2 < cur) {
          pairs[p] = [a, e];
          pairs[q] = [b, c];
          improved = true;
        }
      }
    }
  }
  return { pairs, leftover };
}
