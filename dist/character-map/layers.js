(() => {
  const assetRoot = "../assets/cv/interactive/audiotour/character-layers-v1/";
  const gallery = document.querySelector("#gallery");
  const assembly = document.querySelector("#assembly");
  const referenceToggle = document.querySelector("#reference");
  const status = document.querySelector("#asset-status");
  const images = new Map();
  const visible = new Set();
  let manifest;
  let reference;

  async function loadImage(src) {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
  }

  function renderAssembly() {
    if (!manifest) return;
    const context = assembly.getContext("2d");
    context.clearRect(0, 0, assembly.width, assembly.height);
    if (referenceToggle.checked && reference) {
      context.drawImage(reference, 0, 0, assembly.width, assembly.height);
      assembly.setAttribute("aria-label", "Unchanged original CV portrait, shown here only as a reference.");
      return;
    }
    assembly.setAttribute("aria-label", "Draft assembly of generated audio-tour character layers. Sleeve joins and facial overlays need refinement; two layers are missing.");
    for (const layer of [...manifest.layers].sort((a, b) => a.z - b.z)) {
      if (!visible.has(layer.id) || !images.has(layer.id)) continue;
      context.drawImage(images.get(layer.id), ...layer.sourceRect, ...layer.targetRect);
    }
  }

  function addCard(layer, image, failure) {
    const card = document.createElement("article");
    card.className = "asset-card";
    card.dataset.layer = layer.id;
    if (image) {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 300;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Generated transparent ${layer.label.toLowerCase()} layer.`);
      const context = canvas.getContext("2d");
      const [, , width, height] = layer.sourceRect;
      const scale = Math.min(432 / width, 258 / height);
      context.drawImage(image, ...layer.sourceRect, (480 - width * scale) / 2, (300 - height * scale) / 2, width * scale, height * scale);
      card.append(canvas);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "pending";
      placeholder.textContent = failure ? "Asset could not be loaded" : "Not generated";
      card.append(placeholder);
    }
    const copy = document.createElement("div");
    copy.className = "copy";
    const heading = document.createElement("h2");
    heading.textContent = layer.label;
    const info = document.createElement("p");
    info.textContent = image ? `${layer.group} · ${image.naturalWidth} × ${image.naturalHeight} PNG · transparent background` : failure ? failure : "Unresolved after an image-generation batch failure. No substitute has been inserted.";
    copy.append(heading, info);
    if (image) {
      const link = document.createElement("a");
      link.href = assetRoot + layer.src;
      link.download = layer.src;
      link.textContent = `Download ${layer.src}`;
      copy.append(link);
    }
    card.append(copy);
    gallery.append(card);
  }

  async function load() {
    try {
      const response = await fetch(assetRoot + "layer-set.json");
      if (!response.ok) throw new Error("The layer manifest could not be loaded.");
      manifest = await response.json();
      reference = await loadImage("../assets/cv/interactive/character/marju-natural-v2.png");
      const results = await Promise.all(manifest.layers.map(async (layer) => {
        if (!layer.src) return { layer };
        try { return { layer, image: await loadImage(assetRoot + layer.src) }; }
        catch (error) { return { layer, failure: error.message }; }
      }));
      for (const { layer, image, failure } of results) {
        addCard(layer, image, failure);
        if (!image) continue;
        images.set(layer.id, image);
        visible.add(layer.id);
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = true;
        input.dataset.layer = layer.id;
        input.addEventListener("change", () => {
          if (input.checked) visible.add(layer.id);
          else visible.delete(layer.id);
          renderAssembly();
        });
        label.append(input, document.createTextNode(layer.label));
        document.querySelector("#assembly-controls").append(label);
      }
      status.textContent = `${images.size} separate draft PNGs are ready. Cheeks and loose front hair are still missing after a tool rejection interrupted the final batch. The original portrait is untouched. These parts need alignment and seam refinement before they can be used in the audio tour.`;
      renderAssembly();
    } catch (error) {
      status.textContent = `Preview unavailable: ${error.message}`;
    }
  }
  referenceToggle.addEventListener("change", renderAssembly);
  load();
})();
