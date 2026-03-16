// SyncPaymentsButton.tsx
// Component  : SyncPaymentsButton
// Version    : v1.0.0
// Date       : 2026-03-16
// Description: Manual trigger button for xtrf-sync-payments edge function.
//              Calls the Supabase edge function with ?manual=true&mode=both
//              and displays a live result summary. Designed for the Cethos
//              Financial Dashboard admin panel.
//
// CHANGELOG
//   v1.0.0  2026-03-16  Initial creation. Supports AR/AP/Both mode selection,
//                       live progress display, and result summary with last-run
//                       status from xtrf_new_sync_log.
import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/xtrf-sync-payments`;

interface SyncLogEntry {
  status: string;
  sync_type: string;
  records_upserted?: number;
  started_at?: string;
}

interface SyncResultSection {
  invoices_scanned: number;
  synced: number;
  noPayment: number;
  errors: number;
  firstError?: string;
}

interface SyncResult {
  results?: {
    ar?: SyncResultSection;
    ap?: SyncResultSection;
  };
}

const MODES = [
  { value: "both", label: "AR + AP", color: "#6366f1" },
  { value: "ar", label: "AR Only", color: "#0ea5e9" },
  { value: "ap", label: "AP Only", color: "#f59e0b" },
] as const;

type ModeValue = (typeof MODES)[number]["value"];

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "#22c55e"
      : status === "failed"
        ? "#ef4444"
        : "#94a3b8";
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <span style={{ color: "#94a3b8", fontSize: 13 }}>{label}</span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          fontWeight: 600,
          color: highlight ? "#22c55e" : "#e2e8f0",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function SyncPaymentsButton() {
  const [mode, setMode] = useState<ModeValue>("both");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRuns, setLastRuns] = useState<SyncLogEntry[]>([]);
  const [elapsed, setElapsed] = useState<string | null>(null);

  // Load last 4 payment sync log entries on mount
  const fetchLastRuns = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/xtrf_new_sync_log` +
          `?sync_type=like.xtrf_sync*payments*` +
          `&order=started_at.desc&limit=4`,
        {
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
          },
        },
      );
      if (res.ok) setLastRuns(await res.json());
    } catch (_) {
      /* ignore fetch errors for log display */
    }
  }, []);

  useEffect(() => {
    fetchLastRuns();
  }, [fetchLastRuns]);

  const handleSync = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    const t0 = Date.now();
    try {
      const res = await fetch(`${FUNCTION_URL}?mode=${mode}&manual=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data: SyncResult = await res.json();
      setResult(data);
      await fetchLastRuns();
    } catch (err) {
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const selectedMode = MODES.find((m) => m.value === mode)!;

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
        background: "#0f172a",
        borderRadius: 14,
        border: "1px solid #1e293b",
        padding: 24,
        maxWidth: 480,
        color: "#e2e8f0",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background:
              "linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ⟳
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "-0.01em",
            }}
          >
            Sync Payments from XTRF
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>
            Manual trigger · batch size 200
          </div>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
              background: mode === m.value ? m.color : "#1e293b",
              color: mode === m.value ? "#fff" : "#64748b",
              boxShadow:
                mode === m.value ? `0 0 12px ${m.color}55` : "none",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Trigger button */}
      <button
        onClick={handleSync}
        disabled={running}
        style={{
          width: "100%",
          padding: "12px 0",
          borderRadius: 10,
          border: "none",
          cursor: running ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.02em",
          background: running
            ? "#1e293b"
            : `linear-gradient(135deg, ${selectedMode.color} 0%, #0ea5e9 100%)`,
          color: running ? "#475569" : "#fff",
          transition: "all 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: running
            ? "none"
            : `0 0 20px ${selectedMode.color}44`,
        }}
      >
        {running ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                border: "2px solid #475569",
                borderTopColor: "#94a3b8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            Syncing payments…
          </>
        ) : (
          <>↯ Run Payment Sync ({selectedMode.label})</>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Error state */}
      {error && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 8,
            background: "#1c0a0a",
            border: "1px solid #7f1d1d",
            color: "#fca5a5",
            fontSize: 13,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Result summary */}
      {result && !error && (
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 10,
            background: "#0d1f0d",
            border: "1px solid #14532d",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#22c55e",
              letterSpacing: "0.08em",
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            ✓ Sync Complete · {elapsed}s
          </div>
          {result.results?.ar && (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: "#0ea5e9",
                  fontWeight: 700,
                  marginBottom: 4,
                  marginTop: 8,
                }}
              >
                AR PAYMENTS
              </div>
              <ResultRow
                label="Invoices scanned"
                value={result.results.ar.invoices_scanned}
              />
              <ResultRow
                label="Payments synced"
                value={result.results.ar.synced}
                highlight={result.results.ar.synced > 0}
              />
              <ResultRow
                label="No payment found"
                value={result.results.ar.noPayment}
              />
              <ResultRow
                label="Errors"
                value={result.results.ar.errors}
              />
            </>
          )}
          {result.results?.ap && (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: "#f59e0b",
                  fontWeight: 700,
                  marginBottom: 4,
                  marginTop: 14,
                }}
              >
                AP PAYMENTS
              </div>
              <ResultRow
                label="Invoices scanned"
                value={result.results.ap.invoices_scanned}
              />
              <ResultRow
                label="Payments synced"
                value={result.results.ap.synced}
                highlight={result.results.ap.synced > 0}
              />
              <ResultRow
                label="No payment found"
                value={result.results.ap.noPayment}
              />
              <ResultRow
                label="Errors"
                value={result.results.ap.errors}
              />
            </>
          )}
          {(result.results?.ar?.firstError ||
            result.results?.ap?.firstError) && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 6,
                background: "#1c0a0a",
                color: "#fca5a5",
                fontSize: 12,
              }}
            >
              {result.results?.ar?.firstError ||
                result.results?.ap?.firstError}
            </div>
          )}
        </div>
      )}

      {/* Recent sync log */}
      {lastRuns.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Recent Runs
          </div>
          {lastRuns.map((run, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid #1e293b",
                fontSize: 12,
              }}
            >
              <StatusDot status={run.status} />
              <span
                style={{
                  color: "#64748b",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {run.sync_type
                  .replace("xtrf_sync_", "")
                  .replace(/_/g, " ")}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#22c55e",
                  fontSize: 11,
                }}
              >
                +{run.records_upserted ?? 0}
              </span>
              <span
                style={{ color: "#334155", fontSize: 11, flexShrink: 0 }}
              >
                {run.started_at
                  ? new Date(run.started_at).toLocaleString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer note */}
      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: "#334155",
          borderTop: "1px solid #1e293b",
          paddingTop: 12,
        }}
      >
        Hourly cron:{" "}
        <code style={{ color: "#475569" }}>xtrf-sync-payments-hourly</code>{" "}
        · batch 50 &nbsp;·&nbsp; Manual batch: 200
      </div>
    </div>
  );
}
