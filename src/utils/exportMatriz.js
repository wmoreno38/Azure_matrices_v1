import JSZip from 'jszip';
import { MATRIX_TEMPLATE } from '../data/template.js';

// Conversión base64 → Uint8Array segura para archivos grandes (evita stack overflow)
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportMatriz(project) {
  if (!project) throw new Error('Proyecto inválido');

  const mainZip = new JSZip();
  const templateBytes = base64ToBytes(MATRIX_TEMPLATE);
  const xlsxZip = await JSZip.loadAsync(templateBytes);

  let sheetXml = await xlsxZip.file('xl/worksheets/sheet8.xml').async('string');
  let ssXml    = await xlsxZip.file('xl/sharedStrings.xml').async('string');

  const ssUniqMatch  = ssXml.match(/uniqueCount="(\d+)"/);
  const ssCountMatch = ssXml.match(/count="(\d+)"/);
  let currentUnique  = ssUniqMatch  ? parseInt(ssUniqMatch[1])  : 0;
  let currentCount   = ssCountMatch ? parseInt(ssCountMatch[1]) : 0;

  const newStrings  = [];
  const cellUpdates = [];

  (project.controls || []).forEach((ctrl, idx) => {
    const excelRow = idx + 9;

    if (ctrl.compliance?.trim()) {
      cellUpdates.push({ row: excelRow, col: 'U', sIdx: currentUnique + newStrings.length });
      newStrings.push(ctrl.compliance);
    }

    const evs = (project.evidences || []).filter(e => e.controlId === ctrl.id);
    if (evs.length > 0) {
      const evText = evs.map((ev, ei) => {
        const fNames = ev.files?.length ? ev.files.map(f => f.name).join(', ') : '';
        return `Ev${ei + 1}: ${ev.description}${fNames ? ` [${fNames}]` : ''}`;
      }).join('\n');
      cellUpdates.push({ row: excelRow, col: 'V', sIdx: currentUnique + newStrings.length });
      newStrings.push(evText);
    }
  });

  if (newStrings.length > 0) {
    ssXml = ssXml
      .replace(/count="\d+"/,       `count="${currentCount  + newStrings.length}"`)
      .replace(/uniqueCount="\d+"/, `uniqueCount="${currentUnique + newStrings.length}"`);
    const newSi = newStrings.map(s => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join('');
    ssXml = ssXml.replace('</sst>', newSi + '</sst>');
  }

  cellUpdates.forEach(upd => {
    const cellRef = upd.col + upd.row;
    const pat = `<c r="${cellRef}"`;
    const idx = sheetXml.indexOf(pat);
    if (idx >= 0) {
      const endSelf = sheetXml.indexOf('/>', idx);
      const endFull = sheetXml.indexOf('</c>', idx);
      if (endSelf >= 0 && (endFull < 0 || endSelf < endFull)) {
        const sm = sheetXml.substring(idx, endSelf + 2).match(/s="(\d+)"/);
        sheetXml = sheetXml.substring(0, idx)
          + `<c r="${cellRef}"${sm ? ` s="${sm[1]}"` : ''} t="s"><v>${upd.sIdx}</v></c>`
          + sheetXml.substring(endSelf + 2);
      } else if (endFull >= 0) {
        const sm = sheetXml.substring(idx, endFull + 4).match(/s="(\d+)"/);
        sheetXml = sheetXml.substring(0, idx)
          + `<c r="${cellRef}"${sm ? ` s="${sm[1]}"` : ''} t="s"><v>${upd.sIdx}</v></c>`
          + sheetXml.substring(endFull + 4);
      }
    } else {
      const rowStart = `<row r="${upd.row}"`;
      const ri = sheetXml.indexOf(rowStart);
      if (ri >= 0) {
        const re = sheetXml.indexOf('>', ri);
        if (re >= 0) sheetXml = sheetXml.substring(0, re + 1) + `<c r="${cellRef}" t="s"><v>${upd.sIdx}</v></c>` + sheetXml.substring(re + 1);
      }
    }
  });

  xlsxZip.file('xl/worksheets/sheet8.xml', sheetXml);
  xlsxZip.file('xl/sharedStrings.xml', ssXml);
  const modifiedXlsx = await xlsxZip.generateAsync({ type: 'arraybuffer' });

  const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
  mainZip.file(`MATRIZ_${safeName}.xlsx`, modifiedXlsx);

  const evFolder = mainZip.folder('Evidencias');
  (project.controls || []).forEach(ctrl => {
    const evs = (project.evidences || []).filter(e => e.controlId === ctrl.id);
    if (!evs.length) return;
    const folderName = `${ctrl.code}_${(ctrl.causaBase || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 40).trim()}`;
    const ctrlFolder = evFolder.folder(folderName);
    evs.forEach((ev, ei) => {
      let meta = `Control: ${ctrl.code} - ${ctrl.causaBase}\nEvidencia: ${ev.description}\nTipo: ${ev.type}\nFecha: ${ev.date || ''}\nEstado: ${ev.status}\n`;
      if (ev.reviewer) meta += `Revisor: ${ev.reviewer}\n`;
      if (ev.notes)    meta += `Notas: ${ev.notes}\n`;
      ctrlFolder.file(`Ev${ei + 1}_info.txt`, meta);
      (ev.files || []).forEach(f => {
        try { const b64 = f.data?.split(',')[1]; if (b64) ctrlFolder.file(f.name || 'archivo', b64, { base64: true }); } catch (_) {}
      });
    });
  });

  const blob = await mainZip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${safeName}_Export.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}
