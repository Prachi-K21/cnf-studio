import { useEffect, useMemo, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Copy, Download, CheckCircle2, Circle, CircleDot, AlertTriangle, BookOpen, Wand2 } from 'lucide-react';
import { parseGrammar, convertToCNF, validateCNF, makeReport, grammarText, varsOf, termsOf, show, Step, Production } from './algorithms/cnf';

const EXAMPLES = [
  ['Basic CFG', 'S → AB\nA → a\nB → b'], ['Epsilon Production', 'S → AB | a\nA → a | ε\nB → b'],
  ['Unit Production', 'S → A\nA → B\nB → b'], ['Long Production', 'S → ABC\nA → a\nB → b\nC → c'],
  ['Complex Grammar', 'S → AB | BC\nA → BA | a\nB → CC | b\nC → AB | a'], ['Nullable Variables', 'S → AB\nA → BC | ε\nB → b\nC → c'],
  ['Start on RHS + useless', 'S → aS | A | b\nA → a\nX → Y\nY → y\nZ → z'],
];
const DEFAULT = 'S → AB | a\nA → aA | ε\nB → bB | b';
const tagCls: Record<string, string> = { ADDED: 'bg-green-500/15 text-green-400 border-green-500/40', REMOVED: 'bg-red-500/15 text-red-400 border-red-500/40', UNCHANGED: 'bg-slate-500/10 text-slate-400 border-slate-600' };

const Rule = ({ text, tag }: { text: string; tag?: string }) => (
  <div className={`pop mono flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm ${tag ? tagCls[tag] : 'border-slate-700 bg-[#172033]'}`}>
    <span className={tag === 'REMOVED' ? 'line-through' : ''}>{text}</span>{tag && <span className="text-[10px] font-semibold tracking-wider">{tag}</span>}
  </div>
);
const Card = ({ title, children, cls = '' }: { title: string; children: React.ReactNode; cls?: string }) => (
  <section className={`rounded-xl border border-slate-700/70 bg-[#111827] p-4 ${cls}`}><h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h3>{children}</section>
);
const Badge = ({ children }: { children: React.ReactNode }) => <span className="mono rounded-md border border-slate-600 bg-[#172033] px-2 py-0.5 text-xs">{children}</span>;

export default function App() {
  const [text, setText] = useState(DEFAULT);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [fail, setFail] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState('');
  const parsed = useMemo(() => parseGrammar(text), [text]);
  const g = parsed.grammar;
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800); };

  const convert = () => {
    setPlaying(false);
    if (!g) { setFail(parsed.errors); setSteps(null); return; }
    try { setSteps(convertToCNF(g)); setFail(null); setIdx(0); setTimeout(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }), 50); }
    catch (e: any) { setFail([e.message]); setSteps(null); }
  };
  const last = steps ? steps.length - 1 : 0;
  useEffect(() => { if (!playing || !steps) return; if (idx >= last) { setPlaying(false); return; } const t = setTimeout(() => setIdx(i => i + 1), 1800); return () => clearTimeout(t); }, [playing, idx, steps]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!steps || ['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowRight') setIdx(i => Math.min(last, i + 1)); else if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [steps, last]);

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => say('Copied to clipboard'));
  const download = (name: string, t: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' })); a.download = name; a.click(); say('Download started'); };
  const s = steps?.[idx];
  const fin = steps?.[last].after;
  const val = fin ? validateCNF(fin) : null;
  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#172033] px-3 py-1.5 text-sm hover:border-violet-400 focus:outline-2 focus:outline-violet-400 disabled:opacity-40';
  const primary = 'inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-1.5 text-sm font-medium hover:bg-violet-500 focus:outline-2 focus:outline-white';
  const list = (ps: Production[], tags?: (k: string) => string) => ps.map((p, i) => <Rule key={show(p) + i} text={show(p)} tag={tags?.(show(p))} />);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-[#0B1020]/90 px-4 py-3 backdrop-blur" aria-label="Main">
        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#2563EB] font-bold">C</span><b>CNF Studio</b><span className="hidden text-sm text-slate-400 sm:inline">CFG → CNF</span></div>
        <div className="flex gap-4 text-sm text-slate-300"><a href="#theory" className="hover:text-white">Theory</a><a href="#examples" className="hover:text-white">Examples</a><a href="#help" className="hover:text-white">Help</a></div>
      </nav>

      <header className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-4xl font-bold">CFG → CNF Simulator</h1>
        <p className="mt-2 text-lg text-violet-300">Transform grammars. Understand every step.</p>
        <p className="mt-3 text-slate-400">Convert Context-Free Grammars into Chomsky Normal Form and understand every transformation along the way.</p>
        <div className="mt-6 flex justify-center gap-3"><button className={primary} onClick={() => { convert(); }}>Start Simulation</button><button className={btn} onClick={() => { setText(EXAMPLES[4][1]); setSteps(null); say('Example loaded'); }}>Try Example</button></div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          <Card title="Input Context-Free Grammar">
            <textarea aria-label="Grammar input" value={text} onChange={e => { setText(e.target.value); setSteps(null); setFail(null); }} spellCheck={false} rows={8}
              className="mono w-full rounded-lg border border-slate-700 bg-[#0B1020] p-3 text-sm focus:outline-2 focus:outline-violet-500" placeholder="S → AB | a" />
              <p className="mt-1 text-xs text-slate-500">Use → or {"->"}, {"|"} for alternatives, ε / eps / epsilon for empty. Uppercase = variable, others = terminals.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={btn} onClick={() => say(g ? 'Valid CFG ✓' : 'Grammar has errors')}>Validate</button>
              <button className={btn} onClick={() => { setText(DEFAULT); setSteps(null); }}>Load Example</button>
              <button className={btn} onClick={() => { setText(''); setSteps(null); setFail(null); }}>Clear</button>
              <button className={primary} onClick={convert}><Wand2 size={15} />Convert to CNF</button>
            </div>
          </Card>
          <Card title="Grammar Summary">
            {!text.trim() ? <div className="text-center text-slate-400"><p>Enter a CFG to begin.</p><button className={primary + ' mt-3'} onClick={() => setText(DEFAULT)}>Load Example Grammar</button></div> :
              g ? <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="text-slate-400">Start:</span><Badge>{g.start}</Badge><span className="text-slate-400">Variables:</span>{[...varsOf(g)].map(v => <Badge key={v}>{v}</Badge>)}</div>
                <div className="flex flex-wrap items-center gap-2"><span className="text-slate-400">Terminals:</span>{[...termsOf(g)].map(v => <Badge key={v}>{v}</Badge>)}<span className="text-slate-400">Productions:</span><Badge>{g.productions.length}</Badge></div>
                <div className="font-medium text-green-400">✓ Valid CFG</div>
                {parsed.warnings.map(w => <div key={w} className="text-xs text-amber-400">⚠ {w}</div>)}
              </div> : <div role="alert" className="text-sm text-red-400"><b>✗ Invalid Grammar</b><ol className="mt-1 list-decimal pl-5">{parsed.errors.map(e => <li key={e}>{e}</li>)}</ol></div>}
          </Card>
          <div id="examples"><Card title="Examples">
            <div className="grid gap-2">{EXAMPLES.map(([n, t]) => <button key={n} className="rounded-lg border border-slate-700 bg-[#172033] p-2 text-left text-sm hover:border-violet-400" onClick={() => { setText(t); setSteps(null); setFail(null); }}><b>{n}</b><div className="mono truncate text-xs text-slate-400">{t.replace(/\n/g, '   ')}</div></button>)}</div>
          </Card></div>
        </div>

        <div id="workspace" className="space-y-4">
          {fail && <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm"><b className="flex items-center gap-2 text-red-400"><AlertTriangle size={16} />Grammar Validation Failed</b><ol className="mt-2 list-decimal pl-5">{fail.map(e => <li key={e}>{e}</li>)}</ol><button className={btn + ' mt-3'} onClick={() => document.querySelector('textarea')?.focus()}>Fix Grammar</button></div>}
          {!steps && !fail && <Card title="Transformation Workspace"><p className="py-10 text-center text-slate-400">Press <b>Convert to CNF</b> to compute every transformation step.</p></Card>}
          {steps && s && fin && val && <>
            <div className="mono grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">{[['Variables', varsOf(g!).size], ['Terminals', termsOf(g!).size], ['Productions', g!.productions.length], ['Steps', steps.length], ['Final Rules', fin.productions.length]].map(([k, v]) => <div key={k as string} className="rounded-lg border border-slate-700 bg-[#111827] p-2 text-center"><div className="text-lg font-bold text-violet-300">{v}</div>{k}</div>)}</div>
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <ol className="space-y-1" aria-label="Timeline">{steps.map((t, i) => (
                <li key={t.id}><button disabled={i > idx} onClick={() => setIdx(i)} aria-current={i === idx ? 'step' : undefined}
                  className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-sm ${i === idx ? 'border-violet-500 bg-violet-500/10' : 'border-transparent'} ${i > idx ? 'opacity-50' : 'hover:bg-[#172033]'}`}>
                  {i < idx ? <CheckCircle2 size={16} className="mt-0.5 text-green-400" /> : i === idx ? <CircleDot size={16} className="mt-0.5 text-violet-400" /> : <Circle size={16} className="mt-0.5" />}
                  <span><span className="mono text-xs text-slate-500">{t.id}</span><br />{t.title}<span className="sr-only"> — {i < idx ? 'completed' : i === idx ? 'current' : 'pending'}</span></span></button></li>))}</ol>
              <div className="space-y-3" key={idx}>
                <div><div className="mono text-xs text-violet-300">STEP {s.id}</div><h2 className="text-2xl font-bold">{s.title}</h2><p className="text-slate-400">{s.desc}</p></div>
                <Card title="Before">{list(s.before.productions, k => (s.diff.removed.includes(k) ? 'REMOVED' : ''))}</Card>
                <Card title="What happens?" cls="border-violet-500/40"><p className="mb-2 text-sm text-slate-300"><b>Why:</b> {s.why}</p><ul className="space-y-1 text-sm">{s.notes.map(n => <li key={n} className="mono pop rounded bg-[#172033] px-2 py-1">➜ {n}</li>)}</ul></Card>
                <Card title="After">{list(s.after.productions, k => (s.diff.added.includes(k) ? 'ADDED' : ''))}</Card>
                <Card title="Diff"><div className="grid gap-1">{s.diff.added.map(x => <Rule key={'a' + x} text={'+ ' + x} tag="ADDED" />)}{s.diff.removed.map(x => <Rule key={'r' + x} text={'− ' + x} tag="REMOVED" />)}{s.diff.same.map(x => <Rule key={'u' + x} text={x} tag="UNCHANGED" />)}</div></Card>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#111827]/95 p-3 backdrop-blur">
              <button className={btn} disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Previous step"><SkipBack size={15} />Previous</button>
              <button className={primary} onClick={() => { if (idx >= last) setIdx(0); setPlaying(!playing); }} aria-label="Play or pause">{playing ? <><Pause size={15} />Pause</> : <><Play size={15} />Play</>}</button>
              <button className={btn} disabled={idx === last} onClick={() => setIdx(idx + 1)} aria-label="Next step">Next<SkipForward size={15} /></button>
              <button className={btn} onClick={() => { setIdx(0); setPlaying(false); }} aria-label="Reset"><RotateCcw size={15} />Reset</button>
              <span className="mono text-sm text-slate-400">Step {idx + 1} / {steps.length}</span>
            </div>
            {idx === last && <Card title="🎉 CNF Conversion Complete" cls="border-green-500/40">
              <h3 className="mb-2 font-semibold">Final Chomsky Normal Form</h3>
              <pre className="mono rounded-lg bg-[#0B1020] p-3 text-sm">{grammarText(fin)}</pre>
              <div className={`mt-3 font-bold ${val.valid ? 'text-green-400' : 'text-red-400'}`}>{val.valid ? '✓ CNF VALID' : '✗ CNF INVALID'}</div>
              <ul className="mt-1 space-y-0.5 text-sm">{val.checks.map(c => <li key={c.label}>{c.ok ? '✓' : '✗'} {c.label}{!c.ok && <span className="text-red-400"> — {c.detail}</span>}</li>)}</ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={btn} onClick={() => copy(grammarText(g!))}><Copy size={14} />Copy Grammar</button>
                <button className={btn} onClick={() => copy(grammarText(fin))}><Copy size={14} />Copy CNF</button>
                <button className={btn} onClick={() => download('cnf.txt', grammarText(fin))}><Download size={14} />Download TXT</button>
                <button className={btn} onClick={() => download('cnf-report.txt', makeReport(g!, steps))}><Download size={14} />Download Report</button>
                <button className={btn} onClick={() => { setSteps(null); setIdx(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Start Over</button>
              </div></Card>}
          </>}
        </div>
      </main>

      <section id="theory" className="mx-auto max-w-4xl px-4 pb-16"><details className="rounded-xl border border-slate-700 bg-[#111827] p-4" open>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><BookOpen size={16} />Theory</summary>
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p><b>CFG:</b> a grammar whose rules have a single variable on the left, e.g. S → aSb | ε.</p>
          <p><b>CNF:</b> every rule is <span className="mono">A → BC</span> (two variables) or <span className="mono">A → a</span> (one terminal); S → ε is allowed only for the start symbol when it is not on any RHS.</p>
          <p><b>Why?</b> CNF makes parse trees binary, which the CYK parsing algorithm needs, and it simplifies proofs (e.g. the pumping lemma) in formal language theory.</p>
          <p><b>Pipeline:</b> new start symbol → remove ε → remove unit rules → remove non-generating, then unreachable variables → replace terminals (T_a → a) → binarize (A → BCD becomes A → B X1, X1 → CD).</p>
          <p id="help"><b>Help:</b> ← / → change step, Space plays or pauses (when focus is not in the editor).</p>
        </div></details></section>
      {toast && <div role="status" className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-900 shadow-lg">{toast}</div>}
    </div>
  );
}
