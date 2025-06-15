// routes/chat.js
const express = require('express');
const router = express.Router();
const llamarGemini = require('../utils/gemini'); // Importa la función que llama a Gemini

// Ruta para chat IA
router.post('/chat', async (req, res) => {
  console.log('--- routes/chat.js: Solicitud POST a /chat recibida ---');
  const { message } = req.body; // Espera que el mensaje venga en el cuerpo como { message: "..." }

  if (!message) {
    console.log('--- routes/chat.js: Error - Mensaje vacío en la solicitud ---');
    return res.status(400).json({ response: 'El mensaje no puede estar vacío.' });
  }

  console.log(`--- routes/chat.js: Mensaje del usuario: "${message}" ---`);
  
  try {
    console.log('--- routes/chat.js: Llamando a llamarGemini para obtener respuesta de IA... ---');
    // ESTA ES LA LÍNEA CRÍTICA: Llamar a la función que interactúa con Gemini
    const respuesta = await llamarGemini(message); 
    console.log('--- routes/chat.js: Respuesta de llamarGemini recibida exitosamente ---');
    res.json({ response: respuesta }); // Envía la respuesta de Gemini de vuelta al frontend
  } catch (error) {
    console.error('--- routes/chat.js: Error en la llamada a Gemini o procesamiento: ---', error);
    // Envía un mensaje de error detallado al frontend si la llamada a Gemini falla
    res.status(500).json({ response: `Error al procesar la solicitud con Gemini: ${error.message || 'Error desconocido'}. Por favor, intenta de nuevo.` });
  }
});

module.exports = router;
