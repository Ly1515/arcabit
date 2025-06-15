import asyncio
import json
import websockets
import sqlite3 # Importamos la librería para SQLite

# --- Función para buscar en la base de datos (tiendas.db) ---
def buscar_tienda_en_db(card_id):
    conn = None # Inicializamos conn a None
    try:
        # Conectar a la base de datos SQLite
        # Asegúrate de que tiendas.db esté en la misma carpeta que server.py
        conn = sqlite3.connect('tiendas.db')
        cursor = conn.cursor()

        # Crear la tabla 'tiendas' si no existe
        # Esto es útil para la primera ejecución o si el archivo db se borra
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tiendas (
                card_id TEXT PRIMARY KEY,
                nombre TEXT,
                ubicacion TEXT
            )
        ''')
        # Puedes insertar datos de prueba aquí si necesitas que existan en tu DB
        # ¡IMPORTANTE! Comenta estas líneas después de la primera ejecución si no quieres duplicados
        # Ejemplo:
        # cursor.execute("INSERT OR IGNORE INTO tiendas (card_id, nombre, ubicacion) VALUES (?, ?, ?)", ('044B7DBA5D1590', 'Mi Tienda Favorita', 'Centro Comercial XYZ'))
        # cursor.execute("INSERT OR IGNORE INTO tiendas (card_id, nombre, ubicacion) VALUES (?, ?, ?)", ('OTROIDDELATARJETA', 'Cafetería Rápida', 'Avenida Siempre Viva 742'))
        # conn.commit() # ¡Importante hacer commit después de INSERT/UPDATE

        # Ejecutar la consulta SQL para buscar la tienda por card_id
        cursor.execute("SELECT nombre, ubicacion FROM tiendas WHERE card_id = ?", (card_id,))

        # Obtener el resultado
        tienda = cursor.fetchone()

        if tienda:
            # Retorna un diccionario con el nombre y la ubicación
            return {"nombre": tienda[0], "ubicacion": tienda[1]}
        else:
            return None # Si no encuentra la tienda, retorna None

    except sqlite3.Error as e:
        print(f"Error de base de datos al buscar tienda: {e}")
        return None # En caso de error, también retorna None
    finally:
        if conn:
            conn.close() # Asegurarse de cerrar la conexión
# -------------------------------------------------------------


async def handler(websocket, path):
    print(f"Cliente conectado: {websocket.remote_address}")
    try:
        async for message in websocket:
            data = json.loads(message)
            print(f"Mensaje recibido del cliente: {data}")

            # Lógica para manejar el ID de la tarjeta (simulado o real desde tu lector RFID)
            # En un caso real, un script separado o un dispositivo enviaría "cardScanned" al backend.
            # Aquí, lo simulamos recibiendo ese tipo de mensaje.
            if data.get("type") == "cardScanned":
                card_id = data.get("cardId")
                print(f"ID de tarjeta recibido: {card_id}")

                # Aquí es donde usamos la función para buscar en la DB
                store_info = buscar_tienda_en_db(card_id)

                if store_info:
                    await websocket.send(json.dumps({
                        "type": "storeInfo",
                        "data": {
                            "cardId": card_id,
                            "storeName": store_info["nombre"],
                            "storeLocation": store_info["ubicacion"]
                        }
                    }))
                    print(f"Información de tienda enviada para ID: {card_id}")
                else:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": f"No se encontró información para la tarjeta ID: {card_id}. Por favor, verifica el ID."
                    }))
                    print(f"Error: No se encontró información para ID: {card_id}")

            elif data.get("type") == "submitAnswers":
                # Este es el tipo de mensaje que tu frontend enviaría con las respuestas del formulario
                answers = data.get("answers")
                print(f"Respuestas recibidas: {answers}")
                # Aquí puedes añadir la lógica para guardar estas respuestas en otra tabla de tu DB
                # Por ejemplo, una tabla `respuestas_encuesta`

                # Simulación de detección de palabras clave (solo para mostrar la funcionalidad)
                keywords_detected = {}
                if 'q12' in answers and answers['q12']: # Si la pregunta q12 (texto) tiene respuesta
                    # Ejemplo simple: buscar "malo", "lento", "bug"
                    text_q12 = answers['q12'].lower()
                    found_keywords_q12 = []
                    if "malo" in text_q12 or "dificil" in text_q12:
                        found_keywords_q12.append("negativo_uso")
                    if "lento" in text_q12 or "tarda" in text_q12:
                        found_keywords_q12.append("rendimiento_lento")
                    if "bug" in text_q12 or "error" in text_q12:
                        found_keywords_q12.append("error_tecnico")
                    if found_keywords_q12:
                        keywords_detected['q12'] = found_keywords_q12

                if 'q16' in answers and answers['q16']: # Si la pregunta q16 (problema técnico) tiene respuesta
                    text_q16 = answers['q16'].lower()
                    found_keywords_q16 = []
                    if "cae" in text_q16 or "cierra" in text_q16:
                        found_keywords_q16.append("cierre_inesperado")
                    if "no carga" in text_q16 or "cargando" in text_q16:
                        found_keywords_q16.append("problema_carga")
                    if "bloquea" in text_q16 or "congela" in text_q16:
                        found_keywords_q16.append("interfaz_bloqueada")
                    if found_keywords_q16:
                        keywords_detected['q16'] = found_keywords_q16

                # Enviar confirmación de éxito y las palabras clave detectadas
                await websocket.send(json.dumps({
                    "type": "submissionStatus",
                    "message": "Respuestas recibidas con éxito!",
                    "keywords": keywords_detected # Enviamos las palabras clave al frontend
                }))

    except websockets.exceptions.ConnectionClosedOK:
        print("Conexión WebSocket cerrada limpiamente.")
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Conexión WebSocket cerrada con error: {e}")
    except Exception as e:
        print(f"Error inesperado en el handler: {e}")
    finally:
        print(f"Cliente desconectado: {websocket.remote_address}")


async def main():
    # Antes de iniciar el servidor, asegúrate de que la DB y la tabla están listas
    # Puedes llamar a buscar_tienda_en_db con un ID dummy para forzar la creación
    # o crearla manualmente si prefieres. Las líneas CREATE TABLE en la función se encargarán.
    
    async with websockets.serve(handler, "localhost", 3000):
        print("Servidor WebSocket iniciado en ws://localhost:3000")
        await asyncio.Future()  # Corre indefinidamente hasta que se detenga manualmente

if __name__ == "__main__":
    asyncio.run(main())