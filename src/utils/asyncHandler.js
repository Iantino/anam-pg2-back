// Evita repetir try/catch en cada controlador. Cualquier error asíncrono
// se pasa a next(err) y lo captura el manejador de errores central de server.js
// (sección 8: "Registrar errores técnicos en logs sin mostrar información
// sensible al usuario").

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
