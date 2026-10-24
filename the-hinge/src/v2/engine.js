/* THE HINGE — forecast engine (pure functions, no DOM). Margin convention: D − R in points.
   For Nebraska the "D" side is the independent challenger. */
const ENGINE = (() => {
  const DAY = 86400000;
  const t = (s) => Date.parse(s + 'T12:00:00Z');
  const daysBetween = (a, b) => Math.round((t(b) - t(a)) / DAY);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normalGen(rng) {
    let spare = null;
    return function () {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u, v, s;
      do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
      const m = Math.sqrt(-2 * Math.log(s) / s);
      spare = v * m; return u * m;
    };
  }
  function erf(x) { // Abramowitz-Stegun 7.1.26
    const s = Math.sign(x); x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const k = 1 / (1 + p * x);
    const y = 1 - (((((a5 * k + a4) * k) + a3) * k + a2) * k + a1) * k * Math.exp(-x * x);
    return s * y;
  }
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  /* ---------------------------------------------------------------- poll average
     Calibrated on 538's raw polls 1998–2022 (669 Senate/governor races):
     exponential recency weight (time constant tau days), sqrt(sample) weight,
     partisan-sponsor polls shifted partAdj points toward the other party. */
  function pollAverage(polls, asOf, o) {
    const now = t(asOf);
    const rows = [];
    for (const p of polls) {
      if (p.excluded) continue;
      const end = t(p.end);
      if (!(end <= now)) continue;
      const mid = (t(p.start || p.end) + end) / 2;
      const age = Math.max(0, (now - mid) / DAY);
      const raw = p.dem - p.rep;
      let adj = 0;
      if (p.partisan === 'D') adj -= o.partAdj;
      else if (p.partisan === 'R') adj += o.partAdj;
      if (p.pop && p.pop !== 'LV') adj += o.rvAdj;
      const n = Math.min(Math.max(p.n || 600, 100), o.nmax || 3000);
      const w = Math.exp(-age / o.tau) * Math.sqrt(n / 600) * (p.partisan ? o.partW : 1);
      rows.push({ p, age, raw, adj, m: raw + adj, w });
    }
    if (!rows.length) return { avg: null, neff: 0, k: 0, rows, ageEff: null };
    let W = 0, W2 = 0, S = 0, A = 0, Sraw = 0;
    for (const r of rows) { W += r.w; W2 += r.w * r.w; S += r.w * r.m; A += r.w * r.age; Sraw += r.w * r.raw; }
    for (const r of rows) r.share = r.w / W;
    return { avg: S / W, rawAvg: Sraw / W, neff: (W * W) / W2, k: rows.length, rows, ageEff: A / W };
  }

  // residual error of a polling average vs the result, by effective poll count (backtest fit)
  const sigmaPolls = (k) => Math.sqrt(3.8 * 3.8 + (6.4 * 6.4) / Math.max(k, 1));

  /* ---------------------------------------------------------------- one race */
  function raceEstimate(race, polls, ctx) {
    const { s, asOf, envAdj, daysLeft } = ctx;
    const pa = pollAverage(polls, asOf, s);
    const lean = race.pres24 + 1.5;            // vs. 2024 national popular vote (R+1.5)
    const inc = race.incAdv || 0;
    const cand = race.cand || 0;
    const fixed = race.fixedPrior != null;
    const F = fixed ? race.fixedPrior + (envAdj - (ctx.gbBaseline ?? envAdj)) : s.leanCoef * lean + envAdj + inc + cand + (race.fundAdj || 0);
    const sigF = fixed ? (race.sigmaPrior || 4) : s.sigmaF;
    const steps = [];
    let mu, sigPost, wPolls = 0, A = null, Aadj = null, sigA = null, sigDrift = null;
    if (pa.avg !== null && !ctx.ignorePolls) {
      A = pa.avg;
      Aadj = A - s.biasState * (race.elast ?? 1) - (race.stateBias || 0) * s.stateBiasOn;
      sigA = sigmaPolls(pa.neff);
      sigDrift = s.driftRate * Math.sqrt(Math.max(0, daysLeft) + Math.min(pa.ageEff, 60));
      const vP = sigA * sigA + sigDrift * sigDrift;
      const vF = (sigF * sigF) / Math.max(s.fundWeight, 1e-6);
      const precP = 1 / vP, precF = s.fundWeight > 0 ? 1 / vF : 0;
      wPolls = precP / (precP + precF);
      mu = wPolls * Aadj + (1 - wPolls) * F;
      sigPost = Math.sqrt(1 / (precP + precF));
      steps.push({ k: 'Raw poll average', v: pa.rawAvg });
      steps.push({ k: 'Sponsor / population adjustments', v: A });
      steps.push({ k: 'Historical bias correction', v: Aadj });
      steps.push({ k: 'Blend with fundamentals', v: mu });
    } else {
      mu = F; sigPost = sigF;
      steps.push({ k: fixed ? 'No polls tracked — prior from the forecasters’ Likely/Safe ratings' : ctx.ignorePolls ? 'Polls set aside — history-only estimate' : 'No public polls — fundamentals only', v: F });
    }
    mu += s.envShift * (race.elast ?? 1);
    if (s.envShift) steps.push({ k: 'Scenario shift', v: mu });
    return { race, pa, A, Aadj, F, sigA, sigF, sigDrift, wPolls, mu, sigPost, steps, lean };
  }

  /* ---------------------------------------------------------------- House district */
  const RATING_SCORE = { 'Safe D': 3, 'Solid D': 3, 'Likely D': 2, 'Lean D': 1, 'Tilt D': 0.5, 'Toss-up': 0, 'Tossup': 0, 'Tilt R': -0.5, 'Lean R': -1, 'Likely R': -2, 'Safe R': -3, 'Solid R': -3 };
  function ratingScore(d) {
    const v = [d.cook, d.sabato, d.ie].map((r) => RATING_SCORE[r]).filter((x) => x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  }
  function districtEstimate(dist, ctx) {
    const { s, envAdj, gbBaseline } = ctx;
    const sc = ratingScore(dist);
    const ratingCenter = sc * 5;                // Lean ≈ ±5, Likely ≈ ±10, Safe ≈ ±15
    // ratings already price in today's environment → only movement from today's average applies
    const ratingPart = ratingCenter + (envAdj - gbBaseline);
    const incAdv = dist.open ? 0 : (dist.party === 'D' ? s.houseInc : -s.houseInc);
    const pvi = typeof dist.pvi === 'number' ? dist.pvi : null;    // + = D lean (two-party pts)
    const fundPart = pvi === null ? ratingPart : 2 * pvi + envAdj + incAdv;
    const w = pvi === null ? 1 : s.houseRatingsW;
    let mu = w * ratingPart + (1 - w) * fundPart;
    if (dist.poll && s.useDistrictPolls) {
      const pm = dist.poll.dem - dist.poll.rep - (dist.poll.partisan === 'D' ? s.partAdj : dist.poll.partisan === 'R' ? -s.partAdj : 0);
      const vP = 7.5 * 7.5, vM = s.sigmaDist * s.sigmaDist;
      mu = (mu / vM + pm / vP) / (1 / vM + 1 / vP);
    }
    mu += s.envShift;
    return { dist, score: sc, ratingCenter, fundPart, mu, sig: s.sigmaDist };
  }

  /* ---------------------------------------------------------------- simulation */
  function simulate(model, s, calls) {
    const { races, districts, senateBase, houseBase, regions } = model;
    const nS = s.nSims;
    const rng = mulberry32(s.seed || 20261103);
    const z = normalGen(rng);
    const regIdx = {}; regions.forEach((r, i) => (regIdx[r] = i));
    const senRaces = races.filter((r) => r.race.office === 'Senate');
    const nR = races.length, nD = districts.length;
    const margins = races.map(() => new Float32Array(nS));
    const dWins = new Uint8Array(nD * 0); // not stored per district to save memory
    const distWinCount = new Float64Array(nD);
    const senD = new Int16Array(nS), senR = new Int16Array(nS), senI = new Int16Array(nS);
    const houseD = new Int16Array(nS);
    const natShock = new Float32Array(nS);
    const tipCount = {}; races.forEach((r) => (tipCount[r.race.id] = 0));
    const reg = new Float64Array(regions.length);
    const order = senRaces.map((_, i) => i);
    const senIdx = senRaces.map((r) => races.indexOf(r));
    const tmpM = new Float64Array(senRaces.length);
    let accepted = 0;
    const accept = new Uint8Array(nS);
    // optional fat tails for the shared national shock: Student-t with df degrees of freedom,
    // rescaled to the same standard deviation, so big misses / late shocks are more likely
    const df = s.tailDf && s.tailDf > 2 ? Math.round(s.tailDf) : 0;
    const tScale = df ? Math.sqrt((df - 2) / df) : 1;
    const natDraw = () => {
      if (!df) return z();
      let c = 0; for (let q = 0; q < df; q++) { const g = z(); c += g * g; }
      return (z() / Math.sqrt(c / df)) * tScale;
    };
    for (let i = 0; i < nS; i++) {
      const nu = s.sigmaNat * natDraw() + s.sigmaNatDrift * z();
      natShock[i] = nu;
      for (let k = 0; k < reg.length; k++) reg[k] = s.sigmaReg * z();
      let d = senateBase.D, r = senateBase.R, ind = 0, ok = true;
      for (let j = 0; j < nR; j++) {
        const e = races[j];
        const m = e.mu + (e.race.elast ?? 1) * nu + reg[regIdx[e.race.region] ?? 0] + e.sigPost * z();
        margins[j][i] = m;
        const call = calls && calls[e.race.id];
        if (call && ((call === 'D') !== (m > 0))) ok = false;
        if (e.race.office !== 'Senate') continue;
        if (m > 0) { if (e.race.dSideInd) ind++; else d++; } else r++;
      }
      senD[i] = d; senR[i] = r; senI[i] = ind;
      let hd = houseBase.D;
      for (let j = 0; j < nD; j++) {
        const e = districts[j];
        const m = e.mu + nu * s.houseNatScale + reg[regIdx[e.dist.region] ?? 0] + e.sig * z();
        const call = calls && calls['H:' + e.dist.district];
        if (call && ((call === 'D') !== (m > 0))) ok = false;
        if (m > 0) { hd++; distWinCount[j]++; }
      }
      houseD[i] = hd;
      accept[i] = ok ? 1 : 0; if (ok) accepted++;
      // tipping point: order Senate races from most-D to most-R, find the seat that delivers control
      for (let q = 0; q < senRaces.length; q++) tmpM[q] = margins[senIdx[q]][i];
      order.sort((a, b) => tmpM[b] - tmpM[a]);
      let need = 51 - senateBase.D, cum = 0;
      for (let q = 0; q < order.length; q++) {
        cum++;
        if (cum === need) { tipCount[senRaces[order[q]].race.id]++; break; }
      }
    }
    // conditioning on called races (election-night mode): keep only consistent draws
    const useCond = calls && Object.keys(calls).length > 0 && accepted >= Math.min(300, nS * 0.02);
    const keep = (i) => (useCond ? accept[i] === 1 : true);
    const N = useCond ? accepted : nS;
    const raceOut = races.map((e, j) => {
      const arr = [];
      let w = 0;
      for (let i = 0; i < nS; i++) if (keep(i)) { arr.push(margins[j][i]); if (margins[j][i] > 0) w++; }
      arr.sort((a, b) => a - b);
      const call = calls && calls[e.race.id];
      return { id: e.race.id, pD: call ? (call === 'D' ? 1 : 0) : w / N, med: quantile(arr, 0.5), lo: quantile(arr, 0.1), hi: quantile(arr, 0.9), lo05: quantile(arr, 0.05), hi95: quantile(arr, 0.95) };
    });
    const hist = (arr, lo, hi) => { const h = {}; for (let v = lo; v <= hi; v++) h[v] = 0; for (let i = 0; i < nS; i++) if (keep(i)) { const v = arr[i]; h[v] = (h[v] || 0) + 1; } for (const k in h) h[k] /= N; return h; };
    let senRctl = 0, senDctl = 0, senHung = 0, houseDctl = 0;
    const combo = { DD: 0, DR: 0, RD: 0, RR: 0 }; // House first, Senate second; an Osborn-decides Senate counts half each way
    const sd = [], hdv = [];
    for (let i = 0; i < nS; i++) {
      if (!keep(i)) continue;
      const h = houseD[i] >= 218 ? 'D' : 'R';
      if (senR[i] >= 50) { senRctl++; combo[h + 'R']++; } else if (senD[i] >= 51) { senDctl++; combo[h + 'D']++; } else { senHung++; combo[h + 'D'] += 0.5; combo[h + 'R'] += 0.5; }
      if (houseD[i] >= 218) houseDctl++;
      sd.push(senD[i] + senI[i]); hdv.push(houseD[i]);
    }
    for (const k in combo) combo[k] /= N;
    sd.sort((a, b) => a - b); hdv.sort((a, b) => a - b);
    const tip = Object.entries(tipCount).map(([id, c]) => ({ id, p: c / nS })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
    return {
      N, conditioned: useCond, races: raceOut, combo,
      districts: districts.map((e, j) => ({ district: e.dist.district, pD: distWinCount[j] / nS, mu: e.mu })),
      senate: { pR: senRctl / N, pD: senDctl / N, pHung: senHung / N, hist: hist(Array.from(senD, (v, i) => v + senI[i]), 40, 60), med: quantile(sd, 0.5), lo: quantile(sd, 0.1), hi: quantile(sd, 0.9), tip },
      house: { pD: houseDctl / N, hist: hist(houseD, 150, 300), med: quantile(hdv, 0.5), lo: quantile(hdv, 0.1), hi: quantile(hdv, 0.9) },
    };
  }

  /* ---------------------------------------------------------------- deterministic curves */
  function houseCurve(districts, houseBase, s, shifts) {
    const sigTot = (e) => Math.sqrt(e.sig * e.sig + s.sigmaReg * s.sigmaReg);
    return shifts.map((sh) => {
      let mean = houseBase.D, v = 0;
      for (const e of districts) { const p = Phi((e.mu + sh * s.houseNatScale) / sigTot(e)); mean += p; v += p * (1 - p); }
      const sd = Math.sqrt(v);
      return { shift: sh, mean, lo: mean - 1.2816 * sd, hi: mean + 1.2816 * sd, pMaj: 1 - Phi((217.5 - mean) / Math.max(sd, 0.5)) };
    });
  }
  function senateCurve(races, senateBase, s, shifts) {
    return shifts.map((sh) => {
      let mean = senateBase.D, v = 0;
      for (const e of races) {
        if (e.race.office !== 'Senate') continue;
        const sg = Math.sqrt(e.sigPost * e.sigPost + s.sigmaReg * s.sigmaReg);
        const p = Phi((e.mu + (e.race.elast ?? 1) * sh) / sg); mean += p; v += p * (1 - p);
      }
      const sd = Math.sqrt(v);
      return { shift: sh, mean, lo: mean - 1.2816 * sd, hi: mean + 1.2816 * sd };
    });
  }

  /* ---------------------------------------------------------------- electorate lab (two-party shares) */
  // bD, bR, S are shares of the two-party vote (sum 100). tD,tR,tS turnout multipliers. p = share of S to D.
  function labShare(o) {
    const D = o.tD * o.bD + o.tS * o.S * o.p, R = o.tR * o.bR + o.tS * o.S * (1 - o.p);
    return (100 * D) / (D + R);
  }
  const labMargin = (o) => 2 * labShare(o) - 100;
  function labSolveP(o, targetMargin) { // swing share needed to hit a two-party margin
    let lo = -1, hi = 2;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (labMargin({ ...o, p: mid }) < targetMargin) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function floorsFrom(results, maxMargin) {
    const ok = results.filter((r) => Math.abs(r.d2 * 2 - 100) <= maxMargin);
    const use = ok.length >= 2 ? ok : results;
    const dMin = Math.min(...use.map((r) => r.d2)), dMax = Math.max(...use.map((r) => r.d2));
    return { bD: dMin, bR: 100 - dMax, S: dMax - dMin, used: use };
  }

  return { t, daysBetween, Phi, quantile, pollAverage, sigmaPolls, raceEstimate, ratingScore, districtEstimate, simulate, houseCurve, senateCurve, labShare, labMargin, labSolveP, floorsFrom, mulberry32, normalGen };
})();
if (typeof module !== 'undefined') module.exports = ENGINE;
