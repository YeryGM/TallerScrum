const form = document.getElementById('formRegistro');
let mensaje = document.getElementById('mensaje');

if (!mensaje) {
  mensaje = document.createElement('div');
  mensaje.id = 'mensaje';
  if (form && form.parentNode) form.parentNode.insertBefore(mensaje, form.nextSibling);
  else document.body.appendChild(mensaje);
}

function mostrarMensaje(texto, color) {
  mensaje.textContent = texto;
  mensaje.style.color = color;
}

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

async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredUsers() {
  try { return JSON.parse(localStorage.getItem('usuarios') || '[]'); }
  catch (e) { return []; }
}

function saveStoredUsers(users) {
  localStorage.setItem('usuarios', JSON.stringify(users));
}

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function generateUsersTxt(users) {
  const header = 'nombre,email,passwordHash,createdAt';
  const lines = users.map(u => `${escapeCsv(u.nombre)},${escapeCsv(u.email)},${u.passwordHash},${u.createdAt}`);
  const content = [header, ...lines].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'usuarios.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmar = document.getElementById('confirmar').value;

  if (!nombre || !email || !password || !confirmar) {
    mostrarMensaje('❌ Por favor completa todos los campos.', 'red');
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    mostrarMensaje('❌ El formato del correo no es válido.', 'red');
    return;
  }

  if (password !== confirmar) {
    mostrarMensaje('⚠️ Las contraseñas no coinciden.', 'orange');
    return;
  }

  const canonical = normalizeEmail(email);
  const stored = getStoredUsers();
  if (stored.some(u => u.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())) {
    mostrarMensaje('⚠️ El nombre de usuario ya está en uso.', 'orange');
    return;
  }
  if (stored.some(u => u.emailCanonical === canonical)) {
    mostrarMensaje('⚠️ El correo ya está registrado.', 'orange');
    return;
  }

  const passHash = await hashPassword(password);
  const newUser = { nombre, email, emailCanonical: canonical, passwordHash: passHash, createdAt: new Date().toISOString() };
  stored.push(newUser);
  saveStoredUsers(stored);

  // Enviar al servidor para que escriba usuarios.txt
  try {
    const res = await fetch('http://localhost:3000/save-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: stored }) });
    if (!res.ok) throw new Error('Server error ' + res.status);
    mostrarMensaje(`✅ Usuario "${nombre}" registrado correctamente.`, 'green');
  } catch (err) {
    console.warn('No se pudo guardar en servidor, descargando localmente', err);
    try { generateUsersTxt(stored); mostrarMensaje(`✅ Usuario "${nombre}" registrado. usuarios.txt descargado.`, 'green'); }
    catch (e) { mostrarMensaje(`✅ Usuario "${nombre}" registrado (no se pudo crear archivo).`, 'green'); }
  }

  form.reset();
});
