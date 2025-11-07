const form = document.getElementById("formRegistro");
const mensaje = document.getElementById("mensaje");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // evita que la página se recargue

  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmar = document.getElementById("confirmar").value.trim();

  // ✅ Verificar que todos los campos estén llenos
  if (!nombre || !email || !password || !confirmar) {
    mostrarMensaje("❌ Por favor completa todos los campos.", "red");
    return;
  }

  // ✅ Verificar que las contraseñas coincidan
  if (password !== confirmar) {
    mostrarMensaje("⚠️ Las contraseñas no coinciden.", "orange");
    return;
  }

  // Si todo está correcto:
  mostrarMensaje(`✅ Usuario "${nombre}" registrado correctamente.`, "green");
  form.reset();
});

function mostrarMensaje(texto, color) {
  mensaje.textContent = texto;
  mensaje.style.color = color;
}
