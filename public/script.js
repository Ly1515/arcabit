// Función para cargar preguntas desde el backend
function cargarPreguntas() {
  fetch('/api/preguntas')
    .then(res => res.json())
    .then(preguntas => {
      const lista = document.getElementById('lista-preguntas');
      if (!lista) return;  // Si no existe, salimos
      lista.innerHTML = ''; // limpiar lista
      preguntas.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${p.texto}</strong> (${p.tipo})`;
        if (p.opciones && p.opciones.length > 0) {
          const ulOpciones = document.createElement('ul');
          p.opciones.forEach(o => {
            const liO = document.createElement('li');
            liO.textContent = o;
            ulOpciones.appendChild(liO);
          });
          li.appendChild(ulOpciones);
        }
        lista.appendChild(li);
      });
    })
    .catch(console.error);
}

// Código para el chat en nuevaPregunta.html
const btnEnviar = document.getElementById('btnEnviar');
if (btnEnviar) {
  btnEnviar.addEventListener('click', () => {
    const inputMensaje = document.getElementById('inputMensaje');
    const respuestaDiv = document.getElementById('respuestaIA');
    const mensaje = inputMensaje.value;

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: mensaje }),
    })
      .then(res => res.json())
      .then(data => {
        respuestaDiv.textContent = data.response;
      })
      .catch(err => {
        respuestaDiv.textContent = 'Error al comunicarse con la IA';
        console.error(err);
      });
  });
}

// Si estamos en preguntas.html cargamos las preguntas
if (document.getElementById('lista-preguntas')) {
  cargarPreguntas();
}
