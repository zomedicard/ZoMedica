// =================================================================
// SECCIÓN: IMPORTACIONES DE MÓDulos
// =================================================================
// Aquí se cargan todas las librerías necesarias para el servidor.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import crypto from 'crypto';

// =================================================================
// SECCIÓN: CONFIGURACIÓN DE NODEMAILER (SERVICIO DE CORREO)
// =================================================================
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Tu correo desde el archivo .env
        pass: process.env.EMAIL_PASS  // Tu contraseña de aplicación desde .env
    }
});

// =================================================================
// SECCIÓN: CONFIGURACIÓN INICIAL DEL SERVIDOR
// =================================================================
// Inicialización de Express y configuración de middlewares que se aplican a todas las peticiones.
const app = express();
app.use(cors());
app.use(express.json());

// Variables de entorno y de ruta
const JWT_SECRET = process.env.env_SECRET || "tu_secreto_secreto";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// =================================================================
// SECCIÓN: CONFIGURACIÓN DE MULTER (SUBIDA DE ARCHIVOS)
// =================================================================
// Define cómo y dónde se guardarán los archivos subidos (imágenes, PDFs).
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.mkdir(uploadDir, { recursive: true }).then(() => cb(null, uploadDir));
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Límite de 2 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF, JPG o PNG'), false);
        }
    }
});


// =================================================================
// SECCIÓN: CONEXIÓN A BASE DE DATOS Y CREACIÓN DE TABLAS
// =================================================================
// Se conecta a la base de datos SQLite y se asegura de que todas las tablas existan.
// También realiza una migración de datos inicial si es necesario.
let db;
(async () => {
    try {
        db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });
       
     await db.exec(`
       CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL,
    rol TEXT NOT NULL,
    perfil_completo INTEGER DEFAULT 0,
    verificado INTEGER DEFAULT 0, 
    token_verificacion TEXT, 
    especialidad TEXT,
    bio TEXT,
    direccion TEXT,
    telefono TEXT,
    sitioWeb TEXT,
    logoPath TEXT,
    fotoPath TEXT,
    cvPath TEXT,
    linkedinURL TEXT,
    cedula TEXT,
    fechaNacimiento TEXT,
    habilidades TEXT -- Almacenado como JSON string
);
    
    CREATE TABLE IF NOT EXISTS vacantes (
        id INTEGER PRIMARY KEY,
        titulo TEXT,
        institucion TEXT,
        descripcion TEXT,
        keywords TEXT,
        usuario_id INTEGER,
        ubicacion TEXT,
        tipoContrato TEXT,
        salario TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS postulaciones (
        id INTEGER PRIMARY KEY,
        usuario_id INTEGER,
        vacante_id INTEGER,
        fecha TEXT,
        cvPath TEXT,
        estado TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (vacante_id) REFERENCES vacantes(id)
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
        id INTEGER PRIMARY KEY,
        usuario_id INTEGER,
        mensaje TEXT,
        leida INTEGER DEFAULT 0,
        fecha TEXT,
        url TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS experiencias (
        id INTEGER PRIMARY KEY,
        usuario_id INTEGER,
        puesto TEXT,
        institucion TEXT,
        periodo TEXT,
        descripcion TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS educacion (
        id INTEGER PRIMARY KEY,
        usuario_id INTEGER,
        titulo TEXT,
        institucion TEXT,
        periodo TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS certificaciones (
        id INTEGER PRIMARY KEY,
        usuario_id INTEGER,
        nombre TEXT,
        institucion TEXT,
        periodo TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
`);

        // VERIFICA SI HAY VACANTES Y LAS MIGRA DESDE EL JSON SI LA TABLA ESTÁ VACÍA
        const vacantesExistentes = await db.get('SELECT COUNT(*) as count FROM vacantes');
        if (vacantesExistentes.count === 0) {
            try {
                const data = await fs.readFile(path.join(__dirname, 'vacantes.json'), 'utf8');
                const vacantesDesdeJson = JSON.parse(data);
                const stmt = await db.prepare('INSERT INTO vacantes (id, titulo, institucion, descripcion, keywords) VALUES (?, ?, ?, ?, ?)');
                for (const vacante of vacantesDesdeJson) {
                    await stmt.run(vacante.id, vacante.titulo, vacante.institucion, vacante.descripcion, JSON.stringify(vacante.keywords));
                }
                await stmt.finalize();
                console.log('Vacantes migradas a la base de datos.');
            } catch (e) {
                console.error('Error al migrar vacantes desde el JSON:', e);
            }
        }

        console.log('¡Conectado a la base de datos de SQLite y tablas creadas!');
    } catch (err) {
        console.error('Error al conectar a la base de datos:', err);
    }
})();


// =================================================================
// SECCIÓN: MIDDLEWARE DE AUTENTICACIÓN
// =================================================================
// Esta función protege las rutas que requieren que un usuario haya iniciado sesión.
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'Token no proporcionado.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'Token no proporcionado.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ error: 'Token inválido.' });
        req.user = user;
        next();
    });
};


// =================================================================
// SECCIÓN: RUTAS (ENDPOINTS) DE LA API
// =================================================================
// Aquí se definen todas las URLs a las que el frontend puede llamar.

// --- Rutas de Autenticación ---

// server.js (Dentro de la ruta app.post('/register', ...))

app.post('/register', async (req, res) => {
    const { nombre, correo, password, rol } = req.body;
    
    if (!nombre || !correo || !password || !rol) {
        return res.status(400).json({ error: 'Por favor, completa todos los campos.' });
    }
    
    try {
        const existingUser = await db.get('SELECT id FROM usuarios WHERE correo = ?', correo);
        if (existingUser) {
            return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const tokenVerificacion = crypto.randomBytes(32).toString('hex');
        
        const result = await db.run(
            'INSERT INTO usuarios (nombre, correo, password, rol, verificado, token_verificacion) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, correo, hashedPassword, rol, 0, tokenVerificacion]
        );

        // --- INICIO: LÓGICA DE ENVÍO DE CORREO REAL ---
        const linkVerificacion = `http://localhost:3000/verify-email/${tokenVerificacion}`; 
        
        const mailOptions = {
            from: `"MediJobs" <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Verifica tu cuenta en MediJobs',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                    <h2>¡Bienvenido a MediJobs!</h2>
                    <p>Gracias por registrarte. Por favor, haz clic en el siguiente botón para verificar tu correo electrónico y activar tu cuenta.</p>
                    <a href="${linkVerificacion}" style="background-color: #0A66C2; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0;">
                        Verificar mi Cuenta
                    </a>
                    <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                    <p><a href="${linkVerificacion}">${linkVerificacion}</a></p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Correo de verificación enviado a ${correo}`);
        // --- FIN: LÓGICA DE ENVÍO DE CORREO REAL ---

        res.status(201).json({ 
            message: 'Registro exitoso. Se ha enviado un enlace de verificación a su correo electrónico.',
            alerta: '¡Debe verificar su correo para poder iniciar sesión!'
        });

    } catch (err) {
        if (err.message.includes('SQLITE_CONSTRAINT_UNIQUE')) {
            return res.status(409).json({ error: 'El correo ya está registrado.' });
        }
        console.error('Error al registrar usuario o enviar correo:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// server.js (Añadir esta ruta en una sección de "Autenticación Avanzada")

app.get('/verify-email/:token', async (req, res) => {
    // La URL de tu frontend. Asegúrate de que el puerto (5500) sea correcto.
    const frontendUrl = 'http://127.0.0.1:5501/index.html';

    try {
        const token = req.params.token;
        const result = await db.run(
            'UPDATE usuarios SET verificado = 1, token_verificacion = NULL WHERE token_verificacion = ? AND verificado = 0',
            [token]
        );

        if (result.changes > 0) {
            // Éxito: Redirige al login con un parámetro de éxito
            console.log(`✅ ÉXITO: Usuario con token ${token} ha sido verificado.`);
            res.redirect(`${frontendUrl}#login?verified=true`);
        } else {
            // Fracaso: Redirige al login con un parámetro de error
            console.log(`⚠️ ALERTA: No se pudo verificar el token ${token}.`);
            res.redirect(`${frontendUrl}#login?verified=false`);
        }
    } catch (error) {
        console.error('Error al verificar correo:', error);
        res.redirect(`${frontendUrl}#login?verified=error`);
    }
});

app.post('/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM usuarios WHERE correo = ?', correo);
        
        // --- LÍNEA DE DEPURACIÓN CLAVE ---
        console.log('🔎 Intentando iniciar sesión para:', user); 
        // ------------------------------------

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        if (user.verificado === 0) {
            return res.status(403).json({ 
                error: 'Debes verificar tu correo electrónico antes de iniciar sesión.',
                requiereVerificacion: true 
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
        
        const token = jwt.sign({ id: user.id, rol: user.rol, correo: user.correo, nombre: user.nombre }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, nombre: user.nombre, rol: user.rol, correo: user.correo } });

    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// --- Rutas de Perfil (Profesional e Institución) ---
app.get('/perfil', verificarToken, async (req, res) => {
    try {
        // Busca todos los campos del perfil del usuario logueado
        const user = await db.get('SELECT id, nombre, correo, rol, especialidad, bio, direccion, telefono, sitioWeb, logoPath, habilidades, fotoPath, cvPath, linkedinURL, cedula, fechaNacimiento FROM usuarios WHERE id = ?', req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        if (user.habilidades) {
            try { user.habilidades = JSON.parse(user.habilidades); } catch (e) { user.habilidades = []; }
        } else {
            user.habilidades = [];
        }
        const experiencias = await db.all('SELECT puesto, institucion, periodo, descripcion FROM experiencias WHERE usuario_id = ? ORDER BY id DESC', req.user.id);
        const educacion = await db.all('SELECT titulo, institucion, periodo FROM educacion WHERE usuario_id = ? ORDER BY id DESC', req.user.id);
        const certificaciones = await db.all('SELECT nombre, institucion, periodo FROM certificaciones WHERE usuario_id = ? ORDER BY id DESC', req.user.id);
        res.json({ ...user, experiencias, educacion, certificaciones });
    } catch (err) {
        console.error('Error al obtener perfil:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/perfil', verificarToken, async (req, res) => {
    try {
        await db.run('BEGIN TRANSACTION');

        // Lógica separada para actualizar profesional o institución
       if (req.user.rol === 'profesional') {
            const { nombre, especialidad, bio, telefono, linkedinURL, cedula, fechaNacimiento, habilidades, experiencias, educacion, certificaciones } = req.body;
            await db.run(
                'UPDATE usuarios SET nombre = ?, especialidad = ?, bio = ?, telefono = ?, linkedinURL = ?, cedula = ?, fechaNacimiento = ?, habilidades = ? WHERE id = ?',
                [nombre, especialidad, bio, telefono, linkedinURL, cedula, fechaNacimiento, JSON.stringify(habilidades), req.user.id]
            );

            // Eliminar y re-insertar Experiencias
            await db.run('DELETE FROM experiencias WHERE usuario_id = ?', req.user.id);
            const stmtExp = await db.prepare('INSERT INTO experiencias (usuario_id, puesto, institucion, periodo, descripcion) VALUES (?, ?, ?, ?, ?)');
            for (const exp of experiencias || []) { await stmtExp.run(req.user.id, exp.puesto, exp.institucion, exp.periodo, exp.descripcion); }
            await stmtExp.finalize();

            // Eliminar y re-insertar Educación
            await db.run('DELETE FROM educacion WHERE usuario_id = ?', req.user.id);
            const stmtEdu = await db.prepare('INSERT INTO educacion (usuario_id, titulo, institucion, periodo) VALUES (?, ?, ?, ?)');
            for (const edu of educacion || []) { await stmtEdu.run(req.user.id, edu.titulo, edu.institucion, edu.periodo); }
            await stmtEdu.finalize();

            // Eliminar y re-insertar Certificaciones (¡El cambio clave!)
            await db.run('DELETE FROM certificaciones WHERE usuario_id = ?', req.user.id);
            const stmtCert = await db.prepare('INSERT INTO certificaciones (usuario_id, nombre, institucion, periodo) VALUES (?, ?, ?, ?)');
            for (const cert of certificaciones || []) { await stmtCert.run(req.user.id, cert.nombre, cert.institucion, cert.periodo); }
            await stmtCert.finalize();
            
        } else if (req.user.rol === 'institucion') {
            const { nombre, direccion, telefono, sitioWeb, bio } = req.body;
            await db.run(
                'UPDATE usuarios SET nombre = ?, direccion = ?, telefono = ?, sitioWeb = ?, bio = ? WHERE id = ?',
                [nombre, direccion, telefono, sitioWeb, bio, req.user.id]
            );
        }
        
        await db.run('COMMIT');
        res.json({ message: 'Perfil actualizado con éxito.' });
    } catch (err) {
        await db.run('ROLLBACK');
        console.error('Error al actualizar perfil:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/perfil/cv', verificarToken, upload.single('cv'), async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }
    try {
        const cvPath = `uploads/${req.file.filename}`;
        await db.run('UPDATE usuarios SET cvPath = ? WHERE id = ?', [cvPath, req.user.id]);
        res.json({ message: 'CV actualizado con éxito.', cvPath });
    } catch (err) {
        console.error('Error al actualizar el CV:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/perfil/foto', verificarToken, upload.single('foto'), async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }
    try {
        const fotoPath = `uploads/${req.file.filename}`;
        await db.run('UPDATE usuarios SET fotoPath = ? WHERE id = ?', [fotoPath, req.user.id]);
        res.json({ message: 'Foto de perfil actualizada con éxito.', fotoPath });
    } catch (err) {
        console.error('Error al actualizar la foto de perfil:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/perfil/logo', verificarToken, upload.single('logo'), async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }
    try {
        const logoPath = `uploads/${req.file.filename}`;
        await db.run('UPDATE usuarios SET logoPath = ? WHERE id = ?', [logoPath, req.user.id]);
        res.json({ message: 'Logo actualizado con éxito.', logoPath });
    } catch (err) {
        console.error('Error al actualizar el logo:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/instituciones/:id', async (req, res) => {
    const institucionId = req.params.id;
    try {
        const institucion = await db.get('SELECT id, nombre, direccion, telefono, sitioWeb, logoPath, bio FROM usuarios WHERE id = ? AND rol = "institucion"', institucionId);
        
        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada.' });
        }

        const vacantes = await db.all('SELECT id, titulo, descripcion, ubicacion, tipoContrato FROM vacantes WHERE usuario_id = ? ORDER BY id DESC', institucionId);
        res.json({ ...institucion, vacantes });
    } catch (err) {
        console.error('Error al obtener perfil de institución:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


app.get('/instituciones/:id', async (req, res) => {
    const institucionId = req.params.id;
    try {
        const institucion = await db.get('SELECT id, nombre, direccion, telefono, sitioWeb, logoPath, bio FROM usuarios WHERE id = ? AND rol = "institucion"', institucionId);
        
        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada.' });
        }

        const vacantes = await db.all('SELECT id, titulo, descripcion, ubicacion, tipoContrato FROM vacantes WHERE usuario_id = ? ORDER BY id DESC', institucionId);
        res.json({ ...institucion, vacantes });
    } catch (err) {
        console.error('Error al obtener perfil de institución:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Esta es la nueva ruta para la foto de perfil del profesional
app.put('/perfil/foto', verificarToken, upload.single('foto'), async (req, res) => {
    // 1. Nos aseguramos de que solo los profesionales puedan usarla
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    // 2. Verificamos que se haya subido un archivo
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }
    try {
        // 3. Creamos la ruta para guardarla en la base de datos
        const fotoPath = `uploads/${req.file.filename}`;
        // 4. Actualizamos la base de datos con la nueva ruta de la foto
        await db.run('UPDATE usuarios SET fotoPath = ? WHERE id = ?', [fotoPath, req.user.id]);
        // 5. Enviamos una respuesta de éxito
        res.json({ message: 'Foto de perfil actualizada con éxito.', fotoPath });
    } catch (err) {
        console.error('Error al actualizar la foto de perfil:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/perfil/logo', verificarToken, upload.single('logo'), async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }
    try {
        const logoPath = `uploads/${req.file.filename}`;
        await db.run('UPDATE usuarios SET logoPath = ? WHERE id = ?', [logoPath, req.user.id]);
        res.json({ message: 'Logo actualizado con éxito.', logoPath });
    } catch (err) {
        console.error('Error al actualizar el logo:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- Rutas de Vacantes ---
app.get('/vacantes/:id', async (req, res) => {
    const vacanteId = req.params.id;
    try {
        const vacante = await db.get('SELECT * FROM vacantes WHERE id = ?', vacanteId);
        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }
        const institucion = await db.get('SELECT id, nombre, logoPath FROM usuarios WHERE id = ?', vacante.usuario_id);
        try {
            vacante.keywords = JSON.parse(vacante.keywords);
        } catch (e) {
            vacante.keywords = [];
        }
        const institucionInfo = institucion || {
            id: null,
            nombre: 'Institución no disponible',
            logoPath: 'placeholder-logo.png'
        };
        res.json({ ...vacante, institucion: institucionInfo });
    } catch (err) {
        console.error('Error al obtener vacante:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/vacantes', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    // 1. OBTENEMOS LOS NUEVOS DATOS DEL BODY
    const { titulo, institucion, descripcion, keywords, ubicacion, tipoContrato, salario } = req.body;
    
    if (!titulo || !institucion || !descripcion) {
        return res.status(400).json({ error: 'Por favor, completa todos los campos obligatorios.' });
    }
    try {
        const keywordsStr = JSON.stringify(keywords || []);
        // 2. AÑADIMOS LAS NUEVAS VARIABLES A LA CONSULTA SQL
        const result = await db.run(
            'INSERT INTO vacantes (titulo, institucion, descripcion, keywords, usuario_id, ubicacion, tipoContrato, salario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [titulo, institucion, descripcion, keywordsStr, req.user.id, ubicacion, tipoContrato, salario]
        );
        res.status(201).json({ message: 'Vacante creada con éxito.', id: result.lastID });
    } catch (err) {
        console.error('Error al crear vacante:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.delete('/vacantes/:id', verificarToken, async (req, res) => {
    const vacanteId = req.params.id;
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado. Solo las instituciones pueden eliminar vacantes.' });
    }
    try {
        const vacante = await db.get('SELECT usuario_id FROM vacantes WHERE id = ?', vacanteId);
        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }
        if (vacante.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta vacante.' });
        }
        await db.run('DELETE FROM vacantes WHERE id = ?', vacanteId);
        await db.run('DELETE FROM postulaciones WHERE vacante_id = ?', vacanteId);
        res.json({ message: 'Vacante eliminada con éxito.' });
    } catch (err) {
        console.error('Error al eliminar vacante:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/vacantes', async (req, res) => {
    // 1. Obtenemos los posibles filtros desde la URL (q, ubicacion, tipoContrato)
    const { q, ubicacion, tipoContrato } = req.query;
    
    let sql = 'SELECT * FROM vacantes';
    let params = [];
    let conditions = [];

    // 2. Construimos la búsqueda por palabra clave (si existe)
    if (q) {
        conditions.push('(titulo LIKE ? OR descripcion LIKE ? OR keywords LIKE ?)');
        const searchTerm = `%${q}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    // 3. Añadimos el filtro de ubicación (si existe y no está vacío)
    if (ubicacion) {
        conditions.push('ubicacion LIKE ?');
        params.push(`%${ubicacion}%`);
    }

    // 4. Añadimos el filtro de tipo de contrato (si existe y no está vacío)
    if (tipoContrato) {
        conditions.push('tipoContrato = ?');
        params.push(tipoContrato);
    }

    // 5. Si hay alguna condición, las unimos a la consulta SQL
    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY id DESC'; // Mostramos las más recientes primero

    try {
        const vacantes = await db.all(sql, params);
        vacantes.forEach(v => {
            try { v.keywords = JSON.parse(v.keywords); } catch (e) { v.keywords = []; }
        });
        res.json(vacantes);
    } catch (err) {
        console.error('Error al obtener vacantes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/institucion/vacantes', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const vacantes = await db.all('SELECT * FROM vacantes WHERE usuario_id = ?', req.user.id);
        vacantes.forEach(v => {
            try { v.keywords = JSON.parse(v.keywords); } catch (e) { v.keywords = []; }
        });
        res.json(vacantes);
    } catch (err) {
        console.error('Error al obtener vacantes de la institución:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// --- Rutas de Postulaciones ---
// --- INICIO DEL CÓDIGO A AÑADIR ---

app.get('/institucion/postulaciones', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    // Obtenemos los filtros de la URL (req.query)
    const { vacanteId, estado, nombre } = req.query;

    // Base de la consulta SQL
    let sql = `
        SELECT
            p.id, p.fecha, p.estado,
            u.nombre AS profesional_nombre, u.correo AS profesional_correo, u.cvPath AS cvPath,
            v.titulo AS vacante_titulo
        FROM postulaciones p
        JOIN usuarios u ON p.usuario_id = u.id
        JOIN vacantes v ON p.vacante_id = v.id
        WHERE v.usuario_id = ?`;

    const params = [req.user.id];

    // Añadimos filtros a la consulta dinámicamente
    if (vacanteId) {
        sql += ' AND v.id = ?';
        params.push(vacanteId);
    }
    if (estado) {
        sql += ' AND p.estado = ?';
        params.push(estado);
    }
    if (nombre) {
        sql += ' AND u.nombre LIKE ?';
        params.push(`%${nombre}%`);
    }

    sql += ' ORDER BY p.fecha DESC';

    try {
        const postulaciones = await db.all(sql, params);
        res.json(postulaciones);
    } catch (err) {
        console.error('Error al obtener postulaciones de institución:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- FIN DEL CÓDIGO A AÑADIR ---
app.post('/postular/:id', verificarToken, upload.single('cv'), async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const vacanteId = req.params.id;
    const usuarioId = req.user.id;
    const cvPath = req.file ? req.file.path : null;
    try {
        const existingPostulacion = await db.get(
            'SELECT id FROM postulaciones WHERE usuario_id = ? AND vacante_id = ?',
            [usuarioId, vacanteId]
        );
        if (existingPostulacion) {
            return res.status(409).json({ error: 'Ya te has postulado a esta vacante.' });
        }
        const vacante = await db.get('SELECT titulo, usuario_id FROM vacantes WHERE id = ?', vacanteId);
        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }
        const result = await db.run(
            'INSERT INTO postulaciones (usuario_id, vacante_id, fecha, cvPath, estado) VALUES (?, ?, ?, ?, ?)',
            [usuarioId, vacanteId, new Date().toISOString(), cvPath, 'Enviada']
        );
const mensaje = `¡${req.user.nombre} se postuló a tu vacante "${vacante.titulo}"!`;
        const url = `pipeline/${vacanteId}/${encodeURIComponent(vacante.titulo)}`;
        await db.run(
            'INSERT INTO notificaciones (usuario_id, mensaje, fecha, url) VALUES (?, ?, ?, ?)',
            [vacante.usuario_id, mensaje, new Date().toISOString(), url]
        );       
        res.status(201).json({ message: 'Postulación enviada con éxito.', id: result.lastID });
    } catch (err) {
        console.error('Error al postularse:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/postulaciones', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const postulaciones = await db.all(
            `SELECT
                p.id, p.fecha, p.cvPath, p.estado,
                v.titulo as vacante_titulo, v.institucion as vacante_institucion
            FROM postulaciones p
            JOIN vacantes v ON p.vacante_id = v.id
            WHERE p.usuario_id = ?`,
            req.user.id
        );
        res.json(postulaciones);
    } catch (err) {
        console.error('Error al obtener postulaciones:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.delete('/postulaciones/:id', verificarToken, async (req, res) => {
    const postulacionId = req.params.id;
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado. Solo los profesionales pueden eliminar postulaciones.' });
    }
    try {
        const postulacion = await db.get('SELECT usuario_id FROM postulaciones WHERE id = ?', postulacionId);
        if (!postulacion) {
            return res.status(404).json({ error: 'Postulación no encontrada.' });
        }
        if (postulacion.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta postulación.' });
        }
        const result = await db.run('DELETE FROM postulaciones WHERE id = ?', postulacionId);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Postulación no encontrada o ya eliminada.' });
        }
        res.json({ message: 'Postulación eliminada con éxito.' });
    } catch (err) {
        console.error('Error al eliminar postulación:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- INICIO DEL CÓDIGO A AÑADIR ---

app.get('/institucion/postulaciones/:id/profesional', verificarToken, async (req, res) => {
    const postulacionId = req.params.id;

    // 1. Solo las instituciones pueden usar esta ruta
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    try {
        // 2. Verificación de seguridad:
        // Comprobamos que la postulación solicitada pertenece a una vacante de la institución que hace la petición.
        const postulacion = await db.get(
            `SELECT p.usuario_id AS profesional_id, v.usuario_id AS institucion_id
             FROM postulaciones p
             JOIN vacantes v ON p.vacante_id = v.id
             WHERE p.id = ?`,
            postulacionId
        );

        if (!postulacion) {
            return res.status(404).json({ error: 'Postulación no encontrada.' });
        }

        // Si el ID de la institución dueña de la vacante no coincide con el ID del usuario logueado, denegamos el acceso.
        if (postulacion.institucion_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para ver este perfil.' });
        }

        // 3. Si la verificación es exitosa, obtenemos el perfil completo del profesional
        const profesionalId = postulacion.profesional_id;
        const profesional = await db.get('SELECT id, nombre, correo, especialidad, bio, habilidades, fotoPath, cvPath, linkedinURL, cedula, fechaNacimiento, telefono FROM usuarios WHERE id = ?', profesionalId);

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado.' });
        }

        // Parseamos las habilidades y adjuntamos el resto de la información
        try {
            profesional.habilidades = JSON.parse(profesional.habilidades);
        } catch (e) {
            profesional.habilidades = [];
        }

        const experiencias = await db.all('SELECT puesto, institucion, periodo, descripcion FROM experiencias WHERE usuario_id = ? ORDER BY id DESC', profesionalId);
        const educacion = await db.all('SELECT titulo, institucion, periodo FROM educacion WHERE usuario_id = ? ORDER BY id DESC', profesionalId);
        const certificaciones = await db.all('SELECT nombre, institucion, periodo FROM certificaciones WHERE usuario_id = ? ORDER BY id DESC', profesionalId);

        // 4. Enviamos el perfil completo
        res.json({
            ...profesional,
            experiencias,
            educacion,
            certificaciones
        });

    } catch (err) {
        console.error('Error al obtener perfil del profesional:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/postulaciones/:id/estado', verificarToken, async (req, res) => {
    const postulacionId = req.params.id;
    const { estado } = req.body;
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado. Solo las instituciones pueden cambiar el estado.' });
    }
    const estadosValidos = ['Enviada', 'En Revisión', 'Entrevistado', 'Rechazado', 'Aceptado'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado de postulación no válido.' });
    }
const postulacion = await db.get(
            `SELECT
                p.usuario_id AS profesional_id,
                p.vacante_id, 
                v.titulo AS vacante_titulo,
                v.usuario_id AS institucion_id
            FROM postulaciones p
            JOIN vacantes v ON p.vacante_id = v.id
            WHERE p.id = ?`,
            postulacionId
        );
        if (!postulacion) {
            return res.status(404).json({ error: 'Postulación no encontrada.' });
        }
        if (postulacion.institucion_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para modificar esta postulación.' });
        }

        // Obtenemos el nombre de la institución para el mensaje
        const institucion = await db.get('SELECT nombre FROM usuarios WHERE id = ?', req.user.id);

        await db.run('UPDATE postulaciones SET estado = ? WHERE id = ?', [estado, postulacionId]);
        
       const mensaje = `La institución "${institucion.nombre}" actualizó tu postulación a "${postulacion.vacante_titulo}" al estado: "${estado}".`;
const url = `postulacion/${postulacionId}`;

        await db.run(
            'INSERT INTO notificaciones (usuario_id, mensaje, fecha, url) VALUES (?, ?, ?, ?)',
            [postulacion.profesional_id, mensaje, new Date().toISOString(), url]
        );
        res.json({ message: `Estado de postulación actualizado a "${estado}".` });
    });
// --- Rutas de Notificaciones ---
app.get('/notificaciones', verificarToken, async (req, res) => {
    try {
        const notificaciones = await db.all(
            'SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY fecha DESC',
            req.user.id
        );
        res.json(notificaciones);
    } catch (err) {
        console.error('Error al obtener notificaciones:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/notificaciones/:id/leida', verificarToken, async (req, res) => {
    const notificacionId = req.params.id;
    try {
        const result = await db.run(
            'UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?',
            [notificacionId, req.user.id]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Notificación no encontrada o no pertenece al usuario.' });
        }
        res.json({ message: 'Notificación marcada como leída.' });
    } catch (err) {
        console.error('Error al marcar notificación como leída:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- INICIO: Rutas para el Buscador de Talentos ---

// Ruta 1: Para buscar perfiles según filtros
app.get('/institucion/buscar-profesionales', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { especialidad, habilidades, keyword } = req.query;

    let sql = `SELECT id, nombre, especialidad, bio, fotoPath, habilidades FROM usuarios WHERE rol = 'profesional'`;
    const params = [];

    if (especialidad) {
        sql += ` AND especialidad LIKE ?`;
        params.push(`%${especialidad}%`);
    }
    if (habilidades) {
        sql += ` AND habilidades LIKE ?`;
        params.push(`%${habilidades}%`);
    }
    if (keyword) {
        sql += ` AND (nombre LIKE ? OR bio LIKE ? OR especialidad LIKE ?)`;
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    try {
        const perfiles = await db.all(sql, params);
        perfiles.forEach(p => {
            try { p.habilidades = JSON.parse(p.habilidades); } catch (e) { p.habilidades = []; }
        });
        res.json(perfiles);
    } catch (error) {
        console.error('Error en búsqueda de profesionales:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Ruta 2: Para obtener un perfil profesional específico por su ID
app.get('/profesionales/:id', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const profesional = await db.get('SELECT id, nombre, correo, especialidad, bio, fotoPath, cvPath, linkedinURL, telefono FROM usuarios WHERE id = ? AND rol = "profesional"', req.params.id);

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado.' });
        }

        // AÑADIMOS LA BÚSQUEDA DE DATOS ADICIONALES
        profesional.experiencias = await db.all('SELECT puesto, institucion, periodo, descripcion FROM experiencias WHERE usuario_id = ?', req.params.id);
        profesional.educacion = await db.all('SELECT titulo, institucion, periodo FROM educacion WHERE usuario_id = ?', req.params.id);

        const habilidadesRow = await db.get('SELECT habilidades FROM usuarios WHERE id = ?', req.params.id);
        try {
            profesional.habilidades = JSON.parse(habilidadesRow.habilidades);
        } catch (e) {
            profesional.habilidades = [];
        }

        res.json(profesional);

    } catch (error) {
        console.error('Error al obtener perfil de profesional:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- FIN: Rutas para el Buscador de Talentos ---

// =================================================================
// SECCIÓN: SERVIDOR DE ARCHIVOS ESTÁTICOS Y ARRANQUE DEL SERVIDOR
// =================================================================
// Le dice a Express que sirva archivos directamente desde las carpetas 'public' y 'uploads'.
// Finalmente, inicia el servidor para que empiece a escuchar peticiones.
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});