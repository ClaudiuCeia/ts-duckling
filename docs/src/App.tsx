import { useState, useCallback, useRef, useEffect } from "react";
import { Header } from "./components/Header";
import { ParserSidebar } from "./components/ParserSidebar";
import { AnnotatedText } from "./components/AnnotatedText";
import { Hovercard } from "./components/Hovercard";
import { extract, stopWorker, type EntityResult } from "./worker-client";
import { PARSER_PRIORITY, PRESETS, ALL_IDS } from "./registry";
import { fmtDuration, loadSelection, saveSelection } from "./utils";
import { loadUrlText } from "./fetch-url";

export function App() {
  const [selected, setSelected] = useState(() => loadSelection(ALL_IDS));
  const [input, setInput] = useState("");
  const [entities, setEntities] = useState<EntityResult[]>([]);
  const [timing, setTiming] = useState("");
  const [status, setStatus] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [maxChars, setMaxChars] = useState(8000);
  const [fullText, setFullText] = useState(false);
  const [preset, setPreset] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // Hovercard state
  const [hovercardEntities, setHovercardEntities] = useState<EntityResult[]>([]);
  const [hovercardAnchor, setHovercardAnchor] = useState<HTMLElement | null>(null);

  const reqIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onSelectionChange = useCallback((next: Set<string>) => {
    setSelected(next);
    saveSelection(next);
  }, []);

  const doExtract = useCallback(() => {
    if (!input.trim()) {
      setEntities([]);
      setTiming("");
      setStatus("");
      setSpinning(false);
      return;
    }

    const id = ++reqIdRef.current;
    const max = fullText ? 0 : Math.max(500, maxChars);
    const ids = PARSER_PRIORITY.filter((p) => selected.has(p));

    stopWorker();
    setStatus("Parsing…");
    setSpinning(true);
    setHovercardEntities([]);
    setHovercardAnchor(null);

    extract({ reqId: id, text: input, ids, maxChars: max }, (resp) => {
      if (resp.reqId !== id) return;
      setEntities(resp.entities);
      const suffix = resp.truncated ? ` (prefix ${resp.length} chars)` : "";
      setTiming(`${fmtDuration(resp.ms)}${suffix}`);
      setStatus("");
      setSpinning(false);
    });
  }, [input, selected, maxChars, fullText]);

  // Debounced auto-extract
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doExtract, 350);
    return () => clearTimeout(timerRef.current);
  }, [doExtract]);

  const handlePreset = (key: string) => {
    setPreset(key);
    if (key && PRESETS[key]) setInput(PRESETS[key]);
  };

  const handleLoadUrl = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setStatus("Fetching…");
    setSpinning(true);
    stopWorker();
    try {
      const result = await loadUrlText(url);
      setInput(result.text);
      setPreset("");
      setStatus(`Loaded (${Math.round(result.ms)}ms)`);
      setTimeout(() => setStatus(""), 1500);
    } catch {
      setStatus("Load failed (likely CORS)");
      setTimeout(() => setStatus(""), 2500);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  };

  const handleEntityClick = (entity: EntityResult, el: HTMLElement) => {
    const group = entities.filter((e) => e.start === entity.start);
    group.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    setHovercardEntities(group);
    setHovercardAnchor(el);
  };

  const handleStop = () => {
    stopWorker();
    setStatus("Stopped");
    setSpinning(false);
    setTimeout(() => setStatus(""), 900);
  };

  const handleClear = () => {
    stopWorker();
    setInput("");
    setUrl("");
    setEntities([]);
    setTiming("");
    setStatus("");
    setSpinning(false);
    setPreset("");
    setHovercardEntities([]);
    setHovercardAnchor(null);
  };

  return (
    <>
      <Header>
        {status && (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
            {spinning && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
            )}
            {status}
          </span>
        )}
        <button
          type="button"
          onClick={doExtract}
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:border-teal-300 hover:bg-teal-100"
        >
          Extract
        </button>
        <button
          type="button"
          onClick={handleStop}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-300"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-300"
        >
          Clear
        </button>
      </Header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <ParserSidebar selected={selected} onSelectionChange={onSelectionChange} />

          <div className="space-y-4">
            {/* Input section */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold tracking-wide text-slate-900">Input</h2>
                <div className="text-sm text-slate-500">{input.length} chars</div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr]">
                  <label className="text-sm text-slate-600">
                    <div className="mb-1 font-medium text-slate-700">Preset</div>
                    <select
                      value={preset}
                      onChange={(e) => handlePreset(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-200/40"
                    >
                      <option value="">(none)</option>
                      <option value="mixed">Mixed</option>
                      <option value="pii">PII</option>
                      <option value="article">Article-ish</option>
                    </select>
                  </label>

                  <div>
                    <div className="mb-1 text-sm font-medium text-slate-700">Max chars</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={500}
                        step={500}
                        value={maxChars}
                        onChange={(e) => setMaxChars(Number(e.target.value) || 8000)}
                        className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm focus:border-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-200/40"
                      />
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={fullText}
                          onChange={(e) => setFullText(e.target.checked)}
                          className="h-4 w-4 accent-teal-600"
                        />
                        Full text (slow)
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <label className="flex-1 text-sm text-slate-600">
                    <div className="mb-1 font-medium text-slate-700">URL</div>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleLoadUrl(); }}
                      placeholder="https://en.wikipedia.org/wiki/Perceptual_hashing"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-200/40"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadUrl}
                    disabled={loading || !url.trim()}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Loading…" : "Load"}
                  </button>
                </div>

                <textarea
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setPreset(""); }}
                  spellCheck={false}
                  className="mt-4 h-56 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed text-slate-900 shadow-sm focus:border-teal-300 focus:outline-none focus:ring-4 focus:ring-teal-200/40"
                  placeholder="Try: Email me at no-reply+foo@some.domain.dev, call +14155552671, visit https://duckling.deno.dev/, SSN 123-45-6789, CC 4242 4242 4242 4242"
                />
              </div>
            </section>

            {/* Preview section */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold tracking-wide text-slate-900">Preview</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>{entities.length} matches</span>
                  {timing && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono text-slate-600">{timing}</span>
                    </>
                  )}
                  <label className="flex items-center gap-2 font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={showJson}
                      onChange={(e) => setShowJson(e.target.checked)}
                      className="h-4 w-4 accent-teal-600"
                    />
                    Show JSON
                  </label>
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Annotated text
                </div>
                <div className="mt-2">
                  <AnnotatedText
                    text={input}
                    entities={entities}
                    onEntityClick={handleEntityClick}
                  />
                </div>

                {showJson && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Raw JSON
                    </div>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-900">
                      {JSON.stringify(entities, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Hovercard
        entities={hovercardEntities}
        anchor={hovercardAnchor}
        onClose={() => { setHovercardEntities([]); setHovercardAnchor(null); }}
      />
    </>
  );
}
