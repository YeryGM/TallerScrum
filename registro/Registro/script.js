const form = document.getElementById("formRegistro");
const mensaje = document.getElementById("mensaje");

form.addEventListener("submit", (event) => {
  event.preventDefault(); // Evita recargar la página

  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmar = document.getElementById("confirmar").value.trim();

  // Validaciones básicas
  if (!nombre || !email || !password || !confirmar) {
    mostrarMensaje("❌ Por favor completa todos los campos.", "red");
    return;
  }

  if (password !== confirmar) {
    mostrarMensaje("⚠️ Las contraseñas no coinciden.", "orange");
    return;
  }

  // Aquí podrías enviar los datos al servidor (fetch o API)
  mostrarMensaje(`✅ Usuario "${nombre}" registrado correctamente.`, "green");
  form.reset();
});

function mostrarMensaje(texto, color) {
  mensaje.textContent = texto;
  mensaje.style.color = color;
}
