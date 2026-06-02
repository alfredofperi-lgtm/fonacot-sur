import { useState, useEffect, useCallback } from "react";

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbz4RV3Sh847EujjNF486VtIFOn7fdEdCjjvhpZozxlxZ0QZuFC7GwRxs4YPXtkBOPoIsA/exec";

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

const ROLES = {
  "DIR-REGIONAL":    { tipo: "regional",   label: "Director Regional",     clave: "sur2026" },
  "DIR-VILLAHERMOSA":{ tipo: "direccion",  dir: "Villahermosa",            label: "Director Villahermosa", clave: "villa2026" },
  "DIR-MERIDA":      { tipo: "direccion",  dir: "Mérida",                  label: "Director Mérida",       clave: "merida2026" },
  "DIR-TUXTLA":      { tipo: "direccion",  dir: "Tuxtla Gutiérrez",        label: "Director Tuxtla",       clave: "tuxtla2026" },
  "DIR-PUEBLA":      { tipo: "direccion",  dir: "Puebla",                  label: "Director Puebla",       clave: "puebla2026" },
};

const SUCURSALES_CLAVES = {
  "Villahermosa": "vhsa2026", "Ciudad del Carmen": "carmen2026", "Coatzacoalcos": "coat2026",
  "Mérida": "mid2026", "Campeche": "camp2026", "Cancún": "cancun2026",
  "Playa del Carmen": "playa2026", "Cozumel": "coz2026", "Chetumal": "chet2026",
  "Tuxtla Gutiérrez": "tuxtla2026", "San Cristóbal de las Casas": "sancris2026",
  "Tapachula": "tapa2026", "Oaxaca": "oax2026", "Tuxtepec": "tux2026",
  "Salina Cruz": "salina2026", "Puebla": "pue2026", "Tehuacán": "tehua2026",
  "Tlaxcala": "tlax2026", "Veracruz": "ver2026", "Córdoba": "cord2026",
  "Xalapa": "xal2026", "Poza Rica": "poza2026",
};

// Fila especial en Sheets para guardar configuración del período
const CONFIG_DIR    = "__CONFIG__";
const CONFIG_SUC    = "__PERIODO__";

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

function buildData(rows) {
  const d = {};
  Object.entries(ESTRUCTURA).forEach(([dir, sucs]) => {
    d[dir] = {};
    sucs.forEach(suc => { d[dir][suc] = { metaMonto: METAS_MONTO[suc] || 0, diasCapturados: [] }; });
  });
  let config = null;
  rows.forEach(r => {
    if (r.Direccion === CONFIG_DIR && r.Sucursal === CONFIG_SUC) {
      config = { diasHabiles: Number(r.DiaHabil), diaActual: Number(r.Monto) };
      return;
    }
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
  return { data: d, config };
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

function PantallaLogin({ onLogin }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState(false);

  const intentarLogin = () => {
    for (const [, rol] of Object.entries(ROLES)) {
      if (clave === rol.clave) { onLogin({ tipo: rol.tipo, dir: rol.dir || null, label: rol.label }); return; }
    }
    for (const [suc, claveSuc] of Object.entries(SUCURSALES_CLAVES)) {
      if (clave === claveSuc) {
        for (const [dir, sucs] of Object.entries(ESTRUCTURA)) {
          if (sucs.includes(suc)) { onLogin({ tipo: "sucursal", suc, dir, label: suc }); return; }
        }
      }
    }
    setError(true);
    setTimeout(() => setError(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e293b,#0f172a)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 24, width: "100%", maxWidth: 380, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ background: "linear-gradient(135deg,#1e3a5f,#0f172a)", padding: "32px 28px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(255,255,255,0.1)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏦</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>FONACOT</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 4 }}>Región Sur</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Seguimiento de Metas</div>
        </div>
        <div style={{ padding: 28 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 8 }}>🔑 Ingresa tu clave de acceso</label>
          <input type="password" value={clave}
            onChange={e => setClave(e.target.value)}
            onKeyDown={e => e.key === "Enter" && intentarLogin()}
            placeholder="••••••••"
            style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: `2px solid ${error ? "#fca5a5" : "#e2e8f0"}`, fontSize: 16, outline: "none", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 3, background: error ? "#fef2f2" : "#fff" }} />
          {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>⚠️ Clave incorrecta. Intenta de nuevo.</div>}
          <button onClick={intentarLogin} style={{ width: "100%", marginTop: 16, padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#1e3a5f,#0f172a)", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Entrar →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [usuario, setUsuario]             = useState(null);
  const [data, setData]                   = useState(buildData([]).data);
  const [cargando, setCargando]           = useState(true);
  const [guardando, setGuardando]         = useState(false);
  const [errorConexion, setErrorConexion] = useState(null);
  const [ultimaSync, setUltimaSync]       = useState(null);

  const [diasHabiles, setDiasHabiles]     = useState(22);
  const [diaActual, setDiaActual]         = useState(1);
  const [mesActual, setMesActual]         = useState(5);
  const [anioActual, setAnioActual]       = useState(2026);
  const [configAbierta, setConfigAbierta] = useState(false);
  const [configForm, setConfigForm]       = useState({ diasHabiles: 22, diaActual: 1, mes: 5, anio: 2026 });

  const [vista, setVista]       = useState("dashboard");
  const [dirSel, setDirSel]     = useState(null);
  const [editando, setEditando] = useState(null);
  const [montoInput, setMontoInput] = useState("");
  const [editDia, setEditDia]   = useState(null);

  const mesLabel = `${MESES[mesActual]} ${anioActual}`;
  const esRegional  = usuario?.tipo === "regional";
  const esDireccion = usuario?.tipo === "direccion";
  const esSucursal  = usuario?.tipo === "sucursal";

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setErrorConexion(null);
      const res = await fetch(SHEETS_URL + "?t=" + Date.now());
      if (!res.ok) throw new Error("Error de red");
      const rows = await res.json();
      const { data: d, config } = buildData(Array.isArray(rows) ? rows : []);
      setData(d);
      if (config) {
        setDiasHabiles(config.diasHabiles);
        setDiaActual(config.diaActual);
      }
      setUltimaSync(new Date());
    } catch (e) {
      setErrorConexion("No se pudo conectar con Google Sheets.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (usuario) cargarDatos(); }, [cargarDatos, usuario]);
  useEffect(() => {
    if (!usuario) return;
    const interval = setInterval(cargarDatos, 60000);
    return () => clearInterval(interval);
  }, [cargarDatos, usuario]);

  const guardarEnSheets = async (dir, suc, dia, monto) => {
    setGuardando(true);
    setErrorConexion(null);
    try {
      const params = new URLSearchParams({ Direccion: dir, Sucursal: suc, DiaHabil: dia, Monto: monto === null ? "null" : monto });
      await fetch(SHEETS_URL + "?" + params.toString(), { mode: "no-cors" });
    } catch (_) {}
    finally {
      await new Promise(r => setTimeout(r, 2000));
      await cargarDatos();
      setGuardando(false);
    }
  };

  const borrarEnSheets = async (dir, suc, dia) => { await guardarEnSheets(dir, suc, dia, null); };

  const guardarConfig = async () => {
    const dh = Number(configForm.diasHabiles) || 22;
    const da = Number(configForm.diaActual) || 1;
    setDiasHabiles(dh);
    setDiaActual(da);
    setMesActual(Number(configForm.mes));
    setAnioActual(Number(configForm.anio) || 2026);
    setConfigAbierta(false);
    // Guardar configuración en Sheets para que todos la vean
    await guardarEnSheets(CONFIG_DIR, CONFIG_SUC, dh, da);
  };

  const esperadoHoy = (meta) => Math.round((meta / diasHabiles) * diaActual);

  if (!usuario) return <PantallaLogin onLogin={u => { setUsuario(u); }} />;

  const region = totalRegion(data || {});
  const pctR   = pctVsEsperado(region.realM, region.metaM, diaActual, diasHabiles);
  const semR   = semaforo(pctR);

  // ── MODAL CONFIG (solo regional) ─────────────────────────────────────
  const ModalConfig = () => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", padding: "22px 28px", color: "#fff" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>FONACOT · Región Sur</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>Configuración del período</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Se actualizará para todos los usuarios</div>
        </div>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>🗓️ Mes</label>
              <select value={configForm.mes} onChange={e => setConfigForm(p => ({ ...p, mes: Number(e.target.value) }))}
                style={{ width: "100%", padding: "11px 10px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box" }}>
                {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>📅 Año</label>
              <input type="number" min="2020" max="2035" value={configForm.anio}
                onChange={e => setConfigForm(p => ({ ...p, anio: e.target.value }))}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>⚙️ Días hábiles del mes</label>
            <input type="number" min="1" max="31" value={configForm.diasHabiles}
              onChange={e => setConfigForm(p => ({ ...p, diasHabiles: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>📍 Día hábil actual</label>
            <input type="number" min="1" value={configForm.diaActual}
              onChange={e => setConfigForm(p => ({ ...p, diaActual: e.target.value }))}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Este valor se guardará en Sheets y todos lo verán</div>
          </div>
          <button onClick={guardarConfig} style={{ padding: "13px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Guardar y aplicar para todos →
          </button>
        </div>
      </div>
    </div>
  );

  // ── COMPONENTE DE CAPTURA (reutilizable) ─────────────────────────────
  const PanelCaptura = ({ dir, suc }) => {
    const col = COLORES[dir];
    const s   = data[dir]?.[suc] || { metaMonto: METAS_MONTO[suc] || 0, diasCapturados: [] };
    const acu = acumulado(s);
    const pm  = pctVsEsperado(acu, s.metaMonto, diaActual, diasHabiles);
    const sm  = semaforo(pm);
    const capturaHoy = s.diasCapturados.find(d => d.dia === diaActual);
    const mHoy = Number(montoInput) || 0;

    return (
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ background: col, borderRadius: 16, padding: "18px 24px", color: "#fff" }}>
          <div style={{ fontSize: 10, opacity: .75, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            {esSucursal ? "Mi sucursal" : "Avance de sucursal"} · {mesLabel}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{suc}</div>
          <div style={{ fontSize: 12, opacity: .75 }}>
            {esSucursal ? "" : `Dir. ${dir} · `}{mesLabel} · Día hábil {diaActual}/{diasHabiles}
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
            {[
              { l: "Meta del mes", v: fmtMXN(s.metaMonto) },
              { l: "Acumulado", v: fmtMXN(acu) },
              { l: `Esperado día ${diaActual}`, v: fmtMXN(esperadoHoy(s.metaMonto)) },
            ].map(item => (
              <div key={item.l} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 9, opacity: .8, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{item.l}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono'" }}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Barra de progreso */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, height: 8, flex: 1 }}>
              <div style={{ width: `${Math.min(pm, 100)}%`, height: "100%", background: "#fff", borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono'" }}>{pm}%</span>
            <span style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>{sm.label}</span>
          </div>
          <div style={{ fontSize: 10, opacity: .6, marginTop: 6 }}>% vs meta esperada al día hábil {diaActual} de {diasHabiles}</div>
        </div>

        {/* Día hábil info */}
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
          <div style={{ background: "#f8fafc", padding: "12px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>📅 Captura del día hábil {diaActual}</div>
            {capturaHoy
              ? <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>✓ Guardado</span>
              : <span style={{ background: "#fef9c3", color: "#d97706", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 10px" }}>Pendiente</span>
            }
          </div>
          <div style={{ padding: 20 }}>
            {capturaHoy ? (
              editDia?.dia === diaActual ? (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 8 }}>Nuevo monto para el día {diaActual}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editDia.monto}
                    onChange={e => setEditDia(d => ({ ...d, monto: e.target.value.replace(/[^0-9.]/g, "") }))}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `2px solid ${col}`, fontSize: 18, fontFamily: "'DM Mono'", outline: "none", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => setEditDia(null)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontFamily: "inherit", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={async () => { await guardarEnSheets(dir, suc, diaActual, editDia.monto); setEditDia(null); }} disabled={guardando}
                      style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: col, color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {guardando ? <><Spinner color="#fff" /> Guardando...</> : "Guardar cambio"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Monto registrado hoy</div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'DM Mono'", color: "#0f172a" }}>{fmtMXN(capturaHoy.monto)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setEditDia({ dia: diaActual, monto: String(capturaHoy.monto) })}
                      style={{ padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${col}`, background: "#fff", color: col, fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✏️ Editar</button>
                    <button onClick={async () => { await borrarEnSheets(dir, suc, diaActual); }} disabled={guardando}
                      style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid #fca5a5", background: "#fff", color: "#dc2626", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      {guardando ? "..." : "🗑 Borrar"}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 8 }}>
                  💰 Monto colocado hoy (día hábil {diaActual})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={montoInput}
                  onChange={e => setMontoInput(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Escribe el monto aquí"
                  autoFocus
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `2px solid ${col}`, fontSize: 20, fontFamily: "'DM Mono'", outline: "none", boxSizing: "border-box", color: "#0f172a" }}
                />
                {mHoy > 0 && (
                  <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Nuevo acumulado</span>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono'", color: "#16a34a" }}>{fmtMXN(acu + mHoy)}</span>
                  </div>
                )}
                <button
                  onClick={async () => { if (mHoy > 0) { await guardarEnSheets(dir, suc, diaActual, montoInput); setMontoInput(""); } }}
                  disabled={!mHoy || guardando}
                  style={{ width: "100%", marginTop: 12, padding: "14px", borderRadius: 12, border: "none", background: mHoy > 0 ? col : "#e2e8f0", color: mHoy > 0 ? "#fff" : "#94a3b8", fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: mHoy > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {guardando ? <><Spinner color="#fff" /> Guardando en Sheets...</> : "Guardar captura"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Historial */}
        {s.diasCapturados.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
            <div style={{ background: "#f8fafc", padding: "12px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>📋 Historial del mes</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.diasCapturados.length} día(s) · Total: {fmtMXN(acu)}</div>
            </div>
            <div>
              {s.diasCapturados.map((d, i) => {
                const esHoy = d.dia === diaActual;
                const enEd  = editDia?.dia === d.dia && !esHoy;
                return (
                  <div key={d.dia} style={{ padding: "12px 20px", borderTop: i > 0 ? "1px solid #f1f5f9" : "none", background: esHoy ? "#f0fdf4" : "#fff" }}>
                    {enEd ? (
                      <div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Editando día hábil {d.dia}</div>
                        <input type="text" inputMode="numeric" value={editDia.monto}
                          onChange={e => setEditDia(ed => ({ ...ed, monto: e.target.value.replace(/[^0-9.]/g, "") }))}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `2px solid ${col}`, fontSize: 16, fontFamily: "'DM Mono'", outline: "none", boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={() => setEditDia(null)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontFamily: "inherit", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                          <button onClick={async () => { await guardarEnSheets(dir, suc, d.dia, editDia.monto); setEditDia(null); }} disabled={guardando}
                            style={{ flex: 2, padding: "8px", borderRadius: 8, border: "none", background: col, color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
                          <button onClick={() => setEditDia({ dia: d.dia, monto: String(d.monto) })}
                            style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${col}`, background: "#fff", color: col, fontFamily: "inherit", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>✏️</button>
                          <button onClick={async () => { await borrarEnSheets(dir, suc, d.dia); }} disabled={guardando}
                            style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #fca5a5", background: "#fff", color: "#dc2626", fontFamily: "inherit", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>🗑</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!esSucursal && (
          <button onClick={() => { setVista("detalle"); setEditando(null); setEditDia(null); setMontoInput(""); }}
            style={{ padding: "12px", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            ← Regresar
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      {configAbierta && esRegional && <ModalConfig />}

      {/* HEADER */}
      <header style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", color: "#fff", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, boxShadow: "0 2px 16px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!esSucursal && (vista === "detalle" || vista === "captura") && (
            <button onClick={() => { if (vista === "captura") { setVista("detalle"); setEditando(null); } else { setVista("dashboard"); setDirSel(null); } setMontoInput(""); setEditDia(null); }}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 12px", fontSize: 13, fontFamily: "inherit" }}>← Regresar</button>
          )}
          <div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>FONACOT · Región Sur</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{usuario.label}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{mesLabel} · Día {diaActual}/{diasHabiles}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              {cargando || guardando ? <><Spinner color="#94a3b8" /> {guardando ? "Guardando..." : "Sync..."}</> : ultimaSync ? `✓ ${ultimaSync.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </div>
          </div>
          <button onClick={cargarDatos} title="Actualizar" style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 10px", fontSize: 14 }}>🔄</button>
          {esRegional && (
            <button onClick={() => { setConfigForm({ diasHabiles, diaActual, mes: mesActual, anio: anioActual }); setConfigAbierta(true); }}
              style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 12px", fontSize: 12, fontFamily: "inherit" }}>⚙️ Período</button>
          )}
          <button onClick={() => setUsuario(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 12px", fontSize: 12, fontFamily: "inherit" }}>Salir</button>
        </div>
      </header>

      {errorConexion && (
        <div style={{ background: "#fef2f2", borderBottom: "1px solid #fca5a5", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#dc2626" }}>⚠️ {errorConexion}</span>
          <button onClick={() => setErrorConexion(null)} style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Vista sucursal */}
      {esSucursal && (
        cargando && !ultimaSync
          ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16 }}><Spinner color="#0f172a" /><div style={{ fontSize: 14, color: "#64748b" }}>Cargando datos...</div></div>
          : <div style={{ padding: 20 }}><PanelCaptura dir={usuario.dir} suc={usuario.suc} /></div>
      )}

      {/* Vista dirección / regional */}
      {!esSucursal && (
        <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
          {cargando && !ultimaSync && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16 }}>
              <Spinner color="#0f172a" /><div style={{ fontSize: 14, color: "#64748b" }}>Conectando con Google Sheets...</div>
            </div>
          )}

          {(!cargando || ultimaSync) && (<>

          {/* Dashboard regional */}
          {vista === "dashboard" && esRegional && (<>
            <div style={{ background: "#fff", borderRadius: 16, padding: 22, marginBottom: 18, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Monto Colocado · Región Sur</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", fontFamily: "'DM Mono'", letterSpacing: -1, marginTop: 2 }}>{fmtMXN(region.realM)}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Meta: {fmtMXN(region.metaM)} · Esperado día {diaActual}: {fmtMXN(esperadoHoy(region.metaM))}</div>
                </div>
                <span style={{ background: semR.bg, color: semR.color, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "4px 14px" }}>{semR.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Barra pct={pctR} color={semR.color} />
                <span style={{ fontSize: 15, fontWeight: 700, color: semR.color, fontFamily: "'DM Mono'", whiteSpace: "nowrap" }}>{pctR}%</span>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>% vs meta esperada al día hábil {diaActual} de {diasHabiles} · Actualización cada 60 seg</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
              {Object.keys(ESTRUCTURA).map(dir => {
                const col = COLORES[dir], tot = totalDir(data, dir), pct = pctVsEsperado(tot.realM, tot.metaM, diaActual, diasHabiles), sem = semaforo(pct), sucs = ESTRUCTURA[dir];
                return (
                  <div key={dir} onClick={() => { setDirSel(dir); setVista("detalle"); }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)"}
                    style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0", cursor: "pointer", transition: "box-shadow .2s" }}>
                    <div style={{ background: col, padding: "14px 18px" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Dirección</div>
                      <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, marginBottom: 7 }}>{dir}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>{sucs.length} sucursales</div>
                        <span style={{ background: sem.bg, color: sem.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 9px" }}>{sem.label}</span>
                      </div>
                    </div>
                    <div style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>Real / Meta</span>
                        <span style={{ fontSize: 12, fontFamily: "'DM Mono'", fontWeight: 600, color: "#0f172a" }}>{fmtMXN(tot.realM)} / {fmtMXN(tot.metaM)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Barra pct={pct} color={col} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: col, fontFamily: "'DM Mono'", whiteSpace: "nowrap" }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10 }}>Esperado día {diaActual}: {fmtMXN(esperadoHoy(tot.metaM))}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {sucs.map(suc => {
                          const s = data[dir]?.[suc], sp = pctVsEsperado(acumulado(s || { diasCapturados: [] }), s?.metaMonto || METAS_MONTO[suc], diaActual, diasHabiles), ss = semaforo(sp);
                          return (
                            <div key={suc} style={{ background: ss.bg, color: ss.color, fontSize: 10, fontWeight: 600, borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color, display: "inline-block" }} />{suc}
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

          {/* Dashboard dirección */}
          {vista === "dashboard" && esDireccion && (() => {
            const dir = usuario.dir, col = COLORES[dir], tot = totalDir(data, dir), pct = pctVsEsperado(tot.realM, tot.metaM, diaActual, diasHabiles), sem = semaforo(pct), sucs = ESTRUCTURA[dir];
            return (<>
              <div style={{ background: col, borderRadius: 16, padding: 22, marginBottom: 18, color: "#fff" }}>
                <div style={{ fontSize: 10, opacity: .7, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Mi Dirección · {mesLabel}</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{dir}</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono'", marginBottom: 4 }}>{fmtMXN(tot.realM)}</div>
                <div style={{ fontSize: 13, opacity: .8, marginBottom: 12 }}>Meta: {fmtMXN(tot.metaM)} · Esperado día {diaActual}: {fmtMXN(esperadoHoy(tot.metaM))}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, height: 8, flex: 1 }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "#fff", borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono'" }}>{pct}%</span>
                  <span style={{ background: sem.bg, color: sem.color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 12px" }}>{sem.label}</span>
                </div>
              </div>
              <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Mis Sucursales — {mesLabel}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Día hábil {diaActual}/{diasHabiles}</div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Sucursal","Meta","Acumulado","Esperado","% vs Esp.","Estado"].map(h => (
                          <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 600, color: "#64748b", textAlign: "left", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: .5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sucs.map((suc, i) => {
                        const s = data[dir]?.[suc] || { metaMonto: METAS_MONTO[suc] || 0, diasCapturados: [] };
                        const acu = acumulado(s), pm = pctVsEsperado(acu, s.metaMonto, diaActual, diasHabiles), sm = semaforo(pm);
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>);
          })()}

          {/* Detalle dirección (regional) */}
          {vista === "detalle" && dirSel && esRegional && (() => {
            const col = COLORES[dirSel], tot = totalDir(data, dirSel), pct = pctVsEsperado(tot.realM, tot.metaM, diaActual, diasHabiles), sem = semaforo(pct), sucs = ESTRUCTURA[dirSel];
            return (<>
              <div style={{ background: col, borderRadius: 16, padding: 22, marginBottom: 18, color: "#fff" }}>
                <div style={{ fontSize: 10, opacity: .7, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Dirección</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{dirSel}</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono'", marginBottom: 4 }}>{fmtMXN(tot.realM)}</div>
                <div style={{ fontSize: 13, opacity: .8, marginBottom: 12 }}>Meta: {fmtMXN(tot.metaM)} · Esperado día {diaActual}: {fmtMXN(esperadoHoy(tot.metaM))}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, height: 8, flex: 1 }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "#fff", borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono'" }}>{pct}%</span>
                  <span style={{ background: sem.bg, color: sem.color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 12px" }}>{sem.label}</span>
                </div>
              </div>
              <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>Sucursales — {mesLabel}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Día hábil {diaActual}/{diasHabiles}</div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Sucursal","Meta","Acumulado","Esperado","% vs Esp.","Estado",""].map(h => (
                          <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 600, color: "#64748b", textAlign: "left", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: .5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sucs.map((suc, i) => {
                        const s = data[dirSel]?.[suc] || { metaMonto: METAS_MONTO[suc] || 0, diasCapturados: [] };
                        const acu = acumulado(s), pm = pctVsEsperado(acu, s.metaMonto, diaActual, diasHabiles), sm = semaforo(pm);
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
                              <button onClick={() => { setEditando({ dir: dirSel, suc }); setMontoInput(""); setEditDia(null); setVista("captura"); }}
                                style={{ background: col, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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

          {/* Captura regional */}
          {vista === "captura" && editando && esRegional && (
            <PanelCaptura dir={editando.dir} suc={editando.suc} />
          )}

          </>)}
        </main>
      )}
    </div>
  );
}
