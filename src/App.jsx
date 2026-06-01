import { useState, useEffect, useCallback } from "react";

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzKTCEl1oGPRxTnDjN742kx0CAE2jKjyDfYKAjiqY3rTi2KOSkAjUMJBjBfJXJuS75aoA/exec";

const ESTRUCTURA = {
  "Villahermosa":     ["Villahermosa", "Ciudad del Carmen", "Coatzacoalcos"],
  "Mérida":           ["Mérida", "Campeche", "Cancún", "Playa del Carmen", "Cozumel", "Chetumal"],
  "Tuxtla Gutiérrez": ["Tuxtla Gutiérrez", "San Cristóbal de las Casas", "Tapachula", "Oaxaca", "Tuxtepec", "Salina Cruz"],
  "Puebla":           ["Puebla", "Tehuacán", "Tlaxcala", "Veracruz", "Córdoba", "Xalapa", "Poza Rica"],
};

const COLORES = {
  "Villahermosa":     "#0ea5e9",
  "Mérida":           "#10b981",
  "Tuxtla Gutiérrez": "#f59e0b",
  "Puebla":           "#8b5cf6",
};

const METAS_MONTO = {
  "Villahermosa":               92590833.77,
  "Ciudad del Carmen":          28129448.78,
  "Coatzacoalcos":              25601587.22,
  "Mérida":                    118396008.97,
  "Campeche":                   19071516.09,
  "Cancún":                     76239500.59,
  "Playa del Carmen":           23765671.33,
  "Cozumel":                     6283320.64,
  "Chetumal":                    9557507.37,
  "Tuxtla Gutiérrez":           86093177.69,
  "San Cristóbal de las Casas":  9450064.19,
  "Tapachula":                  26895875.57,
  "Oaxaca":                     32442671.32,
  "Tuxtepec":                   16418014.78,
  "Salina Cruz":                10394356.28,
  "Puebla":                    110794010.26,
  "Tehuacán":                   22324360.54,
  "Tlaxcala":                   40445563.50,
  "Veracruz":                   69363750.00,
  "Córdoba":                    28349835.08,
  "Xalapa":                     22155717.46,
  "Poza Rica":                  10777946.60,
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function semaforo(pct) {
  if (pct >= 90) return { color: "#16a34a", bg: "#dcfce7", label: "Óptimo" };
  if (pct >= 70) return { color: "#d97706", bg: "#fef9c3", label: "En riesgo" };
  return { color: "#dc2626", bg: "#fee2e2", label: "Crítico" };
}

function pctVsEsperado(acum, meta, diaActual, diasHabiles) {
  if (!meta || !diasHabiles || !diaActual) return 0;
  const esp = (meta / diasHabiles) * diaActual;
  return esp ? Math.round((acum / esp) * 100) : 0;
}

function fmtMXN(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
}

// Construye estructura de datos desde filas de Sheets
function buildData(rows) {
  const d = {};
  Object.entries(ESTRUCTURA).forEach(([dir, sucs]) => {
    d[dir] = {};
    sucs.forEach(suc => { d[dir][suc] = { metaMonto: METAS_MONTO[suc] || 0, diasCapturados: [] }; });
  });
  rows.forEach(r => {
    const dir = r.Direccion, suc = r.Sucursal, dia = Number(r.DiaHabil), monto = Number(r.Monto);
    if (d[dir] && d[dir][suc] && dia && monto) {
      d[dir][suc].diasCapturados.push({ dia, monto });
    }
  });
  Object.keys(d).forEach(dir =>
    Object.keys(d[dir]).forEach(suc =>
      d[dir][suc].diasCapturados.sort((a, b) => a.dia - b.dia)
    )
  );
  return d;
}

function acumulado(suc) { return (suc.diasCapturados || []).reduce((acc, d) => acc + d.monto, 0); }
function totalDir(data, dir) {
  let metaM = 0, realM = 0;
  Object.values(data[dir]).forEach(s => { metaM += s.metaMonto; realM += acumulado(s); });
  return { metaM, realM };
}
function totalRegion(data) {
  let metaM = 0, realM = 0;
  Object.keys(ESTRUCTURA).forEach(dir => { const t = totalDir(data, dir); metaM += t.metaM; realM += t.realM; });
  return { metaM, realM };
}

function Barra({ pct, color }) {
  return (
    <div style={{ background: "#f1f5f9", borderRadius: 99, height: 8, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 99, transition: "width .5s" }} />
    </div>
  );
}

function Spinner({ color = "#64748b" }) {
  return (
    <div style={{ display: "inline-block", width: 16, height: 16, border: `2px solid ${color}30`,
      borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.7s linear infinite" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function App() {
  const [data, setData]                   = useState(buildData([]));
  const [cargando, setCargando]           = useState(true);
  const [guardando, setGuardando]         = useState(false);
  const [errorConexion, setErrorConexion] = useState(null);
  const [ultimaSync, setUltimaSync]       = useState(null);

  const [diasHabiles, setDiasHabiles]     = useState(22);
  const [diaActual, setDiaActual]         = useState(1);
  const [mesActual, setMesActual]         = useState(5);
  const [anioActual, setAnioActual]       = useState(2026);
  const [configAbierta, setConfigAbierta] = useState(true);
  const [configForm, setConfigForm]       = useState({ diasHabiles: 22, diaActual: 1, mes: 5, anio: 2026 });

  const [vista, setVista]       = useState("dashboard");
  const [dirSel, setDirSel]     = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm]         = useState({ montoHoy: "" });
  const [editDia, setEditDia]   = useState(null);

  const mesLabel = `${MESES[mesActual]} ${anioActual}`;

  // ── Cargar datos desde Sheets ──────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setErrorConexion(null);
      const res = await fetch(SHEETS_URL + "?t=" + Date.now());
      if (!res.ok) throw new Error("Error de red");
      const rows = await res.json();
      setData(buildData(Array.isArray(rows) ? rows : []));
      setUltimaSync(new Date());
    } catch (e) {
      setErrorConexion("No se pudo conectar con Google Sheets. Verifica tu conexión.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Auto-refresh cada 60 segundos
  useEffect(() => {
    const interval = setInterval(cargarDatos, 60000);
    return () => clearInterval(interval);
  }, [cargarDatos]);

  // ── Guardar/actualizar en Sheets ───────────────────────────────────────
  const guardarEnSheets = async (dir, suc, dia, monto) => {
    setGuardando(true);
    setErrorConexion(null);
    try {
      const params = new URLSearchParams({
        Direccion: dir,
        Sucursal: suc,
        DiaHabil: dia,
        Monto: monto === null ? "null" : monto,
      });
      // no-cors: la petición llega a Sheets aunque no podamos leer la respuesta
      await fetch(SHEETS_URL + "?" + params.toString(), { mode: "no-cors" });
    } catch (_) {
      // ignorar error de CORS — el dato sí se guarda
    } finally {
      // Esperar a que Sheets procese y luego recargar
      await new Promise(r => setTimeout(r, 2000));
      await cargarDatos();
      setGuardando(false);
    }
  };

  const borrarEnSheets = async (dir, suc, dia) => {
    await guardarEnSheets(dir, suc, dia, null);
  };

  const guardarConfig = () => {
    setDiasHabiles(Number(configForm.diasHabiles) || 22);
    setDiaActual(Number(configForm.diaActual) || 1);
    setMesActual(Number(configForm.mes));
    setAnioActual(Number(configForm.anio) || 2026);
    setConfigAbierta(false);
  };

  const abrirCaptura = (dir, suc) => {
    setEditando({ dir, suc });
    setEditDia(null);
    setForm({ montoHoy: "" });
    setVista("captura");
  };

  const esperadoHoy = (meta) => Math.round((meta / diasHabiles) * diaActual);

  const region = totalRegion(data);
  const pctR   = pctVsEsperado(region.realM, region.metaM, diaActual, diasHabiles);
  const semR   = semaforo(pctR);

  // ── MODAL CONFIG ──────────────────────────────────────────────────────
  const ModalConfig = () => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
        overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", padding: "22px 28px", color: "#fff" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>FONACOT · Región Sur</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>Configuración del período</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Conectado a Google Sheets ✓</div>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>🗓️ Mes</label>
              <select value={configForm.mes}
                onChange={e => setConfigForm(p => ({ ...p, mes: Number(e.target.value) }))}
                style={{ width: "100%", padding: "11px 10px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                  fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>📅 Año</label>
              <input type="number" min="2020" max="2035" value={configForm.anio}
                onChange={e => setConfigForm(p => ({ ...p, anio: e.target.value }))}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                  fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>⚙️ Días hábiles del mes</label>
            <input type="number" min="1" max="31" value={configForm.diasHabiles}
              onChange={e => setConfigForm(p => ({ ...p, diasHabiles: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                fontSize: 16, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>📍 Día hábil actual</label>
            <input type="number" min="1" value={configForm.diaActual}
              onChange={e => setConfigForm(p => ({ ...p, diaActual: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                fontSize: 16, fontFamily: "'DM Mono',monospace", outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={guardarConfig} style={{ padding: "13px", borderRadius: 10, border: "none",
            background: "#0f172a", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Aplicar configuración →
          </button>
        </div>
      </div>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {configAbierta && <ModalConfig />}

      {/* HEADER */}
      <header style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", color: "#fff",
        padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, boxShadow: "0 2px 16px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(vista === "detalle" || vista === "captura") && (
            <button onClick={() => {
              if (vista === "captura") { setVista(dirSel ? "detalle" : "dashboard"); setEditando(null); }
              else { setVista("dashboard"); setDirSel(null); }
            }} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
              color: "#fff", cursor: "pointer", padding: "6px 12px", fontSize: 13, fontFamily: "inherit" }}>← Regresar</button>
          )}
          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>FONACOT · Región Sur</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {vista === "dashboard" ? "Seguimiento de Metas" : vista === "detalle" ? `Dirección ${dirSel}` : `Avance — ${editando?.suc}`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Indicador de sincronización */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{mesLabel}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
              {cargando || guardando
                ? <><Spinner color="#94a3b8" /> {guardando ? "Guardando..." : "Sincronizando..."}</>
                : ultimaSync
                  ? `✓ Sync ${ultimaSync.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
            </div>
          </div>
          <button onClick={cargarDatos} title="Actualizar ahora"
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
              color: "#fff", cursor: "pointer", padding: "6px 10px", fontSize: 14 }}>🔄</button>
          <button onClick={() => { setConfigForm({ diasHabiles, diaActual, mes: mesActual, anio: anioActual }); setConfigAbierta(true); }}
            style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8,
              color: "#fff", cursor: "pointer", padding: "6px 12px", fontSize: 12, fontFamily: "inherit" }}>⚙️ Período</button>
        </div>
      </header>

      {/* BANNER ERROR */}
      {errorConexion && (
        <div style={{ background: "#fef2f2", borderBottom: "1px solid #fca5a5", padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#dc2626" }}>⚠️ {errorConexion}</span>
          <button onClick={() => setErrorConexion(null)}
            style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>

        {/* Pantalla de carga inicial */}
        {cargando && !ultimaSync && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: 300, gap: 16 }}>
            <Spinner color="#0f172a" />
            <div style={{ fontSize: 14, color: "#64748b" }}>Conectando con Google Sheets...</div>
          </div>
        )}

        {(!cargando || ultimaSync) && (<>

        {/* ══ DASHBOARD ══ */}
        {vista === "dashboard" && (<>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, marginBottom: 18,
            boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Monto Colocado · Región Sur</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono'", letterSpacing: -1, marginTop: 2 }}>{fmtMXN(region.realM)}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  Meta: {fmtMXN(region.metaM)} · Esperado día {diaActual}: {fmtMXN(esperadoHoy(region.metaM))}
                </div>
              </div>
              <span style={{ background: semR.bg, color: semR.color, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 14px" }}>{semR.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Barra pct={pctR} color={semR.color} />
              <span style={{ fontSize: 15, fontWeight: 700, color: semR.color, fontFamily: "'DM Mono'", whiteSpace: "nowrap" }}>{pctR}%</span>
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>% vs meta esperada al día hábil {diaActual} de {diasHabiles} · Se actualiza cada 60 seg</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {Object.keys(ESTRUCTURA).map(dir => {
              const col  = COLORES[dir];
              const tot  = totalDir(data, dir);
              const pct  = pctVsEsperado(tot.realM, tot.metaM, diaActual, diasHabiles);
              const sem  = semaforo(pct);
              const sucs = ESTRUCTURA[dir];
              return (
                <div key={dir}
                  onClick={() => { setDirSel(dir); setVista("detalle"); }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)"}
                  style={{ background: "#fff", borderRadius: 16, overflow: "hidden",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0",
                    cursor: "pointer", transition: "box-shadow .2s", display: "flex", flexDirection: "column" }}>
                  <div style={{ background: col, padding: "14px 18px" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Dirección</div>
                    <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, marginBottom: 7 }}>{dir}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>{sucs.length} sucursales</div>
                      <span style={{ background: sem.bg, color: sem.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 9px" }}>{sem.label}</span>
                    </div>
                  </div>
                  <div style={{ padding: "14px 18px", flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Real / Meta</span>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono'", fontWeight: 600, color: "#0f172a" }}>
                        {fmtMXN(tot.realM)} / {fmtMXN(tot.metaM)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Barra pct={pct} color={col} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: col, fontFamily: "'DM Mono'", whiteSpace: "nowrap" }}>{pct}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10 }}>Esperado día {diaActual}: {fmtMXN(esperadoHoy(tot.metaM))}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {sucs.map(suc => {
                        const s  = data[dir][suc];
                        const sp = pctVsEsperado(acumulado(s), s.metaMonto, diaActual, diasHabiles);
                        const ss = semaforo(sp);
                        return (
                          <div key={suc} style={{ background: ss.bg, color: ss.color, fontSize: 10,
                            fontWeight: 600, borderRadius: 6, padding: "3px 8px",
                            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color, display: "inline-block", flexShrink: 0 }} />
                            {suc}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>)}

        {/* ══ DETALLE DIRECCIÓN ══ */}
        {vista === "detalle" && dirSel && (() => {
          const col  = COLORES[dirSel];
          const tot  = totalDir(data, dirSel);
          const pct  = pctVsEsperado(tot.realM, tot.metaM, diaActual, diasHabiles);
          const sem  = semaforo(pct);
          const sucs = ESTRUCTURA[dirSel];
          return (<>
            <div style={{ background: col, borderRadius: 16, padding: 22, marginBottom: 18, color: "#fff" }}>
              <div style={{ fontSize: 10, opacity: .7, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Dirección</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{dirSel}</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono'", marginBottom: 4 }}>{fmtMXN(tot.realM)}</div>
              <div style={{ fontSize: 13, opacity: .8, marginBottom: 12 }}>
                Meta: {fmtMXN(tot.metaM)} · Esperado día {diaActual}: {fmtMXN(esperadoHoy(tot.metaM))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, height: 8, flex: 1 }}>
                  <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "#fff", borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono'" }}>{pct}%</span>
                <span style={{ background: sem.bg, color: sem.color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 12px" }}>{sem.label}</span>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden",
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9",
                display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Sucursales — {mesLabel}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Día hábil {diaActual}/{diasHabiles}</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Sucursal","Meta Monto","Acumulado","Esperado hoy","% vs Esp.","Estado",""].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 600, color: "#64748b",
                          textAlign: "left", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: .5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sucs.map((suc, i) => {
                      const s   = data[dirSel][suc];
                      const acu = acumulado(s);
                      const pm  = pctVsEsperado(acu, s.metaMonto, diaActual, diasHabiles);
                      const sm  = semaforo(pm);
                      return (
                        <tr key={suc} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>{suc}</td>
                          <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", fontFamily: "'DM Mono'" }}>{fmtMXN(s.metaMonto)}</td>
                          <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono'", color: "#0f172a" }}>{fmtMXN(acu)}</td>
                          <td style={{ padding: "12px 14px", fontSize: 12, color: "#64748b", fontFamily: "'DM Mono'" }}>{fmtMXN(esperadoHoy(s.metaMonto))}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 50, background: "#f1f5f9", borderRadius: 99, height: 6, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(pm, 100)}%`, height: "100%", background: sm.color, borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, fontFamily: "'DM Mono'" }}>{pm}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{sm.label}</span>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <button onClick={e => { e.stopPropagation(); abrirCaptura(dirSel, suc); }}
                              style={{ background: col, color: "#fff", border: "none", borderRadius: 8,
                                padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                              {s.diasCapturados.length > 0 ? "Ver / Editar" : "Capturar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>);
        })()}

        {/* ══ CAPTURA / EDICIÓN ══ */}
        {vista === "captura" && editando && (() => {
          const col = COLORES[editando.dir];
          const s   = data[editando.dir][editando.suc];
          const acu = acumulado(s);
          const pm  = pctVsEsperado(acu, s.metaMonto, diaActual, diasHabiles);
          const sm  = semaforo(pm);
          const capturaHoy = s.diasCapturados.find(d => d.dia === diaActual);
          const mHoy = Number(form.montoHoy) || 0;

          return (
            <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Header sucursal */}
              <div style={{ background: col, borderRadius: 16, padding: "18px 24px", color: "#fff" }}>
                <div style={{ fontSize: 10, opacity: .75, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Avance de sucursal</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{editando.suc}</div>
                <div style={{ fontSize: 12, opacity: .75 }}>Dir. {editando.dir} · {mesLabel} · Día hábil {diaActual}/{diasHabiles}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                  {[{l:"Meta mes",v:fmtMXN(s.metaMonto)},{l:"Acumulado",v:fmtMXN(acu)},{l:"Esperado",v:fmtMXN(esperadoHoy(s.metaMonto))}].map(item => (
                    <div key={item.l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, opacity: .7, fontWeight: 600, textTransform: "uppercase" }}>{item.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono'" }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, height: 8, flex: 1 }}>
                    <div style={{ width: `${Math.min(pm, 100)}%`, height: "100%", background: "#fff", borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono'" }}>{pm}%</span>
                  <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>{sm.label}</span>
                </div>
              </div>

              {/* Captura día actual */}
              <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden",
                boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
                <div style={{ background: "#f8fafc", padding: "12px 20px", borderBottom: "1px solid #e2e8f0",
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>📅 Día hábil {diaActual} (hoy)</div>
                  {capturaHoy && <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>✓ Guardado en Sheets</span>}
                </div>
                <div style={{ padding: 20 }}>
                  {capturaHoy ? (
                    editDia?.dia === diaActual ? (
                      <div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Editar monto del día {diaActual}</div>
                        <input type="number" min="0" value={editDia.monto}
                          onChange={e => setEditDia(d => ({ ...d, monto: e.target.value }))}
                          style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${col}`,
                            fontSize: 17, fontFamily: "'DM Mono'", outline: "none", boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button onClick={() => setEditDia(null)}
                            style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                              background: "#fff", color: "#64748b", fontFamily: "inherit", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                            Cancelar
                          </button>
                          <button onClick={async () => { await guardarEnSheets(editando.dir, editando.suc, diaActual, editDia.monto); setEditDia(null); }}
                            disabled={guardando}
                            style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: col,
                              color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            {guardando ? <><Spinner color="#fff" /> Guardando...</> : "Guardar en Sheets"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Monto registrado</div>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono'", color: "#0f172a" }}>{fmtMXN(capturaHoy.monto)}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setEditDia({ dia: diaActual, monto: capturaHoy.monto })}
                            style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${col}`,
                              background: "#fff", color: col, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                            ✏️ Editar
                          </button>
                          <button onClick={async () => { await borrarEnSheets(editando.dir, editando.suc, diaActual); }}
                            disabled={guardando}
                            style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #fca5a5",
                              background: "#fff", color: "#dc2626", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                            {guardando ? "..." : "🗑 Borrar"}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 8 }}>
                        💰 Monto colocado hoy
                      </label>
                      <input type="number" min="0" value={form.montoHoy}
                        onChange={e => setForm({ montoHoy: e.target.value })}
                        placeholder="0"
                        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${col}`,
                          fontSize: 18, fontFamily: "'DM Mono'", outline: "none", boxSizing: "border-box", color: "#0f172a" }} />
                      {mHoy > 0 && (
                        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 10, marginTop: 10, fontSize: 12, color: "#64748b" }}>
                          Nuevo acumulado: <strong style={{ color: "#0f172a", fontFamily: "'DM Mono'" }}>{fmtMXN(acu + mHoy)}</strong>
                        </div>
                      )}
                      <button onClick={async () => { if (mHoy > 0) { await guardarEnSheets(editando.dir, editando.suc, diaActual, form.montoHoy); setForm({ montoHoy: "" }); } }}
                        disabled={!mHoy || guardando}
                        style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, border: "none",
                          background: mHoy > 0 ? col : "#e2e8f0", color: mHoy > 0 ? "#fff" : "#94a3b8",
                          fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: mHoy > 0 ? "pointer" : "default",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {guardando ? <><Spinner color="#fff" /> Guardando en Sheets...</> : "Guardar en Sheets"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Historial */}
              {s.diasCapturados.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
                  <div style={{ background: "#f8fafc", padding: "12px 20px", borderBottom: "1px solid #e2e8f0",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>📋 Historial en Google Sheets</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.diasCapturados.length} día(s)</div>
                  </div>
                  <div>
                    {s.diasCapturados.map((d, i) => {
                      const esHoy    = d.dia === diaActual;
                      const enEdicion = editDia?.dia === d.dia && !esHoy;
                      return (
                        <div key={d.dia} style={{ padding: "12px 20px", borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
                          background: esHoy ? "#f0fdf4" : "#fff" }}>
                          {enEdicion ? (
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Editando día hábil {d.dia}</div>
                              <input type="number" min="0" value={editDia.monto}
                                onChange={e => setEditDia(ed => ({ ...ed, monto: e.target.value }))}
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${col}`,
                                  fontSize: 16, fontFamily: "'DM Mono'", outline: "none", boxSizing: "border-box" }} />
                              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                <button onClick={() => setEditDia(null)}
                                  style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                                    background: "#fff", color: "#64748b", fontFamily: "inherit", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                                <button onClick={async () => { await guardarEnSheets(editando.dir, editando.suc, d.dia, editDia.monto); setEditDia(null); }}
                                  disabled={guardando}
                                  style={{ flex: 2, padding: "8px", borderRadius: 8, border: "none", background: col,
                                    color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                  {guardando ? <><Spinner color="#fff" /> Guardando...</> : "Guardar"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>Día hábil {d.dia}{esHoy ? " · hoy" : ""}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono'", color: "#0f172a" }}>{fmtMXN(d.monto)}</div>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => setEditDia({ dia: d.dia, monto: d.monto })}
                                  style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${col}`,
                                    background: "#fff", color: col, fontFamily: "inherit", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>✏️ Editar</button>
                                <button onClick={async () => { await borrarEnSheets(editando.dir, editando.suc, d.dia); }}
                                  disabled={guardando}
                                  style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #fca5a5",
                                    background: "#fff", color: "#dc2626", fontFamily: "inherit", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>🗑</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button onClick={() => { setVista(dirSel ? "detalle" : "dashboard"); setEditando(null); setEditDia(null); }}
                style={{ padding: "12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#64748b", fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                ← Regresar
              </button>
            </div>
          );
        })()}

        </>)}
      </main>
    </div>
  );
}
