const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

loginForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      // Login correcto → redirigir
      window.location.href = '/tablero';
    } else {
      errorMsg.textContent = data.error || "Email o contraseña incorrectos";
    }
  } catch (err) {
    console.error('Error en login', err);
    errorMsg.textContent = "Error al conectar con el servidor";
  }
});
