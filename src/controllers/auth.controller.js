// Módulo 4.1: Inicio de sesión y control de acceso
//
// Cubre los puntos del documento:
//  - Formulario de usuario y contraseña -> lo consume el frontend
//  - Validación de credenciales
//  - Contraseñas mediante hash seguro (bcrypt), nunca en texto plano
//  - Inicio y cierre de sesión mediante sesiones (express-session)
//  - Bloqueo por intentos fallidos
//  - Redirección según el rol (el rol se devuelve en la respuesta; el
//    frontend decide a dónde redirigir)
//  - Regenerar el identificador de sesión después de autenticar

const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");

const MAX_INTENTOS = parseInt(process.env.MAX_INTENTOS_FALLIDOS || "5", 10);
const MINUTOS_BLOQUEO = parseInt(process.env.BLOQUEO_MINUTOS || "15", 10);

const login = asyncHandler(async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: "Usuario y contraseña son obligatorios." });
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.nombre, u.usuario, u.password_hash, u.estado,
            u.intentos_fallidos, u.bloqueado_hasta, r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.usuario = ?`,
    [usuario]
  );

  // Mensaje genérico: no revelar si el usuario existe o no.
  const credencialesInvalidas = () =>
    res.status(401).json({ error: "Usuario o contraseña incorrectos." });

  if (rows.length === 0) return credencialesInvalidas();

  const cuenta = rows[0];

  if (cuenta.estado !== "activo") {
    return res.status(403).json({ error: "La cuenta está desactivada. Contacta al administrador." });
  }

  if (cuenta.bloqueado_hasta && new Date(cuenta.bloqueado_hasta) > new Date()) {
    return res.status(423).json({
      error: `Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo después de las ${cuenta.bloqueado_hasta}.`,
    });
  }

  const passwordValido = await bcrypt.compare(password, cuenta.password_hash);

  if (!passwordValido) {
    const intentos = cuenta.intentos_fallidos + 1;
    let bloqueadoHasta = null;

    if (intentos >= MAX_INTENTOS) {
      bloqueadoHasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000);
    }

    await pool.query(
      `UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?`,
      [intentos, bloqueadoHasta, cuenta.id]
    );

    await registrarAuditoria({
      usuarioId: cuenta.id,
      accion: "login_fallido",
      tabla: "usuarios",
      registroId: cuenta.id,
      detalle: `Intento fallido #${intentos}`,
    });

    return credencialesInvalidas();
  }

  // Login correcto: reiniciar contador de intentos fallidos.
  await pool.query(
    `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?`,
    [cuenta.id]
  );

  // Regenerar el identificador de sesión después de autenticar (sección 8).
  req.session.regenerate((err) => {
    if (err) throw err;

    req.session.usuario = {
      id: cuenta.id,
      nombre: cuenta.nombre,
      usuario: cuenta.usuario,
      rol: cuenta.rol,
    };

    registrarAuditoria({
      usuarioId: cuenta.id,
      accion: "login",
      tabla: "usuarios",
      registroId: cuenta.id,
    });

    res.json({ usuario: req.session.usuario });
  });
});

const logout = asyncHandler(async (req, res) => {
  const usuarioId = req.session?.usuario?.id ?? null;

  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "No se pudo cerrar sesión." });

    res.clearCookie("connect.sid");

    if (usuarioId) {
      registrarAuditoria({ usuarioId, accion: "logout", tabla: "usuarios", registroId: usuarioId });
    }

    res.json({ mensaje: "Sesión cerrada correctamente." });
  });
});

const sesionActual = (req, res) => {
  if (!req.session?.usuario) {
    return res.status(401).json({ error: "No hay sesión activa." });
  }
  res.json({ usuario: req.session.usuario });
};

module.exports = { login, logout, sesionActual };
