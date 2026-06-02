import { useState } from "react";

export default function App() {
  const [clave, setClave] = useState("");
  const [entro, setEntro] = useState(false);

  if (entro) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>✅ Login funcionando</h1>
        <p>La app cargó correctamente.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h2>Login de prueba</h2>
      <input
        type="password"
        value={clave}
        onChange={e => setClave(e.target.value)}
        placeholder="Escribe tu clave"
        style={{ padding: 10, fontSize: 16, marginRight: 10 }}
      />
      <button onClick={() => { if (clave === "sur2026") setEntro(true); }}
        style={{ padding: 10, fontSize: 16 }}>
        Entrar
      </button>
    </div>
  );
}
