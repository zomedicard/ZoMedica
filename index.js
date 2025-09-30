// Importaciones de módulos necesarios
import 'dotenv/config'; // Importamos dotenv para usar variables de entorno
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

// Configuración inicial del servidor
const app = express();
app.use(cors());
app.use(express.json());

// Variables de entorno
const JWT_SECRET = process.env.env_SECRET || "tu_secreto_secreto"; // Usar el secreto del entorno o uno por defecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Conexión a la base de datos SQLite y creación de tablas
let db;
(async () => {
  try {
    db = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY,
        nombre TEXT,
        correo TEXT UNIQUE,
        password TEXT,
        rol TEXT
      );

      CREATE TABLE IF NOT EXISTS vacantes (
        id INTEGER PRIMARY KEY,
        titulo TEXT,
        institucion TEXT,
        descripcion TEXT,
        keywords TEXT,
        usuario_id INTEGER,
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

// Configuración de Multer para la subida de archivos
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
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  }
});

// Middleware para verificar el token JWT
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

// Rutas de la API (ahora usando SQLite)

// Registro de usuario
app.post('/register', async (req, res) => {
  const { nombre, correo, password, rol } = req.body;
  if (!nombre || !correo || !password || !rol) {
    return res.status(400).json({ error: 'Por favor, completa todos los campos.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, correo, hashedPassword, rol]
    );
    res.status(201).json({ message: 'Usuario registrado con éxito.', id: result.lastID });
  } catch (err) {
    if (err.message.includes('SQLITE_CONSTRAINT_UNIQUE')) {
      return res.status(409).json({ error: 'El correo ya está registrado.' });
    }
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Inicio de sesión
app.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  try {
    const user = await db.get('SELECT * FROM usuarios WHERE correo = ?', correo);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
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

// Crear una vacante (solo para instituciones)
app.post('/vacantes', verificarToken, async (req, res) => {
  if (req.user.rol !== 'institucion') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const { titulo, institucion, descripcion, keywords } = req.body;
  if (!titulo || !institucion || !descripcion) {
    return res.status(400).json({ error: 'Por favor, completa todos los campos.' });
  }

  try {
    const keywordsStr = JSON.stringify(keywords);
    const result = await db.run(
      'INSERT INTO vacantes (titulo, institucion, descripcion, keywords, usuario_id) VALUES (?, ?, ?, ?, ?)',
      [titulo, institucion, descripcion, keywordsStr, req.user.id]
    );
    res.status(201).json({ message: 'Vacante creada con éxito.', id: result.lastID });
  } catch (err) {
    console.error('Error al crear vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// RUTA PARA ELIMINAR UNA VACANTE
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

// Obtener todas las vacantes (con búsqueda y filtrado)
app.get('/vacantes', async (req, res) => {
  const { q } = req.query; // Capturamos el parámetro de búsqueda
  let sql = 'SELECT * FROM vacantes';
  let params = [];

  if (q) {
    sql += ' WHERE titulo LIKE ? OR institucion LIKE ? OR descripcion LIKE ? OR keywords LIKE ?';
    const searchTerm = `%${q}%`;
    params = [searchTerm, searchTerm, searchTerm, searchTerm];
  }

  try {
    const vacantes = await db.all(sql, params);
    vacantes.forEach(v => {
      try {
        v.keywords = JSON.parse(v.keywords);
      } catch (e) {
        v.keywords = [];
      }
    });
    res.json(vacantes);
  } catch (err) {
    console.error('Error al obtener vacantes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ENDPOINT PARA OBTENER LAS VACANTES DE LA INSTITUCIÓN
app.get('/institucion/vacantes', verificarToken, async (req, res) => {
  if (req.user.rol !== 'institucion') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  try {
    const vacantes = await db.all('SELECT * FROM vacantes WHERE usuario_id = ?', req.user.id);
    vacantes.forEach(v => {
      try {
        v.keywords = JSON.parse(v.keywords);
      } catch (e) {
        v.keywords = [];
      }
    });
    res.json(vacantes);
  } catch (err) {
    console.error('Error al obtener vacantes de la institución:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Postularse a una vacante (con notificación para la institución)
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

    const mensaje = `¡Nueva postulación a tu vacante "${vacante.titulo}"!`;
    const url = 'instituciones';
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

// Obtener el historial de postulaciones de un profesional
app.get('/postulaciones', verificarToken, async (req, res) => {
  if (req.user.rol !== 'profesional') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  try {
    const postulaciones = await db.all(
      `SELECT
        p.id,
        p.fecha,
        p.cvPath,
        p.estado,
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

// NUEVA RUTA: Eliminar una postulación (solo para el profesional)
app.delete('/postulaciones/:id', verificarToken, async (req, res) => {
    const postulacionId = req.params.id;

    if (req.user.rol !== 'profesional') {
        return res.status(403).json({ error: 'Acceso denegado. Solo los profesionales pueden eliminar postulaciones.' });
    }

    try {
        // 1. Verificar si la postulación existe y si pertenece al usuario logueado
        const postulacion = await db.get('SELECT usuario_id FROM postulaciones WHERE id = ?', postulacionId);
        if (!postulacion) {
            return res.status(404).json({ error: 'Postulación no encontrada.' });
        }
        if (postulacion.usuario_id !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta postulación.' });
        }

        // 2. Eliminar la postulación de la base de datos
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


// OBTENER POSTULACIONES PARA UNA INSTITUCIÓN
app.get('/institucion/postulaciones', verificarToken, async (req, res) => {
  if (req.user.rol !== 'institucion') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  try {
    // Primero, obtenemos los IDs de las vacantes publicadas por la institución
    const misVacantes = await db.all('SELECT id FROM vacantes WHERE usuario_id = ?', req.user.id);
    const misVacantesIds = misVacantes.map(v => v.id);

    if (misVacantesIds.length === 0) {
      return res.json([]);
    }

    // Luego, buscamos las postulaciones para esas vacantes
    const placeholders = misVacantesIds.map(() => '?').join(',');
    const postulaciones = await db.all(
      `SELECT
        p.id,
        p.fecha,
        p.cvPath,
        p.estado,
        v.titulo as vacante_titulo,
        v.institucion as vacante_institucion,
        u.nombre as profesional_nombre,
        u.correo as profesional_correo
      FROM postulaciones p
      JOIN vacantes v ON p.vacante_id = v.id
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.vacante_id IN (${placeholders})`,
      misVacantesIds
    );
    res.json(postulaciones);
  } catch (err) {
    console.error('Error al obtener postulaciones de institución:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// NUEVA RUTA PARA OBTENER LAS NOTIFICACIONES DE UN USUARIO
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

// NUEVA RUTA PARA MARCAR UNA NOTIFICACIÓN COMO LEÍDA
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

// ACTUALIZADO: RUTA PARA ACTUALIZAR EL ESTADO DE UNA POSTULACIÓN (CON NOTIFICACIÓN)
app.put('/postulaciones/:id/estado', verificarToken, async (req, res) => {
  const postulacionId = req.params.id;
  const { estado } = req.body;

  // 1. Verificar que el usuario es una institución
  if (req.user.rol !== 'institucion') {
    return res.status(403).json({ error: 'Acceso denegado. Solo las instituciones pueden cambiar el estado.' });
  }

  // 2. Opcional: Validar que el estado enviado es válido
  const estadosValidos = ['Enviada', 'En Revisión', 'Entrevistado', 'Rechazado', 'Aceptado'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado de postulación no válido.' });
  }

  try {
    // 3. Obtener la información de la postulación
    const postulacion = await db.get(
      `SELECT
        p.usuario_id AS profesional_id,
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

    // 4. Verificar que la institución es la dueña de la vacante asociada a la postulación
    if (postulacion.institucion_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta postulación.' });
    }

    // 5. Actualizar el estado en la base de datos
    await db.run('UPDATE postulaciones SET estado = ? WHERE id = ?', [estado, postulacionId]);

    // 6. CREAR LA NOTIFICACIÓN PARA EL PROFESIONAL CON URL
    const mensaje = `El estado de tu postulación a "${postulacion.vacante_titulo}" ha cambiado a "${estado}".`;
    const url = 'profesionales'; // La URL es la sección "Mis Postulaciones"
    await db.run(
      'INSERT INTO notificaciones (usuario_id, mensaje, fecha, url) VALUES (?, ?, ?, ?)',
      [postulacion.profesional_id, mensaje, new Date().toISOString(), url]
    );

    res.json({ message: `Estado de postulación actualizado a "${estado}".` });
  } catch (err) {
    console.error('Error al actualizar el estado de la postulación:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(3000, () => {
  console.log('Servidor escuchando en el puerto 3000');
});