// Sección 8: "Validar permisos en el servidor; ocultar un botón no
// constituye seguridad." y "Proteger las rutas internas".
//
// Este middleware bloquea cualquier ruta si no hay una sesión activa.

function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ error: "No autenticado. Inicia sesión para continuar." });
  }
  next();
}

module.exports = requireAuth;
