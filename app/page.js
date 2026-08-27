"use client";

import { useState, useMemo } from "react";
import {
  parseCoord,
  distance,
  parseLines,
  bestMatching,
} from "../lib/distance.js";

const MAP_BASE = "https://test.voidtrek.com/map/";

function heat(d, max) {
  if (max <= 0) return "mid";
  const r = d / max;
  if (r <= 0.34) return "near";
  if (r >= 0.72) return "far";
  return "mid";
}

function CoordLink({ coord }) {
  if (!coord) return null;
  return (
    <a
      className="link"
      href={MAP_BASE + coord}
      target="_blank"
      rel="noreferrer"
    >
      {coord}
    </a>
  );
}

/* ── Tab 1: Closest Trade ─────────────────────────────────────────── */
function TradeTab() {
  const [blob, setBlob] = useState("");
  const [ran, setRan] = useState(false);

  const parsed = useMemo(() => parseLines(blob), [blob]);
  const valid = parsed.filter((e) => e.coord);
  const invalid = parsed.filter((e) => e.invalid);

  const result = useMemo(() => {
    if (!ran || valid.length < 2) return null;
    return bestMatching(valid);
  }, [ran, valid]);

  const maxDist = result
    ? Math.max(...result.pairs.map((p) => p.dist), 0)
    : 0;

  return (
    <div className="panel">
      <p className="intro">
        Paste one guildmate per line — a <strong>name</strong> then their{" "}
        <strong>base coord</strong> (e.g. <span className="mono">Guildmate1 A00:00:00:00</span>).
        The navigator pairs everyone so each base trades exactly once, choosing
        the set of pairs with the shortest total distance. An odd base out gets
        flagged.
      </p>

      <div className="field">
        <div className="label">
          Guild bases
          <span className="hint">{valid.length} valid</span>
        </div>
        <textarea
          spellCheck={false}
          placeholder={"Guildmate1 A00:00:00:00\nGuildmate2 A00:00:00:00\nGuildmate3 A00:00:00:00\n..."}
          value={blob}
          onChange={(e) => {
            setBlob(e.target.value);
            setRan(false);
          }}
        />
      </div>

      <div className="controls">
        <button
          className="btn btn-primary"
          onClick={() => setRan(true)}
          disabled={valid.length < 2}
        >
          Plot best trades
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setBlob("");
            setRan(false);
          }}
        >
          Clear
        </button>
      </div>

      {invalid.length > 0 && (
        <div className="errbox">
          Skipped {invalid.length} line{invalid.length > 1 ? "s" : ""} with no
          readable coord:{" "}
          <span className="mono">
            {invalid.slice(0, 3).map((e) => e.label || "(blank)").join(", ")}
            {invalid.length > 3 ? "…" : ""}
          </span>
        </div>
      )}

      {result && (
        <div className="results">
          <div className="results-head">
            <span className="results-title">Trade routes</span>
            <span className="stat">
              <b>{result.pairs.length}</b> trades
            </span>
            <span className="stat">
              total <b>{fmt(result.total)}</b>
            </span>
            <span className="stat">
              avg <b>{fmt(result.average)}</b>
            </span>
          </div>
          <ul className="rows">
            {result.pairs.map((p, i) => (
              <li className="row" key={i}>
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <div className="pair-body">
                  <div className="pair-line">
                    <span className="node">
                      <span className="name">{p.a.label || "—"}</span>
                      <CoordLink coord={p.a.coordRaw} />
                    </span>
                    <span className="arrow">⇄</span>
                    <span className="node">
                      <span className="name">{p.b.label || "—"}</span>
                      <CoordLink coord={p.b.coordRaw} />
                    </span>
                  </div>
                </div>
                <span className="dist" data-heat={heat(p.dist, maxDist)}>
                  {fmt(p.dist)}
                  <span className="unit">dist</span>
                </span>
              </li>
            ))}
          </ul>
          {result.leftover && (
            <div className="leftover">
              Odd base out: <b>{result.leftover.label || result.leftover.coordRaw}</b>{" "}
              (<span className="mono">{result.leftover.coordRaw}</span>) has no
              partner this round — an odd number of bases can't all pair up.
            </div>
          )}
        </div>
      )}

      {ran && valid.length < 2 && (
        <div className="empty">Need at least two valid bases to make a trade.</div>
      )}
    </div>
  );
}

/* ── Tab 2: Closest Free Astro ────────────────────────────────────── */
function AstroTab() {
  const [baseRaw, setBaseRaw] = useState("");
  const [blob, setBlob] = useState("");
  const [ran, setRan] = useState(false);

  const base = useMemo(() => parseCoord(baseRaw.trim()), [baseRaw]);
  const parsed = useMemo(() => parseLines(blob), [blob]);
  const valid = parsed.filter((e) => e.coord);
  const invalid = parsed.filter((e) => e.invalid);

  const ranked = useMemo(() => {
    if (!ran || !base) return null;
    return valid
      .map((e) => ({ ...e, dist: distance(base, e.coord) }))
      .sort((a, b) => a.dist - b.dist);
  }, [ran, base, valid]);

  const maxDist = ranked ? Math.max(...ranked.map((r) => r.dist), 0) : 0;

  return (
    <div className="panel">
      <p className="intro">
        Enter your <strong>current base</strong>, then paste the{" "}
        <strong>free astros</strong> around you — one per line, with or without
        a label. The navigator ranks them from nearest to farthest so you can
        pick the closest spot for your next base.
      </p>

      <div className="grid2 split">
        <div className="field">
          <div className="label">
            Your base
            {base ? (
              <span className="hint" style={{ color: "var(--good)" }}>
                locked
              </span>
            ) : baseRaw.trim() ? (
              <span className="hint" style={{ color: "var(--hot)" }}>
                unreadable
              </span>
            ) : null}
          </div>
          <input
            className="single mono"
            spellCheck={false}
            placeholder="A00:00:00:00"
            value={baseRaw}
            onChange={(e) => {
              setBaseRaw(e.target.value);
              setRan(false);
            }}
          />
        </div>
      </div>

      <div className="field">
        <div className="label">
          Free astros
          <span className="hint">{valid.length} valid</span>
        </div>
        <textarea
          spellCheck={false}
          placeholder={
            "A00:00:00:00\nA00:00:00:00\nA00:00:00:00\n..."
          }
          value={blob}
          onChange={(e) => {
            setBlob(e.target.value);
            setRan(false);
          }}
        />
      </div>

      <div className="controls">
        <button
          className="btn btn-primary"
          onClick={() => setRan(true)}
          disabled={!base || valid.length < 1}
        >
          Rank by distance
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setBaseRaw("");
            setBlob("");
            setRan(false);
          }}
        >
          Clear
        </button>
      </div>

      {invalid.length > 0 && (
        <div className="errbox">
          Skipped {invalid.length} line{invalid.length > 1 ? "s" : ""} with no
          readable coord:{" "}
          <span className="mono">
            {invalid.slice(0, 3).map((e) => e.label || "(blank)").join(", ")}
            {invalid.length > 3 ? "…" : ""}
          </span>
        </div>
      )}

      {ran && !base && (
        <div className="empty">
          Enter a readable base coord first — format{" "}
          <span className="mono">A00:00:00:00</span>.
        </div>
      )}

      {ranked && base && (
        <div className="results">
          <div className="results-head">
            <span className="results-title">Nearest astros</span>
            <span className="stat">
              from <b className="mono">{base.raw}</b>
            </span>
            <span className="stat">
              <b>{ranked.length}</b> targets
            </span>
            {ranked.length > 0 && (
              <span className="stat">
                closest <b>{fmt(ranked[0].dist)}</b>
              </span>
            )}
          </div>
          <ul className="rows">
            {ranked.map((r, i) => (
              <li className="row" key={i}>
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <div className="pair-body">
                  <div className="pair-line">
                    <span className="node">
                      {r.label && <span className="name">{r.label}</span>}
                      <CoordLink coord={r.coordRaw} />
                    </span>
                  </div>
                </div>
                <span className="dist" data-heat={heat(r.dist, maxDist)}>
                  {fmt(r.dist)}
                  <span className="unit">dist</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function Page() {
  const [tab, setTab] = useState("trade");

  return (
    <div className="wrap">
      <header className="masthead">
        <span className="brand">
          AE<span className="dot">·</span>NAV
        </span>
        <span className="tagline">Distance helper</span>
        <span className="mast-right">Astro Empires distance model</span>
      </header>

      <nav className="tabs">
        <button
          className="tab"
          data-active={tab === "trade"}
          onClick={() => setTab("trade")}
        >
          <span className="num">01</span>Closest trade
        </button>
        <button
          className="tab"
          data-active={tab === "astro"}
          onClick={() => setTab("astro")}
        >
          <span className="num">02</span>Closest free astro
        </button>
      </nav>

      {tab === "trade" ? <TradeTab /> : <AstroTab />}

      <p className="footnote">
        Distance uses the game&apos;s <code>calc_distance()</code> model:
        system distance is <code>ceil(√(Δx² + Δy²))</code> where{" "}
        <code>x = reg₁·10 + sys₁</code> and <code>y = reg₀·10 + sys₀</code>.
      </p>
    </div>
  );
}
