(() => {
  const scene = document.querySelector("#cv-scene");
  if (!scene) return;

  const buttons = [...scene.querySelectorAll(".art-button[data-kind][data-key]")];
  const masks = new Map();
  let hoveredButton = null;
  let pressedButton = null;
  let lastPointer = null;

  function setHovered(button) {
    if (hoveredButton === button) return;
    hoveredButton?.classList.remove("is-hovered");
    hoveredButton = button;
    hoveredButton?.classList.add("is-hovered");
    scene.classList.toggle("has-art-hover", Boolean(button));
  }

  function isVisiblePixel(button, x, y) {
    const image = button.querySelector("img");
    if (!image?.naturalWidth || button.disabled) return false;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height || x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return false;
    const mask = masks.get(button);
    // Keep the original button usable if this browser cannot read the image.
    if (mask === null) return true;
    if (!mask) return false;
    // Map the pointer back through the current animation, including rotation.
    // Sampling the rotated bounding rectangle alone would offset the mask.
    const style = getComputedStyle(image);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    const [originX, originY] = style.transformOrigin.split(" ").map(parseFloat);
    const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([localX, localY]) => ({
      x: matrix.a * (localX - originX) + matrix.c * (localY - originY) + originX + matrix.e,
      y: matrix.b * (localX - originX) + matrix.d * (localY - originY) + originY + matrix.f
    }));
    const shiftedX = x - rect.left + Math.min(...corners.map((corner) => corner.x)) - originX - matrix.e;
    const shiftedY = y - rect.top + Math.min(...corners.map((corner) => corner.y)) - originY - matrix.f;
    const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
    if (!determinant) return false;
    const localX = (matrix.d * shiftedX - matrix.c * shiftedY) / determinant + originX;
    const localY = (-matrix.b * shiftedX + matrix.a * shiftedY) / determinant + originY;
    if (localX < 0 || localX >= width || localY < 0 || localY >= height) return false;
    const column = Math.floor(localX / width * mask.width);
    const row = Math.floor(localY / height * mask.height);
    return mask.alpha[row * mask.width + column] >= 32;
  }

  function buttonAt(x, y) {
    const seen = new Set();
    // The browser supplies the actual paint order, including the book stack.
    // Ignore transparent pixels and continue down to the next visible object.
    for (const element of document.elementsFromPoint(x, y)) {
      if (element.closest(".zone-title")) return null;
      const button = element.closest(".art-button[data-kind][data-key]");
      if (!button || !scene.contains(button) || seen.has(button)) continue;
      seen.add(button);
      if (isVisiblePixel(button, x, y)) return button;
    }
    return null;
  }

  function prepareMask(button) {
    const image = button.querySelector("img");
    if (!image?.naturalWidth) return;
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = new Uint8Array(canvas.width * canvas.height);
      for (let index = 0; index < alpha.length; index++) alpha[index] = pixels[index * 4 + 3];
      masks.set(button, { width: canvas.width, height: canvas.height, alpha });
    } catch (error) {
      masks.set(button, null);
      console.warn("Could not create the image hit area:", image.getAttribute("src"), error);
    }
    if (lastPointer) setHovered(buttonAt(lastPointer.x, lastPointer.y));
  }

  for (const button of buttons) {
    const image = button.querySelector("img");
    if (!image) continue;
    image.draggable = false;
    if (image.complete) prepareMask(button);
    else image.addEventListener("load", () => prepareMask(button), { once: true });
  }

  scene.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    lastPointer = { x: event.clientX, y: event.clientY };
    setHovered(buttonAt(event.clientX, event.clientY));
  });
  scene.addEventListener("pointerleave", () => {
    lastPointer = null;
    setHovered(null);
  });
  function refreshHovered() {
    if (lastPointer) setHovered(buttonAt(lastPointer.x, lastPointer.y));
  }
  window.addEventListener("scroll", refreshHovered, { capture: true, passive: true });
  window.addEventListener("resize", refreshHovered);
  scene.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pressedButton = buttonAt(event.clientX, event.clientY);
    pressedButton?.classList.add("is-pressed");
    // Do not let a transparent rectangle focus the wrong book.
    event.preventDefault();
    pressedButton?.focus({ preventScroll: true });
  });
  window.addEventListener("pointerup", () => pressedButton?.classList.remove("is-pressed"));
  window.addEventListener("pointercancel", () => {
    pressedButton?.classList.remove("is-pressed");
    pressedButton = null;
    setHovered(null);
  });
  scene.addEventListener("click", (event) => {
    // Keyboard and assistive-technology activation keeps native button behavior.
    if (event.detail === 0) return;
    const button = buttonAt(event.clientX, event.clientY);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button && button === pressedButton) button.click();
    pressedButton = null;
    setHovered(null);
  }, true);
})();
