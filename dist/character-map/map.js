(() => {
  const svgNS = "http://www.w3.org/2000/svg";
  const stage = document.querySelector("#stage");
  const portrait = document.querySelector("#portrait");
  const overlay = document.querySelector("#overlay");
  const layerList = document.querySelector("#layers");
  const feedback = document.querySelector("#feedback");
  const guides = document.querySelector("#guides");
  const pivotX = document.querySelector("#pivot-x");
  const pivotY = document.querySelector("#pivot-y");
  const pickButton = document.querySelector("#pick-pivot");
  let map;
  let selected;
  let picking = false;

  function svgElement(tag, attributes) {
    const element = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }

  function drawMap() {
    overlay.replaceChildren();
    for (const layer of [...map.layers].sort((a, b) => a.z - b.z)) {
      if (!guides.checked && layer !== selected) continue;
      const active = layer === selected;
      const group = svgElement("g", { "data-layer": layer.id, opacity: active ? 1 : .38 });
      group.append(svgElement("polygon", {
        points: layer.region.map((point) => point.join(",")).join(" "),
        fill: active ? layer.color : "none",
        "fill-opacity": .14,
        stroke: layer.color,
        "stroke-width": active ? 2.5 : 1.3,
        "vector-effect": "non-scaling-stroke"
      }));
      const [x, y] = layer.pivot;
      group.append(svgElement("path", {
        d: `M ${x - 11} ${y} H ${x + 11} M ${x} ${y - 11} V ${y + 11}`,
        stroke: layer.color, "stroke-width": 2, "vector-effect": "non-scaling-stroke"
      }));
      group.append(svgElement("circle", { cx: x, cy: y, r: 4, fill: "#fffdf8", stroke: layer.color, "stroke-width": 2, "vector-effect": "non-scaling-stroke" }));
      overlay.append(group);
    }
    overlay.dataset.selectedLayer = selected.id;
  }

  function setPicking(value) {
    picking = value;
    stage.classList.toggle("picking", picking);
    pickButton.setAttribute("aria-pressed", String(picking));
    pickButton.textContent = picking ? "Cancel picking pivot" : "Pick pivot on portrait";
  }

  function select(layer) {
    selected = layer;
    setPicking(false);
    for (const button of layerList.children) button.setAttribute("aria-pressed", String(button.dataset.layer === layer.id));
    document.querySelector("#selected-name").textContent = layer.label;
    document.querySelector("#motion").textContent = layer.plannedMotion;
    document.querySelector("#parent").textContent = map.layers.find((part) => part.id === layer.parent)?.label ?? "Root / original canvas";
    document.querySelector("#z").textContent = layer.z;
    pivotX.value = layer.pivot[0];
    pivotY.value = layer.pivot[1];
    feedback.textContent = "";
    drawMap();
  }

  function updatePivot(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > map.source.width || y > map.source.height) return;
    selected.pivot = [Math.round(x), Math.round(y)];
    pivotX.value = selected.pivot[0];
    pivotY.value = selected.pivot[1];
    feedback.textContent = `${selected.label} pivot: ${selected.pivot.join(", ")}. Download the map to save this change.`;
    drawMap();
  }

  function sourcePoint(event) {
    const rect = portrait.getBoundingClientRect();
    return [
      Math.max(0, Math.min(map.source.width, Math.round((event.clientX - rect.left) / rect.width * map.source.width))),
      Math.max(0, Math.min(map.source.height, Math.round((event.clientY - rect.top) / rect.height * map.source.height)))
    ];
  }

  stage.addEventListener("pointermove", (event) => {
    if (!map) return;
    const [x, y] = sourcePoint(event);
    document.querySelector("#coordinates").textContent = `Original pixels: x ${x} · y ${y}`;
  });
  stage.addEventListener("pointerleave", () => {
    if (map) document.querySelector("#coordinates").textContent = `${map.source.width} × ${map.source.height} original pixels`;
  });
  stage.addEventListener("click", (event) => {
    if (!picking || !map) return;
    updatePivot(...sourcePoint(event));
    setPicking(false);
  });
  document.querySelector("#pivot-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (selected) updatePivot(Number(pivotX.value), Number(pivotY.value));
  });
  pickButton.addEventListener("click", () => {
    if (!selected) return;
    setPicking(!picking);
    feedback.textContent = picking ? "Click the desired pivot on the portrait. You can also enter X and Y with the keyboard." : "";
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && picking) setPicking(false); });
  guides.addEventListener("change", () => { if (map) drawMap(); });
  document.querySelector("#download").addEventListener("click", () => {
    if (!map) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(map, null, 2) + "\n"], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "character-map.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback.textContent = "The coordinate map has been prepared for download.";
  });

  async function load() {
    try {
      const response = await fetch("character-map.json");
      if (!response.ok) throw new Error("The coordinate map could not be loaded.");
      map = await response.json();
      await portrait.decode();
      if (portrait.naturalWidth !== map.source.width || portrait.naturalHeight !== map.source.height) throw new Error("The portrait dimensions do not match the coordinate map.");
      for (const layer of map.layers) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.layer = layer.id;
        button.style.setProperty("--layer-color", layer.color);
        button.textContent = layer.label;
        button.addEventListener("click", () => select(layer));
        layerList.append(button);
      }
      select(map.layers.find((layer) => layer.id === "hair-left"));
    } catch (error) {
      document.querySelector("#selected-name").textContent = "Preview unavailable";
      feedback.textContent = error.message;
      document.querySelector("#download").disabled = true;
      pickButton.disabled = true;
    }
  }
  load();
})();
