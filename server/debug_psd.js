const fs = require('fs');
const { readPsd, initializeCanvas } = require('ag-psd');
const { createCanvas } = require('@napi-rs/canvas');

initializeCanvas(
  (w, h) => createCanvas(Math.max(1, w || 1), Math.max(1, h || 1)),
  (w, h) => createCanvas(Math.max(1, w || 1), Math.max(1, h || 1))
    .getContext('2d').createImageData(Math.max(1, w || 1), Math.max(1, h || 1))
);

const psdPath = process.argv[2];
const buf = fs.readFileSync(psdPath);
const psd = readPsd(buf, { skipCompositeImageData: true, skipLayerImageData: true });

const dpi = psd.imageResources?.resolutionInfo?.horizontalResolution;
console.log('=== PSD INFO ===');
console.log(`Size: ${psd.width} x ${psd.height} | DPI: ${dpi}`);
console.log('');

function walk(layers, indent) {
  for (const l of layers || []) {
    if (l.text) {
      const runs = l.text.styleRuns || [];
      const s0 = runs[0]?.style || {};
      const t = l.text.transform || {};
      const w = (l.right || 0) - (l.left || 0);
      const h = (l.bottom || 0) - (l.top || 0);
      console.log(`${indent}[TEXT] "${l.name}"`);
      console.log(`${indent}  bounds: left=${l.left} top=${l.top} right=${l.right} bottom=${l.bottom} => ${w}x${h}px`);
      console.log(`${indent}  text: ${JSON.stringify((l.text.text || '').substring(0, 80))}`);
      console.log(`${indent}  fontSize: ${s0.fontSize}`);
      console.log(`${indent}  font: ${s0.font?.name}`);
      console.log(`${indent}  fillColor: ${JSON.stringify(s0.fillColor)}`);
      console.log(`${indent}  bold: ${s0.bold} | italic: ${s0.italic} | tracking: ${s0.tracking}`);
      console.log(`${indent}  transform: xx=${t.xx} xy=${t.xy} yx=${t.yx} yy=${t.yy} tx=${t.tx} ty=${t.ty}`);
      console.log(`${indent}  justification: ${runs[0]?.style?.justification || psd.children?.[0]?.text?.paragraphRuns?.[0]?.style?.justification}`);
      console.log(`${indent}  styleRuns count: ${runs.length}`);
      if (runs.length > 1) {
        runs.slice(0, 5).forEach((r, i) => {
          console.log(`${indent}  run[${i}]: len=${r.length} fontSize=${r.style?.fontSize} color=${JSON.stringify(r.style?.fillColor)}`);
        });
      }
    } else {
      console.log(`${indent}${l.name}${l.children ? ' [group]' : ''}`);
    }
    if (l.children) walk(l.children, indent + '  ');
  }
}

walk(psd.children, '');
