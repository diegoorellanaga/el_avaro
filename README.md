# El Avaro · App de ensayo de diálogos

App **100% front** (HTML + CSS + JS, sin backend ni build) para practicar los diálogos de *El Avaro* de Molière. Eliges tu personaje y la app te va mostrando los diálogos previos escena por escena; cuando te toca a ti no te muestra tu línea, te dice **"TU TURNO"**.

Ideal para publicar gratis en **GitHub Pages**.

---

## Contenido

```
el-avaro-app/
├── index.html          # estructura de la app
├── style.css           # estilos
├── app.js              # lógica (selección de personaje + ensayo)
├── data.js             # el libreto completo en JSON (window.OBRA = {...})
├── el_avaro.json       # el mismo libreto como .json puro (por si lo necesitas)
├── generar_audio.py    # script Python para generar el audio LOCALMENTE
├── audio/              # aquí se guardarán los .mp3/.wav generados
└── README.md
```

---

## Cómo funciona la app

1. **Elige tu personaje.** Se listan todos los personajes con diálogo, ordenados por número de líneas.
2. **Ajustes:**
   - *Mostrar solo escenas donde hablo:* filtra y solo verás las escenas en las que tu personaje interviene.
   - *Reproducir audio:* si generaste los audios, muestra un botón de reproducción.
3. **Ensayo:**
   - Verás cada diálogo anterior con su personaje, sus acotaciones *(entre paréntesis, en cursiva)* y su texto.
   - Cuando le toca a **tu personaje**, la tarjeta se pone verde y dice **"🎭 TU TURNO — di tu línea"** sin mostrar el texto.
   - Pulsa **Siguiente →** para avanzar (al siguiente diálogo o a tu turno de nuevo).
   - Botón **Revelar mi línea** (o barra espaciadora) por si quieres comprobar.
   - Flechas ← → del teclado para navegar; ⏮ / ⏭ para saltar de escena.

---

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `el-avaro-ensayo`).
2. Sube **todo el contenido de esta carpeta** a la raíz del repo:
   ```bash
   cd el-avaro-app
   git init
   git add .
   git commit -m "App de ensayo El Avaro"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/el-avaro-ensayo.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/root`. Guarda.
4. En 1-2 minutos tu app estará en:
   `https://TU_USUARIO.github.io/el-avaro-ensayo/`

> No necesitas ningún servidor: `data.js` embebe el libreto, así que funciona incluso abriendo `index.html` directo en el navegador.

---

## Generar el audio (LOCAL, en tu PC Ubuntu)

El audio queda **pendiente**: los diálogos tienen `audio_url: null` hasta que corras el script. `generar_audio.py` crea un archivo por diálogo en `audio/` y actualiza el `audio_url` en `data.js`.

### 1. Elige un motor de TTS

| Motor | Offline | Calidad | Salida | Instalación |
|-------|---------|---------|--------|-------------|
| **piper** (recomendado) | ✅ | Natural | `.wav` | `pip install piper-tts` + descargar una voz `.onnx` en español |
| **gtts** | ❌ (internet) | Buena | `.mp3` | `pip install gTTS` |
| **pyttsx3** | ✅ | Robótica | `.wav` | `sudo apt install espeak-ng` + `pip install pyttsx3` |

**Piper** (mejor resultado offline): descarga una voz en español de
[huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/es)
(necesitas el `.onnx` y su `.onnx.json`, p. ej. `es_ES-davefx-medium.onnx`) y déjalos junto al script.

### 2. Ejecuta

```bash
# Prueba rápida (primeros 10 diálogos) con gTTS:
python3 generar_audio.py --motor gtts --limite 10

# Todo con Piper (offline):
python3 generar_audio.py --motor piper

# Solo el acto 1, offline con voces del sistema:
python3 generar_audio.py --motor pyttsx3 --acto 1
```

Opciones:
- `--limite N` — genera solo los primeros N (para probar).
- `--acto N` — genera solo un acto.
- `--sobrescribir` — regenera aunque el archivo ya exista.
- `--incluir-acotaciones` — locuta también las acotaciones.
- `--voz-piper RUTA.onnx` — modelo Piper específico.
- `--json el_avaro.json` — usar el .json en vez de data.js.

### 3. Sube los audios

Tras generar, `audio/` tendrá los archivos y `data.js` apuntará a ellos.
Haz `git add . && git commit && git push` y activa "Reproducir audio" en la app.

---

## Estructura del JSON (`data.js` / `el_avaro.json`)

```json
{
  "titulo": "EL AVARO",
  "autor": "Molière",
  "personajes": ["HARPAGÓN, padre de...", "..."],
  "actos": [
    {
      "numero": 1,
      "titulo": "ACTO PRIMERO",
      "escenas": [
        {
          "numero": 1,
          "titulo": "ESCENA I",
          "encabezado": "VALERIO y ELISA",
          "personajes_en_escena": ["VALERIO", "ELISA"],
          "dialogos": [
            {
              "id": "A1E1D1",
              "orden": 1,
              "personaje": "VALERIO",
              "texto": "¡Cómo, encantadora Elisa...",
              "acotaciones": [],
              "audio_url": null,
              "tiempo_espera": 0
            }
          ]
        }
      ]
    }
  ]
}
```

Campos por diálogo:
- `id` — identificador único (`A{acto}E{escena}D{orden}`), usado como nombre del audio.
- `personaje` — quién habla.
- `texto` — la línea hablada (sin acotaciones).
- `acotaciones` — lista de indicaciones escénicas *(Aparte.)*, *(A Elisa.)*, etc.
- `audio_url` — ruta al audio (placeholder `null` hasta generarlo).
- `tiempo_espera` — segundos de pausa sugeridos (0 por defecto; ajústalo si quieres).
