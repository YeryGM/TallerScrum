const form = document.getElementById("formRegistro");
let mensaje = document.getElementById("mensaje");

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const nombre = document.getElementById('nombre').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmar = document.getElementById('confirmar').value.trim();

  // ✅ Verificar que todos los campos estén llenos
  if (!nombre || !email || !password || !confirmar) {
    mostrarMensaje('❌ Por favor completa todos los campos.', 'red');
    return;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (password !== confirmar) {
    mostrarMensaje('⚠️ Las contraseñas no coinciden.', 'orange');
    return;
  }

  mostrarMensaje(`✅ Usuario "${nombre}" registrado correctamente.`, "green");
  form.reset();
});

function mostrarMensaje(texto, color) {
  mensaje.textContent = texto;
  mensaje.style.color = color;
}
