// utils/gemini.js
// Importa la biblioteca de Google Generative AI para Node.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Carga la API Key desde las variables de entorno.
// Es buena práctica tener esto aquí también, aunque app.js ya lo haga,
// en caso de que este archivo sea requerido de forma independiente en otros contextos.
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

// Asegúrate de que la API Key esté disponible
if (!API_KEY) {
    console.error("Error: La variable de entorno GEMINI_API_KEY no está definida.");
    // No usamos process.exit(1) aquí para no detener el servidor si app.js ya lo manejó,
    // pero es importante que el error sea visible y que el flujo se maneje.
    // En un entorno de producción, un exit o un sistema robusto de manejo de errores sería ideal.
    throw new Error("GEMINI_API_KEY no está definida. La API de Gemini no funcionará.");
}

// Inicializa el cliente de la API de Generative AI
const genAI = new GoogleGenerativeAI(API_KEY);

// Define el modelo a usar. 'gemini-1.5-flash' es una buena opción por su rendimiento.
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Inicia una nueva sesión de chat. Esto es importante para mantener el contexto.
// La historia del chat se mantendrá en memoria mientras el servidor esté corriendo.
// Para persistencia de historial entre reinicios o para múltiples usuarios, se necesitaría una base de datos.
const chat = model.startChat({
    history: [], // Comienza con un historial vacío.
    generationConfig: {
        maxOutputTokens: 1000, // Limita la longitud de la respuesta
    },
});

/**
 * Función para llamar a la API de Gemini y obtener una respuesta.
 * @param {string} userMessage - El mensaje del usuario para el modelo Gemini.
 * @returns {Promise<string>} La respuesta generada por Gemini.
 */
async function llamarGemini(userMessage) {
    try {
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        const text = response.text(); // Obtiene el texto de la respuesta
        return text;
    } catch (error) {
        console.error('Error en llamarGemini (interno de Gemini API):', error.message);
        // Vuelve a lanzar el error para que pueda ser capturado por el router
        // Esto es crucial para que el frontend reciba un mensaje de error JSON.
        throw new Error('Error al comunicarse con la API de Gemini: ' + error.message);
    }
}

module.exports = llamarGemini;
