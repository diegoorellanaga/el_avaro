/* ====================================================================
   El Avaro · App de ensayo de diálogos (100% front)
   - Selección de personaje
   - Muestra solo escenas donde el personaje habla
   - Recorre diálogo por diálogo; cuando toca tu personaje muestra "TU TURNO"
   - Audio pendiente (usa audio_url del JSON si existe)
   ==================================================================== */

const OBRA = window.OBRA;

// ---------- Estado global ----------
const estado = {
  personaje: null,          // personaje elegido
  soloMisEscenas: true,     // filtrar escenas
  usarAudio: false,
  secuencia: [],            // lista aplanada de items {acto, escena, dialogo}
  indice: 0,                // posición actual en la secuencia
};

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/** Cuenta cuántos diálogos tiene cada personaje en toda la obra */
function contarParlamentos() {
  const conteo = {};
  for (const acto of OBRA.actos) {
    for (const esc of acto.escenas) {
      for (const d of esc.dialogos) {
        conteo[d.personaje] = (conteo[d.personaje] || 0) + 1;
      }
    }
  }
  return conteo;
}

/** Devuelve la lista de personajes parlantes ordenada por nº de líneas (desc) */
function personajesParlantes() {
  const conteo = contarParlamentos();
  return Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]).map((nombre) => ({
    nombre,
    lineas: conteo[nombre],
  }));
}

/** Construye la secuencia de diálogos a ensayar para el personaje elegido */
function construirSecuencia() {
  const seq = [];
  for (const acto of OBRA.actos) {
    for (const esc of acto.escenas) {
      const hablaAqui = esc.dialogos.some((d) => d.personaje === estado.personaje);
      if (estado.soloMisEscenas && !hablaAqui) continue;
      for (const d of esc.dialogos) {
        seq.push({
          actoNum: acto.numero,
          actoTitulo: acto.titulo,
          escenaNum: esc.numero,
          escenaTitulo: esc.titulo,
          encabezado: esc.encabezado,
          dialogo: d,
          esMio: d.personaje === estado.personaje,
        });
      }
    }
  }
  return seq;
}

// ---------- Pantalla de inicio ----------
function pintarPersonajes() {
  const cont = $("#lista-personajes");
  cont.innerHTML = "";
  for (const p of personajesParlantes()) {
    const btn = document.createElement("button");
    btn.className = "chip-personaje";
    btn.dataset.nombre = p.nombre;
    btn.innerHTML = `<span class="cp-nombre">${p.nombre}</span>
                     <span class="cp-meta">${p.lineas} ${p.lineas === 1 ? "línea" : "líneas"}</span>`;
    btn.addEventListener("click", () => seleccionarPersonaje(p.nombre));
    cont.appendChild(btn);
  }
}

function seleccionarPersonaje(nombre) {
  estado.personaje = nombre;
  $$(".chip-personaje").forEach((el) => {
    el.classList.toggle("sel", el.dataset.nombre === nombre);
  });
  $("#btn-empezar").disabled = false;
}

// ---------- Navegación de pantallas ----------
function mostrarPantalla(id) {
  $$(".pantalla").forEach((p) => p.classList.remove("activa"));
  $(id).classList.add("activa");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Ensayo ----------
function empezarEnsayo() {
  estado.soloMisEscenas = $("#chk-solo-mis-escenas").checked;
  estado.usarAudio = $("#chk-audio").checked;
  estado.secuencia = construirSecuencia();
  estado.indice = 0;

  if (estado.secuencia.length === 0) {
    alert("Ese personaje no tiene diálogos.");
    return;
  }
  $("#etq-personaje").textContent = estado.personaje;
  mostrarPantalla("#pantalla-ensayo");
  renderItem();
}

function renderItem() {
  const item = estado.secuencia[estado.indice];
  if (!item) return;

  const { dialogo, esMio } = item;

  // Contexto
  $("#etq-acto").textContent = item.actoTitulo;
  $("#etq-escena").textContent = item.escenaTitulo +
    (item.encabezado ? " · " + item.encabezado : "");
  $("#etq-progreso").textContent = `${estado.indice + 1} / ${estado.secuencia.length}`;

  const tarjeta = $("#tarjeta-dialogo");
  const acotEl = $("#dialogo-acotacion");
  const persEl = $("#dialogo-personaje");
  const textoEl = $("#dialogo-texto");
  const btnRevelar = $("#btn-revelar");
  const btnAudio = $("#btn-audio");

  // Acotaciones
  acotEl.textContent = (dialogo.acotaciones && dialogo.acotaciones.length)
    ? dialogo.acotaciones.join(" ")
    : "";

  if (esMio) {
    // TU TURNO: no mostramos el texto
    tarjeta.classList.add("turno-tuyo");
    persEl.textContent = dialogo.personaje + " (tú)";
    textoEl.classList.add("tu-turno-msg");
    textoEl.textContent = "🎭 TU TURNO — di tu línea";
    btnRevelar.hidden = false;
  } else {
    tarjeta.classList.remove("turno-tuyo");
    persEl.textContent = dialogo.personaje;
    textoEl.classList.remove("tu-turno-msg");
    textoEl.textContent = dialogo.texto;
    btnRevelar.hidden = true;
  }

  // Audio (pendiente): solo se muestra si hay url y el usuario activó audio
  if (estado.usarAudio && dialogo.audio_url) {
    btnAudio.hidden = false;
  } else {
    btnAudio.hidden = true;
  }

  // Botones extremos
  $("#btn-anterior").disabled = estado.indice === 0;
  $("#btn-siguiente").textContent =
    estado.indice === estado.secuencia.length - 1 ? "Fin ✓" : "Siguiente →";
}

function revelarLinea() {
  const item = estado.secuencia[estado.indice];
  if (!item || !item.esMio) return;
  const textoEl = $("#dialogo-texto");
  textoEl.classList.remove("tu-turno-msg");
  textoEl.textContent = item.dialogo.texto;
  $("#btn-revelar").hidden = true;
}

function siguiente() {
  if (estado.indice < estado.secuencia.length - 1) {
    estado.indice++;
    renderItem();
  }
}

function anterior() {
  if (estado.indice > 0) {
    estado.indice--;
    renderItem();
  }
}

/** Salta al primer diálogo de la escena anterior/siguiente dentro de la secuencia */
function saltarEscena(direccion) {
  const actual = estado.secuencia[estado.indice];
  const claveActual = actual.actoNum + "-" + actual.escenaNum;

  if (direccion > 0) {
    for (let i = estado.indice + 1; i < estado.secuencia.length; i++) {
      const k = estado.secuencia[i].actoNum + "-" + estado.secuencia[i].escenaNum;
      if (k !== claveActual) { estado.indice = i; renderItem(); return; }
    }
  } else {
    // buscar inicio de la escena actual; si ya estamos al inicio, ir a la anterior
    let inicioActual = estado.indice;
    while (inicioActual > 0) {
      const k = estado.secuencia[inicioActual - 1].actoNum + "-" + estado.secuencia[inicioActual - 1].escenaNum;
      if (k !== claveActual) break;
      inicioActual--;
    }
    if (inicioActual < estado.indice) {
      estado.indice = inicioActual; renderItem(); return;
    }
    if (inicioActual > 0) {
      // ir al inicio de la escena previa
      const prevKey = estado.secuencia[inicioActual - 1].actoNum + "-" + estado.secuencia[inicioActual - 1].escenaNum;
      let j = inicioActual - 1;
      while (j > 0) {
        const k = estado.secuencia[j - 1].actoNum + "-" + estado.secuencia[j - 1].escenaNum;
        if (k !== prevKey) break;
        j--;
      }
      estado.indice = j; renderItem();
    }
  }
}

function reproducirAudio() {
  const item = estado.secuencia[estado.indice];
  if (!item || !item.dialogo.audio_url) return;
  const rep = $("#reproductor");
  rep.src = item.dialogo.audio_url;
  rep.play().catch(() => alert("No se pudo reproducir el audio. Verifica que el archivo exista."));
}

// ---------- Eventos ----------
function initEventos() {
  $("#btn-empezar").addEventListener("click", empezarEnsayo);
  $("#btn-volver").addEventListener("click", () => mostrarPantalla("#pantalla-inicio"));
  $("#btn-siguiente").addEventListener("click", siguiente);
  $("#btn-anterior").addEventListener("click", anterior);
  $("#btn-revelar").addEventListener("click", revelarLinea);
  $("#btn-escena-sig").addEventListener("click", () => saltarEscena(1));
  $("#btn-escena-ant").addEventListener("click", () => saltarEscena(-1));
  $("#btn-audio").addEventListener("click", reproducirAudio);

  // Teclado: flechas para navegar, espacio para revelar
  document.addEventListener("keydown", (e) => {
    if (!$("#pantalla-ensayo").classList.contains("activa")) return;
    if (e.key === "ArrowRight") { siguiente(); }
    else if (e.key === "ArrowLeft") { anterior(); }
    else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); revelarLinea(); }
  });
}

// ---------- Arranque ----------
document.addEventListener("DOMContentLoaded", () => {
  pintarPersonajes();
  initEventos();
});
