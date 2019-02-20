function $(sel, target = document) {return target.querySelector(sel);}

const NCELLS=120000;     // Area of the simulation board (in pixels)
const CIRCLE_FADE = 60;   // # of frames over which to fade mutation circles

// Map of Hue (0-255) to RGB values
const HSB = new Array(256);
for (let i = 0; i < 256; i++) {
  let a = i*360/255;
  let r=0, g=0, b=0;
  if (a < 60) {
    r = 255;
    g = a*255/60;
  } else if (a < 120) {
    a-= 60;
    r = 255 - (a*255/60);
    g = 255;
  } else if (a < 180) {
    a-= 120;
    g = 255;
    b = a*255/60;
  } else if (a < 240) {
    a-= 180;
    g = 255 - (a*255/60);
    b = 255;
  } else if (a < 300) {
    a-= 240;
    r = a*255/60;
    b = 255;
  } else {
    a-= 300;
    r = 255;
    b = 255 - (a*255/60);
  }

  HSB[i] = [r | 0, g | 0, b | 0];
}

// Global all the thingz!!!
let plague;
let frame = 0;
let maxFrame = Number.POSITIVE_INFINITY;
let circles = [];
let stats = [];
let viewMode = 0;

// Toggle between the various view modes we have
function setViewMode(mode) {
  viewMode = mode > 2 ? 0 : mode;
  ['mode-all', 'mode-infected', 'mode-immune'].forEach((m, i) => {
    document.body.classList.toggle(m, i == viewMode);
  })
  renderBoard();
}

function renderGraph() {
  const canvas = $('#graph');
  const {width: w, height: h} = canvas;
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 4;

  ctx.strokeStyle = 'cyan';
  ctx.beginPath();
  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const x = i / stats.length * w;
    const y = h * (1 - stat.immunity / 100);
    if (i != 0) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = 'red';
  ctx.beginPath();
  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const x = i / stats.length * w;
    const y = h * (1 - stat.infected / 100);
    if (i != 0) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
    }
  }
  ctx.stroke();
}

function renderColors() {
  const canvas = $('#colors');
  const {width: w, height: h} = canvas;
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 4;

  ctx.beginPath();
  const nCells = plague.nCells;
  for (let c = 0; c < 8; c++) {
    ctx.strokeStyle = `hsl(${c * 45 + 22.5}, 100%, 50%)`;
    ctx.beginPath();
    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const x = i / stats.length * w;
      const y = h * (1 - stat.colors[c] / nCells);
      if (i != 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
}

function renderBoard() {
  const canvas = $('#board');
  const {width: w, height: h} = canvas;
  const ctx = canvas.getContext('2d');
  const bitmap = ctx.createImageData(w, h);

  const state = plague.state[0];
  const data = bitmap.data;
  for (let i = 0, j = 0, n = state.nCells; i < n; i++) {
    switch (viewMode) {
      case 0: {  // Show all properties
        let imm = .1 + .9 * state[i].immune/128;
        const inf = state[i].infected ? 128 : 0;
        if (inf) imm /= 2;
        const color = HSB[state[i].code & 0xff];
        data[j++] = inf + color[0] * imm;
        data[j++] = inf + color[1] * imm;
        data[j++] = inf + color[2] * imm;
        break;
      }

      case 1: { // Show infected
        const vir = state[i].infected ? 255 : 0;
        data[j++] = vir;
        data[j++] = vir;
        data[j++] = vir;
        break;
      }

      case 2: { // Show immune
        const imm = Math.min(255, state[i].immune * 256/128);
        data[j++] = imm;
        data[j++] = imm;
        data[j++] = imm;
        break;
      }
    }
    data[j++] = 255;
  }

  ctx.putImageData(bitmap, 0, 0);

  // Draw a circle where an infection is introduced
  if (plague.infectedCell) {
    const cell = plague.infectedCell;
    const x = cell.i % plague.width;
    const y = Math.floor(cell.i / plague.width);
    circles.push({x, y, i: 0, hue: cell.code * 360/256});
  }

  circles = circles.filter(c => {
    const a = c.i/CIRCLE_FADE;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${c.hue}, 100%, 50%, ${1-a})`;

    ctx.arc(c.x, c.y, 5, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();

    return c.i++ < CIRCLE_FADE;
  });
}

document.addEventListener('keypress', e => {
  switch (e.key) {
    case ' ': // Play/pause
      maxFrame = maxFrame > frame ? frame : Number.POSITIVE_INFINITY
      break;

    case 's': // Step
      maxFrame = frame + 1;
      break;

    case 'v': // Toggle between the various views
      setViewMode(viewMode + 1);
  }
});

function updateControls() {
  Object.entries(plague)
    .filter(([p]) => /[A-Z]{2,}/.test(p))
    .forEach(([prop, val]) => {
      const target = $(`#${prop}`);
      if (!target) return;
      const label = target.closest('label');
      target.value = val;
      $('span', label).innerText = `${prop} = ${val}`;
    });
}

document.addEventListener('change', e => {
  const target = e.target;
  if (target.id in plague) {
    plague[target.id] = parseFloat(target.value, 10);
    updateControls();
  }
});

function tick() {
  // Stop animating if we don't have focus so we don't burn CPU/battery
  // unnecessarily
  $('#shield').classList.toggle('focus', document.hasFocus());
  if (!document.hasFocus() || frame >= maxFrame) {
    setTimeout(tick, .5);
    return;
  }

  plague.tick();

  frame++;
  if (frame % 10 == 0 && plague.stats)  {
    const stat = plague.stats;
    stat.immunity = 100 * stat.nImmunity/plague.nCells / 128;
    stat.infected = 100 * stat.nInfected/plague.nCells;

    stats.push(stat);
    if (stats.length > 200) stats.shift();
  }

  renderBoard();
  renderGraph();
  renderColors();

  window.requestAnimationFrame(tick);
}

window.onload = function() {
  // Make plague object with same aspect ratio as screen area, but with control
  // for the number of cells so that we can control perf.
  const canvas = $('#board');
  let {innerWidth: ww, innerHeight: wh} = window;
  ww -= 296;
  canvas.width = Math.floor(Math.sqrt(NCELLS * ww/wh));
  canvas.height = Math.floor(Math.sqrt(NCELLS * wh/ww));
  canvas.style.zoom = ww / canvas.width;

  plague = new Plague(canvas.width, canvas.height);

  // Initialize view mode
  setViewMode(0);

  // Make sure controls reflect settings in plague instance
  updateControls();

  // Start animating
  tick();
}
