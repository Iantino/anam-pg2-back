// Sección 4.2: "Administrar permisos por módulo o función."
//
// Uso: requireRole("Administrador") o requireRole("Administrador", "Operativo")
// Debe usarse SIEMPRE después de requireAuth en la cadena de middlewares.

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    const rolUsuario = req.session?.usuario?.rol;

    if (!rolUsuario) {
      return res.status(401).json({ error: "No autenticado." });
    }

    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        error: "No tienes permiso para realizar esta acción.",
      });
    }

    next();
  };
}

module.exports = requireRole;
