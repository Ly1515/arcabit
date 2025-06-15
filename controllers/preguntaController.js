const fs = require('fs');
const rutaPreguntas = './data/preguntas.json';

exports.listarPreguntas = (req, res) => {
  const preguntas = JSON.parse(fs.readFileSync(rutaPreguntas, 'utf8'));
  res.render('preguntas', { preguntas });
};

exports.formNuevaPregunta = (req, res) => {
  res.render('nuevaPregunta');
};

exports.crearPregunta = (req, res) => {
  const preguntas = JSON.parse(fs.readFileSync(rutaPreguntas, 'utf8'));

  const nuevaPregunta = {
    id: preguntas.length ? preguntas[preguntas.length - 1].id + 1 : 1,
    texto: req.body.texto,
    tipo: req.body.tipo,
    opciones: req.body.opciones ? req.body.opciones.split(',') : []
  };

  preguntas.push(nuevaPregunta);

  fs.writeFileSync(rutaPreguntas, JSON.stringify(preguntas, null, 2));
  res.redirect('/preguntas');
};

exports.eliminarPregunta = (req, res) => {
  let preguntas = JSON.parse(fs.readFileSync(rutaPreguntas, 'utf8'));
  preguntas = preguntas.filter(p => p.id != req.params.id);
  fs.writeFileSync(rutaPreguntas, JSON.stringify(preguntas, null, 2));
  res.redirect('/preguntas');
};
