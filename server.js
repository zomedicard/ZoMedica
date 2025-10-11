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
import { WebSocketServer } from 'ws';
import http from 'http';

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
// Configuración de CORS para permitir solo peticiones desde tu frontend en Vercel
const corsOptions = {
  origin: 'https://zo-medica.vercel.app', // <-- ¡PON TU URL DE VERCEL AQUÍ!
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));;
app.use(express.json());

// Variables de entorno y de ruta
const JWT_SECRET = process.env.JWT_SECRET || "YHLQMDLGN_8095040_DJLUJIAN_LAPIZ";
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
    token_verificacion_expires INTEGER,
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
    habilidades TEXT,
    reset_token TEXT,
    reset_token_expires INTEGER
);
    
 CREATE TABLE IF NOT EXISTS vacantes (
    id INTEGER PRIMARY KEY,
    titulo TEXT,
    institucion TEXT,
    descripcion TEXT,
    keywords TEXT,
    requisitos_obligatorios TEXT,
    requisitos_deseables TEXT,
    usuario_id INTEGER,
    ubicacion TEXT,
    tipoContrato TEXT,
    salario TEXT,
    vistas INTEGER NOT NULL DEFAULT 0,
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
    
    CREATE TABLE IF NOT EXISTS favoritos (
       usuario_id INTEGER,
       vacante_id INTEGER,
       PRIMARY KEY (usuario_id, vacante_id),
       FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
       FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE
   );
    
    CREATE TABLE IF NOT EXISTS alertas (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       usuario_id INTEGER NOT NULL,
       palabras_clave TEXT,
       ubicacion TEXT,
       tipo_contrato TEXT,
       fecha_creacion TEXT NOT NULL,
       FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS conversaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postulacion_id INTEGER UNIQUE NOT NULL,
    profesional_id INTEGER NOT NULL,
    institucion_id INTEGER NOT NULL,
    activa INTEGER DEFAULT 0,
    fecha_creacion TEXT NOT NULL,
    FOREIGN KEY (postulacion_id) REFERENCES postulaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (profesional_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (institucion_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversacion_id INTEGER NOT NULL,
    remitente_id INTEGER NOT NULL,
    mensaje TEXT NOT NULL,
    fecha_envio TEXT NOT NULL,
    leido INTEGER DEFAULT 0,
    FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

    CREATE TABLE IF NOT EXISTS vistas_vacantes (
            usuario_id INTEGER,
            vacante_id INTEGER,
            PRIMARY KEY (usuario_id, vacante_id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE
        );
`);

            // Pega este código justo después de la línea que contiene ');' del db.exec

try {
    await db.exec('ALTER TABLE vacantes ADD COLUMN vistas INTEGER NOT NULL DEFAULT 0');
    await db.exec('ALTER TABLE vacantes ADD COLUMN requisitos_obligatorios TEXT');
    await db.exec('ALTER TABLE vacantes ADD COLUMN requisitos_deseables TEXT');
    console.log('Columnas de requisitos añadidas a la tabla de vacantes.');
} catch (e) {
    if (!e.message.includes('duplicate column name')) {
        console.error('Error al añadir columnas de requisitos:', e);
    }
}        
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
     try {
            await db.exec('ALTER TABLE usuarios ADD COLUMN reset_token TEXT');
            await db.exec('ALTER TABLE usuarios ADD COLUMN reset_token_expires INTEGER');
            console.log('Columnas de recuperación de contraseña añadidas por si faltaban.');
        } catch (e) {
            // Esto es normal si las columnas ya existen, no hay que preocuparse.
            if (!e.message.includes('duplicate column name')) {
                console.error("Error añadiendo columnas de recuperación:", e);
            }
        }
    } catch (err) {
        console.error('Error al conectar a la base de datos:', err);
    }
})();

// Hacer que la carpeta "public" sea accesible para el navegador
app.use(express.static(path.join(__dirname, 'public')));

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

// AÑADE ESTE NUEVO MIDDLEWARE DEBAJO DE TU FUNCIÓN verificarToken

const verificarTokenOpcional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return next(); // No hay token, pero continuamos
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return next(); // Token malformado, pero continuamos
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user; // El token es válido, adjuntamos el usuario
        }
        next(); // Continuamos sin importar si hubo un error o no
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
const tokenExpires = Date.now() + 3600000; // El token expira en 1 hora

const result = await db.run(
    'INSERT INTO usuarios (nombre, correo, password, rol, verificado, token_verificacion, token_verificacion_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [nombre, correo, hashedPassword, rol, 0, tokenVerificacion, tokenExpires]
);

        // --- INICIO: LÓGICA DE ENVÍO DE CORREO REAL ---
        const linkVerificacion = `https://zo-medica.vercel.app/verify-email/${tokenVerificacion}`; 
        
        const mailOptions = {
            from: `"ZoMedica" <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Verifica tu cuenta en ZoMedica',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                    <h2>¡Bienvenido a ZoMedica!</h2>
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
    const frontendUrl = 'https://zo-medica.vercel.app/index.html';
    try {
        const token = req.params.token;
        // Ahora también comprobamos que el token no haya expirado
        const result = await db.run(
            'UPDATE usuarios SET verificado = 1, token_verificacion = NULL, token_verificacion_expires = NULL WHERE token_verificacion = ? AND token_verificacion_expires > ?',
            [token, Date.now()] // Compara con la fecha y hora actual
        );

        if (result.changes > 0) {
    // Éxito: Redirige al login con el parámetro ANTES del ancla
    console.log(`✅ ÉXITO: Usuario con token ${token} ha sido verificado.`);
    res.redirect(`${frontendUrl}?verified=true#login`); // <-- LÍNEA CORREGIDA
} else {
    // Fracaso: Redirige al login con el parámetro ANTES del ancla
    console.log(`⚠️ ALERTA: No se pudo verificar el token ${token}.`);
    res.redirect(`${frontendUrl}?verified=false#login`); // <-- LÍNEA CORREGIDA
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

        // ▼▼▼ ESTE ES EL BLOQUE QUE VAMOS A "APAGAR" ▼▼▼
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
        
       const token = jwt.sign({ id: user.id, rol: user.rol, correo: user.correo, nombre: user.nombre }, JWT_SECRET, { expiresIn: '15m' });
        res.json({ token, user: { id: user.id, nombre: user.nombre, rol: user.rol, correo: user.correo } });

    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/resend-verification', async (req, res) => {
    const { correo } = req.body;
    try {
        const user = await db.get('SELECT * FROM usuarios WHERE correo = ? AND verificado = 0', [correo]);
        if (user) {
            const tokenVerificacion = crypto.randomBytes(32).toString('hex');
            const tokenExpires = Date.now() + 3600000; // Nuevo token, nueva expiración de 1 hora

            await db.run(
                'UPDATE usuarios SET token_verificacion = ?, token_verificacion_expires = ? WHERE correo = ?',
                [tokenVerificacion, tokenExpires, correo]
            );

            const linkVerificacion = `https://zo-medica.vercel.app/verify-email/${tokenVerificacion}`;
            const mailOptions = {
                from: `"ZoMedica" <${process.env.EMAIL_USER}>`,
                to: correo,
                subject: 'Verifica tu cuenta en ZoMedica (Nuevo Enlace)',
                html: `<p>Recibiste una solicitud para un nuevo enlace de verificación. Haz clic abajo para activar tu cuenta. Este enlace expirará en 1 hora.</p><a href="${linkVerificacion}" style="padding: 10px; background-color: #0A66C2; color: white; text-decoration: none; border-radius: 5px;">Verificar mi Cuenta</a>`
            };
            await transporter.sendMail(mailOptions);
        }
        res.json({ message: 'Si tu cuenta existe y no está verificada, se ha enviado un nuevo enlace a tu correo.' });
    } catch (err) {
        console.error('Error reenviando verificación:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// RUTA 1: PARA SOLICITAR EL CORREO DE RECUPERACIÓN
app.post('/forgot-password', async (req, res) => {
    const { correo } = req.body;
    try {
        const user = await db.get('SELECT * FROM usuarios WHERE correo = ?', [correo]);
        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expires = Date.now() + 3600000; // Expira en 1 hora
            await db.run(
                'UPDATE usuarios SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
                [token, expires, user.id]
            );
            const resetLink = `https://zo-medica.vercel.app/index.html?resetToken=${token}`;
            const mailOptions = {
                from: `"ZoMedica" <${process.env.EMAIL_USER}>`,
                to: user.correo,
                subject: 'Restablecimiento de Contraseña en ZoMedica',
                html: `
                    <h2>¿Olvidaste tu contraseña?</h2>
                    <p>Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón para continuar.</p>
                    <p>Este enlace expirará en 1 hora.</p>
                    <a href="${resetLink}" style="background-color: #0A66C2; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px;">
                        Restablecer Contraseña
                    </a>
                    <p>Si no solicitaste esto, puedes ignorar este correo.</p>
                `
            };
            await transporter.sendMail(mailOptions);
        }
        res.json({ message: 'Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.' });
    } catch (err) {
        console.error('Error en /forgot-password:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// RUTA 2: PARA PROCESAR LA NUEVA CONTRASEÑA
app.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const user = await db.get(
            'SELECT * FROM usuarios WHERE reset_token = ? AND reset_token_expires > ?',
            [token, Date.now()]
        );
        if (!user) {
            return res.status(400).json({ error: 'El token es inválido o ha expirado. Por favor, solicita uno nuevo.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
            'UPDATE usuarios SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );
        res.json({ message: '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.' });
    } catch (err) {
        console.error('Error en /reset-password:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- Rutas de Perfil (Profesional e Institución) ---
// REEMPLAZA ESTA FUNCIÓN COMPLETA EN server.js

app.get('/perfil', verificarToken, async (req, res) => {
    try {
        const user = await db.get('SELECT id, nombre, correo, rol, especialidad, bio, direccion, telefono, sitioWeb, logoPath, habilidades, fotoPath, cvPath, linkedinURL, cedula, fechaNacimiento FROM usuarios WHERE id = ?', req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        // --- INICIO DE LA MODIFICACIÓN ---
        // Pide a la base de datos que cuente (COUNT) todas las filas en "postulaciones"
        // donde el 'usuario_id' coincida con el del usuario que ha iniciado sesión.
        const postulationCount = await db.get('SELECT COUNT(*) AS total FROM postulaciones WHERE usuario_id = ?', req.user.id);
        // --- FIN DE LA MODIFICACIÓN ---

        // Parsea las habilidades
        if (user.habilidades) {
            try { user.habilidades = JSON.parse(user.habilidades); } catch (e) { user.habilidades = []; }
        } else {
            user.habilidades = [];
        }

        // Obtiene el resto de la información
        const experiencias = await db.all('SELECT puesto, institucion, periodo, descripcion FROM experiencias WHERE usuario_id = ? ORDER BY id DESC', req.user.id);
        const educacion = await db.all('SELECT titulo, institucion, periodo FROM educacion WHERE usuario_id = ? ORDER BY id DESC', req.user.id);
        const certificaciones = await db.all('SELECT nombre, institucion, periodo FROM certificaciones WHERE usuario_id = ? ORDER BY id DESC', req.user.id);

        // --- INICIO DE LA MODIFICACIÓN ---
        // Ahora, en la respuesta que enviamos al frontend, incluimos el nuevo contador.
        // Lo llamaremos 'totalPostulaciones'.
        res.json({ 
            ...user, 
            totalPostulaciones: postulationCount.total, // <-- ¡AÑADIDO AQUÍ!
            experiencias, 
            educacion, 
            certificaciones 
        });
        // --- FIN DE LA MODIFICACIÓN ---

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

// REEMPLAZA ESTA FUNCIÓN COMPLETA
app.get('/vacantes/:id', verificarTokenOpcional, async (req, res) => {
    const vacanteId = req.params.id;
    const usuarioId = req.user ? req.user.id : null;

    try {
        if (usuarioId) {
            try {
                await db.run('INSERT INTO vistas_vacantes (usuario_id, vacante_id) VALUES (?, ?)', [usuarioId, vacanteId]);
                await db.run('UPDATE vacantes SET vistas = vistas + 1 WHERE id = ?', vacanteId);
            } catch (error) {
                if (!error.message.includes('SQLITE_CONSTRAINT')) {
    console.error('Error inesperado al registrar vista:', error);
}
            }
        }

        const vacante = await db.get('SELECT * FROM vacantes WHERE id = ?', vacanteId);

        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }

        const postulationCount = await db.get('SELECT COUNT(*) AS total FROM postulaciones WHERE vacante_id = ?', vacanteId);
        vacante.totalPostulaciones = postulationCount.total;

        const institucion = await db.get('SELECT id, nombre, logoPath FROM usuarios WHERE id = ?', vacante.usuario_id);

        // --- ¡NUEVA LÓGICA! ---
        // Convierte el texto de requisitos (separado por comas) en una lista (array)
        try {
            vacante.requisitos_obligatorios = vacante.requisitos_obligatorios ? vacante.requisitos_obligatorios.split(',').map(r => r.trim()) : [];
            vacante.requisitos_deseables = vacante.requisitos_deseables ? vacante.requisitos_deseables.split(',').map(r => r.trim()) : [];
        } catch (e) {
            vacante.requisitos_obligatorios = [];
            vacante.requisitos_deseables = [];
        }

        const institucionInfo = institucion || { id: null, nombre: 'Institución no disponible', logoPath: 'placeholder-logo.png' };

        res.json({ ...vacante, institucion: institucionInfo });

    } catch (err) {
        console.error('Error al obtener vacante:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// REEMPLAZA ESTA FUNCIÓN COMPLETA
app.post('/vacantes', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    // 1. OBTENEMOS LOS NUEVOS DATOS DEL BODY, INCLUYENDO LOS REQUISITOS
    const { titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, ubicacion, tipoContrato, salario } = req.body;

    if (!titulo || !institucion || !descripcion) {
        return res.status(400).json({ error: 'Por favor, completa todos los campos obligatorios.' });
    }
    try {
        // 2. AÑADIMOS LAS NUEVAS VARIABLES A LA CONSULTA SQL
        const result = await db.run(
            'INSERT INTO vacantes (titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, usuario_id, ubicacion, tipoContrato, salario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, req.user.id, ubicacion, tipoContrato, salario]
        );
        res.status(201).json({ message: 'Vacante creada con éxito.', id: result.lastID });
        procesarAlertasParaNuevaVacante({ ...req.body, id: result.lastID });
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
    const { q, ubicacion, tipoContrato } = req.query;

    // --- INICIO DE LA MODIFICACIÓN ---
    // Ahora la consulta es más potente: une vacantes con postulaciones
    // y cuenta (COUNT) cuántas postulaciones (p.id) tiene cada vacante.
    // Usamos LEFT JOIN para que las vacantes sin postulaciones también aparezcan (con contador 0).
    let sql = `
        SELECT v.*, COUNT(p.id) as totalPostulaciones
        FROM vacantes v
        LEFT JOIN postulaciones p ON v.id = p.vacante_id
    `;
    // --- FIN DE LA MODIFICACIÓN ---

    let params = [];
    let conditions = [];

    if (q) {
        conditions.push('(v.titulo LIKE ? OR v.descripcion LIKE ? OR v.keywords LIKE ?)');
        const searchTerm = `%${q}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    if (ubicacion) {
        conditions.push('v.ubicacion LIKE ?');
        params.push(`%${ubicacion}%`);
    }

    if (tipoContrato) {
        conditions.push('v.tipoContrato = ?');
        params.push(tipoContrato);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    // --- INICIO DE LA MODIFICACIÓN ---
    // Agrupamos por vacante para que el contador funcione correctamente.
    sql += ' GROUP BY v.id ORDER BY v.id DESC';
    // --- FIN DE LA MODIFICACIÓN ---

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

// AÑADE ESTA NUEVA RUTA DEBAJO DE app.post('/vacantes', ...)

app.put('/vacantes/:id', verificarToken, async (req, res) => {
    // 1. Solo las instituciones pueden editar
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const vacanteId = req.params.id;
    const { titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, ubicacion, tipoContrato, salario } = req.body;

    // Validación básica de datos
    if (!titulo || !institucion || !descripcion) {
        return res.status(400).json({ error: 'Por favor, completa los campos obligatorios.' });
    }

    try {
        // 2. Verificación de seguridad: ¿Esta vacante pertenece a la institución que la edita?
        const vacanteExistente = await db.get('SELECT usuario_id FROM vacantes WHERE id = ?', vacanteId);
        if (!vacanteExistente) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }
        if (vacanteExistente.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para editar esta vacante.' });
        }

        // 3. Si todo está en orden, actualizamos la base de datos
        await db.run(
            `UPDATE vacantes SET 
                titulo = ?, institucion = ?, descripcion = ?, requisitos_obligatorios = ?, 
                requisitos_deseables = ?, ubicacion = ?, tipoContrato = ?, salario = ?
             WHERE id = ?`,
            [titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, ubicacion, tipoContrato, salario, vacanteId]
        );

        res.json({ message: 'Vacante actualizada con éxito.' });
        procesarAlertasParaNuevaVacante({ ...req.body, id: vacanteId });

    } catch (err) {
        console.error('Error al actualizar vacante:', err);
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
// REEMPLAZA ESTA FUNCIÓN COMPLETA EN server.js

app.get('/postulaciones', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const postulaciones = await db.all(
            `SELECT
                p.id, p.fecha, p.cvPath, p.estado,
                v.id AS vacante_id, -- <-- ¡AQUÍ ESTÁ LA CORRECCIÓN!
                v.titulo as vacante_titulo, 
                v.institucion as vacante_institucion
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

// REEMPLAZA ESTA FUNCIÓN COMPLETA
app.put('/postulaciones/:id/estado', verificarToken, async (req, res) => {
    const postulacionId = req.params.id;
    const { estado } = req.body;
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const estadosValidos = ['Enviada', 'En Revisión', 'Entrevistado', 'Rechazado', 'Aceptado'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido.' });
    }

    try {
        const postulacion = await db.get(
            `SELECT p.usuario_id AS profesional_id, v.usuario_id AS institucion_id, v.titulo AS vacante_titulo
            FROM postulaciones p JOIN vacantes v ON p.vacante_id = v.id WHERE p.id = ?`,
            postulacionId
        );

        if (!postulacion || postulacion.institucion_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para modificar esta postulación.' });
        }

        await db.run('UPDATE postulaciones SET estado = ? WHERE id = ?', [estado, postulacionId]);

        // --- LÓGICA DE ACTIVACIÓN DEL CHAT ---
        if (estado === 'Entrevistado') {
            // Intenta crear una conversación si no existe
            await db.run(
                `INSERT OR IGNORE INTO conversaciones (postulacion_id, profesional_id, institucion_id, fecha_creacion) 
                VALUES (?, ?, ?, ?)`,
                [postulacionId, postulacion.profesional_id, postulacion.institucion_id, new Date().toISOString()]
            );
            // La activa
            await db.run(
                'UPDATE conversaciones SET activa = 1 WHERE postulacion_id = ?',
                [postulacionId]
            );
        }
        // --- FIN DE LA LÓGICA DEL CHAT ---

        const institucion = await db.get('SELECT nombre FROM usuarios WHERE id = ?', req.user.id);
        const mensaje = `La institución "${institucion.nombre}" actualizó tu postulación a "${postulacion.vacante_titulo}" al estado: "${estado}".`;
        const url = `postulacion/${postulacionId}`;

        await db.run(
            'INSERT INTO notificaciones (usuario_id, mensaje, fecha, url) VALUES (?, ?, ?, ?)',
            [postulacion.profesional_id, mensaje, new Date().toISOString(), url]
        );

        res.json({ message: `Estado actualizado a "${estado}".` });
    } catch (err) {
        console.error('Error al actualizar estado:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
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

app.put('/notificaciones/marcar-todas-leidas', verificarToken, async (req, res) => {
    try {
        await db.run(
            'UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0',
            [req.user.id]
        );
        res.json({ message: 'Todas las notificaciones han sido marcadas como leídas.' });
    } catch (err) {
        console.error('Error al marcar todas las notificaciones como leídas:', err);
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

// --- Rutas y Lógica para Alertas de Empleo ---

// RUTA 1: Para que un usuario cree una nueva alerta
app.post('/alertas', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Solo los profesionales pueden crear alertas.' });
    }
    const { palabras_clave, ubicacion, tipo_contrato } = req.body;
    if (!palabras_clave && !ubicacion && !tipo_contrato) {
        return res.status(400).json({ error: 'Debes proporcionar al menos un criterio para la alerta.' });
    }
    try {
        await db.run(
            'INSERT INTO alertas (usuario_id, palabras_clave, ubicacion, tipo_contrato, fecha_creacion) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, palabras_clave, ubicacion, tipo_contrato, new Date().toISOString()]
        );
        res.status(201).json({ message: 'Alerta creada con éxito.' });
    } catch (err) {
        console.error('Error al crear alerta:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// RUTA 2: Para que un usuario vea sus alertas guardadas
app.get('/alertas', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const alertas = await db.all('SELECT * FROM alertas WHERE usuario_id = ?', req.user.id);
        res.json(alertas);
    } catch (err) {
        console.error('Error al obtener alertas:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// RUTA 3: Para que un usuario elimine una alerta
app.delete('/alertas/:id', verificarToken, async (req, res) => {
    try {
        const result = await db.run(
            'DELETE FROM alertas WHERE id = ? AND usuario_id = ?',
            [req.params.id, req.user.id]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Alerta no encontrada o no tienes permiso para eliminarla.' });
        }
        res.json({ message: 'Alerta eliminada con éxito.' });
    } catch (err) {
        console.error('Error al eliminar alerta:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// FUNCIÓN CENTRAL: Compara una vacante nueva con todas las alertas guardadas
async function procesarAlertasParaNuevaVacante(vacante) {
    console.log(`🔎 Procesando alertas para la nueva vacante: "${vacante.titulo}"`);
    const alertas = await db.all(`
        SELECT a.*, u.correo, u.nombre FROM alertas a
        JOIN usuarios u ON a.usuario_id = u.id
    `);

    for (const alerta of alertas) {
        let coincide = true;

        // Comprueba si la ubicación de la alerta coincide (si existe)
        if (alerta.ubicacion && !vacante.ubicacion.toLowerCase().includes(alerta.ubicacion.toLowerCase())) {
            coincide = false;
        }

        // Comprueba si el tipo de contrato coincide (si existe)
        if (alerta.tipo_contrato && vacante.tipoContrato !== alerta.tipo_contrato) {
            coincide = false;
        }

        // Comprueba si las palabras clave coinciden (si existen)
        if (alerta.palabras_clave) {
            const textoVacante = `${vacante.titulo} ${vacante.descripcion}`.toLowerCase();
            if (!textoVacante.includes(alerta.palabras_clave.toLowerCase())) {
                coincide = false;
            }
        }

        if (coincide) {
            console.log(`✅ Coincidencia encontrada para ${alerta.correo}. Enviando email...`);
            // Si todo coincide, envía el correo
            const mailOptions = {
                from: `"ZoMedica" <${process.env.EMAIL_USER}>`,
                to: alerta.correo,
                subject: `📢 Nueva Oportunidad en ZoMedica: ${vacante.titulo}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>¡Hola, ${alerta.nombre}!</h2>
                        <p>Hemos encontrado una nueva vacante que coincide con una de tus alertas guardadas:</p>
                        <div style="border-left: 4px solid #0A66C2; padding-left: 15px; margin: 20px 0;">
                            <h3 style="margin: 0;">${vacante.titulo}</h3>
                            <p style="margin: 5px 0;"><strong>Institución:</strong> ${vacante.institucion}</p>
                            ${vacante.ubicacion ? `<p style="margin: 5px 0;"><strong>Ubicación:</strong> ${vacante.ubicacion}</p>` : ''}
                        </div>
                        <p>¡No pierdas la oportunidad! Haz clic en el siguiente botón para ver los detalles y postularte.</p>
                        <a href="https://zo-medica.vercel.app" style="background-color: #0A66C2; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; display: inline-block;">
                            Ver Vacante Ahora
                        </a>
                        <p style="font-size: 0.8em; color: #777; margin-top: 30px;">Recibes este correo porque creaste una alerta de empleo en ZoMedica.</p>
                    </div>
                `
            };

            try {
                await transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error(`❌ Error enviando email de alerta a ${alerta.correo}:`, emailError);
            }
        }
    }
}

// --- Rutas para el Sistema de Mensajería ---

// --- NUEVA RUTA ---
// Cuenta los mensajes no leídos para el usuario logueado
app.get('/mensajes/no-leidos', verificarToken, async (req, res) => {
    try {
        const count = await db.get(`
            SELECT COUNT(m.id) as total
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            WHERE m.remitente_id != ? AND m.leido = 0 AND (c.profesional_id = ? OR c.institucion_id = ?)
        `, [req.user.id, req.user.id, req.user.id]);

        res.json({ total: count.total || 0 });
    } catch (err) {
        console.error('Error al contar mensajes no leídos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// Obtiene todas las conversaciones activas para el usuario logueado
app.get('/conversaciones', verificarToken, async (req, res) => {
    try {
        let conversaciones;
        if (req.user.rol === 'profesional') {
            conversaciones = await db.all(`
                SELECT c.id, c.postulacion_id, u.nombre AS nombre_interlocutor, v.titulo AS titulo_vacante
                FROM conversaciones c
                JOIN usuarios u ON c.institucion_id = u.id
                JOIN postulaciones p ON c.postulacion_id = p.id
                JOIN vacantes v ON p.vacante_id = v.id
                WHERE c.profesional_id = ? AND c.activa = 1
            `, req.user.id);
        } else { // Rol es 'institucion'
            conversaciones = await db.all(`
                SELECT c.id, c.postulacion_id, u.nombre AS nombre_interlocutor, v.titulo AS titulo_vacante
                FROM conversaciones c
                JOIN usuarios u ON c.profesional_id = u.id
                JOIN postulaciones p ON c.postulacion_id = p.id
                JOIN vacantes v ON p.vacante_id = v.id
                WHERE c.institucion_id = ? AND c.activa = 1
            `, req.user.id);
        }
        res.json(conversaciones);
    } catch (err) {
        console.error('Error al obtener conversaciones:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// Obtiene todos los mensajes de una conversación específica
app.get('/conversaciones/:id/mensajes', verificarToken, async (req, res) => {
    try {
        const conversacion = await db.get('SELECT * FROM conversaciones WHERE id = ?', req.params.id);
        // Verificación de seguridad: el usuario debe ser parte de la conversación
        if (req.user.id !== conversacion.profesional_id && req.user.id !== conversacion.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        const mensajes = await db.all('SELECT * FROM mensajes WHERE conversacion_id = ? ORDER BY fecha_envio ASC', req.params.id);
        res.json(mensajes);
    } catch (err) {
        console.error('Error al obtener mensajes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- NUEVA RUTA ---
// Marca los mensajes de una conversación como leídos
app.put('/conversaciones/:id/leido', verificarToken, async (req, res) => {
    try {
        // Verificación de seguridad (similar a la que ya tenemos)
        const conversacion = await db.get('SELECT * FROM conversaciones WHERE id = ?', req.params.id);
        if (req.user.id !== conversacion.profesional_id && req.user.id !== conversacion.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        // Actualiza solo los mensajes recibidos por el usuario actual
        await db.run(
            'UPDATE mensajes SET leido = 1 WHERE conversacion_id = ? AND remitente_id != ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Mensajes marcados como leídos.' });
    } catch (err) {
        console.error('Error al marcar mensajes como leídos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Envía un nuevo mensaje
app.post('/mensajes', verificarToken, async (req, res) => {
    const { conversacion_id, mensaje } = req.body;
    try {
        const conversacion = await db.get('SELECT * FROM conversaciones WHERE id = ?', conversacion_id);
        if (req.user.id !== conversacion.profesional_id && req.user.id !== conversacion.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        const result = await db.run(
            'INSERT INTO mensajes (conversacion_id, remitente_id, mensaje, fecha_envio) VALUES (?, ?, ?, ?)',
            [conversacion_id, req.user.id, mensaje, new Date().toISOString()]
        );

        // --- INICIO DE LA LÓGICA DE WEBSOCKETS ---
        const destinatarioId = req.user.id === conversacion.profesional_id ? conversacion.institucion_id : conversacion.profesional_id;
        const destinatarioSocket = clients.get(destinatarioId);

        if (destinatarioSocket && destinatarioSocket.readyState === destinatarioSocket.OPEN) {
            destinatarioSocket.send(JSON.stringify({ type: 'nuevo_mensaje' }));
            console.log(`📢 Notificación de nuevo mensaje enviada en tiempo real al usuario ${destinatarioId}`);
        }
        // --- FIN DE LA LÓGICA DE WEBSOCKETS ---

        res.status(201).json({ message: 'Mensaje enviado.', id: result.lastID });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


// =================================================================
// SECCIÓN: SERVIDOR DE ARCHIVOS ESTÁTICOS Y ARRANQUE DEL SERVIDOR
// =================================================================
// --- Rutas para Vacantes Favoritas ---

// RUTA 1: Para marcar/desmarcar una vacante como favorita
app.post('/favoritos/:vacanteId', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Solo los profesionales pueden guardar favoritos.' });
    }
    const usuarioId = req.user.id;
    const vacanteId = req.params.vacanteId;

    try {
        const esFavorito = await db.get('SELECT * FROM favoritos WHERE usuario_id = ? AND vacante_id = ?', [usuarioId, vacanteId]);

        if (esFavorito) {
            // Si ya es favorito, lo quitamos
            await db.run('DELETE FROM favoritos WHERE usuario_id = ? AND vacante_id = ?', [usuarioId, vacanteId]);
            res.json({ message: 'Vacante eliminada de favoritos.', esFavorito: false });
        } else {
            // Si no es favorito, lo añadimos
            await db.run('INSERT INTO favoritos (usuario_id, vacante_id) VALUES (?, ?)', [usuarioId, vacanteId]);
            res.json({ message: 'Vacante guardada en favoritos.', esFavorito: true });
        }
    } catch (err) {
        console.error('Error al gestionar favorito:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// RUTA 2: Para obtener todas las vacantes favoritas de un usuario
app.get('/favoritos', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const favoritos = await db.all(`
            SELECT v.* FROM vacantes v
            JOIN favoritos f ON v.id = f.vacante_id
            WHERE f.usuario_id = ?
        `, req.user.id);
        res.json(favoritos);
    } catch (err) {
        console.error('Error al obtener favoritos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- Ruta de Analíticas para Vacantes ---

app.get('/institucion/vacantes/:id/analiticas', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const vacanteId = req.params.id;

    try {
        // 1. Verificamos que la vacante pertenece a la institución que la solicita
        const vacante = await db.get('SELECT * FROM vacantes WHERE id = ? AND usuario_id = ?', [vacanteId, req.user.id]);
        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada o no te pertenece.' });
        }

        // 2. Contamos las postulaciones totales para esa vacante
        const postulaciones = await db.get('SELECT COUNT(*) AS total FROM postulaciones WHERE vacante_id = ?', vacanteId);

        // 3. Calculamos la tasa de conversión
        const vistasUnicas = vacante.vistas; // Ya tenemos este dato en la tabla de vacantes
        const totalPostulaciones = postulaciones.total;
        let tasaConversion = 0;
        if (vistasUnicas > 0) {
            tasaConversion = ((totalPostulaciones / vistasUnicas) * 100).toFixed(1);
        }

        // 4. Enviamos todos los datos juntos
        res.json({
            vistas: vistasUnicas,
            postulaciones: totalPostulaciones,
            tasa_conversion: tasaConversion
        });

    } catch (err) {
        console.error('Error al obtener analíticas de la vacante:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// --- PEGA ESTE NUEVO BLOQUE DE CÓDIGO EN LUGAR DEL ANTERIOR ---

// Mantenemos estas líneas para que el servidor siga sirviendo archivos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 1. Creamos un servidor HTTP base y le pasamos nuestra aplicación Express.
const server = http.createServer(app);

// 2. Creamos el servidor de WebSockets y lo "enganchamos" al servidor HTTP principal.
const wss = new WebSocketServer({ server });

// 3. Este mapa nos ayudará a saber qué conexión WebSocket pertenece a qué usuario.
const clients = new Map();

// 4. Lógica que se ejecuta cada vez que un nuevo usuario se conecta por WebSocket.
wss.on('connection', (ws, req) => {
    // Extraemos el token de la URL para identificar al usuario.
    const token = req.url.split('?token=')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                // Si el token es válido, guardamos la conexión del usuario.
                clients.set(user.id, ws);
                console.log(`✅ WebSocket conectado para el usuario: ${user.id}`);
                
                // Si el usuario cierra la pestaña, eliminamos su conexión.
                ws.on('close', () => {
                    clients.delete(user.id);
                    console.log(`🔌 WebSocket desconectado para el usuario: ${user.id}`);
                });
            }
        });
    }
});

// 5. Finalmente, le decimos a nuestro nuevo servidor "combinado" que empiece a escuchar.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor (HTTP y WebSocket) escuchando en el puerto ${PORT}`);
});