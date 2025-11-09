function showRegister() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
}

function showLogin() {
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
}

// Login
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (data.ok) {
    window.location.href = '/tablero';
  } else {
    errorEl.textContent = 'Email o contraseña incorrectos';
  }
}

// Registro
async function register() {
  const nombre = document.getElementById('reg-nombre').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const errorEl = document.getElementById('reg-error');
  errorEl.textContent = '';

  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, email, password })
  });

  const data = await res.json();
  if (data.ok) {
    alert('Registro exitoso! Ahora puedes iniciar sesión.');
    showLogin();
  } else {
    if (data.error === 'email_exists') {
      errorEl.textContent = 'El email ya está registrado';
    } else {
      errorEl.textContent = 'Error en el registro';
    }
  }
}
