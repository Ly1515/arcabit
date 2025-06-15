// routes/preguntas.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises; // Importa el módulo fs.promises para operaciones asíncronas de archivos
const path = require('path'); // Importa el módulo path para manejar rutas de archivos

// Define la ruta al archivo JSON donde se guardarán las preguntas.
// Se asume que el archivo 'preguntas.json' está en la carpeta 'data/' relativa a este archivo.
const QUESTIONS_FILE_PATH = path.join(__dirname, '../data/preguntas.json');

// Preguntas predefinidas que se usarán si el archivo JSON no existe o está vacío.
const defaultQuestions = [
    { id: 'q1', texto: '¿Cuál es tu color favorito?', tipo: 'opciones', opciones: 'Rojo, Azul, Verde, Amarillo' },
    { id: 'q2', texto: '¿Qué servicios ofrecemos?', tipo: 'checkbox', opciones: 'Desarrollo Web, Diseño Gráfico, Consultoría SEO' },
    { id: 'q3', texto: 'Por favor, describe tu problema.', tipo: 'texto' }
];

// Array en memoria que contendrá las preguntas cargadas desde el archivo.
let questions = [];
let nextQuestionId = 1; // Para generar IDs únicos

// Función para cargar las preguntas desde el archivo JSON
async function loadQuestionsFromFile() {
    try {
        const data = await fs.readFile(QUESTIONS_FILE_PATH, 'utf8');
        const parsedQuestions = JSON.parse(data);
        
        if (parsedQuestions.length > 0) {
            questions = parsedQuestions;
            console.log('Preguntas cargadas desde preguntas.json');
            // Asegúrate de que nextQuestionId sea mayor que cualquier ID existente
            const maxId = Math.max(...questions.map(q => parseInt(q.id.replace('q', '')) || 0)); // Añadir || 0 para manejar IDs no numéricos
            nextQuestionId = maxId + 1;
        } else {
            // Si el archivo existe pero está vacío, usa las preguntas predefinidas
            questions = [...defaultQuestions]; // Usa una copia para no modificar el original
            console.log('El archivo preguntas.json está vacío. Cargando preguntas predefinidas.');
            // Determina el siguiente ID basándose en las predefinidas
            const maxId = Math.max(...defaultQuestions.map(q => parseInt(q.id.replace('q', '')) || 0));
            nextQuestionId = maxId + 1;
            await saveQuestionsToFile(); // Guarda las predefinidas en el archivo
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn('El archivo preguntas.json no existe. Creando uno nuevo con preguntas predefinidas.');
            questions = [...defaultQuestions]; // Inicializa con predefinidas si el archivo no existe
            // Determina el siguiente ID basándose en las predefinidas
            const maxId = Math.max(...defaultQuestions.map(q => parseInt(q.id.replace('q', '')) || 0));
            nextQuestionId = maxId + 1;
            await saveQuestionsToFile(); // Crea el archivo con las preguntas predefinidas
        } else {
            console.error('Error al cargar preguntas desde el archivo:', error);
            // Si hay un error al leer/parsear, inicializa con predefinidas para evitar fallos
            questions = [...defaultQuestions];
            const maxId = Math.max(...defaultQuestions.map(q => parseInt(q.id.replace('q', '')) || 0));
            nextQuestionId = maxId + 1;
            await saveQuestionsToFile(); // Intenta sobrescribir con predefinidas si hay un error de formato
        }
    }
}

// Función para guardar las preguntas en el archivo JSON
async function saveQuestionsToFile() {
    try {
        const data = JSON.stringify(questions, null, 2); // Formato legible con 2 espacios de indentación
        await fs.writeFile(QUESTIONS_FILE_PATH, data, 'utf8');
        console.log('Preguntas guardadas en preguntas.json');
    } catch (error) {
        console.error('Error al guardar preguntas en el archivo:', error);
    }
}

// Carga las preguntas al iniciar el módulo (una vez por cada vez que se requiera este archivo)
// Esto asegura que 'questions' esté poblado antes de que se manejen las rutas.
// Es importante que esta función se llame y se complete antes de que se realicen operaciones CRUD.
loadQuestionsFromFile();


/**
 * @route GET /api/preguntas
 * @desc Obtiene todas las preguntas
 */
router.get('/', (req, res) => {
    res.json(questions);
});

/**
 * @route POST /api/preguntas
 * @desc Crea una nueva pregunta
 */
router.post('/', async (req, res) => {
    const { texto, tipo, opciones } = req.body;
    if (!texto || !tipo) {
        return res.status(400).json({ error: 'Texto y tipo de pregunta son requeridos.' });
    }
    // Genera un ID único para la nueva pregunta
    const newQuestion = { id: `q${nextQuestionId++}`, texto, tipo, opciones: opciones || '' };
    questions.push(newQuestion);
    await saveQuestionsToFile(); // Guarda los cambios después de añadir
    res.status(201).json(newQuestion);
});

/**
 * @route GET /api/preguntas/:id
 * @desc Obtiene una pregunta específica por ID
 */
router.get('/:id', (req, res) => {
    const question = questions.find(q => q.id === req.params.id);
    if (question) {
        res.json(question);
    } else {
        res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
});

/**
 * @route PUT /api/preguntas/:id
 * @desc Actualiza una pregunta existente por ID
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { texto, tipo, opciones } = req.body;
    const questionIndex = questions.findIndex(q => q.id === id);

    if (questionIndex > -1) {
        // Actualiza solo los campos proporcionados, manteniendo los existentes
        questions[questionIndex] = { ...questions[questionIndex], texto, tipo, opciones: opciones || '' };
        await saveQuestionsToFile(); // Guarda los cambios después de actualizar
        res.json(questions[questionIndex]);
    } else {
        res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
});

/**
 * @route DELETE /api/preguntas/:id
 * @desc Elimina una pregunta por ID
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const initialLength = questions.length;
    questions = questions.filter(q => q.id !== id);
    if (questions.length < initialLength) {
        await saveQuestionsToFile(); // Guarda los cambios después de eliminar
        res.status(200).json({ message: 'Pregunta eliminada correctamente.' });
    } else {
        res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
});

module.exports = router;
