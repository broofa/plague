function frnd(n) {
  return Math.random() * n;
}

function irnd(n) {
  return Math.random() * n | 0;
}

function codeDiff(c0, c1) {
  const d = Math.abs(c0 - c1);
  return d > 127 ? 256 - d : d;
}

function getNeighbor(state, i, ni) {
  const {width, nCells} = state;
  switch (ni & 0x07) {
    case 0: i -= 1; break;
    case 1: i += 1; break;
    case 2: i -= width; break;
    case 3: i += width; break;
    case 4: i -= width - 1; break;
    case 5: i -= width + 1; break;
    case 6: i += width - 1; break;
    case 7: i += width + 1; break;
  }

  if (i < 0) {
    i += nCells;
  } else if (i >= nCells) {
    i -= nCells;
  }

  return state[i];
}

class Plague {
  constructor(width, height) {
    this.IMMUNE_ENTROPY = .8;
    this.IMMUNE_BOOST = 60;
    this.LIFE_MAX = 20;
    this.MUTATION = .1; // Probability of cell getting infected

    this.width = width;
    this.height = height;
    this.nCells = width * height;

    this.state = [
      this.initState(width, height),
      this.initState(width, height)
    ];

    this.isSuppressed = false;
  }

  initState(width, height) {
    const s = new Array(width * height);
    s.width = width;
    s.height = height;
    s.nCells = width * height;

    for (let i = 0; i < s.length; i++) s[i] = this.initCell({i});

    return s;
  }

  initCell(state, lastState = null) {
    state.life = irnd(this.LIFE_MAX); // life:  (int) Iterations left in cell's life
    state.infected = false; // infected: (bool) True if cell is infected

    if (!lastState) {
      state.code = 0;   // code: (int) Genetic code value
      state.immune = 0; // immune: (int) Amount of immunity a cell has
    } else {
      // Set code and immunity to average of two random neighbors
      const n0 = getNeighbor(lastState, state.i, irnd(8));
      const n1 = getNeighbor(lastState, state.i, irnd(8));

      // Code is circular, so we pick the closer of the two possible averages
      let code = n0.code + n1.code >> 1, d = code - n0.code;
      state.code = ((d < 64 && d > -64) ? code : code + 128) & 0xff;

      // Decrease immunity
      state.immune = ((n0.immune + n1.immune) / 2) - this.IMMUNE_ENTROPY;
      if (state.immune < 0) state.immune = 0;
    }

    return state;
  }

  tick() {
    const {MUTATION, IMMUNE_BOOST, LIFE_MAX} = this;
    const [lastState, nextState] = this.state;
    const {nCells} = lastState;
    const stats = {
      nImmunity: 0,
      nInfected: 0,
      colors: [0,0,0,0,0,0,0,0],
    };
    const isVaccinated = plague.isVaccinated;

    // Infect a cell at random
    if (Math.random() < MUTATION) {
      const cell = lastState[irnd(nCells)];
      cell.code = (cell.code + frnd(frnd(128)) * (irnd(2) ? -1 : 1)) & 0xff;
      cell.infected = true;
      this.infectedCell = cell;
    } else {
      this.infectedCell = null;
    }


    // Process each cell
    for (let i = 0; i < nCells; i++) {
      const last = lastState[i];

      // If cell was infected on this tick, do nothing
      if (last.infected === null) continue;

      const next = nextState[i];

      if (!last.life) {
        // Dead cells get resurrected
        this.initCell(next, lastState);
        continue;
      }

      // If cell was just infected, ignore
      // if (!last.infected && next.infected) continue;

      // Update cell state
      next.life = last.life - 1;
      next.infected = last.infected;
      next.code = last.code;
      next.immune = last.immune;

      // Infected cells [try to] infect their neighbors
      if (last.infected) {
        for (let i = 0; i < 1; i++) {
          const dir = irnd(8);
          const n = getNeighbor(lastState, last.i, dir);
          if (n.infected) continue;

          // Compute code difference
          let d = codeDiff(n.code, last.code);
          if (isVaccinated) d >>= 2;

          // If codes are different enough, infect
          if (d > n.immune) {
            const nn = nextState[n.i];
            nn.immune += IMMUNE_BOOST;
            if (nn.immune > 128) nn.immune = 128;
            nn.infected = true;
            nn.code = nn.code * .001 + last.code * .999;

            n.infected = null; // Mark cell as having just been infected
            break;
          }
        }
      }

      if (next.infected) stats.nInfected++;

      stats.nImmunity += next.immune;
      stats.colors[(next.code & 0xff) >> 5]++;
    }

    this.stats = stats;

    // Swap states
    this.state.reverse();
  }
}
