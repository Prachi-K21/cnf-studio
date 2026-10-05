export interface Production { lhs: string; rhs: string[] }
export interface Grammar { start: string; productions: Production[] }
export interface Diff { added: string[]; removed: string[]; same: string[] }
export interface Step { id: string; title: string; desc: string; why: string; notes: string[]; before: Grammar; after: Grammar; diff: Diff }
export interface Check { label: string; ok: boolean; detail?: string }
export const EPS = 'ε';
export const show = (p: Production) => `${p.lhs} → ${p.rhs.length ? p.rhs.join(' ') : EPS}`;
const isVar = (s: string) => /^[A-Z]/.test(s);
const uniq = (ps: Production[]) => { const m = new Map<string, Production>(); ps.forEach(p => m.set(show(p), p)); return [...m.values()]; };
export const varsOf = (g: Grammar) => { const s = new Set<string>([g.start]); g.productions.forEach(p => { s.add(p.lhs); p.rhs.forEach(x => isVar(x) && s.add(x)); }); return s; };
export const termsOf = (g: Grammar) => { const s = new Set<string>(); g.productions.forEach(p => p.rhs.forEach(x => !isVar(x) && s.add(x))); return s; };

export function parseGrammar(text: string) {
  const errors: string[] = [], warnings: string[] = [], prods: Production[] = [];
  let start = '';
  if (!text.trim()) return { errors: ['Enter a CFG to begin.'], warnings, grammar: undefined as Grammar | undefined };
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim(); if (!line || line.startsWith('#')) return;
    const n = i + 1, m = line.split(/→|->/);
    if (m.length < 2) { errors.push(`Line ${n}: incomplete production (missing → or ->).`); return; }
    if (m.length > 2) { errors.push(`Line ${n}: more than one arrow.`); return; }
    const lhs = m[0].trim();
    if (!lhs) { errors.push(`Line ${n}: missing left-hand-side variable.`); return; }
    if (!/^[A-Z][0-9]*$/.test(lhs)) { errors.push(`Line ${n}: invalid variable "${lhs}" (use e.g. S, A, A1).`); return; }
    if (!start) start = lhs;
    m[1].split('|').forEach(alt => {
      const a = alt.trim();
      if (!a) { errors.push(`Line ${n}: empty alternative (stray "|" or missing right-hand side).`); return; }
      if (/^(ε|eps|epsilon|λ)$/i.test(a)) { prods.push({ lhs, rhs: [] }); return; }
      if (/[ελ]/.test(a)) { errors.push(`Line ${n}: ε must appear as the complete RHS of an alternative.`); return; }
      const toks = a.replace(/\s+/g, '').match(/[A-Z][0-9]*|./g) || [];
      for (const t of toks) if (!isVar(t) && !/^[a-z0-9+\-*\/()=.,;:#]$/.test(t)) { errors.push(`Line ${n}: invalid symbol "${t}".`); return; }
      prods.push({ lhs, rhs: toks });
    });
  });
  if (errors.length) return { errors, warnings, grammar: undefined };
  const ps = uniq(prods);
  if (ps.length < prods.length) warnings.push(`${prods.length - ps.length} duplicate production(s) were merged.`);
  const g: Grammar = { start, productions: ps };
  const defined = new Set(ps.map(p => p.lhs));
  varsOf(g).forEach(v => { if (!defined.has(v)) warnings.push(`Variable ${v} has no productions (it will be removed as non-generating).`); });
  return { errors, warnings, grammar: g };
}

const diffOf = (a: Grammar, b: Grammar): Diff => {
  const A = a.productions.map(show), B = b.productions.map(show);
  return { added: B.filter(x => !A.includes(x)), removed: A.filter(x => !B.includes(x)), same: B.filter(x => A.includes(x)) };
};
export const findNullable = (ps: Production[]) => {
  const N = new Set<string>(); let ch = true;
  while (ch) { ch = false; for (const p of ps) if (!N.has(p.lhs) && p.rhs.every(x => N.has(x))) { N.add(p.lhs); ch = true; } }
  return N;
};

export function convertToCNF(g0: Grammar): Step[] {
  const steps: Step[] = [];
  const used = new Set<string>(varsOf(g0));
  const fresh = (base: string, from: number) => { let i = from, n = base + i; while (used.has(n)) n = base + ++i; used.add(n); return n; };
  const push = (id: string, title: string, desc: string, why: string, notes: string[], before: Grammar, after: Grammar) =>
    steps.push({ id, title, desc, why, notes, before, after, diff: diffOf(before, after) });
  const G = (start: string, productions: Production[]): Grammar => ({ start, productions });

  push('01', 'Parse & Validate', 'Check the grammar is well-formed.', 'Every later step assumes a valid CFG.',
    [`Start symbol: ${g0.start}`, `Variables: ${[...varsOf(g0)].join(', ')}`, `Terminals: ${[...termsOf(g0)].join(', ') || '—'}`], g0, g0);

  // New start symbol
  let g = g0;
  if (g0.productions.some(p => p.rhs.includes(g0.start))) {
    const s0 = fresh('S', 0);
    g = G(s0, [{ lhs: s0, rhs: [g0.start] }, ...g0.productions]);
    push('02', 'New Start Symbol', 'Add a fresh start symbol.', 'The start symbol appears on a right-hand side; a fresh start keeps it off every RHS so ε can safely be kept only for the start.',
      [`${g0.start} occurs on a RHS, so ${s0} → ${g0.start} is added and ${s0} becomes the start symbol.`], g0, g);
  } else push('02', 'New Start Symbol', 'Add a fresh start symbol.', 'Needed only if the start symbol appears on a RHS.', [`${g0.start} never appears on a RHS, so no new start symbol is needed.`], g, g);

  // ε elimination
  const N = findNullable(g.productions), out: Production[] = [], notes: string[] = [];
  notes.push(N.size ? `Nullable variables: ${[...N].join(', ')} (each can derive ε).` : 'No variable is nullable.');
  for (const p of g.productions) {
    if (!p.rhs.length) continue;
    const pos = p.rhs.map((x, i) => (N.has(x) ? i : -1)).filter(i => i >= 0);
    if (pos.length > 15) throw new Error('Too many nullable symbols in one production to expand safely.');
    const vs: string[] = [];
    for (let mask = 0; mask < 1 << pos.length; mask++) {
      const om = new Set(pos.filter((_, k) => mask & (1 << k)));
      const r = p.rhs.filter((_, i) => !om.has(i));
      if (r.length) { out.push({ lhs: p.lhs, rhs: r }); if (mask) vs.push(r.join(' ')); }
    }
    if (pos.length) notes.push(`${show(p)} gains: ${vs.length ? vs.join(' | ') : '(only ε, dropped)'}`);
  }
  if (N.has(g.start)) { out.push({ lhs: g.start, rhs: [] }); notes.push(`${g.start} is nullable, so ${g.start} → ε is kept (ε is in the language).`); }
  let g2 = G(g.start, uniq(out));
  push('03', 'Eliminate ε-Productions', 'Remove productions that generate ε while preserving the language.', 'For every nullable variable in a RHS we add the alternative without it, then delete A → ε.', notes, g, g2);

  // Unit
  const un = (p: Production) => p.rhs.length === 1 && isVar(p.rhs[0]);
  const uo: Production[] = [], un_notes: string[] = [];
  for (const A of varsOf(g2)) {
    const cl = new Set<string>([A]); let ch = true;
    while (ch) { ch = false; for (const p of g2.productions) if (cl.has(p.lhs) && un(p) && !cl.has(p.rhs[0])) { cl.add(p.rhs[0]); ch = true; } }
    if (cl.size > 1) un_notes.push(`${A} ⇒* ${[...cl].filter(x => x !== A).join(', ')} through unit rules.`);
    for (const B of cl) for (const p of g2.productions) if (p.lhs === B && !un(p)) uo.push({ lhs: A, rhs: p.rhs });
  }
  let g3 = G(g2.start, uniq(uo));
  push('04', 'Eliminate Unit Productions', 'Replace A → B chains by the rules they lead to.', 'If A ⇒* B and B → α (non-unit), then A → α is added directly; all A → B are deleted.', un_notes.length ? un_notes : ['No unit productions found.'], g2, g3);

  // Useless
  const gen = new Set<string>(); let ch = true;
  while (ch) { ch = false; for (const p of g3.productions) if (!gen.has(p.lhs) && p.rhs.every(x => !isVar(x) || gen.has(x))) { gen.add(p.lhs); ch = true; } }
  if (!gen.has(g3.start)) throw new Error(`The start symbol ${g3.start} cannot derive any terminal string, so the language is empty and has no CNF.`);
  const ng = [...varsOf(g3)].filter(v => !gen.has(v));
  let g4 = G(g3.start, g3.productions.filter(p => gen.has(p.lhs) && p.rhs.every(x => !isVar(x) || gen.has(x))));
  push('05a', 'Remove Non-Generating Variables', 'Delete variables that never derive a terminal string.', 'Such variables cannot appear in any complete derivation.',
    ng.length ? ng.map(v => `Variable ${v} cannot derive a string of only terminals, so it is removed (with every rule using it).`) : ['Every variable is generating.'], g3, g4);
  const reach = new Set<string>([g4.start]); ch = true;
  while (ch) { ch = false; for (const p of g4.productions) if (reach.has(p.lhs)) p.rhs.forEach(x => { if (isVar(x) && !reach.has(x)) { reach.add(x); ch = true; } }); }
  const ur = [...varsOf(g4)].filter(v => !reach.has(v));
  let g5 = G(g4.start, g4.productions.filter(p => reach.has(p.lhs)));
  push('05b', 'Remove Unreachable Variables', 'Delete variables not reachable from the start symbol.', 'They can never be used in a derivation from the start symbol.',
    ur.length ? ur.map(v => `Variable ${v} is unreachable from ${g5.start}, so it is removed.`) : ['Every variable is reachable.'], g4, g5);

  // Terminals
  const tm = new Map<string, string>(), tp: Production[] = [], tn: string[] = [];
  const tr = g5.productions.map(p => {
    if (p.rhs.length < 2) return p;
    return { lhs: p.lhs, rhs: p.rhs.map(x => {
      if (isVar(x)) return x;
      if (!tm.has(x)) { let b = `T_${x}`, n = b, i = 1; while (used.has(n)) n = b + i++; used.add(n); tm.set(x, n); tp.push({ lhs: n, rhs: [x] }); tn.push(`${n} → ${x} is created and reused wherever ${x} appears in a long rule.`); }
      return tm.get(x)!;
    }) };
  });
  let g6 = G(g5.start, uniq([...tr, ...tp]));
  push('06', 'Replace Terminals', 'Isolate terminals inside long productions.', 'CNF allows terminals only in rules of the form A → a.', tn.length ? tn : ['No terminal occurs in a rule of length ≥ 2.'], g5, g6);

  // Binarize
  const bo: Production[] = [], bn: string[] = [];
  for (const p of g6.productions) {
    if (p.rhs.length <= 2) { bo.push(p); continue; }
    let cur = p.lhs, rest = p.rhs; const parts: string[] = [];
    while (rest.length > 2) { const x = fresh('X', 1); const q = { lhs: cur, rhs: [rest[0], x] }; bo.push(q); parts.push(show(q)); cur = x; rest = rest.slice(1); }
    const q = { lhs: cur, rhs: rest }; bo.push(q); parts.push(show(q));
    bn.push(`${show(p)} ⟹ ${parts.join(' ; ')}`);
  }
  let g7 = G(g6.start, uniq(bo));
  push('07', 'Binarize Productions', 'Split every RHS longer than 2 into binary rules.', 'CNF allows at most two symbols on the right of a rule.', bn.length ? bn : ['No production is longer than 2.'], g6, g7);

  const v = validateCNF(g7);
  push('08', 'Final CNF', 'Verify and present the result.', 'Confirms every rule is A → BC or A → a.', v.checks.map(c => `${c.ok ? '✓' : '✗'} ${c.label}${c.detail ? ' — ' + c.detail : ''}`), g7, g7);
  return steps;
}

export function validateCNF(g: Grammar) {
  const bad = (f: (p: Production) => boolean) => g.productions.filter(f).map(show);
  const onRhs = g.productions.some(p => p.rhs.includes(g.start));
  const mk = (label: string, l: string[]): Check => ({ label, ok: !l.length, detail: l.join(', ') });
  const gen = new Set<string>(); let ch = true;
  while (ch) { ch = false; for (const p of g.productions) if (!gen.has(p.lhs) && p.rhs.every(x => !isVar(x) || gen.has(x))) { gen.add(p.lhs); ch = true; } }
  const reach = new Set([g.start]); ch = true;
  while (ch) { ch = false; for (const p of g.productions) if (reach.has(p.lhs)) p.rhs.forEach(x => { if (isVar(x) && !reach.has(x)) { reach.add(x); ch = true; } }); }
  const useless = [...varsOf(g)].filter(v => !gen.has(v) || !reach.has(v));
  const checks = [
    mk('No ε-productions (except S → ε for the start symbol, which must not appear on a RHS)', bad(p => p.rhs.length === 0 && (p.lhs !== g.start || onRhs))),
    mk('No unit productions', bad(p => p.rhs.length === 1 && isVar(p.rhs[0]))),
    mk('No useless variables', useless),
    mk('No RHS longer than 2', bad(p => p.rhs.length > 2)),
    mk('Binary rules contain only variables', bad(p => p.rhs.length === 2 && p.rhs.some(x => !isVar(x)))),
    mk('Single-symbol rules contain only terminals', bad(p => p.rhs.length === 1 && isVar(p.rhs[0]))),
  ];
  return { valid: checks.every(c => c.ok), checks };
}

export const grammarText = (g: Grammar) => {
  const m = new Map<string, string[]>();
  g.productions.forEach(p => m.set(p.lhs, [...(m.get(p.lhs) || []), p.rhs.length ? p.rhs.join('') : EPS]));
  const order = [g.start, ...[...m.keys()].filter(k => k !== g.start)];
  return order.filter(k => m.has(k)).map(k => `${k} → ${m.get(k)!.join(' | ')}`).join('\n');
};

export function makeReport(orig: Grammar, steps: Step[]) {
  const fin = steps[steps.length - 1].after, v = validateCNF(fin);
  return ['CFG TO CNF CONVERSION REPORT', '', 'Original Grammar:', grammarText(orig), '',
    ...steps.slice(0, -1).flatMap(s => [`Step ${s.id} — ${s.title}`, s.why, ...s.notes.map(n => '  • ' + n),
      ...s.diff.added.map(x => '  + ' + x), ...s.diff.removed.map(x => '  − ' + x), 'Grammar:', grammarText(s.after), '']),
    'Final CNF:', grammarText(fin), '', 'Validation:', v.valid ? 'VALID' : 'INVALID', ...v.checks.map(c => `  ${c.ok ? '✓' : '✗'} ${c.label}`)].join('\n');
}
