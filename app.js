// Importar módulos necesarios con la sintaxis ES
import 'dotenv/config'; // Carga las variables de entorno al inicio. ¡ESENCIAL!
import express from 'express';
import cors from 'cors';
import session from 'express-session'; // Importar express-session
import path from 'path';
import * as fsPromises from 'fs/promises'; // Usar fsPromises para operaciones asíncronas con promesas
import fs from 'fs'; // Usar fs para operaciones de stream como createReadStream
import csv from 'csv-parser'; // Para parsear archivos CSV
import * as turf from '@turf/turf'; // Para operaciones geoespaciales
import { fileURLToPath } from 'url';
import { Readable } from 'stream'; // Importar Readable para el pipe del CSV
import 'dotenv/config'; // Carga las variables de entorno al inicio. ¡ESENCIAL!

// Reemplazo para __dirname y __filename en Módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importa tus routers existentes.
// Asegúrate de que tus routers (chat.js, preguntas.js) usen 'export default router;'
import chatRoutes from './routes/chat.js';
import preguntasRoutes from './routes/preguntas.js';


console.log('--- app.js: Iniciando carga de configuración ---');

const app = express();
const PORT = process.env.PORT || 3000; // Unificar puerto

console.log(`--- app.js: Puerto configurado a ${PORT} ---`);

// --- Configuración de Express-Session ---
let users = []; // Declarar users en un scope más alto
const USERS_DB_PATH = path.join(__dirname, 'users_db.json');


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

// --- Servir archivos estáticos ---
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


// --- RUTAS DE AUTENTICACIÓN ---

// Ruta para la página de login (la raíz de la aplicación)
app.get('/', (req, res) => {
    // Si ya está autenticado, redirigir a la página de preguntas (o la principal)
    if (req.session.isAuthenticated) { //
        return res.redirect('/preguntas'); //
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
        return res.json({ success: true, message: 'Login de Super Admin (ENV) exitoso', redirectURL: '/preguntas' });
    }

    // 2. Validar Super Usuario desde Environment Variables
    const superUserEnv = process.env.SUPERUSER_USER;
    const superPassEnv = process.env.SUPERUSER_PASS;

    if (username === superUserEnv && password === superPassEnv) {
        req.session.isAuthenticated = true;
        req.session.userId = 'env_superuser'; // ID único para el super user de ENV
        req.session.userRole = 'super-user'; // Asignamos el rol 'super-user'
        return res.json({ success: true, message: 'Login de Super User (ENV) exitoso', redirectURL: '/preguntas' });
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
        return res.json({ success: true, message: 'Login exitoso', redirectURL: '/preguntas' });
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
            nombre: user.nombre, // O user.username si así lo tienes en users_db.json
            role: user.role //
        });
    } else {
        // Esto no debería ocurrir si isAuthenticated ya pasó, pero es un fallback.
        res.status(404).json({ error: 'Información de usuario no encontrada en la base de datos.' }); //
    }
});


// --- RUTAS DE LAS 4 VISTAS (PROTEGIDAS SEGÚN ROL) ---

// Ruta para la página de preguntas (Admin, Super-user y User)
app.get('/preguntas', isAuthenticated, authorizeRoles('admin', 'super-user', 'user'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'preguntas.html')); //
});


// Ruta para la página de preguntas con CRUD (Solo Admin y Super-user)
app.get('/nuevaPregunta', isAuthenticated, authorizeRoles('admin', 'super-user'), (req, res) => { // Ahora super-user también puede
    res.sendFile(path.join(__dirname, 'public', 'nuevaPregunta.html')); //
});

// Ruta para la página de análisis de gráficos (Solo Admin y Super-user)
app.get('/charts', isAuthenticated, authorizeRoles('admin', 'super-user'), (req, res) => { // Ahora super-user también puede
    res.sendFile(path.join(__dirname, 'public', 'charts.html')); //
});

// Ruta para la página del mapa (Admin, Super-user y User)
app.get('/mapa', isAuthenticated, authorizeRoles('admin', 'super-user', 'user'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mapa.html')); //
});

// --- Integración de Routers Existentes (con protección si es necesario) ---
// Aplica el middleware isAuthenticated y/o authorizeRoles a las rutas de los routers.
app.use('/api/preguntas', isAuthenticated, authorizeRoles('admin', 'super-user', 'user'), preguntasRoutes); // Acceso para admin, super-user y user
app.use('/api/chat', isAuthenticated, authorizeRoles('admin'), chatRoutes); // Solo admin (o puedes cambiar a 'admin', 'super-user')


// --- Lógica y Endpoints del Mapa (mantienen aquí) ---

let mexicoBoundary = null; // Para almacenar el GeoJSON del límite de México
const locations = []; // Para almacenar las ubicaciones del CSV

// Función para cargar el GeoJSON del límite de México
async function loadMexicoBoundary() {
    try {
        const data = await fsPromises.readFile(path.join(__dirname, 'data', 'mx.json'), 'utf8'); // Usar fsPromises
        mexicoBoundary = JSON.parse(data); //
        console.log('--- app.js: Límite de México cargado exitosamente ---'); //
    } catch (error) {
        console.error('--- app.js: Error al cargar el GeoJSON del límite de México:', error.message); //
        throw error; // Re-lanza el error para que la inicialización falle si esto es crítico
    }
}

// Definir límites más amplios para generar puntos y luego filtrarlos (estos ya no generan aleatorios)
const MIN_LAT_MEXICO_BOUND = 14.0; //
const MAX_LAT_MEXICO_BOUND = 33.0; //
const MIN_LON_MEXICO_BOUND = -119.0; //
const MAX_LON_MEXICO_BOUND = -85.0; //

// Ya no necesitamos getRandomLatitude/Longitude si solo leemos del CSV


// Función para cargar ubicaciones desde el CSV
async function loadUbicaciones() {
    locations.length = 0; // Limpiar array antes de cargar
    const csvFilePath = path.join(__dirname, 'data', 'arca_data.csv'); // Ruta corregida
    let rowNum = 0; // Para el seguimiento de la fila para errores

    try {
        await fsPromises.access(csvFilePath); // Usar fsPromises.access

        // Crear un stream de lectura del archivo
        const fileStream = fs.createReadStream(csvFilePath, 'utf8'); // AHORA SÍ USA fs.createReadStream

        fileStream.pipe(csv()) //
            .on('data', (row) => { //
                rowNum++; //
                let latitud, longitud; //

                // Extraer latitud y longitud del campo 'geometry'
                if (row.geometry && typeof row.geometry === 'string') { //
                    const match = row.geometry.match(/POINT \(([-]?\d+\.?\d*)\s+([-]?\d+\.?\d*)\)/); //
                    if (match && match.length === 3) { //
                        longitud = parseFloat(match[1]); // El primer número es longitud
                        latitud = parseFloat(match[2]);  // El segundo número es latitud
                    }
                }

                if (latitud && longitud && !isNaN(latitud) && !isNaN(longitud)) { //
                    const lat = parseFloat(latitud); //
                    const lon = parseFloat(longitud); //

                    if (mexicoBoundary) { //
                        const point = turf.point([lon, lat]); //
                        let pointInMexico = false; //

                        if (mexicoBoundary.type === 'FeatureCollection') { //
                            for (const feature of mexicoBoundary.features) { //
                                if (turf.booleanPointInPolygon(point, feature.geometry)) { //
                                    pointInMexico = true; //
                                    break; //
                                }
                            }
                        } else if (mexicoBoundary.type === 'Feature' || mexicoBoundary.type === 'Polygon' || mexicoBoundary.type === 'MultiPolygon') { //
                            if (turf.booleanPointInPolygon(point, mexicoBoundary)) { //
                                pointInMexico = true; //
                            }
                        }

                        if (!pointInMexico) { //
                            console.warn(`--- app.js: Ubicación (lat: ${lat}, lon: ${lon}) de la fila ${rowNum} fuera de los límites de México. Omitiendo.`); //
                            return;
                        }
                    }

                    locations.push({
                        id: row.id || `row_${rowNum}`, //
                        nombre: row.nombre || `Ubicación ${rowNum}`, //
                        latitud: lat, //
                        longitud: lon, //
                        nps: row.nps || 'N/A' //
                    });
                } else {
                    console.warn(`--- app.js: Fila ${rowNum} del CSV omitida debido a datos de latitud/longitud incompletos o inválidos (después de intentar parsear 'geometry'):`, row); //
                }
            })
            .on('end', () => { //
                console.log(`--- app.js: ${locations.length} ubicaciones cargadas desde ${csvFilePath} ---`); //
            })
            .on('error', (error) => { //
                console.error('--- app.js: Error al cargar el CSV (stream):', error.message); //
            });
    } catch (error) {
        if (error.code === 'ENOENT') { //
            console.error(`--- app.js: El archivo CSV no fue encontrado en: ${csvFilePath} ---`); //
        } else {
            console.error('--- app.js: Error al leer el archivo CSV (acceso):', error); //
        }
    }
}

// Helper function to send locations based on user role
function sendLocationsBasedOnRole(req, res) {
    const userRole = req.session.userRole; //
    let locationsToSend = []; //

    if (userRole === 'admin' || userRole === 'super-user') { // Admin y Super-user obtienen todas las ubicaciones
        locationsToSend = locations; // Admin gets all locations
        console.log(`--- app.js: ${userRole} (${req.session.userId}) solicitó todas las ubicaciones. Total: ${locationsToSend.length}`); //
    } else if (userRole === 'user') { //
        // User gets a restricted number of locations, e.g., the first 5 stores
        const numberOfStoresForUser = 5; //
        locationsToSend = locations.slice(0, numberOfStoresForUser); //
        console.log(`--- app.js: Usuario (${req.session.userId}) solicitó ubicaciones. Restringido a: ${locationsToSend.length}`); //
    } else {
        // Should not happen if authorizeRoles is working, but as a fallback
        return res.status(403).json({ message: 'Acceso denegado: Rol de usuario no reconocido.' }); //
    }
    res.json(locationsToSend); //
}


// Endpoint para servir las ubicaciones (API)
app.get('/api/ubicaciones', isAuthenticated, authorizeRoles('admin', 'super-user', 'user'), (req, res) => {
    // Check if locations are loaded, if not, try to load them
    if (locations.length === 0) { //
        console.warn('--- app.js: Solicitud de ubicaciones, pero el array está vacío. Intentando recargar. ---'); //
        loadUbicaciones().then(() => { //
            if (locations.length > 0) { //
                sendLocationsBasedOnRole(req, res); // Call helper function after loading
            } else {
                res.status(500).json({ message: 'No se pudieron cargar las ubicaciones desde el archivo CSV.' }); //
            }
        }).catch(err => { //
            console.error('--- app.js: Error al recargar ubicaciones en /api/ubicaciones:', err); //
            res.status(500).json({ message: 'Error interno del servidor al cargar ubicaciones.' }); //
        });
    } else {
        sendLocationsBasedOnRole(req, res); // Send locations directly if already loaded
    }
});


// --- Manejo de Rutas No Encontradas (404) ---
// Este middleware debe ir DESPUÉS de todas tus rutas y configuraciones de archivos estáticos.
app.use((req, res, next) => {
    console.log(`--- app.js: Ruta NO ENCONTRADA. URL solicitada: ${req.originalUrl} ---`); //
    // Asegúrate de que 'public/404.html' exista.
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => { // Añadido callback para manejar error de sendFile
        if (err) { //
            console.error('--- app.js: ERROR al enviar 404.html. Posiblemente el archivo no existe. ---'); // Log más específico
            console.error(err); //
            res.status(500).send('Error interno del servidor: Página no encontrada y error al cargar la página 404.'); // Mensaje de fallback
        }
    });
});

// --- Manejador de Errores General ---
app.use((err, req, res, next) => {
    console.error('--- app.js: ERROR NO MANEJADO DETECTADO ---'); //
    console.error(err.stack); // Imprime el stack trace del error en la consola del servidor
    res.status(500).send('Algo salió mal en el servidor!'); //
});


// --- Inicialización de Carga de Datos del Mapa ---
// Asegúrate de cargar los límites antes de cargar las ubicaciones
loadMexicoBoundary().then(() => { //
    loadUbicaciones(); //
}).catch(err => { //
    console.error('Error fatal al iniciar: no se pudo cargar el límite de México. Los puntos no se filtrarán correctamente. Error:', err.message); //
    loadUbicaciones(); // Intenta cargar ubicaciones de todos modos, pero sin filtro de polígono.
});


// --- Inicio del Servidor ---
app.listen(PORT, () => { //
    console.log(`--- app.js: Servidor escuchando en http://localhost:${PORT} ---`); //
    console.log(`--- app.js: Accede a la aplicación en http://localhost:${PORT} ---`); //
});