const form = document.getElementById("formRegistro");
let mensaje = document.getElementById("mensaje");

// Si no existe el elemento #mensaje en el HTML, lo creamos para evitar errores
if (!mensaje) {
  mensaje = document.createElement("div");
  mensaje.id = "mensaje";
  // intentamos añadirlo después del formulario (si existe) o en el body
  if (form && form.parentNode) {
    form.parentNode.insertBefore(mensaje, form.nextSibling);
  } else {
    document.body.appendChild(mensaje);
  }
}

// Normaliza el email: para Gmail elimina puntos y tags +... en la parte local
function normalizeEmail(email) {
  if (!email) return email;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return email.trim().toLowerCase();
  let [local, domain] = parts;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const plusIndex = local.indexOf('+');
    if (plusIndex !== -1) local = local.substring(0, plusIndex);
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

// Hashea la contraseña usando SubtleCrypto (SHA-256) y devuelve hex
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem('usuarios');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem('usuarios', JSON.stringify(users));
}

// Genera y descarga un archivo usuarios.txt con los usuarios (CSV simple)
function generateUsersTxt(users) {
  const header = 'nombre,email,passwordHash,createdAt';
  const lines = users.map(u => `${escapeCsv(u.nombre)},${escapeCsv(u.email)},${u.passwordHash},${u.createdAt}`);
  const content = [header, ...lines].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'usuarios.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault(); // Evita recargar la página

  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmar = document.getElementById('confirmar').value.trim();

  // Validaciones básicas
  if (!nombre || !email || !password || !confirmar) {
    mostrarMensaje('❌ Por favor completa todos los campos.', 'red');
    return;
  }

  // Validación de formato de email: debe seguir patrón email@dominio.ext
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    mostrarMensaje('❌ El formato del correo no es válido. Debe ser: email@dominio.ext', 'red');
    return;
  }

  // Unicidad: normalizamos emails (tratamiento especial para Gmail)
  const canonicalEmail = normalizeEmail(email);
  const stored = getStoredUsers();
  const nameExists = stored.some(u => u.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  const emailExists = stored.some(u => u.emailCanonical === canonicalEmail);
  if (nameExists) {
    mostrarMensaje('⚠️ El nombre de usuario ya está en uso. Elige otro.', 'orange');
    return;
  }
  if (emailExists) {
    mostrarMensaje('⚠️ El correo ya está registrado.', 'orange');
    return;
  }

  if (password !== confirmar) {
    mostrarMensaje('⚠️ Las contraseñas no coinciden.', 'orange');
    return;
  }

  // Hasheamos la contraseña antes de guardar
  const passHash = await hashPassword(password);

  const newUser = {
    nombre: nombre,
    email: email,
    emailCanonical: canonicalEmail,
    passwordHash: passHash,
    createdAt: new Date().toISOString()
  };

  stored.push(newUser);
  saveStoredUsers(stored);

  // Intentamos guardar usuarios.txt en un servidor local (dentro de la carpeta registro).
  // Si no hay servidor disponible, hacemos la descarga local como fallback.
  try {
    const res = await fetch('http://localhost:3000/save-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: stored })
    });
    if (!res.ok) throw new Error('Server responded ' + res.status);
    mostrarMensaje(`✅ Usuario "${nombre}" registrado y usuarios.txt guardado en servidor.`, 'green');
  } catch (e) {
    console.warn('No se pudo guardar en servidor, generando descarga local.', e);
    try {
      generateUsersTxt(stored);
      mostrarMensaje(`✅ Usuario "${nombre}" registrado. usuarios.txt descargado localmente.`, 'green');
    } catch (e2) {
      console.error('Error generando usuarios.txt', e2);
      mostrarMensaje(`✅ Usuario "${nombre}" registrado, pero no se pudo guardar el archivo.`, 'green');
    }
  }

  form.reset();
});

function mostrarMensaje(texto, color) {
  mensaje.textContent = texto;
  mensaje.style.color = color;
}
