import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { PRECIOS } from '@/lib/precios';
import { getSesion } from '@/lib/session';

const AZUL     = 'FF1B3A5C';
const VERDE    = 'FF1A5C38';
const BLANCO   = 'FFFFFFFF';
const GRIS_F   = 'FFF0F4F8';
const TOTAL_BG = 'FF0F2740';
const BORDE    = 'FFD0D7DE';
const GRUPO_BG = 'FF2D5A8E';

function estKey(correo: string, campo: string) {
  return `${correo}||${campo}`;
}

function formatFecha(raw: string): string {
  if (!raw || raw === '—') return '—';
  // ISO YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  // Ya viene en DD-MM-YYYY (dato guardado en formato de visualización)
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  }
  return '—';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFill(argb: string): any {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBorder(color = BORDE): any {
  const b = { style: 'thin', color: { argb: color } };
  return { top: b, bottom: b, left: b, right: b };
}

const COLS = [
  { key: 'nombre',  width: 30 },
  { key: 'correo',  width: 36 },
  { key: 'estado',  width: 10 },
  { key: 'jira',    width: 7  },
  { key: 'slack',   width: 7  },
  { key: 'sf',      width: 11 },
  { key: 'fecha',   width: 12 },
  { key: 'sep1',    width: 3  },
  { key: 'sep2',    width: 3  },
  { key: 'cGoogle', width: 24 },
  { key: 'cJira',   width: 13 },
  { key: 'cSlack',  width: 13 },
  { key: 'cSF',     width: 19 },
  { key: 'cTotal',  width: 14 },
];

type Asesor = {
  correo: string; nombre: string; estado?: string;
  jira?: boolean; slack?: boolean; sf?: string;
  fechaEliminacion?: string; esDinamico?: boolean;
};

function escribirGrupo(
  ws: ExcelJS.Worksheet,
  grupoNombre: string,
  asesores: Asesor[],
  edits: Record<string, string>,
  eliminadas: Set<string>,
) {
  // Fila separadora con nombre del grupo
  const filaGrupo = ws.addRow([grupoNombre]);
  filaGrupo.height = 18;
  filaGrupo.getCell(1).fill  = makeFill(GRUPO_BG);
  filaGrupo.getCell(1).font  = { bold: true, color: { argb: BLANCO }, size: 11 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filaGrupo.getCell(1).alignment = { horizontal: 'left' } as any;
  ws.mergeCells(filaGrupo.number, 1, filaGrupo.number, 14);

  // Cabecera columnas
  const hdr = ws.addRow([
    'Nombre', 'Correo', 'Estado', 'Jira', 'Slack', 'Salesforce', 'Fecha Baja',
    '', '',
    'Google Workspace (USD)', 'Jira (USD)', 'Slack (USD)', 'Salesforce (USD)', 'Total (USD)',
  ]);
  hdr.height = 18;
  hdr.eachCell((cell, col) => {
    const esSep = col === 8 || col === 9;
    cell.fill = makeFill(esSep ? GRIS_F : col >= 10 ? VERDE : AZUL);
    cell.font = { bold: true, color: { argb: esSep ? GRIS_F : BLANCO }, size: 10 };
    if (!esSep) cell.border = makeBorder(BLANCO);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cell.alignment = { horizontal: col >= 10 ? 'right' : col >= 4 && col <= 7 ? 'center' : 'left' } as any;
  });

  let totG = 0, totJ = 0, totS = 0, totSF = 0, totTotal = 0;
  let rowIdx = 0;

  const visibles = asesores.filter(
    (a) =>
      !eliminadas.has(a.correo) &&
      edits[estKey(a.correo, 'eliminado')] !== 'true' &&
      (a.esDinamico || edits[estKey(a.correo, 'transferido')] !== 'true'),
  );

  for (const a of visibles) {
    const nombre = edits[estKey(a.correo, 'nombre')]           ?? a.nombre           ?? '';
    const correo = edits[estKey(a.correo, 'correo')]           ?? a.correo           ?? '';
    const estado = edits[estKey(a.correo, 'estado')]           ?? a.estado           ?? 'Activo';
    const jira   = (edits[estKey(a.correo, 'jira')]            ?? (a.jira  ? 'true' : 'false')) === 'true';
    const slack  = (edits[estKey(a.correo, 'slack')]           ?? (a.slack ? 'true' : 'false')) === 'true';
    const sf     = edits[estKey(a.correo, 'sf')]               ?? a.sf               ?? '';
    const fecha  = edits[estKey(a.correo, 'fechaEliminacion')] ?? a.fechaEliminacion ?? '';

    const cG  = PRECIOS.google;
    const cJ  = jira  ? PRECIOS.jira    : 0;
    const cS  = slack ? PRECIOS.slack   : 0;
    const cSF = sf === 'Cloud' ? PRECIOS.sfCloud : sf === 'Portal' ? PRECIOS.sfPortal : 0;
    const cT  = cG + cJ + cS + cSF;
    totG += cG; totJ += cJ; totS += cS; totSF += cSF; totTotal += cT;

    const par = rowIdx % 2 === 0;
    const row = ws.addRow([
      nombre, correo, estado,
      jira  ? 'Sí' : 'No',
      slack ? 'Sí' : 'No',
      sf || '—',
      fecha ? formatFecha(fecha) : '—',
      '', '',
      cG, cJ, cS, cSF, cT,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const esSep = col === 8 || col === 9;
      if (!esSep) {
        cell.fill   = makeFill(par ? BLANCO : GRIS_F);
        cell.border = makeBorder();
        cell.font   = { size: 10, color: { argb: 'FF1F2937' } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell.alignment = { horizontal: col >= 10 ? 'right' : col >= 4 && col <= 7 ? 'center' : 'left' } as any;
        if (col >= 10) cell.numFmt = '#,##0.00';
        if (col === 3) {
          const activo = (estado || '').toLowerCase() === 'activo';
          cell.font = { ...cell.font, color: { argb: activo ? 'FF166534' : 'FF991B1B' }, bold: true };
        }
      } else {
        cell.fill = makeFill(BLANCO);
      }
    });
    rowIdx++;
  }

  // Fila total
  const filaTotal = ws.addRow([
    'TOTAL', '', '', '', '', '', '', '', '',
    totG, totJ, totS, totSF, totTotal,
  ]);
  filaTotal.height = 18;
  filaTotal.eachCell({ includeEmpty: true }, (cell, col) => {
    const esSep = col === 8 || col === 9;
    if (!esSep) {
      cell.fill   = makeFill(TOTAL_BG);
      cell.font   = { bold: true, color: { argb: BLANCO }, size: 10 };
      cell.border = {
        top:    { style: 'medium', color: { argb: BLANCO } },
        bottom: { style: 'medium', color: { argb: BLANCO } },
        left:   { style: 'thin',   color: { argb: BLANCO } },
        right:  { style: 'thin',   color: { argb: BLANCO } },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell.alignment = { horizontal: col >= 10 ? 'right' : 'left' } as any;
      if (col >= 10) cell.numFmt = '#,##0.00';
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const sesion = await getSesion();
    if (!sesion || (sesion.rol !== 'admin' && sesion.rol !== 'finanzas')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { hojaLabel, grupos, edits, eliminadas: eliminadasArr } = await req.json();
    const eliminadas = new Set<string>(eliminadasArr ?? []);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(hojaLabel.replace(/[*?:\\/[\]]/g, '-').slice(0, 31));
    ws.columns = COLS;

    const gruposArr = grupos as { grupoNombre: string; asesores: Asesor[] }[];

    for (let i = 0; i < gruposArr.length; i++) {
      const { grupoNombre, asesores } = gruposArr[i];
      escribirGrupo(ws, grupoNombre, asesores, edits, eliminadas);

      // 3 filas vacías entre grupos (no después del último)
      if (i < gruposArr.length - 1) {
        ws.addRow([]);
        ws.addRow([]);
        ws.addRow([]);
      }
    }

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(hojaLabel)}.xlsx"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[export-mbp]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
