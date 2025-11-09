// Usuarios simulados (en un proyecto real se consultaría la base de datos)
const usuarios = [
    { email: 'admin@example.com', password: '1234' },
    { email: 'user@example.com', password: 'abcd' }
];

const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

loginForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const usuarioValido = usuarios.find(u => u.email === email && u.password === password);

    if (usuarioValido) {
        // Credenciales correctas → redirigir al tablero
        window.location.href = 'tablero.html'; // En un proyecto real, aquí va la URL de tu tablero
    } else {
        // Credenciales incorrectas → mostrar error
        errorMsg.textContent = "Email o contraseña incorrectos";
    }
});
