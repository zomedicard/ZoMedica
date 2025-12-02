// =================================================================
// SECCIÓN: IMPORTACIONES DE MÓDulos (Actualizadas para Postgres)
// =================================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';

// --- NUEVAS IMPORTACIONES DE POSTGRES ---
import pkg from 'pg';
const { Client } = pkg;
// ----------------------------------------

import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import http from 'http';
import nodemailer from 'nodemailer';

// =================================================================
// SECCIÓN: CONFIGURACIÓN DE NODEMAILER (SERVICIO DE CORREO)
// =================================================================

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// =================================================================
// SECCIÓN: CONFIGURACIÓN INICIAL DEL SERVIDOR
// =================================================================
const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: La variable de entorno JWT_SECRET no está definida. ¡El servidor no puede iniciar!');
    process.exit(1);
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// =================================================================
// SECCIÓN: CONFIGURACIÓN DE MULTER (SUBIDA DE ARCHIVOS)
// =================================================================

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
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF, JPG o PNG'), false);
        }
    }
});


// =================================================================
// SECCIÓN: CONEXIÓN A POSTGRESQL Y MIGRACIÓN DE TABLAS
// (Inicio del Servidor Condicional a la Conexión de la DB)
// =================================================================

let db; // Ahora es el cliente de PostgreSQL
let clients = new Map(); // Se mantiene global para WebSockets

(async () => {
    try {
        if (!process.env.DATABASE_URL) {
            console.error('❌ FATAL: La variable de entorno DATABASE_URL no está definida. ¡El servidor no puede iniciar!');
            process.exit(1);
        }

        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        await client.connect();
        db = client;
        console.log('✅ ¡Conectado a la base de datos de PostgreSQL!');

        // --- MIGRACIÓN: CREACIÓN DE TABLAS (SINTAXIS POSTGRESQL) ---
        await db.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
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
                habilidades TEXT,
                reset_token TEXT,
                reset_token_expires BIGINT -- Cambiado a BIGINT para timestamps
            );

            CREATE TABLE IF NOT EXISTS vacantes (
                id SERIAL PRIMARY KEY,
                titulo TEXT,
                institucion TEXT,
                descripcion TEXT,
                requisitos_obligatorios TEXT,
                requisitos_deseables TEXT,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                ubicacion TEXT,
                tipoContrato TEXT,
                salario TEXT,
                vistas INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS postulaciones (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                vacante_id INTEGER REFERENCES vacantes(id) ON DELETE CASCADE,
                fecha TEXT,
                cvPath TEXT,
                estado TEXT
            );

            CREATE TABLE IF NOT EXISTS notificaciones (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                mensaje TEXT,
                leida INTEGER DEFAULT 0,
                fecha TEXT,
                url TEXT
            );

            CREATE TABLE IF NOT EXISTS experiencias (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                puesto TEXT,
                institucion TEXT,
                periodo TEXT,
                descripcion TEXT
            );

            CREATE TABLE IF NOT EXISTS educacion (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                titulo TEXT,
                institucion TEXT,
                periodo TEXT
            );

            CREATE TABLE IF NOT EXISTS certificaciones (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                nombre TEXT,
                institucion TEXT,
                periodo TEXT
            );

            CREATE TABLE IF NOT EXISTS favoritos (
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                vacante_id INTEGER REFERENCES vacantes(id) ON DELETE CASCADE,
                PRIMARY KEY (usuario_id, vacante_id)
            );

            CREATE TABLE IF NOT EXISTS alertas (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                palabras_clave TEXT,
                ubicacion TEXT,
                tipo_contrato TEXT,
                fecha_creacion TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS conversaciones (
                id SERIAL PRIMARY KEY,
                postulacion_id INTEGER UNIQUE NOT NULL,
                profesional_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                institucion_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                activa INTEGER DEFAULT 0,
                fecha_creacion TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS mensajes (
                id SERIAL PRIMARY KEY,
                conversacion_id INTEGER NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
                remitente_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                mensaje TEXT NOT NULL,
                fecha_envio TEXT NOT NULL,
                leido INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS vistas_vacantes (
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
                vacante_id INTEGER REFERENCES vacantes(id) ON DELETE CASCADE,
                PRIMARY KEY (usuario_id, vacante_id)
            );
        `);

        console.log('✅ Estructura de tablas de PostgreSQL verificada/creada.');

// --- CÓDIGO TEMPORAL PARA FORZAR VERIFICACIÓN DEL PRIMER USUARIO ---
const CORREO_ADMIN_PARA_TEST = 'Frankgeorge59@gmail.com'; // ESTO YA ESTÁ CORRECTO

await db.query(
    // ⭐ CORRECCIÓN CRÍTICA: Cambiar el 1 final por 0
    // Queremos actualizar a los usuarios que NO están verificados (verificado = 0)
    'UPDATE usuarios SET verificado = 1 WHERE correo = $1 AND verificado = 0',
    [CORREO_ADMIN_PARA_TEST]
);
console.log(`✅ NOTA: Usuario de prueba ${CORREO_ADMIN_PARA_TEST} forzado a verificado=1.`);
// --- FIN DEL CÓDIGO TEMPORAL ---

console.log('✅ Estructura de tablas de PostgreSQL verificada/creada.');

        // =================================================================
        // SECCIÓN: INICIO DEL SERVIDOR (CONDICIONAL)
        // =================================================================
        app.use(express.static(path.join(__dirname, 'public')));
        app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

        const server = http.createServer(app);
        const wss = new WebSocketServer({ server });

        // Lógica de WebSockets
        wss.on('connection', (ws, req) => {
            const token = req.url.split('?token=')[1];
            if (token) {
                jwt.verify(token, JWT_SECRET, (err, user) => {
                    if (!err) {
                        clients.set(user.id, ws);
                        console.log(`✅ WebSocket conectado para el usuario: ${user.id}`);

                        ws.on('close', () => {
                            clients.delete(user.id);
                            console.log(`🔌 WebSocket desconectado para el usuario: ${user.id}`);
                        });
                    }
                });
            }
        });

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`🚀 Servidor (HTTP y WebSocket) escuchando en el puerto ${PORT}`);
        });

    } catch (err) {
        console.error('❌ Error fatal durante la conexión o migración de DB:', err);
        process.exit(1);
    }
})();

// =================================================================
// SECCIÓN: MIDDLEWARE DE AUTENTICACIÓN (Se mantiene sin cambios)
// =================================================================

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

const verificarTokenOpcional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};

// =================================================================
// SECCIÓN: RUTAS (ENDPOINTS) DE LA API (Adaptadas a Postgres)
// =================================================================

app.post('/register', async (req, res) => {
    const { nombre, correo, password, rol } = req.body;

    if (!nombre || !correo || !password || !rol) {
        return res.status(400).json({ error: 'Por favor, completa todos los campos.' });
    }

    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const existingUserResult = await db.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
        const existingUser = existingUserResult.rows[0];

        if (existingUser) {
            return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const tokenVerificacion = crypto.randomBytes(32).toString('hex');

        // CONVERSION: db.run() -> db.query() + RETURNING id
        const insertResult = await db.query(
            'INSERT INTO usuarios (nombre, correo, password, rol, verificado, token_verificacion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [nombre, correo, hashedPassword, rol, 1, tokenVerificacion]
        );

        const apiBaseUrl = process.env.FRONTEND_URL.replace('/index.html', ''); const linkVerificacion = `${apiBaseUrl}/verify-email/${tokenVerificacion}`;

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

        res.status(201).json({
            message: 'Registro exitoso. Se ha enviado un enlace de verificación a su correo electrónico.',
            alerta: '¡Debe verificar su correo para poder iniciar sesión!'
        });

    } catch (err) {
        console.error('Error al registrar usuario o enviar correo:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/verify-email/:token', async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5501/index.html';

    try {
        const token = req.params.token;
        // CONVERSION: db.run() -> db.query() + rowCount
        const result = await db.query(
            'UPDATE usuarios SET verificado = 1, token_verificacion = NULL WHERE token_verificacion = $1 AND verificado = 0',
            [token]
        );

        if (result.rowCount > 0) { // En Postgres, rowCount reemplaza a changes
            console.log(`✅ ÉXITO: Usuario con token ${token} ha sido verificado.`);
            res.redirect(`${frontendUrl}#login?verified=true`);
        } else {
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
        // CONVERSION: db.get() -> db.query().rows[0]
        const userResult = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        const user = userResult.rows[0];

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

        const token = jwt.sign({ id: user.id, rol: user.rol, correo: user.correo, nombre: user.nombre }, JWT_SECRET, { expiresIn: '15m' });
        res.json({ token, user: { id: user.id, nombre: user.nombre, rol: user.rol, correo: user.correo } });

    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/forgot-password', async (req, res) => {
    const { correo } = req.body;
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const userResult = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        const user = userResult.rows[0];

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expires = Date.now() + 3600000;

            // CONVERSION: db.run() -> db.query()
            await db.query(
                'UPDATE usuarios SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
                [token, expires, user.id]
            );
            const resetLink = `${process.env.FRONTEND_URL}?resetToken=${token}`;
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

app.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const userResult = await db.query(
            'SELECT * FROM usuarios WHERE reset_token = $1 AND reset_token_expires > $2',
            [token, Date.now()]
        );
        const user = userResult.rows[0];

        if (!user) {
            return res.status(400).json({ error: 'El token es inválido o ha expirado. Por favor, solicita uno nuevo.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        // CONVERSION: db.run() -> db.query()
        await db.query(
            'UPDATE usuarios SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );
        res.json({ message: '¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.' });
    } catch (err) {
        console.error('Error en /reset-password:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/perfil', verificarToken, async (req, res) => {
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const userResult = await db.query('SELECT id, nombre, correo, rol, especialidad, bio, direccion, telefono, sitioWeb, logoPath, habilidades, fotoPath, cvPath, linkedinURL, cedula, fechaNacimiento FROM usuarios WHERE id = $1', [req.user.id]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        // CONVERSION: db.get() -> db.query().rows[0]
        const postulationCountResult = await db.query('SELECT COUNT(*) AS total FROM postulaciones WHERE usuario_id = $1', [req.user.id]);
        const postulationCount = postulationCountResult.rows[0];

        if (user.habilidades) {
            try { user.habilidades = JSON.parse(user.habilidades); } catch (e) { user.habilidades = []; }
        } else {
            user.habilidades = [];
        }

        // CONVERSION: db.all() -> db.query().rows
        const experienciasResult = await db.query('SELECT puesto, institucion, periodo, descripcion FROM experiencias WHERE usuario_id = $1 ORDER BY id DESC', [req.user.id]);
        const experiencias = experienciasResult.rows;

        // CONVERSION: db.all() -> db.query().rows
        const educacionResult = await db.query('SELECT titulo, institucion, periodo FROM educacion WHERE usuario_id = $1 ORDER BY id DESC', [req.user.id]);
        const educacion = educacionResult.rows;

        // CONVERSION: db.all() -> db.query().rows
        const certificacionesResult = await db.query('SELECT nombre, institucion, periodo FROM certificaciones WHERE usuario_id = $1 ORDER BY id DESC', [req.user.id]);
        const certificaciones = certificacionesResult.rows;

        res.json({
            ...user,
            totalPostulaciones: postulationCount.total,
            experiencias,
            educacion,
            certificaciones
        });

    } catch (err) {
        console.error('Error al obtener perfil:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


app.put('/perfil', verificarToken, async (req, res) => {
    try {
        // CONVERSION: db.run('BEGIN TRANSACTION') -> db.query('BEGIN')
        await db.query('BEGIN');

        if (req.user.rol === 'profesional') {
            const { nombre, especialidad, bio, telefono, linkedinURL, cedula, fechaNacimiento, habilidades, experiencias, educacion, certificaciones } = req.body;

            // CONVERSION: db.run() -> db.query()
            await db.query(
                'UPDATE usuarios SET nombre = $1, especialidad = $2, bio = $3, telefono = $4, linkedinURL = $5, cedula = $6, fechaNacimiento = $7, habilidades = $8 WHERE id = $9',
                [nombre, especialidad, bio, telefono, linkedinURL, cedula, fechaNacimiento, JSON.stringify(habilidades), req.user.id]
            );

            // Transacción: Experiencias
            // CONVERSION: db.run('DELETE') -> db.query('DELETE')
            await db.query('DELETE FROM experiencias WHERE usuario_id = $1', [req.user.id]);

            for (const exp of experiencias || []) {
                // CONVERSION: db.prepare/db.run -> db.query()
                await db.query('INSERT INTO experiencias (usuario_id, puesto, institucion, periodo, descripcion) VALUES ($1, $2, $3, $4, $5)',
                    [req.user.id, exp.puesto, exp.institucion, exp.periodo, exp.descripcion]);
            }

            // Transacción: Educación
            // CONVERSION: db.run('DELETE') -> db.query('DELETE')
            await db.query('DELETE FROM educacion WHERE usuario_id = $1', [req.user.id]);

            for (const edu of educacion || []) {
                // CONVERSION: db.prepare/db.run -> db.query()
                await db.query('INSERT INTO educacion (usuario_id, titulo, institucion, periodo) VALUES ($1, $2, $3, $4)',
                    [req.user.id, edu.titulo, edu.institucion, edu.periodo]);
            }

            // Transacción: Certificaciones
            // CONVERSION: db.run('DELETE') -> db.query('DELETE')
            await db.query('DELETE FROM certificaciones WHERE usuario_id = $1', [req.user.id]);

            for (const cert of certificaciones || []) {
                // CONVERSION: db.prepare/db.run -> db.query()
                await db.query('INSERT INTO certificaciones (usuario_id, nombre, institucion, periodo) VALUES ($1, $2, $3, $4)',
                    [req.user.id, cert.nombre, cert.institucion, cert.periodo]);
            }

        } else if (req.user.rol === 'institucion') {
            const { nombre, direccion, telefono, sitioWeb, bio } = req.body;
            // CONVERSION: db.run() -> db.query()
            await db.query(
                'UPDATE usuarios SET nombre = $1, direccion = $2, telefono = $3, sitioWeb = $4, bio = $5 WHERE id = $6',
                [nombre, direccion, telefono, sitioWeb, bio, req.user.id]
            );
        }

        // CONVERSION: db.run('COMMIT') -> db.query('COMMIT')
        await db.query('COMMIT');
        res.json({ message: 'Perfil actualizado con éxito.' });
    } catch (err) {
        // CONVERSION: db.run('ROLLBACK') -> db.query('ROLLBACK')
        await db.query('ROLLBACK');
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
        // CONVERSION: db.run() -> db.query()
        await db.query('UPDATE usuarios SET cvPath = $1 WHERE id = $2', [cvPath, req.user.id]);
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
        const fotoPath = req.file.filename;
        // CONVERSION: db.run() -> db.query()
        await db.query('UPDATE usuarios SET fotoPath = $1 WHERE id = $2', [fotoPath, req.user.id]);
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
        // CONVERSION: db.run() -> db.query()
        await db.query('UPDATE usuarios SET logoPath = $1 WHERE id = $2', [logoPath, req.user.id]);
        res.json({ message: 'Logo actualizado con éxito.', logoPath });
    } catch (err) {
        console.error('Error al actualizar el logo:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/instituciones/:id', async (req, res) => {
    const institucionId = req.params.id;
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const institucionResult = await db.query('SELECT id, nombre, direccion, telefono, sitioWeb, logoPath, bio FROM usuarios WHERE id = $1 AND rol = $2', [institucionId, 'institucion']);
        const institucion = institucionResult.rows[0];

        if (!institucion) {
            return res.status(404).json({ error: 'Institución no encontrada.' });
        }

        // CONVERSION: db.all() -> db.query().rows
        const vacantesResult = await db.query('SELECT id, titulo, descripcion, ubicacion, tipoContrato FROM vacantes WHERE usuario_id = $1 ORDER BY id DESC', [institucionId]);
        const vacantes = vacantesResult.rows;

        res.json({ ...institucion, vacantes });
    } catch (err) {
        console.error('Error al obtener perfil de institución:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/vacantes/:id', verificarTokenOpcional, async (req, res) => {
    const vacanteId = req.params.id;
    const usuarioId = req.user ? req.user.id : null;

    try {
        if (usuarioId) {
            try {
                // CONVERSION: db.run() -> db.query()
                await db.query('INSERT INTO vistas_vacantes (usuario_id, vacante_id) VALUES ($1, $2) ON CONFLICT (usuario_id, vacante_id) DO NOTHING', [usuarioId, vacanteId]);
                await db.query('UPDATE vacantes SET vistas = vistas + 1 WHERE id = $1', [vacanteId]);
            } catch (error) {
                console.error('Error inesperado al registrar vista:', error);
            }
        }

        // CONVERSION: db.get() -> db.query().rows[0]
        const vacanteResult = await db.query('SELECT * FROM vacantes WHERE id = $1', [vacanteId]);
        const vacante = vacanteResult.rows[0];

        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }

        // CONVERSION: db.get() -> db.query().rows[0]
        const postulationCountResult = await db.query('SELECT COUNT(*) AS total FROM postulaciones WHERE vacante_id = $1', [vacanteId]);
        const postulationCount = postulationCountResult.rows[0];
        vacante.totalPostulaciones = postulationCount.total;

        // CONVERSION: db.get() -> db.query().rows[0]
        const institucionResult = await db.query('SELECT id, nombre, logoPath FROM usuarios WHERE id = $1', [vacante.usuario_id]);
        const institucion = institucionResult.rows[0];

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

app.post('/vacantes', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const { titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, ubicacion, tipoContrato, salario } = req.body;

    if (!titulo || !institucion || !descripcion) {
        return res.status(400).json({ error: 'Por favor, completa todos los campos obligatorios.' });
    }
    try {
        // CONVERSION: db.run() -> db.query() + RETURNING id
        const result = await db.query(
            'INSERT INTO vacantes (titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, usuario_id, ubicacion, tipoContrato, salario) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, req.user.id, ubicacion, tipoContrato, salario]
        );
        const newId = result.rows[0].id;
        res.status(201).json({ message: 'Vacante creada con éxito.', id: newId });
        procesarAlertasParaNuevaVacante({ ...req.body, id: newId });
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
        // CONVERSION: db.get() -> db.query().rows[0]
        const vacanteResult = await db.query('SELECT usuario_id FROM vacantes WHERE id = $1', [vacanteId]);
        const vacante = vacanteResult.rows[0];

        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }
        if (vacante.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta vacante.' });
        }
        // CONVERSION: db.run() -> db.query()
        await db.query('DELETE FROM vacantes WHERE id = $1', [vacanteId]);
        // CONVERSION: db.run() -> db.query()
        await db.query('DELETE FROM postulaciones WHERE vacante_id = $1', [vacanteId]);
        res.json({ message: 'Vacante eliminada con éxito.' });
    } catch (err) {
        console.error('Error al eliminar vacante:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/vacantes', async (req, res) => {
    const { q, ubicacion, tipoContrato } = req.query;

    let sql = `
        SELECT v.*, COUNT(p.id) as totalPostulaciones
        FROM vacantes v
        LEFT JOIN postulaciones p ON v.id = p.vacante_id
    `;

    let params = [];
    let conditions = [];
    let paramIndex = 1;

    if (q) {
        // En Postgres, LIKE es sensible a mayúsculas/minúsculas. Usamos ILIKE para insensibilidad.
        conditions.push('(v.titulo ILIKE $1 OR v.descripcion ILIKE $2 OR v.habilidades ILIKE $3)'); // Asumiendo que 'keywords' era 'habilidades'
        const searchTerm = `%${q}%`;
        params.push(searchTerm, searchTerm, searchTerm);
        paramIndex += 3;
    }

    if (ubicacion) {
        conditions.push(`v.ubicacion ILIKE $${paramIndex}`);
        params.push(`%${ubicacion}%`);
        paramIndex++;
    }

    if (tipoContrato) {
        conditions.push(`v.tipoContrato = $${paramIndex}`);
        params.push(tipoContrato);
        paramIndex++;
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY v.id ORDER BY v.id DESC';

    try {
        // CONVERSION: db.all() -> db.query().rows
        const vacantesResult = await db.query(sql, params);
        const vacantes = vacantesResult.rows;

        // La migración anterior usaba "keywords" para el JSON, que eliminamos en la migración de tablas.
        // Asumiremos que las keywords se extraen de la descripción o título si no están separadas.
        vacantes.forEach(v => {
            // El campo keywords ya no existe en la tabla de vacantes de Postgres.
            // Lo quitamos para evitar errores de parseo de JSON.
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
        // CONVERSION: db.all() -> db.query().rows
        const vacantesResult = await db.query('SELECT * FROM vacantes WHERE usuario_id = $1', [req.user.id]);
        const vacantes = vacantesResult.rows;

        vacantes.forEach(v => {
            // Eliminar lógica de parseo de keywords JSON.
        });
        res.json(vacantes);
    } catch (err) {
        console.error('Error al obtener vacantes de la institución:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/vacantes/:id', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const vacanteId = req.params.id;
    const { titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, ubicacion, tipoContrato, salario } = req.body;

    if (!titulo || !institucion || !descripcion) {
        return res.status(400).json({ error: 'Por favor, completa los campos obligatorios.' });
    }

    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const vacanteExistenteResult = await db.query('SELECT usuario_id FROM vacantes WHERE id = $1', [vacanteId]);
        const vacanteExistente = vacanteExistenteResult.rows[0];

        if (!vacanteExistente) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }
        if (vacanteExistente.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para editar esta vacante.' });
        }

        // CONVERSION: db.run() -> db.query()
        await db.query(
            `UPDATE vacantes SET
                titulo = $1, institucion = $2, descripcion = $3, requisitos_obligatorios = $4,
                requisitos_deseables = $5, ubicacion = $6, tipoContrato = $7, salario = $8
             WHERE id = $9`,
            [titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, ubicacion, tipoContrato, salario, vacanteId]
        );

        res.json({ message: 'Vacante actualizada con éxito.' });
        procesarAlertasParaNuevaVacante({ ...req.body, id: vacanteId });

    } catch (err) {
        console.error('Error al actualizar vacante:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/institucion/postulaciones', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { vacanteId, estado, nombre } = req.query;

    let sql = `
        SELECT
            p.id, p.fecha, p.estado,
            u.nombre AS profesional_nombre, u.correo AS profesional_correo, u.cvPath AS cvPath,
            v.titulo AS vacante_titulo
        FROM postulaciones p
        JOIN usuarios u ON p.usuario_id = u.id
        JOIN vacantes v ON p.vacante_id = v.id
        WHERE v.usuario_id = $1`;

    const params = [req.user.id];
    let paramIndex = 2;

    if (vacanteId) {
        sql += ` AND v.id = $${paramIndex}`;
        params.push(vacanteId);
        paramIndex++;
    }
    if (estado) {
        sql += ` AND p.estado = $${paramIndex}`;
        params.push(estado);
        paramIndex++;
    }
    if (nombre) {
        sql += ` AND u.nombre ILIKE $${paramIndex}`; // Usamos ILIKE para búsqueda de nombre
        params.push(`%${nombre}%`);
        paramIndex++;
    }

    sql += ' ORDER BY p.fecha DESC';

    try {
        // CONVERSION: db.all() -> db.query().rows
        const postulacionesResult = await db.query(sql, params);
        res.json(postulacionesResult.rows);
    } catch (err) {
        console.error('Error al obtener postulaciones de institución:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/postular/:id', verificarToken, upload.single('cv'), async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const vacanteId = req.params.id;
    const usuarioId = req.user.id;
    const cvPath = req.file ? req.file.path : null;
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const existingPostulacionResult = await db.query(
            'SELECT id FROM postulaciones WHERE usuario_id = $1 AND vacante_id = $2',
            [usuarioId, vacanteId]
        );
        const existingPostulacion = existingPostulacionResult.rows[0];

        if (existingPostulacion) {
            return res.status(409).json({ error: 'Ya te has postulado a esta vacante.' });
        }
        // CONVERSION: db.get() -> db.query().rows[0]
        const vacanteResult = await db.query('SELECT titulo, usuario_id FROM vacantes WHERE id = $1', [vacanteId]);
        const vacante = vacanteResult.rows[0];

        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada.' });
        }
        // CONVERSION: db.run() -> db.query() + RETURNING id
        const result = await db.query(
            'INSERT INTO postulaciones (usuario_id, vacante_id, fecha, cvPath, estado) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [usuarioId, vacanteId, new Date().toISOString(), cvPath, 'Enviada']
        );
        const newPostulacionId = result.rows[0].id;

        const mensaje = `¡${req.user.nombre} se postuló a tu vacante "${vacante.titulo}"!`;
        const url = `pipeline/${vacanteId}/${encodeURIComponent(vacante.titulo)}`;
        // CONVERSION: db.run() -> db.query()
        await db.query(
            'INSERT INTO notificaciones (usuario_id, mensaje, fecha, url) VALUES ($1, $2, $3, $4)',
            [vacante.usuario_id, mensaje, new Date().toISOString(), url]
        );
        res.status(201).json({ message: 'Postulación enviada con éxito.', id: newPostulacionId });
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
        // CONVERSION: db.all() -> db.query().rows
        const postulacionesResult = await db.query(
            `SELECT
                p.id, p.fecha, p.cvPath, p.estado,
                v.id AS vacante_id,
                v.titulo as vacante_titulo,
                v.institucion as vacante_institucion
            FROM postulaciones p
            JOIN vacantes v ON p.vacante_id = v.id
            WHERE p.usuario_id = $1`,
            [req.user.id]
        );
        res.json(postulacionesResult.rows);
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
        // CONVERSION: db.get() -> db.query().rows[0]
        const postulacionResult = await db.query('SELECT usuario_id FROM postulaciones WHERE id = $1', [postulacionId]);
        const postulacion = postulacionResult.rows[0];

        if (!postulacion) {
            return res.status(404).json({ error: 'Postulación no encontrada.' });
        }
        if (postulacion.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta postulación.' });
        }
        // CONVERSION: db.run() -> db.query() + rowCount
        const result = await db.query('DELETE FROM postulaciones WHERE id = $1', [postulacionId]);
        if (result.rowCount === 0) { // rowCount reemplaza a changes
            return res.status(404).json({ error: 'Postulación no encontrada o ya eliminada.' });
        }
        res.json({ message: 'Postulación eliminada con éxito.' });
    } catch (err) {
        console.error('Error al eliminar postulación:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/institucion/postulaciones/:id/profesional', verificarToken, async (req, res) => {
    const postulacionId = req.params.id;

    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const postulacionResult = await db.query(
            `SELECT p.usuario_id AS profesional_id, v.usuario_id AS institucion_id
             FROM postulaciones p
             JOIN vacantes v ON p.vacante_id = v.id
             WHERE p.id = $1`,
            [postulacionId]
        );
        const postulacion = postulacionResult.rows[0];

        if (!postulacion) {
            return res.status(404).json({ error: 'Postulación no encontrada.' });
        }

        if (postulacion.institucion_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para ver este perfil.' });
        }

        const profesionalId = postulacion.profesional_id;
        // CONVERSION: db.get() -> db.query().rows[0]
        const profesionalInfoResult = await db.query('SELECT id, nombre, correo, especialidad, bio, habilidades, fotoPath, cvPath, linkedinURL, cedula, fechaNacimiento, telefono FROM usuarios WHERE id = $1', [profesionalId]);
        const profesional = profesionalInfoResult.rows[0];

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado.' });
        }

        try {
            profesional.habilidades = JSON.parse(profesional.habilidades);
        } catch (e) {
            profesional.habilidades = [];
        }

        // CONVERSION: db.all() -> db.query().rows
        const experienciasResult = await db.query('SELECT puesto, institucion, periodo, descripcion FROM experiencias WHERE usuario_id = $1 ORDER BY id DESC', [profesionalId]);
        const experiencias = experienciasResult.rows;
        // CONVERSION: db.all() -> db.query().rows
        const educacionResult = await db.query('SELECT titulo, institucion, periodo FROM educacion WHERE usuario_id = $1 ORDER BY id DESC', [profesionalId]);
        const educacion = educacionResult.rows;
        // CONVERSION: db.all() -> db.query().rows
        const certificacionesResult = await db.query('SELECT nombre, institucion, periodo FROM certificaciones WHERE usuario_id = $1 ORDER BY id DESC', [profesionalId]);
        const certificaciones = certificacionesResult.rows;

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
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    const estadosValidos = ['Enviada', 'En Revisión', 'Entrevistado', 'Rechazado', 'Aceptado'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido.' });
    }

    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const postulacionResult = await db.query(
            `SELECT p.usuario_id AS profesional_id, v.usuario_id AS institucion_id, v.titulo AS vacante_titulo
            FROM postulaciones p JOIN vacantes v ON p.vacante_id = v.id WHERE p.id = $1`,
            [postulacionId]
        );
        const postulacion = postulacionResult.rows[0];

        if (!postulacion || postulacion.institucion_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para modificar esta postulación.' });
        }

        // CONVERSION: db.run() -> db.query()
        await db.query('UPDATE postulaciones SET estado = $1 WHERE id = $2', [estado, postulacionId]);

        if (estado === 'Entrevistado') {
            // CONVERSION: db.run(`INSERT OR IGNORE...`) -> PostgreSQL requiere manejo de ON CONFLICT
            await db.query(
                `INSERT INTO conversaciones (postulacion_id, profesional_id, institucion_id, fecha_creacion)
                VALUES ($1, $2, $3, $4) ON CONFLICT (postulacion_id) DO NOTHING`,
                [postulacionId, postulacion.profesional_id, postulacion.institucion_id, new Date().toISOString()]
            );
            // CONVERSION: db.run() -> db.query()
            await db.query(
                'UPDATE conversaciones SET activa = 1 WHERE postulacion_id = $1',
                [postulacionId]
            );
        }

        // CONVERSION: db.get() -> db.query().rows[0]
        const institucionResult = await db.query('SELECT nombre FROM usuarios WHERE id = $1', [req.user.id]);
        const institucion = institucionResult.rows[0];

        const mensaje = `La institución "${institucion.nombre}" actualizó tu postulación a "${postulacion.vacante_titulo}" al estado: "${estado}".`;
        const url = `postulacion/${postulacionId}`;

        // CONVERSION: db.run() -> db.query()
        await db.query(
            'INSERT INTO notificaciones (usuario_id, mensaje, fecha, url) VALUES ($1, $2, $3, $4)',
            [postulacion.profesional_id, mensaje, new Date().toISOString(), url]
        );

        res.json({ message: `Estado actualizado a "${estado}".` });
    } catch (err) {
        console.error('Error al actualizar estado:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/notificaciones', verificarToken, async (req, res) => {
    try {
        // CONVERSION: db.all() -> db.query().rows
        const notificacionesResult = await db.query(
            'SELECT * FROM notificaciones WHERE usuario_id = $1 ORDER BY fecha DESC',
            [req.user.id]
        );
        res.json(notificacionesResult.rows);
    } catch (err) {
        console.error('Error al obtener notificaciones:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/notificaciones/:id/leida', verificarToken, async (req, res) => {
    const notificacionId = req.params.id;
    try {
        // CONVERSION: db.run() -> db.query() + rowCount
        const result = await db.query(
            'UPDATE notificaciones SET leida = 1 WHERE id = $1 AND usuario_id = $2',
            [notificacionId, req.user.id]
        );
        if (result.rowCount === 0) {
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
        // CONVERSION: db.run() -> db.query()
        await db.query(
            'UPDATE notificaciones SET leida = 1 WHERE usuario_id = $1 AND leida = 0',
            [req.user.id]
        );
        res.json({ message: 'Todas las notificaciones han sido marcadas como leídas.' });
    } catch (err) {
        console.error('Error al marcar todas las notificaciones como leídas:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/institucion/buscar-profesionales', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { especialidad, habilidades, keyword } = req.query;

    let sql = `SELECT id, nombre, especialidad, bio, fotoPath, habilidades FROM usuarios WHERE rol = 'profesional'`;
    const params = [];
    let paramIndex = 1;

    if (especialidad) {
        sql += ` AND especialidad ILIKE $${paramIndex}`;
        params.push(`%${especialidad}%`);
        paramIndex++;
    }
    if (habilidades) {
        sql += ` AND habilidades ILIKE $${paramIndex}`;
        params.push(`%${habilidades}%`);
        paramIndex++;
    }
    if (keyword) {
        sql += ` AND (nombre ILIKE $${paramIndex} OR bio ILIKE $${paramIndex + 1} OR especialidad ILIKE $${paramIndex + 2})`;
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
        paramIndex += 3;
    }

    try {
        // CONVERSION: db.all() -> db.query().rows
        const perfilesResult = await db.query(sql, params);
        const perfiles = perfilesResult.rows;

        perfiles.forEach(p => {
            try { p.habilidades = JSON.parse(p.habilidades); } catch (e) { p.habilidades = []; }
        });
        res.json(perfiles);
    } catch (error) {
        console.error('Error en búsqueda de profesionales:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/profesionales/:id', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const profesionalResult = await db.query('SELECT id, nombre, correo, especialidad, bio, fotoPath, cvPath, linkedinURL, telefono FROM usuarios WHERE id = $1 AND rol = $2', [req.params.id, 'profesional']);
        const profesional = profesionalResult.rows[0];

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado.' });
        }

        // CONVERSION: db.all() -> db.query().rows
        const experienciasResult = await db.query('SELECT puesto, institucion, periodo, descripcion FROM experiencias WHERE usuario_id = $1', [req.params.id]);
        profesional.experiencias = experienciasResult.rows;
        // CONVERSION: db.all() -> db.query().rows
        const educacionResult = await db.query('SELECT titulo, institucion, periodo FROM educacion WHERE usuario_id = $1', [req.params.id]);
        profesional.educacion = educacionResult.rows;

        // CONVERSION: db.get() -> db.query().rows[0]
        const habilidadesRowResult = await db.query('SELECT habilidades FROM usuarios WHERE id = $1', [req.params.id]);
        const habilidadesRow = habilidadesRowResult.rows[0];

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

app.post('/alertas', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Solo los profesionales pueden crear alertas.' });
    }
    const { palabras_clave, ubicacion, tipo_contrato } = req.body;
    if (!palabras_clave && !ubicacion && !tipo_contrato) {
        return res.status(400).json({ error: 'Debes proporcionar al menos un criterio para la alerta.' });
    }
    try {
        // CONVERSION: db.run() -> db.query()
        await db.query(
            'INSERT INTO alertas (usuario_id, palabras_clave, ubicacion, tipo_contrato, fecha_creacion) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, palabras_clave, ubicacion, tipo_contrato, new Date().toISOString()]
        );
        res.status(201).json({ message: 'Alerta creada con éxito.' });
    } catch (err) {
        console.error('Error al crear alerta:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/alertas', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        // CONVERSION: db.all() -> db.query().rows
        const alertasResult = await db.query('SELECT * FROM alertas WHERE usuario_id = $1', [req.user.id]);
        res.json(alertasResult.rows);
    } catch (err) {
        console.error('Error al obtener alertas:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.delete('/alertas/:id', verificarToken, async (req, res) => {
    try {
        // CONVERSION: db.run() -> db.query() + rowCount
        const result = await db.query(
            'DELETE FROM alertas WHERE id = $1 AND usuario_id = $2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Alerta no encontrada o no tienes permiso para eliminarla.' });
        }
        res.json({ message: 'Alerta eliminada con éxito.' });
    } catch (err) {
        console.error('Error al eliminar alerta:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

async function procesarAlertasParaNuevaVacante(vacante) {
    console.log(`🔎 Procesando alertas para la nueva vacante: "${vacante.titulo}"`);
    // CONVERSION: db.all() -> db.query().rows
    const alertasResult = await db.query(`
        SELECT a.*, u.correo, u.nombre FROM alertas a
        JOIN usuarios u ON a.usuario_id = u.id
    `);
    const alertas = alertasResult.rows;

    for (const alerta of alertas) {
        let coincide = true;

        if (alerta.ubicacion && !vacante.ubicacion.toLowerCase().includes(alerta.ubicacion.toLowerCase())) {
            coincide = false;
        }

        if (alerta.tipo_contrato && vacante.tipoContrato !== alerta.tipo_contrato) {
            coincide = false;
        }

        if (alerta.palabras_clave) {
            const textoVacante = `${vacante.titulo} ${vacante.descripcion}`.toLowerCase();
            if (!textoVacante.includes(alerta.palabras_clave.toLowerCase())) {
                coincide = false;
            }
        }

        if (coincide) {
            console.log(`✅ Coincidencia encontrada para ${alerta.correo}. Enviando email...`);
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
                        <a href="${process.env.FRONTEND_URL}" style="background-color: #0A66C2; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; display: inline-block;">
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

app.get('/mensajes/no-leidos', verificarToken, async (req, res) => {
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const countResult = await db.query(`
            SELECT COUNT(m.id) as total
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            WHERE m.remitente_id != $1 AND m.leido = 0 AND (c.profesional_id = $2 OR c.institucion_id = $3)
        `, [req.user.id, req.user.id, req.user.id]);
        const count = countResult.rows[0];

        res.json({ total: count.total || 0 });
    } catch (err) {
        console.error('Error al contar mensajes no leídos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


app.get('/conversaciones', verificarToken, async (req, res) => {
    try {
        let conversacionesResult;
        if (req.user.rol === 'profesional') {
            // CONVERSION: db.all() -> db.query().rows
            conversacionesResult = await db.query(`
                SELECT c.id, c.postulacion_id, u.nombre AS nombre_interlocutor, v.titulo AS titulo_vacante
                FROM conversaciones c
                JOIN usuarios u ON c.institucion_id = u.id
                JOIN postulaciones p ON c.postulacion_id = p.id
                JOIN vacantes v ON p.vacante_id = v.id
                WHERE c.profesional_id = $1 AND c.activa = 1
            `, [req.user.id]);
        } else { // Rol es 'institucion'
            // CONVERSION: db.all() -> db.query().rows
            conversacionesResult = await db.query(`
                SELECT c.id, c.postulacion_id, u.nombre AS nombre_interlocutor, v.titulo AS titulo_vacante
                FROM conversaciones c
                JOIN usuarios u ON c.profesional_id = u.id
                JOIN postulaciones p ON c.postulacion_id = p.id
                JOIN vacantes v ON p.vacante_id = v.id
                WHERE c.institucion_id = $1 AND c.activa = 1
            `, [req.user.id]);
        }
        res.json(conversacionesResult.rows);
    } catch (err) {
        console.error('Error al obtener conversaciones:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});


app.get('/conversaciones/:id/mensajes', verificarToken, async (req, res) => {
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const conversacionResult = await db.query('SELECT * FROM conversaciones WHERE id = $1', [req.params.id]);
        const conversacion = conversacionResult.rows[0];

        if (req.user.id !== conversacion.profesional_id && req.user.id !== conversacion.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        // CONVERSION: db.all() -> db.query().rows
        const mensajesResult = await db.query('SELECT * FROM mensajes WHERE conversacion_id = $1 ORDER BY fecha_envio ASC', [req.params.id]);
        res.json(mensajesResult.rows);
    } catch (err) {
        console.error('Error al obtener mensajes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.put('/conversaciones/:id/leido', verificarToken, async (req, res) => {
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const conversacionResult = await db.query('SELECT * FROM conversaciones WHERE id = $1', [req.params.id]);
        const conversacion = conversacionResult.rows[0];

        if (req.user.id !== conversacion.profesional_id && req.user.id !== conversacion.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        // CONVERSION: db.run() -> db.query()
        await db.query(
            'UPDATE mensajes SET leido = 1 WHERE conversacion_id = $1 AND remitente_id != $2',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Mensajes marcados como leídos.' });
    } catch (err) {
        console.error('Error al marcar mensajes como leídos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/mensajes', verificarToken, async (req, res) => {
    const { conversacion_id, mensaje } = req.body;
    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const conversacionResult = await db.query('SELECT * FROM conversaciones WHERE id = $1', [conversacion_id]);
        const conversacion = conversacionResult.rows[0];

        if (req.user.id !== conversacion.profesional_id && req.user.id !== conversacion.institucion_id) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        // CONVERSION: db.run() -> db.query() + RETURNING id
        const result = await db.query(
            'INSERT INTO mensajes (conversacion_id, remitente_id, mensaje, fecha_envio) VALUES ($1, $2, $3, $4) RETURNING id',
            [conversacion_id, req.user.id, mensaje, new Date().toISOString()]
        );
        const newMsgId = result.rows[0].id;

        const destinatarioId = req.user.id === conversacion.profesional_id ? conversacion.institucion_id : conversacion.profesional_id;
        const destinatarioSocket = clients.get(destinatarioId);

        if (destinatarioSocket && destinatarioSocket.readyState === destinatarioSocket.OPEN) {
            destinatarioSocket.send(JSON.stringify({ type: 'nuevo_mensaje' }));
            console.log(`📢 Notificación de nuevo mensaje enviada en tiempo real al usuario ${destinatarioId}`);
        }

        res.status(201).json({ message: 'Mensaje enviado.', id: newMsgId });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/favoritos/:vacanteId', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Solo los profesionales pueden guardar favoritos.' });
    }
    const usuarioId = req.user.id;
    const vacanteId = req.params.vacanteId;

    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const esFavoritoResult = await db.query('SELECT * FROM favoritos WHERE usuario_id = $1 AND vacante_id = $2', [usuarioId, vacanteId]);
        const esFavorito = esFavoritoResult.rows[0];

        if (esFavorito) {
            // CONVERSION: db.run('DELETE') -> db.query('DELETE')
            await db.query('DELETE FROM favoritos WHERE usuario_id = $1 AND vacante_id = $2', [usuarioId, vacanteId]);
            res.json({ message: 'Vacante eliminada de favoritos.', esFavorito: false });
        } else {
            // CONVERSION: db.run('INSERT') -> db.query('INSERT')
            await db.query('INSERT INTO favoritos (usuario_id, vacante_id) VALUES ($1, $2)', [usuarioId, vacanteId]);
            res.json({ message: 'Vacante guardada en favoritos.', esFavorito: true });
        }
    } catch (err) {
        console.error('Error al gestionar favorito:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/favoritos', verificarToken, async (req, res) => {
    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        // CONVERSION: db.all() -> db.query().rows
        const favoritosResult = await db.query(`
            SELECT v.* FROM vacantes v
            JOIN favoritos f ON v.id = f.vacante_id
            WHERE f.usuario_id = $1
        `, [req.user.id]);
        res.json(favoritosResult.rows);
    } catch (err) {
        console.error('Error al obtener favoritos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/institucion/vacantes/:id/analiticas', verificarToken, async (req, res) => {
    if (req.user.rol !== 'institucion') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const vacanteId = req.params.id;

    try {
        // CONVERSION: db.get() -> db.query().rows[0]
        const vacanteResult = await db.query('SELECT vistas, usuario_id FROM vacantes WHERE id = $1 AND usuario_id = $2', [vacanteId, req.user.id]);
        const vacante = vacanteResult.rows[0];

        if (!vacante) {
            return res.status(404).json({ error: 'Vacante no encontrada o no te pertenece.' });
        }

        // CONVERSION: db.get() -> db.query().rows[0]
        const postulacionesResult = await db.query('SELECT COUNT(*) AS total FROM postulaciones WHERE vacante_id = $1', [vacanteId]);
        const postulaciones = postulacionesResult.rows[0];

        const vistasUnicas = vacante.vistas;
        const totalPostulaciones = postulaciones.total;
        let tasaConversion = 0;
        if (vistasUnicas > 0) {
            tasaConversion = ((parseInt(totalPostulaciones) / vistasUnicas) * 100).toFixed(1);
        }

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

// =================================================================
// SECCIÓN: SEMBRADO DE DATOS (SEEDER)
// =================================================================

// Función para insertar datos de prueba en todas las tablas
async function sembrarDatos() {
    try {
        console.log('🌱 Iniciando sembrado de datos de prueba...');

        // 1. ELIMINAR DATOS PREVIOS (Opcional, para empezar limpio)
        // Puedes comentar esta sección si quieres conservar usuarios ya registrados
        await db.query('DELETE FROM usuarios WHERE nombre IN (\'Empresa de Pruebas\', \'Profesional Ejemplo\')');
        await db.query('DELETE FROM vacantes');
        await db.query('DELETE FROM postulaciones');
        await db.query('DELETE FROM notificaciones');
        await db.query('DELETE FROM conversaciones');

        // 2. CREAR USUARIOS DE PRUEBA
        const hashedPasswordInst = await bcrypt.hash('123456', 10);
        const hashedPasswordProf = await bcrypt.hash('123456', 10);

        const instResult = await db.query(
            "INSERT INTO usuarios (nombre, correo, password, rol, verificado) VALUES ($1, $2, $3, 'institucion', 1) RETURNING id",
            ['Empresa General de Pruebas', 'empresa@emply.com', hashedPasswordInst]
        );
        const institucionId = instResult.rows[0].id;

        const profResult = await db.query(
            "INSERT INTO usuarios (nombre, correo, password, rol, verificado, especialidad, habilidades) VALUES ($1, $2, $3, 'profesional', 1, $4, $5) RETURNING id",
            ['Profesional Ejemplo General', 'profesional@emply.com', hashedPasswordProf, 'Marketing Digital', '["SEO", "SEM", "Análisis de Datos", "Liderazgo"]']
        );
        const profesionalId = profResult.rows[0].id;
        
        // 3. CREAR VACANTES DE PRUEBA
        const vacante1Result = await db.query(
            "INSERT INTO vacantes (titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, usuario_id, ubicacion, tipoContrato, salario) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
            [
                'Gerente de Proyectos (IT)',
                'Empresa General de Pruebas',
                'Buscamos un gerente de proyectos experimentado en metodologías Ágiles.',
                'Certificación PMP,5 años de experiencia,Inglés avanzado',
                'Conocimiento de Scrum,Experiencia en DevOps',
                institucionId,
                'Distrito Nacional',
                'Jornada Completa',
                'RD$120,000 - RD$150,000'
            ]
        );
        const vacanteId1 = vacante1Result.rows[0].id;

        await db.query(
            "INSERT INTO vacantes (titulo, institucion, descripcion, requisitos_obligatorios, requisitos_deseables, usuario_id, ubicacion, tipoContrato, salario) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
            [
                'Analista Financiero Junior',
                'Empresa General de Pruebas',
                'Análisis de datos financieros y preparación de reportes.',
                'Licenciatura en Finanzas,Manejo de Excel avanzado',
                'Experiencia en Contabilidad',
                institucionId,
                'Santiago',
                'Media Jornada',
                'RD$45,000'
            ]
        );
        
        // 4. CREAR POSTULACIÓN DE PRUEBA (Para ver datos en el panel)
        await db.query(
            "INSERT INTO postulaciones (usuario_id, vacante_id, fecha, estado) VALUES ($1, $2, $3, $4)",
            [profesionalId, vacanteId1, new Date().toISOString(), 'En Revisión']
        );
        
        console.log('✅ Sembrado completado. Se crearon 2 vacantes y 2 usuarios de prueba.');
    } catch (error) {
        console.error('❌ Error durante el sembrado de datos:', error);
    }
}

// =================================================================
// ENDPOINT PARA EJECUTAR EL SEMBRADO
// =================================================================

app.post('/api/seed', async (req, res) => {
    try {
        await sembrarDatos();
        res.json({ message: 'Datos de prueba insertados con éxito.' });
    } catch (error) {
        res.status(500).json({ error: 'Fallo al sembrar los datos.' });
    }
});