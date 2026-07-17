#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================
 generar_audio.py  ·  TTS local para "El Avaro"
============================================================
Genera un archivo de audio por cada diálogo del libreto y
actualiza el campo "audio_url" dentro de data.js / el_avaro.json.

Pensado para correr LOCALMENTE en Ubuntu Linux.
Es 100% offline si usas Piper (recomendado); también soporta
gTTS (requiere internet) y pyttsx3 (offline, voz robótica).

------------------------------------------------------------
 USO RÁPIDO
------------------------------------------------------------
1) Elige un motor e instálalo (ver más abajo).
2) Ejecuta:

     python3 generar_audio.py --motor piper
     # o
     python3 generar_audio.py --motor gtts
     # o
     python3 generar_audio.py --motor pyttsx3

Opciones útiles:
     --limite 20        -> genera solo los primeros 20 (para probar)
     --acto 1           -> genera solo el acto 1
     --sobrescribir     -> regenera aunque el .mp3/.wav ya exista
     --json el_avaro.json  (por defecto usa data.js)

------------------------------------------------------------
 INSTALACIÓN DE MOTORES
------------------------------------------------------------
### Opción A · Piper (RECOMENDADO: offline, voz natural)
    pip install piper-tts
    # Descarga una voz en español (ejemplo, voz "davefx" de España):
    #   https://huggingface.co/rhasspy/piper-voices/tree/main/es
    # Necesitas 2 archivos: el .onnx y su .onnx.json, por ejemplo:
    #   es_ES-davefx-medium.onnx
    #   es_ES-davefx-medium.onnx.json
    # Colócalos junto a este script o pásalos con --voz-piper RUTA.onnx
    # Salida: archivos .wav

### Opción B · gTTS (fácil, requiere internet)
    pip install gTTS
    # Salida: archivos .mp3

### Opción C · pyttsx3 (offline, usa voces del sistema / espeak)
    sudo apt-get install espeak-ng
    pip install pyttsx3
    # Salida: archivos .wav

------------------------------------------------------------
 RESULTADO
------------------------------------------------------------
- Los audios se guardan en la carpeta ./audio/ con el nombre <id>.wav|mp3
  (por ejemplo audio/A1E1D1.mp3)
- Se actualiza el campo audio_url de cada diálogo a "audio/<id>.<ext>"
- La app web los reproducirá automáticamente cuando actives "Reproducir audio".
============================================================
"""

import argparse
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
CARPETA_AUDIO = os.path.join(AQUI, "audio")


# ----------------------------------------------------------------------
# Carga / guardado del libreto (soporta data.js o el_avaro.json)
# ----------------------------------------------------------------------
def cargar_obra(ruta):
    """Carga la obra desde data.js (window.OBRA = {...};) o desde un .json."""
    with open(ruta, encoding="utf-8") as f:
        contenido = f.read()
    if ruta.endswith(".js"):
        m = re.search(r"window\.OBRA\s*=\s*(\{.*\})\s*;?\s*$", contenido, re.DOTALL)
        if not m:
            raise ValueError("No se encontró 'window.OBRA = {...}' en el archivo .js")
        return json.loads(m.group(1))
    return json.loads(contenido)


def guardar_obra(ruta, obra):
    """Guarda respetando el formato (data.js o .json)."""
    if ruta.endswith(".js"):
        with open(ruta, "w", encoding="utf-8") as f:
            f.write("// Libreto El Avaro - generado automaticamente desde el PDF\n")
            f.write("window.OBRA = ")
            json.dump(obra, f, ensure_ascii=False, indent=2)
            f.write(";\n")
    else:
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(obra, f, ensure_ascii=False, indent=2)


# ----------------------------------------------------------------------
# Texto a locutar: incluye acotaciones + texto hablado
# ----------------------------------------------------------------------
def texto_para_locutar(dialogo, incluir_acotaciones=False):
    partes = []
    if incluir_acotaciones and dialogo.get("acotaciones"):
        # quitamos paréntesis para que suene más natural
        acot = " ".join(a.strip("()") for a in dialogo["acotaciones"])
        if acot:
            partes.append(acot + ".")
    partes.append(dialogo.get("texto", ""))
    return " ".join(p for p in partes if p).strip()


# ----------------------------------------------------------------------
# Motores TTS
# ----------------------------------------------------------------------
class MotorGTTS:
    ext = "mp3"

    def __init__(self, **kw):
        from gtts import gTTS  # noqa
        self._gTTS = gTTS

    def sintetizar(self, texto, ruta_salida):
        tts = self._gTTS(text=texto, lang="es", slow=False)
        tts.save(ruta_salida)


class MotorPyttsx3:
    ext = "wav"

    def __init__(self, velocidad=170, **kw):
        import pyttsx3
        self.engine = pyttsx3.init()
        self.engine.setProperty("rate", velocidad)
        # intenta seleccionar una voz en español
        for v in self.engine.getProperty("voices"):
            if "spanish" in v.name.lower() or "es" in (getattr(v, "languages", []) or [""])[0].lower() or "es" in v.id.lower():
                self.engine.setProperty("voice", v.id)
                break

    def sintetizar(self, texto, ruta_salida):
        self.engine.save_to_file(texto, ruta_salida)
        self.engine.runAndWait()


class MotorPiper:
    ext = "wav"

    def __init__(self, voz_piper=None, **kw):
        from piper import PiperVoice  # pip install piper-tts
        self._wave = __import__("wave")
        if voz_piper is None:
            # busca un .onnx en la carpeta del script
            candidatos = [f for f in os.listdir(AQUI) if f.endswith(".onnx")]
            if not candidatos:
                raise FileNotFoundError(
                    "No se encontró ningún modelo .onnx de Piper. "
                    "Descarga una voz en español y pásala con --voz-piper RUTA.onnx"
                )
            voz_piper = os.path.join(AQUI, candidatos[0])
        print(f"  Voz Piper: {os.path.basename(voz_piper)}")
        self.voice = PiperVoice.load(voz_piper)

    def sintetizar(self, texto, ruta_salida):
        with self._wave.open(ruta_salida, "wb") as wav:
            self.voice.synthesize(texto, wav)


MOTORES = {
    "gtts": MotorGTTS,
    "pyttsx3": MotorPyttsx3,
    "piper": MotorPiper,
}


# ----------------------------------------------------------------------
# Programa principal
# ----------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Genera audio TTS local para El Avaro")
    ap.add_argument("--motor", choices=MOTORES.keys(), default="gtts",
                    help="Motor TTS a usar (por defecto: gtts)")
    ap.add_argument("--json", default=os.path.join(AQUI, "data.js"),
                    help="Ruta al libreto (data.js o el_avaro.json)")
    ap.add_argument("--voz-piper", default=None,
                    help="Ruta al modelo .onnx de Piper (solo motor piper)")
    ap.add_argument("--velocidad", type=int, default=170,
                    help="Velocidad para pyttsx3")
    ap.add_argument("--acto", type=int, default=None,
                    help="Generar solo un acto (número)")
    ap.add_argument("--limite", type=int, default=None,
                    help="Generar solo los primeros N diálogos (para pruebas)")
    ap.add_argument("--incluir-acotaciones", action="store_true",
                    help="Locutar también las acotaciones escénicas")
    ap.add_argument("--sobrescribir", action="store_true",
                    help="Regenerar aunque el archivo ya exista")
    args = ap.parse_args()

    # Inicializa motor
    try:
        motor = MOTORES[args.motor](voz_piper=args.voz_piper, velocidad=args.velocidad)
    except ImportError as e:
        print(f"[ERROR] Falta instalar el motor '{args.motor}': {e}")
        print("Revisa la sección INSTALACIÓN DE MOTORES en la cabecera de este script.")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] No se pudo inicializar el motor '{args.motor}': {e}")
        sys.exit(1)

    ext = motor.ext
    os.makedirs(CARPETA_AUDIO, exist_ok=True)

    obra = cargar_obra(args.json)

    total = 0
    hechos = 0
    saltados = 0
    errores = 0

    for acto in obra["actos"]:
        if args.acto is not None and acto["numero"] != args.acto:
            continue
        for escena in acto["escenas"]:
            for dialogo in escena["dialogos"]:
                total += 1
                if args.limite is not None and total > args.limite:
                    break

                did = dialogo["id"]
                nombre_archivo = f"{did}.{ext}"
                ruta_salida = os.path.join(CARPETA_AUDIO, nombre_archivo)
                ruta_relativa = f"audio/{nombre_archivo}"

                # actualiza siempre el puntero en el JSON
                dialogo["audio_url"] = ruta_relativa

                if os.path.exists(ruta_salida) and not args.sobrescribir:
                    saltados += 1
                    continue

                texto = texto_para_locutar(dialogo, args.incluir_acotaciones)
                if not texto:
                    continue

                try:
                    motor.sintetizar(texto, ruta_salida)
                    hechos += 1
                    print(f"[{hechos:>4}] {did}  {dialogo['personaje']:<14} "
                          f"{texto[:45]}{'…' if len(texto) > 45 else ''}")
                except Exception as e:
                    errores += 1
                    print(f"[ERROR] {did}: {e}")

    # Guarda el JSON con los audio_url actualizados
    guardar_obra(args.json, obra)

    print("\n" + "=" * 50)
    print(f"Generados : {hechos}")
    print(f"Saltados  : {saltados} (ya existían; usa --sobrescribir para rehacer)")
    print(f"Errores   : {errores}")
    print(f"Audios en : {CARPETA_AUDIO}/")
    print(f"Libreto   : {args.json} (campo audio_url actualizado)")
    print("=" * 50)
    print("\nListo. Sube la carpeta completa a GitHub y activa el audio en la app.")


if __name__ == "__main__":
    main()
