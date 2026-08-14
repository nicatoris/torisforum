/* Image cropper used for avatars and profile banners.
   openCropper(file, {aspect, round, outWidth, allowOriginal}) resolves with
   {blob, name} for a cropped image, {blob: file, name} when the user keeps an
   animated GIF as-is, or null if they cancel.

   Cropping draws to a canvas, which only captures one frame — so for GIFs we
   offer to keep the original file instead, preserving the animation. */

(function () {
  function openCropper(file, opts = {}) {
    const aspect = opts.aspect || 1; // width / height
    const round = !!opts.round;
    const outWidth = opts.outWidth || 512;
    const isGif = file.type === 'image/gif';

    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      const overlay = document.createElement('div');
      overlay.className = 'crop-overlay';
      overlay.innerHTML = `
        <div class="crop-box">
          <div class="crop-head">Position your image</div>
          <div class="crop-stage-wrap">
            <canvas class="crop-stage ${round ? 'is-round' : ''}"></canvas>
          </div>
          <div class="crop-controls">
            <label>Zoom</label>
            <input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1">
          </div>
          <div class="crop-hint">Drag the image to reposition it.</div>
          ${
            isGif
              ? `<div class="crop-gif-note">This is an animated GIF. Cropping saves a single still frame — use <b>Keep animated</b> to upload it unchanged.</div>`
              : ''
          }
          <div class="crop-actions">
            <button type="button" class="btn" data-act="cancel">Cancel</button>
            ${isGif ? '<button type="button" class="btn" data-act="original">Keep animated</button>' : ''}
            <button type="button" class="btn primary" data-act="save">Use image</button>
          </div>
        </div>`;

      const canvas = overlay.querySelector('.crop-stage');
      const zoom = overlay.querySelector('.crop-zoom');
      const ctx = canvas.getContext('2d');

      // Display size of the crop stage
      const stageW = Math.min(300, Math.round(window.innerWidth * 0.7));
      const stageH = Math.round(stageW / aspect);
      canvas.width = stageW;
      canvas.height = stageH;

      let scale = 1;
      let minScale = 1;
      let offX = 0;
      let offY = 0;

      function clamp() {
        const w = img.width * scale;
        const h = img.height * scale;
        // keep the image covering the stage
        offX = Math.min(0, Math.max(offX, stageW - w));
        offY = Math.min(0, Math.max(offY, stageH - h));
      }

      function draw() {
        clamp();
        ctx.clearRect(0, 0, stageW, stageH);
        ctx.drawImage(img, offX, offY, img.width * scale, img.height * scale);
      }

      img.onload = () => {
        // start zoomed to cover the stage
        minScale = Math.max(stageW / img.width, stageH / img.height);
        scale = minScale;
        offX = (stageW - img.width * scale) / 2;
        offY = (stageH - img.height * scale) / 2;
        zoom.min = String(minScale);
        zoom.max = String(minScale * 4);
        zoom.step = String(minScale / 100);
        zoom.value = String(scale);
        draw();
      };
      img.onerror = () => {
        cleanup();
        alert('That file could not be read as an image.');
        resolve(null);
      };
      img.src = url;

      // ── drag to pan ──
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        offX += e.clientX - lastX;
        offY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        draw();
      });
      const endDrag = () => (dragging = false);
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);

      zoom.addEventListener('input', () => {
        const prev = scale;
        scale = parseFloat(zoom.value);
        // zoom about the centre of the stage
        offX = stageW / 2 - ((stageW / 2 - offX) / prev) * scale;
        offY = stageH / 2 - ((stageH / 2 - offY) / prev) * scale;
        draw();
      });

      function cleanup() {
        URL.revokeObjectURL(url);
        overlay.remove();
        document.removeEventListener('keydown', onKey);
      }
      function onKey(e) {
        if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      }
      document.addEventListener('keydown', onKey);

      overlay.addEventListener('click', (e) => {
        const act = e.target.dataset?.act;
        if (!act) return;
        if (act === 'cancel') {
          cleanup();
          resolve(null);
          return;
        }
        if (act === 'original') {
          cleanup();
          resolve({ blob: file, name: file.name });
          return;
        }
        // render the visible region at output resolution
        const out = document.createElement('canvas');
        out.width = outWidth;
        out.height = Math.round(outWidth / aspect);
        const k = out.width / stageW;
        const octx = out.getContext('2d');
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(img, offX * k, offY * k, img.width * scale * k, img.height * scale * k);
        out.toBlob(
          (blob) => {
            cleanup();
            resolve(blob ? { blob, name: 'crop.png' } : null);
          },
          'image/png'
        );
      });

      document.body.appendChild(overlay);
    });
  }

  window.openCropper = openCropper;
})();
