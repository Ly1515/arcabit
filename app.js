// Importar módulos necesarios con la sintaxis ES
import 'dotenv/config'; // Carga las variables de entorno al inicio. ¡ESENCIAL!
import express from 'express';
import cors from 'cors';
import session from 'express-session'; // Importar express-session
import { spawn } from 'child_process'; // Para ejecutar scripts de Python (Mantenido para la función, aunque la detección principal es en JS)
import sqlite3 from 'sqlite3'; // Para la base de datos SQLite
import path from 'path';
import * as fsPromises from 'fs/promises'; // Usar fsPromises para operaciones asíncronas con promesas
import fs from 'fs'; // Usar fs para operaciones de stream como createReadStream
import csv from 'csv-parser'; // Para parsear archivos CSV
import * as turf from '@turf/turf'; // Para operaciones geoespaciales
import { fileURLToPath } from 'url';
import { Readable } from 'stream'; // Importar Readable para el pipe del CSV

// Reemplazo para __dirname y __filename en Módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importa tus routers existentes.
// Asegúrate de que tus routers (chat.js, preguntas.js) usen 'export default router;'
import chatRoutes from './routes/chat.js';
import preguntasRoutes from './routes/preguntas.js';

console.log('--- app.js: Iniciando carga de configuración ---');

const app = express();
const PORT = process.env.PORT || 8001; // Unificar puerto

console.log(`--- app.js: Puerto configurado a ${PORT} ---`);

// --- Configuración de la Base de Datos SQLite ---
const DB_FILE = path.join(__dirname, "parrafos_con_palabras_clave.db");

const TABLE_QUEJA = 'respuestas_queja';
const TABLE_RECOMENDACION = 'respuestas_recomendacion';
const TABLE_SATISFACCION = 'respuestas_satisfaccion';

const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        // Asegúrate de que la columna 'tipo_pregunta' exista en tus tablas
        const createTableQuery = (tableName) => `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                parrafo TEXT NOT NULL,
                palabras_clave_detectadas TEXT,
                fecha_deteccion TEXT NOT NULL,
                tipo_pregunta TEXT -- Añadimos una columna para identificar la pregunta original (ej. 'q3')
            )`;
        db.run(createTableQuery(TABLE_QUEJA));
        db.run(createTableQuery(TABLE_RECOMENDACION));
        db.run(createTableQuery(TABLE_SATISFACCION));
    }
});


// --- Configuración de Express-Session ---
let users = []; // Declarar users en un scope más alto
const USERS_DB_PATH = path.join(__dirname, 'users_db.json');

console.log("ADMIN_USER:", process.env.ADMIN_USER);
console.log("SUPERUSER_USER:", process.env.SUPERUSER_USER);


async function loadUsers() {
    try {
        const data = await fsPromises.readFile(USERS_DB_PATH, 'utf8'); // Usar fsPromises
        const parsedData = JSON.parse(data); //
        // Asegúrate de que el JSON contenga un array 'users'
        if (parsedData && Array.isArray(parsedData.users)) { //
            users = parsedData.users; // Acceder al array 'users' del JSON
            console.log('--- app.js: Usuarios de users_db.json cargados ---');
        } else {
            console.warn('--- app.js: users_db.json no contiene un array "users" válido. Iniciando con usuarios vacíos. ---');
            users = []; //
        }
    } catch (e) {
        if (e.code === 'ENOENT') { //
            console.warn('--- app.js: users_db.json no encontrado. Iniciando con usuarios vacíos. ---');
            // Opcional: Crear un users_db.json por defecto si no existe para empezar
            // Asegúrate de que este admin por defecto sea solo para desarrollo.
            users = [
                { id: 'json_admin_01', username: 'adminjson', password: 'passwordjson', role: 'admin' },
                { id: 'json_super_user_01', username: 'superuserjson', password: 'superpassjson', role: 'super-user' },
                { id: 'json_regular_user_01', username: 'regularuserjson', password: 'regularpassjson', role: 'user' }
            ];
            try {
                await fsPromises.writeFile(USERS_DB_PATH, JSON.stringify({ users }, null, 2), 'utf8'); // Usar fsPromises
                console.log('--- app.js: users_db.json por defecto creado con admin, super-user y user ---');
            } catch (writeErr) {
                console.error('--- app.js: Error al crear users_db.json por defecto:', writeErr); //
            }
        } else {
            console.error('--- app.js: Error al cargar datos de usuarios:', e); //
            users = [];
        }
    }
}

// Cargar usuarios al iniciar la aplicación
loadUsers();

// --- Middlewares Globales ---
app.use(express.json()); //
app.use(express.urlencoded({ extended: true })); //

app.use(session({
    secret: 'cvgbhnjkmfpeoiwqnkdaojihjkq', // Usa una cadena secreta fuerte
    resave: false, //
    saveUninitialized: false, //
    cookie: {
        maxAge: 60 * 60 * 1000, // 1 hora de duración de la sesión
        secure: process.env.NODE_ENV === 'production', // true en producción para HTTPS
        httpOnly: true // Previene acceso al cookie desde JS del cliente
    }
}));

// --- Middleware de Autenticación y Autorización ---
function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) { //
        next(); // El usuario está autenticado, continuar
    } else {
        // Si no está autenticado, redirigir al login
        res.redirect('/'); //
    }
}

function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session.isAuthenticated) { //
            return res.redirect('/'); // No autenticado, redirigir al login
        }
        if (!req.session.userRole || !allowedRoles.includes(req.session.userRole)) { //
            // No tiene el rol permitido, o no tiene rol. Acceso denegado.
            console.warn(`Acceso denegado para el rol '${req.session.userRole || 'sin rol'}' a la ruta ${req.originalUrl}. Roles permitidos: ${allowedRoles.join(', ')}`); //
            // Se asume que 'public/unauthorized.html' existe.
            return res.status(403).sendFile(path.join(__dirname, 'public', 'unauthorized.html')); //
        }
        next(); // Tiene el rol permitido, continuar
    };
}


// --- Configuración de CORS (si es necesario para el frontend) ---
app.use(cors({
    origin: '*', // Permite solicitudes desde cualquier origen. En producción, especifica tu dominio.
    methods: ['GET', 'POST', 'PUT', 'DELETE'], //
    allowedHeaders: ['Content-Type', 'Authorization'], //
}));

// --- Lógica para el Mapa (CSV y generación de ubicaciones) ---
// Definir límites más amplios para generar puntos y luego filtrarlos
const MIN_LAT_MEXICO_BOUND = 14.0;
const MAX_LAT_MEXICO_BOUND = 33.0;
const MIN_LON_MEXICO_BOUND = -119.0; // Incluyendo algo de Baja California
const MAX_LON_MEXICO_BOUND = -85.0; // Incluyendo algo de Yucatán

function getRandomLatitude() {
    return Math.random() * (MAX_LAT_MEXICO_BOUND - MIN_LAT_MEXICO_BOUND) + MIN_LAT_MEXICO_BOUND;
}

function getRandomLongitude() {
    return Math.random() * (MAX_LON_MEXICO_BOUND - MIN_LON_MEXICO_BOUND) + MIN_LON_MEXICO_BOUND;
}

let mexicoBoundary = null; // Variable para almacenar la geometría de México
let ubicaciones = [];
const CSV_FILE_PATH = path.join(__dirname, 'data', 'arca_data.csv'); // Asegúrate de que este archivo exista
const MEXICO_GEOJSON_PATH = path.join(__dirname, 'data', 'mx.json'); // Asegúrate de que este archivo exista

// Cargar la geometría de México una sola vez al inicio
const loadMexicoBoundary = () => {
    return new Promise((resolve, reject) => {
        fs.readFile(MEXICO_GEOJSON_PATH, 'utf8', (err, data) => {
            if (err) {
                console.error('Error al cargar el GeoJSON de México:', err);
                return reject(err);
            }
            try {
                mexicoBoundary = JSON.parse(data);
                console.log('GeoJSON de México cargado exitosamente.');
                resolve();
            } catch (parseErr) {
                console.error('Error al parsear el GeoJSON de México:', parseErr);
                reject(parseErr);
            }
        });
    });
};

const loadUbicaciones = async () => {
    if (!mexicoBoundary) {
        console.warn('Los límites de México no están cargados. Intentando cargar...');
        try {
            await loadMexicoBoundary();
        } catch (error) {
            console.error('No se pudieron cargar los límites de México, los puntos pueden estar fuera del país.');
            // Puedes decidir si quieres abortar o continuar sin filtrado estricto
            // For now, we will proceed but points might be outside
        }
    }

    ubicaciones = [];
    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            let latitud, longitud;
            let pointInMexico = false;
            let attempts = 0;
            const MAX_ATTEMPTS = 100; // Limitar intentos para evitar bucles infinitos si hay un problema con el GeoJSON

            // Generar coordenadas hasta que estén dentro de México
            while (!pointInMexico && attempts < MAX_ATTEMPTS) {
                latitud = getRandomLatitude();
                longitud = getRandomLongitude();
                const point = turf.point([longitud, latitud]); // Turf espera [longitud, latitud]

                if (mexicoBoundary) {
                    // Si el GeoJSON de México es un FeatureCollection, itera sobre sus features
                    if (mexicoBoundary.type === 'FeatureCollection') {
                        for (const feature of mexicoBoundary.features) {
                            if (turf.booleanPointInPolygon(point, feature.geometry)) {
                                pointInMexico = true;
                                break;
                            }
                        }
                    } else if (mexicoBoundary.type === 'Feature' || mexicoBoundary.type === 'Polygon' || mexicoBoundary.type === 'MultiPolygon') {
                        // Si es un solo Feature o Polygon/MultiPolygon
                        if (turf.booleanPointInPolygon(point, mexicoBoundary)) {
                            pointInMexico = true;
                        }
                    }
                } else {
                    // Si no se pudo cargar el GeoJSON, acepta las coordenadas dentro de los límites amplios
                    pointInMexico = true;
                }
                attempts++;
            }

            if (pointInMexico) {
                row.id = ubicaciones.length + 1; // Asigna un ID simple
                row.latitud = latitud;
                row.longitud = longitud;
                ubicaciones.push(row);
            } else {
                console.warn(`No se pudo encontrar una coordenada para el registro ${row.id || ubicaciones.length + 1} dentro de México después de ${MAX_ATTEMPTS} intentos. Se omitirá el punto o se usará la última coordenada generada.`);
                // Decide si quieres omitir el punto o asignarle una coordenada fuera de México.
                // Aquí lo estamos omitiendo si no se encuentra un punto válido.
            }
        })
        .on('end', () => {
            console.log('CSV de ubicaciones cargado y coordenadas aleatorias (filtradas por México) asignadas:', ubicaciones.length, 'registros.');
        })
        .on('error', (err) => {
            console.error('Error al cargar el CSV:', err);
        });
};

// --- RUTAS DE AUTENTICACIÓN ---

// Ruta para la página de login (la raíz de la aplicación)
app.get('/', (req, res) => {
    // Si ya está autenticado, redirigir a la página de preguntas (o la principal)
    if (req.session.isAuthenticated) { //
        return res.redirect('/mapa'); //
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html')); //
});

// Manejo del login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // 1. Validar Super Administrador desde Environment Variables (la máxima autoridad)
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;

    if (username === adminUser && password === adminPass) {
        req.session.isAuthenticated = true;
        req.session.userId = 'env_admin'; // ID único para el admin de ENV
        req.session.userRole = 'admin'; // Asignamos el rol 'admin'
        return res.json({ success: true, message: 'Login de Super Admin (ENV) exitoso', redirectURL: '/mapa' });
    }

    // 2. Validar Super Usuario desde Environment Variables
    const superUserEnv = process.env.SUPERUSER_USER;
    const superPassEnv = process.env.SUPERUSER_PASS;

    if (username === superUserEnv && password === superPassEnv) {
        req.session.isAuthenticated = true;
        req.session.userId = 'env_superuser'; // ID único para el super user de ENV
        req.session.userRole = 'super-user'; // Asignamos el rol 'super-user'
        return res.json({ success: true, message: 'Login de Super User (ENV) exitoso', redirectURL: '/mapa' });
    }

    // 3. Buscar en la base de datos local (JSON) para otros roles (admin, super-user, user)
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        req.session.isAuthenticated = false;
        return res.status(401).json({ success: false, message: 'Usuario o Contraseña incorrectos' });
    }

    if (user.role) {
        req.session.isAuthenticated = true;
        req.session.userId = user.id;
        req.session.userRole = user.role;
        // La URL de redirección puede ser dinámica si quieres, pero '/preguntas' es un buen default
        return res.json({ success: true, message: 'Login exitoso', redirectURL: '/mapa' });
    } else {
        req.session.isAuthenticated = false;
        return res.status(401).json({ success: false, message: 'Usuario sin rol. Contacta a administrador' });
    }
});

// Manejo del logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => { //
        if (err) { //
            console.error('Error al destruir la sesión:', err); //
            return res.status(500).json({ message: 'Error al cerrar sesión' }); //
        }
        // Limpiar la cookie de sesión en el cliente (opcional, destroy ya lo hace por lo general)
        res.clearCookie('connect.sid'); // El nombre de la cookie por defecto de express-session
        res.json({ message: 'Sesión cerrada', redirectURL: '/' }); //
    });
});

// Endpoint para obtener el rol del usuario (usado por el frontend para navegación dinámica)
app.get('/api/user-role', isAuthenticated, (req, res) => {
    if (req.session.userRole) { //
        res.json({ userRole: req.session.userRole }); //
    } else {
        res.status(404).json({ message: 'Rol de usuario no encontrado en la sesión.' }); //
    }
});

// **NUEVA RUTA: /api/userinfo (adaptada para usar req.session)**
app.get('/api/userinfo', isAuthenticated, (req, res) => {
    // Si la sesión existe y está autenticada, req.session.userId y req.session.userRole estarán disponibles.
    if (!req.session.isAuthenticated) { //
        return res.status(401).json({ error: 'No autenticado' }); //
    }

    let user;
    if (req.session.userId === 'env_admin') { // Identificador del admin de ENV
        user = {
            id: 'env_admin',
            nombre: process.env.ADMIN_USER, // Usa el nombre de usuario del .env
            role: 'admin'
        };
    } else if (req.session.userId === 'env_superuser') { // Identificador del super user de ENV
        user = {
            id: 'env_superuser',
            nombre: process.env.SUPERUSER_USER, // Usa el nombre de usuario del .env
            role: 'super-user'
        };
    } else {
        // Busca el usuario completo en tu array 'users' cargado, si necesitas más datos que solo id y rol.
        user = users.find(u => u.id === req.session.userId);
    }

    if (user) { //
        res.json({
            id: user.id, //
            nombre: user.username, // Usar user.username que es lo que se carga de users_db.json
            role: user.role //
        });
    } else {
        // Esto no debería ocurrir si isAuthenticated ya pasó,
        return res.status(404).json({ error: 'Usuario no encontrado en la base de datos de sesión.' });
    }
});

// --- Montaje de Rutas de API ---
// Es CRÍTICO que tus rutas de API se monten ANTES de servir archivos estáticos.
app.use('/api/chat', chatRoutes);       // Endpoint para chat: /api/chat/chat
console.log('--- app.js: Rutas de chat montadas en /api/chat ---');

app.use('/api/preguntas', preguntasRoutes); // Endpoint para preguntas: /api/preguntas/
console.log('--- app.js: Rutas de preguntas montadas en /api/preguntas ---');

// Ruta para obtener ubicaciones del mapa (ahora sin autenticación, si se desea abierta)
// Si quieres proteger esta ruta, añade isAuthenticated:
app.get('/api/ubicaciones', isAuthenticated, (req, res) => {
    res.json(ubicaciones);
});


// --- Lógica de Reconocimiento de Palabras Clave y Encuesta ---

// Función auxiliar para ejecutar el script de Python (si aún es necesario para algo)
// NOTA: La detección de palabras clave principales se hace ahora en Node.js.
// Este script de Python ahora solo sería útil si realiza un procesamiento NLP más complejo
// que no se puede replicar fácilmente en Node.js, o si valida algo.
function runPythonKeywordDetection(text) {
    return new Promise((resolve, reject) => {
        const pythonScriptPath = path.join(__dirname, 'KeyWords_p.py');
        const pythonProcess = spawn('python', [pythonScriptPath, text]);

        let pythonOutput = '';
        let pythonError = '';

        pythonProcess.stdout.on('data', (data) => {
            pythonOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            pythonError += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Error en el script de Python (código ${code}): ${pythonError}`);
                return reject(new Error(`Error al procesar la respuesta con Python: ${pythonError}`));
            }
            try {
                const result = JSON.parse(pythonOutput); 
                resolve(result); 
            } catch (jsonParseError) {
                console.warn('Advertencia: Error al parsear la salida de Python. Asumiendo éxito si no hay error de proceso. Salida cruda:', pythonOutput);
                resolve({ detected_keywords: [], matched_sentences: {} }); // Devuelve algo por defecto si no es JSON válido
            }
        });
    });
}

// Endpoint para manejar los envíos de la encuesta
app.post('/submit-survey', isAuthenticated, async (req, res) => { // Protege esta ruta
    // req.body ahora es un objeto con las respuestas de texto (ej. { "q3": "Tu problema...", "q5": "Otra descripción..." })
    const textResponses = req.body; 

    if (Object.keys(textResponses).length === 0) {
        return res.status(400).json({ success: false, message: 'No se proporcionó ninguna respuesta de texto para procesar.' });
    }

    const operations = [];
    const savedCategories = [];
    const detectedKeywordsByQuestion = {}; // Para almacenar las palabras clave por ID de pregunta

    // Define las palabras clave para cada categoría (se mantienen las que ya se habían agregado)
    const categoryKeywords = {
        queja: { 
            table: TABLE_QUEJA, 
            keywords: [
                "queja", "quejar", "quejarse", "quejas", "malo", "pesimo", "terrible", 
                "problema", "fallo", "defecto", "dificil", "complicado", "error", 
                "lento", "no funciona", "defectuoso", "inaccesible", "frustrante"
            ] 
        },
        recomendacion: { 
            table: TABLE_RECOMENDACION, 
            keywords: [
                "recomendacion", "recomendar", "recomendaciones", "sugerencia", 
                "mejora", "mejorar", "propuesta", "ideas", "añadir", "agregar", 
                "implementar", "futuro", "desarrollar", "innovar", "sugerir"
            ] 
        },
        satisfaccion: { 
            table: TABLE_SATISFACCION, 
            keywords: [
                "satisfecho", "satisfecha", "satisfaccion", "satisfechos", "satisfechas", 
                "satisfactorio", "satisfactoria", "excelente", "bueno", "perfecto", 
                "agradable", "feliz", "facil", "simple", "rapido", "util", "eficiente", 
                "contento", "increible", "genial"
            ] 
        }
    };

    for (const questionId in textResponses) {
        const responseText = textResponses[questionId];

        if (!responseText || responseText.trim() === '') {
            console.log(`Respuesta de "${questionId}" está vacía. Saltando procesamiento.`);
            continue;
        }

        try {
            const normalizedResponseText = responseText.toLowerCase();
            let detected_keywords_for_this_response = [];
            let targetTable = null;
            let detectedCategory = null;

            for (const catName in categoryKeywords) {
                const keywordsToCheck = categoryKeywords[catName].keywords;
                const foundKeywords = keywordsToCheck.filter(kw => normalizedResponseText.includes(kw));

                if (foundKeywords.length > 0) {
                    detected_keywords_for_this_response.push(...foundKeywords);
                    if (!targetTable) { 
                        targetTable = categoryKeywords[catName].table;
                        detectedCategory = catName;
                    }
                }
            }
            
            detected_keywords_for_this_response = [...new Set(detected_keywords_for_this_response)];

            const fechaDeteccion = new Date().toISOString();
            const keywordsString = detected_keywords_for_this_response.join(', ');
            detectedKeywordsByQuestion[questionId] = detected_keywords_for_this_response;

            if (targetTable) {
                operations.push(new Promise((resolve, reject) => {
                    db.run(`INSERT INTO ${targetTable} (parrafo, palabras_clave_detectadas, fecha_deteccion, tipo_pregunta) VALUES (?, ?, ?, ?)`,
                        [responseText, keywordsString, fechaDeteccion, questionId],
                        function(err) {
                            if (err) return reject(err);
                            if (!savedCategories.includes(detectedCategory)) {
                                savedCategories.push(detectedCategory);
                            }
                            resolve();
                        }
                    );
                }));
            } else {
                console.log(`Respuesta de "${questionId}" procesada pero no se detectó una categoría específica para guardar en las tablas predefinidas.`);
            }

        } catch (error) {
            console.error(`Error procesando la respuesta para la pregunta ${questionId}:`, error.message);
        }
    }

    if (operations.length === 0) {
        return res.json({ success: true, message: 'Respuestas procesadas, pero ninguna se detectó en una categoría específica o no se proporcionaron respuestas de texto válidas.', keywords: detectedKeywordsByQuestion });
    }

    try {
        await Promise.all(operations);
        res.json({ success: true, message: 'Respuestas guardadas exitosamente.', categories: savedCategories, keywords: detectedKeywordsByQuestion });
    } catch (err) {
        console.error('Error al guardar alguna de las respuestas en la BD:', err.message);
        res.status(500).json({ success: false, message: 'Error al guardar alguna de las respuestas.', error: err.message });
    }
});


// Endpoint para obtener respuestas por categoría (Protegido por autenticación y rol)
app.get('/api/responses/:category', isAuthenticated, authorizeRoles('admin', 'super-user'), (req, res) => {
    const categoryMap = {
        'quejas': TABLE_QUEJA,
        'recomendaciones': TABLE_RECOMENDACION,
        'satisfaccion': TABLE_SATISFACCION
    };
    const tableName = categoryMap[req.params.category];

    if (!tableName) {
        return res.status(400).json({ success: false, message: 'Categoría no válida.' });
    }

    db.all(`SELECT * FROM ${tableName} ORDER BY fecha_deteccion DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: `Error al obtener datos de ${tableName}.` });
        }
        res.json({ success: true, data: rows });
    });
});

// Endpoint para obtener el conteo de comentarios POR CATEGORÍA para el gráfico (Protegido por autenticación y rol)
app.get('/api/keywords-count', isAuthenticated, authorizeRoles('admin', 'super-user'), async (req, res) => {
    try {
        const getCategoryCount = (tableName, label) => {
            return new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve({ label: label, value: row ? row.count : 0 });
                });
            });
        };

        const results = await Promise.all([
            getCategoryCount(TABLE_QUEJA, 'Quejas'),
            getCategoryCount(TABLE_RECOMENDACION, 'Recomendaciones'),
            getCategoryCount(TABLE_SATISFACCION, 'Satisfacción')
        ]);

        const chartData = results.filter(item => item.value > 0);

        res.json({ success: true, data: chartData });

    } catch (err) {
        console.error("Error al obtener el conteo por categoría:", err);
        res.status(500).json({ success: false, message: "Error al obtener los datos para el gráfico." });
    }
});

// Endpoint para resetear las respuestas (Protegido por autenticación y rol)
app.post('/api/reset-responses', isAuthenticated, authorizeRoles('admin'), (req, res) => {
    const tables = [TABLE_QUEJA, TABLE_RECOMENDACION, TABLE_SATISFACCION];
    const resetOperations = tables.map(table => new Promise((resolve, reject) => {
        db.run(`DELETE FROM ${table}`, [], err => {
            if (err) return reject(err);
            resolve();
        });
    }));

    Promise.all(resetOperations)
        .then(() => res.json({ success: true, message: 'Todas las respuestas han sido reseteadas.' }))
        .catch(err => res.status(500).json({ success: false, message: 'Error al resetear las respuestas.', error: err.message }));
});


// --- Servir Archivos Estáticos ---
// Sirve la carpeta 'public' directamente desde la raíz del servidor.
// Esto hará que '/navbar.html', '/mapa.html', '/navbar.js', '/script.js', etc., sean accesibles.
app.use(express.static(path.join(__dirname, 'public')));

// Sirve la carpeta 'css' bajo la ruta '/css'.
// Esto hará que '/css/navbar.css' sea accesible.
app.use('/css', express.static(path.join(__dirname, 'css')));

// Sirve la carpeta 'img' bajo la ruta '/img'.
// Esto hará que '/img/logo.png' sea accesible.
app.use('/img', express.static(path.join(__dirname, 'img')));

app.get('/favicon.ico', (req, res) => res.status(204).end());


// --- Rutas para servir las páginas HTML específicas del mapa y preguntas (protegidas) ---
app.get('/mapa', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mapa.html')); // Asumiendo que mapa.html es tu página del mapa
});

app.get('/preguntas', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'preguntas.html')); // Página de preguntas
});

// Nueva ruta para el dashboard, solo para roles 'admin' o 'super-user'
app.get('/charts', isAuthenticated, authorizeRoles('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'charts.html'));
});


// --- Manejo de Rutas No Encontradas (404) ---
app.use((req, res, next) => {
    console.log(`--- app.js: Ruta NO ENCONTRADA. URL solicitada: ${req.originalUrl} ---`);
    res.status(404).send('Lo siento, la ruta que buscas no existe o el recurso no fue encontrado.');
});

// --- Manejador de Errores General ---
app.use((err, req, res, next) => {
    console.error('--- app.js: ERROR NO MANEJADO DETECTADO ---');
    console.error(err.stack); // Imprime el stack trace del error en la consola del servidor
    res.status(500).send('Algo salió mal en el servidor!');
});


// --- Inicialización de Carga de Datos del Mapa ---
// Asegúrate de cargar los límites antes de cargar las ubicaciones
loadMexicoBoundary().then(() => {
    loadUbicaciones();
}).catch(err => {
    console.error('Error fatal al iniciar: no se pudo cargar el límite de México. Los puntos no se filtrarán correctamente. Error:', err.message);
    loadUbicaciones(); // Intenta cargar ubicaciones de todos modos, pero sin filtro de polígono.
});


// --- Inicio del Servidor ---
app.listen(PORT, () => {
    console.log(`--- app.js: Servidor escuchando en http://localhost:${PORT} ---`);
    console.log(`--- app.js: Accede a tu aplicación de login en http://localhost:${PORT}/ ---`);
    console.log(`--- app.js: Accede a tu aplicación de mapa en http://localhost:${PORT}/mapa ---`);
    console.log(`--- app.js: Accede a tu aplicación de preguntas en http://localhost:${PORT}/preguntas ---`);
    console.log(`--- app.js: Accede al dashboard en http://localhost:${PORT}/dashboard ---`);
});