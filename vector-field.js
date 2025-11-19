/*
  Fascia di frecce animata che segue una curva di Bezier.
  Controlli disponibili:
    - Larghezza fascia all'inizio e alla fine
    - Offset X dell'ancora inferiore (P0)
    - Coordinate dei due manici centrali (P1, P2)
    - Offset Y dell'ancora destra (P3)
*/

let field;
let controlBindings = [];

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('position', 'fixed');

  pixelDensity(1);
  stroke(20);
  strokeWeight(1.25);
  noFill();

  field = new VectorField({
    spacing: 50,
    arrowLen: 16,
    repelRadius: 70,
    stiffness: 0.075,
    damping: 0.86,
    maxSpeed: 12,
    mouseLerp: 0.30,

    orientRadial: false,

    wedgeWidthStart: 1597,
    wedgeWidthEnd:   1200,
    startOffsetX:    -0.2600,
    endOffsetY:      -0.2500,
    curvePoints: [
      { x: 0.50, y: 1.00 },
      { x: 0.2500, y:0.7700 },
      { x: 0.3300, y: 0.2250 },
      { x: 1.00, y: 0.50 },
    ],
  });

  setupControls();
  background(250);
}

function draw() {
  updateControlsDisplay();
  background(250);
  field.updateAndDraw(mouseX, mouseY);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  field.rebuild();
}

function setupControls() {
  const panel = createDiv();
  panel.id('controls');
  panel.addClass('controls-panel');

  const sliderDefs = [
    {
      label: 'Fascia Inizio (larghezza)',
      min: 200,
      max: 2500,
      step: 1,
      getter: () => field.wedgeWidthStart,
      setter: value => field.updateParam('wedgeWidthStart', value),
    },
    {
      label: 'Fascia Fine (larghezza)',
      min: 100,
      max: 2000,
      step: 1,
      getter: () => field.wedgeWidthEnd,
      setter: value => field.updateParam('wedgeWidthEnd', value),
    },
    {
      label: 'P0 X offset (bordo basso)',
      min: -0.5,
      max: 0.5,
      step: 0.005,
      getter: () => field.getStartOffsetX(),
      setter: value => field.setStartOffsetX(value),
    },
    {
      label: 'P1 X',
      min: -0.25,
      max: 1.25,
      step: 0.005,
      getter: () => field.curvePointsNormalized[1].x,
      setter: value => field.setCurvePoint(1, 'x', value),
    },
    {
      label: 'P1 Y',
      min: -0.25,
      max: 1.25,
      step: 0.005,
      getter: () => field.curvePointsNormalized[1].y,
      setter: value => field.setCurvePoint(1, 'y', value),
    },
    {
      label: 'P2 X',
      min: -0.25,
      max: 1.25,
      step: 0.005,
      getter: () => field.curvePointsNormalized[2].x,
      setter: value => field.setCurvePoint(2, 'x', value),
    },
    {
      label: 'P2 Y',
      min: -0.25,
      max: 1.25,
      step: 0.005,
      getter: () => field.curvePointsNormalized[2].y,
      setter: value => field.setCurvePoint(2, 'y', value),
    },
    {
      label: 'P3 Y offset (bordo destro)',
      min: -0.5,
      max: 0.5,
      step: 0.005,
      getter: () => field.getEndOffsetY(),
      setter: value => field.setEndOffsetY(value),
    },
  ];

  controlBindings = sliderDefs.map(def => {
    const row = createDiv();
    row.addClass('control-row');
    row.parent(panel);

    const label = createSpan(def.label);
    label.addClass('control-label');
    label.parent(row);

    const initialValue = def.getter();
    const slider = createSlider(def.min, def.max, initialValue, def.step);
    slider.parent(row);

    const valueSpan = createSpan(formatSliderValue(initialValue, def.step));
    valueSpan.addClass('control-value');
    valueSpan.parent(row);

    const binding = {
      slider,
      valueSpan,
      getter: def.getter,
      setter: def.setter,
      step: def.step,
      lastValue: initialValue,
    };

    slider.input(() => {
      const current = slider.value();
      const numericValue = typeof current === 'number' ? current : Number(current);
      binding.setter(numericValue);
      binding.lastValue = numericValue;
      valueSpan.html(formatSliderValue(numericValue, binding.step));
    });

    valueSpan.html(formatSliderValue(binding.lastValue, binding.step));
    return binding;
  });
}

function updateControlsDisplay() {
  if (!controlBindings.length) return;
  controlBindings.forEach(binding => {
    const actual = binding.getter();
    if (binding.step >= 1) {
      if (Math.round(actual) === Math.round(binding.lastValue)) return;
    } else if (Math.abs(actual - binding.lastValue) < binding.step * 0.5) {
      return;
    }
    binding.slider.value(actual);
    binding.valueSpan.html(formatSliderValue(actual, binding.step));
    binding.lastValue = actual;
  });
}

function formatSliderValue(value, step) {
  if (step >= 1) return Math.round(value);
  if (step >= 0.1) return value.toFixed(2);
  if (step >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}

/* ----------------------- IMPLEMENTAZIONE ----------------------- */
class VectorField {
  constructor({
    spacing = 50, arrowLen = 16, repelRadius = 110,
    stiffness = 0.08, damping = 0.88, maxSpeed = 12, mouseLerp = 0.25,

    orientRadial = true,
    wedgeWidthStart = 520, wedgeWidthEnd = 160,
    startOffsetX,
    endOffsetY,
    curvePoints = [
      { x: 0.5,  y: 1.0 },
      { x: 0.38, y: 1.0 },
      { x: 0.78, y: 0.32 },
      { x: 1.0,  y: 0.5 },
    ],
    curveSampleCount = 160,

    flowEnabled = true,
    flowSpeed = 140,
    flowRangeS = 220,
    flowRangeN = 0.28,
    flowSpringS = 18,
    flowDampingS = 5.2,
    flowSpringN = 24,
    flowDampingN = 8.5,
    flowMouseRadius = 190,
    flowMouseTangential = 280,
    flowMouseNormal = 0.7,
    flowNoiseAmpS = 24,
    flowNoiseAmpN = 0.12,
    flowNoiseFreq = 0.65,
  } = {}) {
    Object.assign(this, {
      spacing, arrowLen, repelRadius, stiffness, damping, maxSpeed, mouseLerp,
      orientRadial, wedgeWidthStart, wedgeWidthEnd, curveSampleCount,
      flowEnabled, flowSpeed, flowRangeS, flowRangeN, flowSpringS, flowDampingS,
      flowSpringN, flowDampingN, flowMouseRadius, flowMouseTangential,
      flowMouseNormal, flowNoiseAmpS, flowNoiseAmpN, flowNoiseFreq,
    });

    this.bandMin = -0.15;
    this.bandMax =  0.85;

    this.curvePointsNormalized = curvePoints.map(pt => ({ x: pt.x, y: pt.y }));
    this.startOffsetX = startOffsetX ?? ((this.curvePointsNormalized[0]?.x ?? 0.5) - 0.5);
    this.endOffsetY   = endOffsetY   ?? ((this.curvePointsNormalized[3]?.y ?? 0.5) - 0.5);
    this._applyAnchors();

    this.base = [];
    this.pos = [];
    this.vel = [];

    this.captured = [];
    this.s0 = [];
    this.localS = [];
    this.vs = [];
    this.n0 = [];
    this.localN = [];
    this.vn = [];
    this.phase = [];

    this.anchorU = [];
    this.anchorLane = [];

    this.smoothedMouse = createVector(0, 0);
    this._mouseInit = false;
    this._globalFlowOffset = 0;

    this.rebuild();
  }

  rebuild() {
    this._setupCurveGeometry();

    this.base.length = 0;
    this.pos.length = 0;
    this.vel.length = 0;
    this.captured.length = 0;
    this.s0.length = 0;
    this.localS.length = 0;
    this.vs.length = 0;
    this.n0.length = 0;
    this.localN.length = 0;
    this.vn.length = 0;
    this.phase.length = 0;
    this.anchorU.length = 0;
    this.anchorLane.length = 0;

    if (!this.L || !isFinite(this.L)) return;

    const alongCount = Math.max(1, Math.round(this.L / this.spacing));
    for (let si = 0; si <= alongCount; si++) {
      const u = alongCount === 0 ? 0 : si / alongCount;
      const arc = u * this.L;
      const geo = this._pointAtArc(arc);
      if (!geo) continue;

      const width = this._widthAtArc(arc);
      const minNormalPx = this.bandMin * width;
      const maxNormalPx = this.bandMax * width;
      const spanPx = maxNormalPx - minNormalPx;
      const laneCount = Math.max(1, Math.round(spanPx / this.spacing));

      for (let li = 0; li <= laneCount; li++) {
        const laneFrac = laneCount === 0 ? 0.5 : li / laneCount;
        const offsetPx = minNormalPx + laneFrac * spanPx;
        const point = p5.Vector.add(geo.point, p5.Vector.mult(geo.normal, offsetPx));

        const idx = this.base.length;
        this.base.push(point.copy());
        this.pos.push(point.copy());
        this.vel.push(createVector(0, 0));

        this.captured.push(true);
        this.s0.push(arc);
        this.localS.push(0);
        this.vs.push(0);

        this.n0.push(offsetPx);
        this.localN.push(0);
        this.vn.push(0);

        this.phase.push(this._hash01(si * 9283 + li * 5737) * TAU);
        this.anchorU.push(u);
        this.anchorLane.push(laneFrac);
      }
    }
  }

  updateAndDraw(mx, my) {
    const dtRaw = (typeof deltaTime === 'number' && isFinite(deltaTime)) ? deltaTime / 1000 : 1 / 60;
    const dt = constrain(dtRaw, 1 / 120, 0.05);

    const curMouse = createVector(mx, my);
    if (!this._mouseInit) {
      this.smoothedMouse.set(curMouse);
      this._mouseInit = true;
    } else {
      this.smoothedMouse.x = lerp(this.smoothedMouse.x, curMouse.x, this.mouseLerp);
      this.smoothedMouse.y = lerp(this.smoothedMouse.y, curMouse.y, this.mouseLerp);
    }
    const mouse = this.smoothedMouse;

    if (this.flowEnabled && this.L > 0) {
      this._globalFlowOffset = this._wrapArc(this._globalFlowOffset + this.flowSpeed * dt);
    }

    const timeSec = (typeof millis === 'function' ? millis() : performance.now()) / 1000;

    for (let i = 0; i < this.base.length; i++) {
      const base = this.base[i];
      const pos = this.pos[i];
      const vel = this.vel[i];

      const diff = p5.Vector.sub(base, mouse);
      const dist = diff.mag();
      let target = base;
      if (dist > 0 && dist < this.repelRadius) {
        target = p5.Vector.add(mouse, diff.copy().normalize().mult(this.repelRadius));
      }
      const toTarget = p5.Vector.sub(target, pos).mult(this.stiffness);
      vel.mult(this.damping).add(toTarget);
      if (vel.mag() > this.maxSpeed) vel.setMag(this.maxSpeed);
      pos.add(vel);

      if (!this.flowEnabled || !this.captured[i]) continue;

      const flow = this._updateFlowParticle(i, timeSec, dt, mouse);
      if (!flow) continue;

      pos.set(flow.pos);
      vel.set(0, 0);

      push();
      translate(flow.pos.x, flow.pos.y);
      rotate(flow.angle);
      this._arrow(this.arrowLen);
      pop();
    }
  }

  getStartOffsetX() { return this.startOffsetX; }
  setStartOffsetX(val) {
    if (this.startOffsetX === val) return;
    this.startOffsetX = val;
    this._setupCurveGeometry();
  }

  getEndOffsetY() { return this.endOffsetY; }
  setEndOffsetY(val) {
    if (this.endOffsetY === val) return;
    this.endOffsetY = val;
    this._setupCurveGeometry();
  }

  updateParam(name, value) {
    if (this[name] === value) return;
    this[name] = value;
    if (name === 'startOffsetX' || name === 'endOffsetY') {
      this._setupCurveGeometry();
    }
  }

  setCurvePoint(index, axis, value) {
    if (index <= 0 || index >= this.curvePointsNormalized.length - 1) return;
    const point = this.curvePointsNormalized[index];
    if (!point || point[axis] === value) return;
    point[axis] = value;
    this._setupCurveGeometry();
  }

  _capture() {
    /* no-op: particles are spawned already captured */
  }

  _release(i) {
    this.captured[i] = false;
    this.localS[i] = 0;
    this.vs[i] = 0;
    this.localN[i] = 0;
    this.vn[i] = 0;
    this.pos[i].set(this.base[i]);
    this.vel[i].set(0, 0);
  }

  _updateFlowParticle(i, timeSec, dt, mouse) {
    if (!this.curveSegments.length || this.L <= 0) return null;

    const maxTangential = Math.min(this.flowRangeS, this.L * 0.5);
    this.localS[i] = constrain(this.localS[i], -maxTangential, maxTangential);

    const arc = this._wrapArc(this.s0[i] + this._globalFlowOffset + this.localS[i]);
    const geom = this._pointAtArc(arc);
    if (!geom) return null;

    const width = this._widthAtArc(arc);
    const minNormalPx = this.bandMin * width;
    const maxNormalPx = this.bandMax * width;
    const rangePx = this.flowRangeN * width;

    const toMouse = p5.Vector.sub(mouse, geom.point);
    const dist = toMouse.mag();
    const influence = dist > 0 ? constrain(1 - dist / this.flowMouseRadius, 0, 1) : 1;
    const tangentialComponent = dist > 0 ? toMouse.dot(geom.tangent) / dist : 0;
    const normalComponent = dist > 0 ? toMouse.dot(geom.normal) / dist : 0;

    const noiseS = this.flowNoiseAmpS * Math.sin(timeSec * this.flowNoiseFreq + this.phase[i]);
    const noiseN = this.flowNoiseAmpN * Math.sin(timeSec * this.flowNoiseFreq * 1.7 + this.phase[i] * 1.31);

    let tangentialForce = -this.localS[i] * this.flowSpringS - this.vs[i] * this.flowDampingS + noiseS;
    if (influence > 0) {
      tangentialForce += this.flowMouseTangential * tangentialComponent * influence * influence;
    }

    this.vs[i] += tangentialForce * dt;
    this.localS[i] += this.vs[i] * dt;
    this.localS[i] = constrain(this.localS[i], -maxTangential, maxTangential);

    const arcAfter = this._wrapArc(this.s0[i] + this._globalFlowOffset + this.localS[i]);
    const geomAfter = this._pointAtArc(arcAfter);
    if (!geomAfter) return null;

    const widthAfter = this._widthAtArc(arcAfter);
    const minNormalAfterPx = this.bandMin * widthAfter;
    const maxNormalAfterPx = this.bandMax * widthAfter;
    const rangeAfterPx = this.flowRangeN * widthAfter;

    let normalForce = -this.localN[i] * this.flowSpringN - this.vn[i] * this.flowDampingN + noiseN * widthAfter;
    if (influence > 0) {
      normalForce += this.flowMouseNormal * normalComponent * influence * influence * widthAfter;
    }

    this.vn[i] += normalForce * dt;
    this.localN[i] += this.vn[i] * dt;

    const minLocal = Math.max(-rangeAfterPx, minNormalAfterPx - this.n0[i]);
    const maxLocal = Math.min(rangeAfterPx, maxNormalAfterPx - this.n0[i]);
    this.localN[i] = constrain(this.localN[i], minLocal, maxLocal);

    const offsetPx = this.n0[i] + this.localN[i];
    const drawPos = p5.Vector.add(geomAfter.point, p5.Vector.mult(geomAfter.normal, offsetPx));

    const angle = this.orientRadial
      ? atan2(mouse.y - drawPos.y, mouse.x - drawPos.x)
      : atan2(geomAfter.tangent.y, geomAfter.tangent.x);

    this.base[i].set(p5.Vector.add(geomAfter.point, p5.Vector.mult(geomAfter.normal, this.n0[i])));

    return { pos: drawPos, angle };
  }

  _applyAnchors() {
    const targetStartX = 0.5 + this.startOffsetX;
    const prevStartX = this._anchorStartX ?? targetStartX;
    const deltaStartX = targetStartX - prevStartX;

    this.curvePointsNormalized[0] = { x: targetStartX, y: 1 };
    if (!this.curvePointsNormalized[1]) {
      this.curvePointsNormalized[1] = { x: targetStartX - 0.12, y: 1 };
    } else if (deltaStartX !== 0) {
      this.curvePointsNormalized[1].x += deltaStartX;
    }

    const targetEndY = 0.5 + this.endOffsetY;
    const prevEndY = this._anchorEndY ?? targetEndY;
    const deltaEndY = targetEndY - prevEndY;

    this.curvePointsNormalized[3] = { x: 1, y: targetEndY };
    if (!this.curvePointsNormalized[2]) {
      this.curvePointsNormalized[2] = { x: 0.78, y: targetEndY - 0.18 };
    } else if (deltaEndY !== 0) {
      this.curvePointsNormalized[2].y += deltaEndY;
    }

    this._anchorStartX = targetStartX;
    this._anchorEndY = targetEndY;
  }

  _setupCurveGeometry() {
    this._applyAnchors();

    const start = this.curvePointsNormalized[0];
    const handle1 = this.curvePointsNormalized[1];
    const handle2 = this.curvePointsNormalized[2];
    const end = this.curvePointsNormalized[3];

    this.curveCtrl = [
      createVector(start.x * width, start.y * height),
      createVector(handle1.x * width, handle1.y * height),
      createVector(handle2.x * width, handle2.y * height),
      createVector(end.x * width, end.y * height),
    ];

    this._buildCurveLookup();
    this._reprojectFlowState();
  }

  _buildCurveLookup() {
    const oldL = this.L || 0;
    this.curveSegments = [];
    this.L = 0;

    const steps = Math.max(1, Math.floor(this.curveSampleCount));
    let prevPoint = null;
    let prevT = 0;
    let lengthAccum = 0;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this._bezierPoint(t);

      if (prevPoint) {
        const segLen = p5.Vector.dist(prevPoint, point);
        this.curveSegments.push({
          p0: prevPoint.copy(),
          p1: point.copy(),
          t0: prevT,
          t1: t,
          lengthStart: lengthAccum,
          length: segLen,
        });
        lengthAccum += segLen;
      }
      prevPoint = point;
      prevT = t;
    }

    this.L = lengthAccum;
    if (oldL > 0 && this.L > 0) {
      this._globalFlowOffset = this._wrapArc(this._globalFlowOffset * (this.L / oldL));
    } else if (this.L === 0) {
      this._globalFlowOffset = 0;
    }
  }

  _reprojectFlowState() {
    if (!this.anchorU.length || !this.curveSegments.length) return;

    for (let i = 0; i < this.anchorU.length; i++) {
      const u = this.anchorU[i];
      const arc = constrain(u, 0, 1) * this.L;
      const geom = this._pointAtArc(arc);
      if (!geom) continue;

      const width = this._widthAtArc(arc);
      const minNormalPx = this.bandMin * width;
      const maxNormalPx = this.bandMax * width;
      const spanPx = maxNormalPx - minNormalPx;

      const laneFrac = this.anchorLane[i];
      const offsetPx = minNormalPx + laneFrac * spanPx;

      this.s0[i] = arc;
      this.n0[i] = offsetPx;

      const basePos = p5.Vector.add(geom.point, p5.Vector.mult(geom.normal, offsetPx));
      this.base[i].set(basePos);

      const rangePx = this.flowRangeN * width;
      const minLocal = Math.max(-rangePx, minNormalPx - offsetPx);
      const maxLocal = Math.min(rangePx, maxNormalPx - offsetPx);

      this.localS[i] = constrain(this.localS[i], -this.flowRangeS, this.flowRangeS);
      this.localN[i] = constrain(this.localN[i], minLocal, maxLocal);
      this.vs[i] = 0;
      this.vn[i] = 0;

      const drawOffset = this.localN[i];
      const drawPos = p5.Vector.add(basePos, p5.Vector.mult(geom.normal, drawOffset));
      this.pos[i].set(drawPos);
    }
  }

  _projectOnCurve(p) {
    if (!this.curveSegments.length) return null;

    let closest = null;
    let minDistSq = Infinity;

    for (const seg of this.curveSegments) {
      const segVecX = seg.p1.x - seg.p0.x;
      const segVecY = seg.p1.y - seg.p0.y;
      const segLenSq = segVecX * segVecX + segVecY * segVecY;
      if (segLenSq === 0) continue;

      const toPointX = p.x - seg.p0.x;
      const toPointY = p.y - seg.p0.y;
      const uRaw = (toPointX * segVecX + toPointY * segVecY) / segLenSq;
      const u = constrain(uRaw, 0, 1);

      const projX = seg.p0.x + segVecX * u;
      const projY = seg.p0.y + segVecY * u;
      const dx = p.x - projX;
      const dy = p.y - projY;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = { seg, u, projX, projY };
      }
    }

    if (!closest) return null;

    const { seg, u, projX, projY } = closest;
    const t = lerp(seg.t0, seg.t1, u);
    const arcLength = seg.lengthStart + seg.length * u;
    const tangent = this._bezierTangent(t);
    if (tangent.magSq() < 1e-8) tangent.set(1, 0);
    tangent.normalize();
    const normal = createVector(-tangent.y, tangent.x);
    const diff = createVector(p.x - projX, p.y - projY);

    return {
      point: createVector(projX, projY),
      tangent,
      normal,
      angle: atan2(tangent.y, tangent.x),
      arcLength,
      distNormal: diff.x * normal.x + diff.y * normal.y,
      distTangent: diff.x * tangent.x + diff.y * tangent.y,
    };
  }

  _isInsideBand(detail) {
    if (!detail) return false;
    const { arcLength, distNormal, distTangent } = detail;

    const tNorm = this.L > 0 ? constrain(arcLength / this.L, 0, 1) : 0;
    const widthHere = lerp(this.wedgeWidthStart, this.wedgeWidthEnd, tNorm);
    const minNormal = this.bandMin * widthHere;
    const maxNormal = this.bandMax * widthHere;

    if (distNormal < minNormal || distNormal > maxNormal) return false;

    const edgeAllowance = 40;
    if (arcLength <= 0 && distTangent < -edgeAllowance) return false;
    if (arcLength >= this.L && distTangent > edgeAllowance) return false;

    return true;
  }

  _pointAtArc(s) {
    if (!this.curveSegments.length) return null;
    const arc = this._wrapArc(s);
    let seg = this.curveSegments[this.curveSegments.length - 1];

    for (const candidate of this.curveSegments) {
      if (arc <= candidate.lengthStart + candidate.length) {
        seg = candidate;
        break;
      }
    }

    const local = seg.length > 0 ? (arc - seg.lengthStart) / seg.length : 0;
    const t = lerp(seg.t0, seg.t1, constrain(local, 0, 1));
    const point = this._bezierPoint(t);
    const tangent = this._bezierTangent(t);
    if (tangent.magSq() < 1e-8) tangent.set(1, 0);
    tangent.normalize();
    const normal = createVector(-tangent.y, tangent.x);

    return { point, tangent, normal, arc };
  }

  _widthAtArc(arc) {
    if (this.L <= 0) return this.wedgeWidthStart;
    const tNorm = constrain(arc / this.L, 0, 1);
    return lerp(this.wedgeWidthStart, this.wedgeWidthEnd, tNorm);
  }

  _wrapArc(s) {
    if (this.L <= 0) return 0;
    let v = s % this.L;
    if (v < 0) v += this.L;
    return v;
  }

  _bezierPoint(t) {
    const [p0, p1, p2, p3] = this.curveCtrl;
    const inv = 1 - t;
    const inv2 = inv * inv;
    const inv3 = inv2 * inv;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = inv3 * p0.x +
              3 * inv2 * t * p1.x +
              3 * inv * t2 * p2.x +
              t3 * p3.x;
    const y = inv3 * p0.y +
              3 * inv2 * t * p1.y +
              3 * inv * t2 * p2.y +
              t3 * p3.y;

    return createVector(x, y);
  }

  _bezierTangent(t) {
    const [p0, p1, p2, p3] = this.curveCtrl;
    const inv = 1 - t;
    const inv2 = inv * inv;
    const t2 = t * t;

    const x = 3 * inv2 * (p1.x - p0.x) +
              6 * inv * t * (p2.x - p1.x) +
              3 * t2 * (p3.x - p2.x);
    const y = 3 * inv2 * (p1.y - p0.y) +
              6 * inv * t * (p2.y - p1.y) +
              3 * t2 * (p3.y - p2.y);

    return createVector(x, y);
  }

  _arrow(len) {
    line(0, 0, len, 0);
    line(len, 0, len - 5,  2.5);
    line(len, 0, len - 5, -2.5);
  }

  _hash01(i) {
    const s = Math.sin(i * 127.1 + 23.45) * 43758.5453;
    return s - Math.floor(s);
  }
}
