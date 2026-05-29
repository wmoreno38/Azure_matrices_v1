// Antes — solo funcionaba con Web API Headers:
req.headers.get('authorization')  // → undefined en Azure real

// Ahora — compatible con ambos formatos:
if (typeof req.headers.get === 'function') {
  return req.headers.get('authorization');  // Web API
}
return req.headers['authorization'];  // Objeto plano (Azure Functions v4 real)
