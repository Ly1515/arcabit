import re
import sys
import json

# --- Palabras clave a detectar ---
# Hemos anadido variaciones verbales y otras formas para mejorar la deteccion.
PALABRAS_CLAVE = [
    # Palabras clave para Quejas
    "queja", "quejar", "quejarse", "quejas", "malo", "pesimo", "terrible", 
    "problema", "fallo", "defecto", "dificil", "complicado", "error", 
    "lento", "no funciona", "defectuoso", "inaccesible", "frustrante",

    # Palabras clave para Recomendaciones
    "recomendacion", "recomendar", "recomendaciones", "sugerencia", 
    "mejora", "mejorar", "propuesta", "ideas", "añadir", "agregar", 
    "implementar", "futuro", "desarrollar", "innovar", "sugerir",

    # Palabras clave para Satisfaccion
    "satisfecho", "satisfecha", "satisfaccion", "satisfechos", "satisfechas", 
    "satisfactorio", "satisfactoria", "excelente", "bueno", "perfecto", 
    "agradable", "feliz", "facil", "simple", "rapido", "util", "eficiente", 
    "contento", "increible", "genial"
]

def normalizar_texto(texto):
    """
    Convierte el texto a minusculas y elimina signos de puntuacion (excepto espacios),
    preparandolo para una deteccion insensible a mayusculas/minusculas.
    """
    texto = texto.lower()
    return texto

def dividir_en_oraciones(parrafo):
    """
    Divide un parrafo en una lista de oraciones.
    Usa una regex simple para detectar finales de oracion (., !, ?).
    """
    # Expresion regular para dividir por punto, signo de exclamacion o interrogacion,
    # seguido opcionalmente de comillas o parentesis, y luego espacio en blanco.
    # La adicion de |(?:\n\s*\n) permite dividir tambien por dos saltos de linea (parrafos vacios).
    sentences = re.split(r'(?<=[.!?])\s+|\n\s*\n', parrafo.strip())
    # Filtra oraciones vacias que puedan resultar de la division
    return [s.strip() for s in sentences if s.strip()]

def detectar_palabras_clave(parrafo, palabras_clave):
    """
    Detecta si alguna de las palabras clave esta presente en el parrafo,
    analizando oracion por oracion.
    Retorna un diccionario con:
    - 'detected_keywords': una lista de las palabras clave unicas encontradas.
    - 'matched_sentences': un diccionario mapeando cada palabra clave detectada
      a la primera oracion en la que fue encontrada.
    """
    oraciones = dividir_en_oraciones(parrafo)
    palabras_encontradas_totales = set() # Usamos un set para asegurar unicidad
    keyword_to_sentence_map = {} # Para almacenar la primera oracion donde se encontro la palabra clave

    for oracion in oraciones:
        oracion_normalizada_para_busqueda = normalizar_texto(oracion)
        # Limpiar cualquier puntuacion remanente dentro de la oracion despues de normalizarla.
        # Esto es importante para el `\b` de la regex de busqueda de palabras.
        oracion_normalizada_para_busqueda = re.sub(r'[^\w\s]', '', oracion_normalizada_para_busqueda)

        for palabra_clave in palabras_clave:
            palabra_clave_normalizada = normalizar_texto(palabra_clave)
            patron = r'\b' + re.escape(palabra_clave_normalizada) + r'\b'
            
            if re.search(patron, oracion_normalizada_para_busqueda):
                # Solo guarda la primera oracion para esa palabra clave si aún no se ha mapeado
                if palabra_clave not in palabras_encontradas_totales: 
                    keyword_to_sentence_map[palabra_clave] = oracion.strip() # Guarda la oracion original.
                palabras_encontradas_totales.add(palabra_clave)
    
    return {
        "detected_keywords": list(palabras_encontradas_totales),
        "matched_sentences": keyword_to_sentence_map
    }

# --- Funcion principal para ser llamada desde Node.js ---
if __name__ == "__main__":
    if len(sys.argv) > 1:
        parrafo_recibido = sys.argv[1]
        detection_results = detectar_palabras_clave(parrafo_recibido, PALABRAS_CLAVE)
        
        # Imprime el resultado completo (keywords y oraciones coincidentes)
        print(json.dumps(detection_results))
    else:
        error_output = {
            "error": "No se proporciono un parrafo para analizar al script de Python.",
            "detected_keywords": [],
            "matched_sentences": {}
        }
        print(json.dumps(error_output))
