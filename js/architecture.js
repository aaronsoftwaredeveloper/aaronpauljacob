(function () {
  const svg = document.getElementById("diagram");
  const slider = document.getElementById("rps");
  const NS = "http://www.w3.org/2000/svg";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ui = {
    caption: document.getElementById("sliderCaption"),
    value: document.getElementById("rpsLabel"),
    note: document.getElementById("archNote"),
    principle: document.getElementById("principleText"),
    presets: document.getElementById("presets"),
    labels: ["metricALabel", "metricBLabel", "metricCLabel", "metricDLabel", "metricELabel"].map(function (id) { return document.getElementById(id); }),
    values: ["mPods", "mLat", "mStuck", "mCache", "mRep"].map(function (id) { return document.getElementById(id); })
  };

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function stack(prefix, title, sub, count, x, mid, kind) {
    const nodes = [];
    const spread = Math.min(460, 70 * Math.max(count - 1, 1));
    for (let i = 0; i < count; i++) {
      const y = count === 1 ? mid : mid - spread / 2 + (i * spread) / (count - 1);
      nodes.push({ id: prefix + i, title: title + " " + (i + 1), sub: sub, x: x, y: y, kind: kind });
    }
    return nodes;
  }

  const systems = {
    pay: {
      note: "Checkout traffic hits the Experience pods, Traveler API, then Payment Session Service. PSS writes every session change to DynamoDB and calls FOPA, which reaches identity, stored cards, and the card-data zone through Delegate.",
      caption: "Checkout requests",
      suffix: " / sec",
      min: 100,
      max: 4000,
      step: 50,
      value: 1200,
      presets: [["200", "Quiet"], ["1200", "Typical"], ["4000", "Peak"]],
      model: function (raw) {
        const rps = clamp(Math.round(raw), 100, 4000);
        const exp = clamp(Math.ceil(rps / 500), 2, 5);
        const pss = clamp(Math.ceil(rps / 650), 2, 5);
        const fopa = clamp(Math.ceil(rps / 450), 2, 5);
        const nodes = []
          .concat([{ id: "cpm", title: "CPM Module", sub: "Checkout UI", x: 80, y: 300, kind: "edge" }])
          .concat(stack("exp", "Experience", "GraphQL", exp, 250, 260, "scale"))
          .concat([{ id: "tapi", title: "Traveler API", sub: "Session", x: 430, y: 260, kind: "edge" }])
          .concat(stack("pss", "PSS", "gRPC", pss, 610, 260, "scale"))
          .concat([{ id: "ddb", title: "DynamoDB", sub: rps + " writes/s", x: 610, y: 560, kind: "data" }])
          .concat([{ id: "plan", title: "Payment Plan", sub: "On book", x: 800, y: 70, kind: "edge" }])
          .concat(stack("fopa", "FOPA", "Apply FOP", fopa, 820, 300, "scale"))
          .concat([
            { id: "id", title: "Identity", sub: "User", x: 1040, y: 120, kind: "edge" },
            { id: "spi", title: "SPI", sub: "Stored cards", x: 1040, y: 220, kind: "edge" },
            { id: "del", title: "Delegate", sub: "CTS", x: 1040, y: 380, kind: "edge" },
            { id: "etr", title: "ETR", sub: "Edge token", x: 1040, y: 490, kind: "edge" },
            { id: "pvla", title: "PVLA", sub: "Card vault", x: 1040, y: 600, kind: "edge" }
          ]);
        const edges = [];
        function link(a, b) { edges.push([a, b]); }
        for (let i = 0; i < exp; i++) link("cpm", "exp" + i);
        for (let i = 0; i < exp; i++) link("exp" + i, "tapi");
        for (let i = 0; i < pss; i++) link("tapi", "pss" + i);
        for (let i = 0; i < pss; i++) link("pss" + i, "ddb");
        link("pss0", "plan");
        for (let i = 0; i < pss; i++) link("pss" + i, "fopa" + Math.min(i, fopa - 1));
        link("fopa0", "id");
        link("fopa0", "spi");
        for (let i = 0; i < fopa; i++) link("fopa" + i, "del");
        link("del", "etr");
        link("del", "pvla");
        const stuck = Math.round(48 + Math.pow(rps / 900, 1.45) * 42);
        const scaled = Math.round(36 + Math.pow(rps / (pss * 650), 1.45) * 24);
        const retries = Math.max(0, Math.round((rps / (pss * 400) - 0.7) * 8));
        return {
          nodes: nodes,
          edges: edges,
          metrics: [
            ["Experience", String(exp)],
            ["PSS pods", String(pss)],
            ["FOPA pods", String(fopa)],
            ["DB writes/s", rps.toLocaleString()],
            ["p99 scaled", scaled + " ms"]
          ],
          text: "The load sits on three Kubernetes deployments. Experience, PSS, and FOPA scale apart. PSS is the write path: every session change hits DynamoDB, and conditional-write retries show up when those pods are pinned. At " + rps.toLocaleString() + " req/s the scaled path is about " + scaled + " ms. Frozen at 2 PSS pods it would be about " + stuck + " ms, with roughly " + retries + "% write retries."
        };
      }
    },
    ml: {
      note: "GitHub Actions registers the Flyte workflows. Feature engineering reads EGDL into the offline store. Training registers a model in MRS only after the accuracy gate. Deployment fetches the adopted model and ships it through MDS.",
      caption: "Parallel workflow runs",
      suffix: "",
      min: 1,
      max: 8,
      step: 1,
      value: 3,
      presets: [["1", "One run"], ["3", "Typical"], ["8", "Batch"]],
      model: function (raw) {
        const runs = clamp(Math.round(raw), 1, 8);
        const tasks = clamp(runs, 1, 4);
        const nodes = [
          { id: "gha", title: "GitHub Action", sub: "Register YAML", x: 90, y: 80, kind: "edge" },
          { id: "flyte", title: "Flyte", sub: "Workflows", x: 280, y: 80, kind: "build" }
        ];
        const reg = stack("reg", "Feat. reg", "K8s task", tasks, 500, 80, "scale");
        nodes.push.apply(nodes, reg);
        nodes.push({ id: "fsr", title: "Feature registry", sub: "meta.yml", x: 720, y: 80, kind: "data" });
        const fe = stack("fe", "Feat. eng", "Databricks", tasks, 500, 250, "scale");
        nodes.push.apply(nodes, fe);
        nodes.push({ id: "egdl", title: "EGDL", sub: "Prod table", x: 720, y: 250, kind: "data" });
        nodes.push({ id: "off", title: "Offline store", sub: "EGDL", x: 940, y: 250, kind: "data" });
        const tr = stack("tr", "Training", "Spark", tasks, 500, 450, "scale");
        nodes.push.apply(nodes, tr);
        nodes.push({ id: "gate", title: "Accuracy gate", sub: "Threshold", x: 720, y: 450, kind: "build" });
        nodes.push({ id: "mrs", title: "MRS", sub: "Adopted model", x: 940, y: 450, kind: "data" });
        nodes.push({ id: "dep", title: "Deployment", sub: "Scheduled", x: 500, y: 610, kind: "edge" });
        nodes.push({ id: "mds", title: "MDS", sub: "Serve model", x: 760, y: 610, kind: "scale" });
        const edges = [["gha", "flyte"]];
        reg.forEach(function (n) { edges.push(["flyte", n.id]); edges.push([n.id, "fsr"]); });
        fe.forEach(function (n) { edges.push(["flyte", n.id]); edges.push([n.id, "egdl"]); });
        edges.push(["egdl", "off"]);
        tr.forEach(function (n) { edges.push(["off", n.id]); edges.push([n.id, "gate"]); });
        edges.push(["gate", "mrs"]);
        edges.push(["mrs", "dep"]);
        edges.push(["dep", "mds"]);
        return {
          nodes: nodes,
          edges: edges,
          metrics: [
            ["Flyte runs", String(runs)],
            ["Databricks tasks", String(tasks)],
            ["EGDL reads", String(tasks)],
            ["Models gated", String(tasks)],
            ["Deploy", "MDS"]
          ],
          text: runs < 3
            ? "One pass: register features, engineer them from EGDL into the offline store, train, and register in MRS only if accuracy clears the gate."
            : runs + " workflow runs share Flyte. Feature engineering and training fan out to " + tasks + " Databricks and Kubernetes tasks. EGDL stays the source table. Only models that clear the accuracy gate are marked adopted, and MDS deploys that adopted model."
        };
      }
    },
    ami: {
      note: "A new Golden AMI is published on SNS, Lambda records the base AMI, Jenkins runs lom-cli, and CloudFormation updates the image recipe. EC2 Image Builder bakes it. Spinnaker then refreshes test immediately and prod only after a manual judgement.",
      caption: "Instances per environment",
      suffix: "",
      min: 1,
      max: 8,
      step: 1,
      value: 3,
      presets: [["1", "Canary"], ["3", "Roll"], ["8", "Full"]],
      model: function (raw) {
        const n = clamp(Math.round(raw), 1, 8);
        const nodes = [
          { id: "gold", title: "Golden AMI", sub: "Image factory", x: 90, y: 80, kind: "build" },
          { id: "sns", title: "SNS", sub: "Register topic", x: 270, y: 80, kind: "edge" },
          { id: "lam", title: "Lambda", sub: "BaseAmiId", x: 450, y: 80, kind: "edge" },
          { id: "jen", title: "Jenkins", sub: "lom-cli", x: 630, y: 80, kind: "build" },
          { id: "cft", title: "CloudFormation", sub: "Image recipe", x: 830, y: 80, kind: "build" },
          { id: "ib", title: "Image Builder", sub: "Pipeline", x: 1030, y: 80, kind: "build" },
          { id: "baked", title: "Baked AMI", sub: "Certified", x: 1030, y: 210, kind: "build" },
          { id: "spin", title: "Spinnaker", sub: "StackStorm", x: 250, y: 210, kind: "edge" }
        ];
        const edges = [
          ["gold", "sns"], ["sns", "lam"], ["lam", "jen"], ["jen", "cft"],
          ["cft", "ib"], ["ib", "baked"], ["baked", "spin"]
        ];
        const envs = [
          { id: "test", title: "nimbu-test", y: 360, gate: false },
          { id: "prod", title: "nimbu-prod", y: 490, gate: true },
          { id: "prodp", title: "nimbu-prodp", y: 620, gate: true }
        ];
        envs.forEach(function (env) {
          const from = env.gate ? env.id + "g" : "spin";
          if (env.gate) {
            nodes.push({ id: env.id + "g", title: "Manual gate", sub: env.title, x: 450, y: env.y, kind: "edge" });
            edges.push(["spin", env.id + "g"]);
          }
          nodes.push({ id: env.id + "ec2", title: "EC2 × " + n, sub: env.title, x: 680, y: env.y, kind: "scale" });
          nodes.push({ id: env.id + "lb", title: "Load balancer", sub: env.title, x: 900, y: env.y, kind: "edge" });
          nodes.push({ id: env.id + "old", title: "Retire old", sub: "After delay", x: 1100, y: env.y, kind: "edge" });
          edges.push([from, env.id + "ec2"]);
          edges.push([env.id + "ec2", env.id + "lb"]);
          edges.push([env.id + "lb", env.id + "old"]);
        });
        const manual = Math.round(n * 3 * (160 / 17));
        return {
          nodes: nodes,
          edges: edges,
          metrics: [
            ["EC2 / env", String(n)],
            ["Test path", "Direct"],
            ["Prod path", "Manual gate"],
            ["Automated", "2 h"],
            ["If manual", manual + " h"]
          ],
          text: "The bake is one pipeline: SNS, Lambda, Jenkins lom-cli, CloudFormation recipe, Image Builder. Spinnaker then replaces " + n + " instances in test with no gate, and the same count in prod and prodp only after manual judgement. Old instances are removed after the new ones join the load balancer. Doing this by hand would be about " + manual + " hours. The pipeline stays near 2 hours."
        };
      }
    }
  };

  let current = "pay";
  let load = systems.pay.value;
  let particles = [];
  let livePaths = [];
  let signature = "";
  let last = performance.now();
  let spawn = 0;

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function curve(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const x1 = horizontal ? a.x + Math.sign(dx || 1) * 64 : a.x;
    const y1 = horizontal ? a.y : a.y + Math.sign(dy || 1) * 26;
    const x2 = horizontal ? b.x - Math.sign(dx || 1) * 64 : b.x;
    const y2 = horizontal ? b.y : b.y - Math.sign(dy || 1) * 26;
    const c1x = horizontal ? (x1 + x2) / 2 : x1;
    const c1y = horizontal ? y1 : (y1 + y2) / 2;
    const c2x = horizontal ? (x1 + x2) / 2 : x2;
    const c2y = horizontal ? y2 : (y1 + y2) / 2;
    return "M " + x1 + " " + y1 + " C " + c1x + " " + c1y + ", " + c2x + " " + c2y + ", " + x2 + " " + y2;
  }

  function draw(plan) {
    svg.setAttribute("viewBox", "0 0 1200 700");
    svg.replaceChildren();
    const defs = el("defs", {});
    const marker = el("marker", {
      id: "arrow",
      viewBox: "0 0 10 10",
      refX: "9",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto"
    });
    marker.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: cssVar("--gold", "#e0c48a") }));
    defs.appendChild(marker);
    svg.appendChild(defs);
    const byId = {};
    plan.nodes.forEach(function (node) { byId[node.id] = node; });
    const links = el("g", {});
    const layer = el("g", {});
    const packets = el("g", { id: "packets" });
    svg.appendChild(links);
    svg.appendChild(layer);
    svg.appendChild(packets);
    livePaths = [];
    plan.edges.forEach(function (pair) {
      const a = byId[pair[0]];
      const b = byId[pair[1]];
      if (!a || !b) return;
      const path = el("path", { d: curve(a, b), class: "flow", "marker-end": "url(#arrow)" });
      links.appendChild(path);
      livePaths.push(path);
    });
    plan.nodes.forEach(function (node) {
      const hot = node.kind === "scale" || node.kind === "data";
      const g = el("g", {});
      g.appendChild(el("rect", {
        x: node.x - 62,
        y: node.y - 24,
        rx: 12,
        width: 124,
        height: 48,
        fill: cssVar("--node", "#0c1830"),
        stroke: hot ? cssVar("--gold", "#e0c48a") : cssVar("--node-stroke", "rgba(159,212,255,0.45)"),
        "stroke-width": hot ? 1.8 : 1
      }));
      const title = el("text", { class: "node-label", x: node.x, y: node.y - 2, "text-anchor": "middle" });
      title.textContent = node.title;
      const sub = el("text", { class: "node-sub", x: node.x, y: node.y + 14, "text-anchor": "middle" });
      sub.textContent = node.sub;
      g.appendChild(title);
      g.appendChild(sub);
      layer.appendChild(g);
    });
    particles = [];
    signature = current + ":" + plan.nodes.length;
  }

  function paint(system, plan) {
    ui.caption.textContent = system.caption;
    ui.value.textContent = Number(load).toLocaleString();
    const suffix = document.getElementById("sliderSuffix");
    if (suffix) suffix.textContent = system.suffix;
    ui.note.textContent = system.note;
    ui.principle.textContent = plan.text;
    plan.metrics.forEach(function (metric, index) {
      if (!ui.labels[index] || !ui.values[index]) return;
      ui.labels[index].textContent = metric[0];
      ui.values[index].textContent = metric[1];
    });
    document.querySelectorAll("[data-arch]").forEach(function (button) {
      button.classList.toggle("is-on", button.getAttribute("data-arch") === current);
    });
    slider.min = String(system.min);
    slider.max = String(system.max);
    slider.step = String(system.step);
    slider.value = String(load);
    const pace = Math.max(0, Math.min(1, (load - system.min) / (system.max - system.min || 1)));
    svg.style.setProperty("--flow", (1.45 - pace * 0.7).toFixed(2) + "s");
  }

  function renderNow() {
    const system = systems[current];
    const plan = system.model(load);
    draw(plan);
    paint(system, plan);
  }

  function select(id, jump) {
    if (!systems[id]) return;
    current = id;
    load = systems[id].value;
    buildPresets();
    signature = "";
    renderNow();
    if (jump) {
      const lab = document.getElementById("lab");
      if (lab) lab.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function buildPresets() {
    const system = systems[current];
    ui.presets.replaceChildren();
    system.presets.forEach(function (preset) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = preset[1];
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        load = Number(preset[0]);
        renderNow();
      });
      ui.presets.appendChild(button);
    });
  }

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const plan = systems[current].model(load);
    const nextSignature = current + ":" + plan.nodes.length + ":" + plan.nodes.map(function (n) { return n.title; }).join("|");
    if (nextSignature !== signature) draw(plan);
    paint(systems[current], plan);
    if (reduced || !livePaths.length) return;
    const layer = document.getElementById("packets");
    if (!layer) return;
    layer.replaceChildren();
    const system = systems[current];
    const pace = Math.max(0, Math.min(1, (load - system.min) / (system.max - system.min || 1)));
    const period = 2100 - pace * 1100;
    const travel = (now % period) / period;
    const ink = cssVar("--packet", "#f3e2bc");
    livePaths.forEach(function (path) {
      let len = 0;
      try { len = path.getTotalLength(); } catch (error) { len = 0; }
      if (len < 24) return;
      [0, 0.5].forEach(function (offset, index) {
        const point = path.getPointAtLength(((travel + offset) % 1) * len);
        layer.appendChild(el("circle", {
          cx: point.x,
          cy: point.y,
          r: index === 0 ? 4.4 : 3.2,
          fill: ink
        }));
      });
    });
  }

  function frame(now) {
    try { step(now); } catch (error) { signature = ""; }
    requestAnimationFrame(frame);
  }

  slider.addEventListener("input", function () {
    load = Number(slider.value);
    signature = "";
    renderNow();
  });
  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-arch]");
    if (!button) return;
    select(button.getAttribute("data-arch"), button.hasAttribute("data-jump"));
  });
  document.documentElement.addEventListener("themechange", function () { signature = ""; renderNow(); });

  const suffixNode = document.createElement("span");
  suffixNode.id = "sliderSuffix";
  suffixNode.textContent = " / sec";
  ui.value.insertAdjacentElement("afterend", suffixNode);

  window.showArchitecture = select;
  buildPresets();
  renderNow();
  requestAnimationFrame(frame);
})();
