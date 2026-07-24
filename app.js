/* ====================================================================
   El Avaro · App de ensayo de diálogos (100% front)
   - Selección de personaje
   - Muestra solo escenas donde el personaje habla
   - Recorre diálogo por diálogo; cuando toca tu personaje muestra "TU TURNO"
   - AUDIO:
       * Líneas de otros personajes -> reproduce el audio.
       * Tu turno -> NO suena, pero espera el mismo tiempo que dura
         tu audio (para respetar el ritmo real de la escena).
   - Modo AUTO: encadena los diálogos solo (al terminar el audio o la
     espera de tu turno, avanza al siguiente).
   ==================================================================== */

const OBRA = window.OBRA;

// ---------- Estado global ----------
const estado = {
  personaje: null,          // personaje elegido
  soloMisEscenas: true,     // filtrar escenas
  usarAudio: true,          // reproducir / cronometrar audio
  auto: false,              // avance automático encadenado
  secuencia: [],            // lista aplanada de items {acto, escena, dialogo}
  indice: 0,                // posición actual en la secuencia
  timerTurno: null,         // handle del temporizador de "tu turno"
  reproduciendo: false,     // flag para evitar solapamientos
};

// Duración por defecto (segundos) si un audio no existe o no carga.
// Se estima según la longitud del texto para que el ritmo sea razonable.
function duracionEstimada(texto) {
  const palabras = (texto || "").trim().split(/\s+/).filter(Boolean).length;
  // ~2.6 palabras por segundo + un pequeño margen
  return Math.max(1.5, palabras / 2.6 + 0.6);
}

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

function personajesParlantes() {
  const conteo = contarParlamentos();
  return Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]).map((nombre) => ({
    nombre,
    lineas: conteo[nombre],
  }));
}

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

// ---------- Control de audio / temporizadores ----------
function detenerTodo() {
  const rep = $("#reproductor");
  try { rep.pause(); } catch (e) {}
  rep.onended = null;
  rep.onerror = null;
  if (estado.timerTurno) {
    clearTimeout(estado.timerTurno);
    estado.timerTurno = null;
  }
  detenerBarra();
  estado.reproduciendo = false;
}

// Barra de progreso visual durante audio / espera de turno
let barraRAF = null;
function iniciarBarra(duracionSeg) {
  const barra = $("#barra-progreso-fill");
  if (!barra) return;
  const t0 = performance.now();
  const durMs = duracionSeg * 1000;
  function tick(now) {
    const p = Math.min(1, (now - t0) / durMs);
    barra.style.width = (p * 100) + "%";
    if (p < 1) barraRAF = requestAnimationFrame(tick);
  }
  barra.style.width = "0%";
  barraRAF = requestAnimationFrame(tick);
}
function detenerBarra() {
  if (barraRAF) { cancelAnimationFrame(barraRAF); barraRAF = null; }
  const barra = $("#barra-progreso-fill");
  if (barra) barra.style.width = "0%";
}

/**
 * Obtiene la duración (segundos) del audio de un diálogo.
 * Carga la metadata sin reproducir. Si falla, usa la estimación por texto.
 */
function obtenerDuracion(dialogo) {
  return new Promise((resolve) => {
    if (!dialogo.audio_url) { resolve(duracionEstimada(dialogo.texto)); return; }
    const a = new Audio();
    let resuelto = false;
    const fallback = setTimeout(() => {
      if (!resuelto) { resuelto = true; resolve(duracionEstimada(dialogo.texto)); }
    }, 4000);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(fallback);
      const d = isFinite(a.duration) && a.duration > 0 ? a.duration : duracionEstimada(dialogo.texto);
      resolve(d);
    };
    a.onerror = () => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(fallback);
      resolve(duracionEstimada(dialogo.texto));
    };
    a.src = dialogo.audio_url;
  });
}

// ---------- Ensayo ----------
function empezarEnsayo() {
  estado.soloMisEscenas = $("#chk-solo-mis-escenas").checked;
  estado.usarAudio = $("#chk-audio").checked;
  estado.auto = $("#chk-auto").checked;
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
  detenerTodo();
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
  const estadoEl = $("#dialogo-estado");

  acotEl.textContent = (dialogo.acotaciones && dialogo.acotaciones.length)
    ? dialogo.acotaciones.join(" ")
    : "";

  if (esMio) {
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

  // Botón de audio manual (repetir)
  btnAudio.hidden = !(estado.usarAudio && dialogo.audio_url && !esMio);

  // Botones extremos
  $("#btn-anterior").disabled = estado.indice === 0;
  $("#btn-siguiente").textContent =
    estado.indice === estado.secuencia.length - 1 ? "Fin ✓" : "Siguiente →";

  if (estadoEl) estadoEl.textContent = "";

  // --- Comportamiento de audio / tiempo ---
  if (!estado.usarAudio) return; // sin audio: navegación manual pura

  if (esMio) {
    // TU TURNO: no suena, pero esperamos el mismo tiempo que dura tu audio
    obtenerDuracion(dialogo).then((dur) => {
      if (estadoEl) estadoEl.textContent = "⏳ Tu turno (silencio) · " + dur.toFixed(1) + "s";
      iniciarBarra(dur);
      estado.timerTurno = setTimeout(() => {
        detenerBarra();
        if (estadoEl) estadoEl.textContent = "✓ Turno listo";
        if (estado.auto) siguiente();
      }, dur * 1000);
    });
  } else {
    // OTRO PERSONAJE: reproducir audio
    reproducirActual(true);
  }
}

/**
 * Reproduce el audio del diálogo actual.
 * @param {boolean} encadenar  si true y modo auto, avanza al terminar.
 */
function reproducirActual(encadenar) {
  const item = estado.secuencia[estado.indice];
  if (!item) return;
  const dialogo = item.dialogo;
  const estadoEl = $("#dialogo-estado");

  if (!dialogo.audio_url) {
    // sin archivo: cronometramos con estimación
    const dur = duracionEstimada(dialogo.texto);
    if (estadoEl) estadoEl.textContent = "🔇 Sin audio · " + dur.toFixed(1) + "s";
    iniciarBarra(dur);
    estado.timerTurno = setTimeout(() => {
      detenerBarra();
      if (encadenar && estado.auto) siguiente();
    }, dur * 1000);
    return;
  }

  const rep = $("#reproductor");
  rep.src = dialogo.audio_url;
  rep.currentTime = 0;
  estado.reproduciendo = true;

  rep.onloadedmetadata = () => {
    if (isFinite(rep.duration) && rep.duration > 0) iniciarBarra(rep.duration);
  };
  rep.onended = () => {
    estado.reproduciendo = false;
    detenerBarra();
    if (estadoEl) estadoEl.textContent = "✓ Reproducido";
    if (encadenar && estado.auto) siguiente();
  };
  rep.onerror = () => {
    // si el archivo no carga, cronometramos con estimación
    estado.reproduciendo = false;
    const dur = duracionEstimada(dialogo.texto);
    if (estadoEl) estadoEl.textContent = "⚠ Audio no disponible · " + dur.toFixed(1) + "s";
    iniciarBarra(dur);
    estado.timerTurno = setTimeout(() => {
      detenerBarra();
      if (encadenar && estado.auto) siguiente();
    }, dur * 1000);
  };

  if (estadoEl) estadoEl.textContent = "▶ Reproduciendo…";
  rep.play().catch(() => {
    // El navegador puede bloquear autoplay hasta que haya interacción.
    if (estadoEl) estadoEl.textContent = "🔈 Pulsa ▶ para escuchar (autoplay bloqueado)";
  });
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
  } else {
    detenerTodo();
  }
}

function anterior() {
  if (estado.indice > 0) {
    estado.indice--;
    renderItem();
  }
}

function saltarEscena(direccion) {
  const actual = estado.secuencia[estado.indice];
  const claveActual = actual.actoNum + "-" + actual.escenaNum;

  if (direccion > 0) {
    for (let i = estado.indice + 1; i < estado.secuencia.length; i++) {
      const k = estado.secuencia[i].actoNum + "-" + estado.secuencia[i].escenaNum;
      if (k !== claveActual) { estado.indice = i; renderItem(); return; }
    }
  } else {
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

// Botón manual: repite el audio del diálogo actual (sin encadenar)
function repetirAudio() {
  const item = estado.secuencia[estado.indice];
  if (!item || item.esMio) return;
  detenerTodo();
  reproducirActual(false);
}

// Alternar modo auto en caliente
function toggleAuto() {
  estado.auto = $("#chk-auto-ensayo").checked;
}

// ---------- Eventos ----------
function initEventos() {
  $("#btn-empezar").addEventListener("click", empezarEnsayo);
  $("#btn-volver").addEventListener("click", () => { detenerTodo(); mostrarPantalla("#pantalla-inicio"); });
  $("#btn-siguiente").addEventListener("click", siguiente);
  $("#btn-anterior").addEventListener("click", anterior);
  $("#btn-revelar").addEventListener("click", revelarLinea);
  $("#btn-escena-sig").addEventListener("click", () => saltarEscena(1));
  $("#btn-escena-ant").addEventListener("click", () => saltarEscena(-1));
  $("#btn-audio").addEventListener("click", repetirAudio);

  const chkAutoEnsayo = $("#chk-auto-ensayo");
  if (chkAutoEnsayo) chkAutoEnsayo.addEventListener("change", toggleAuto);

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
