import ExcelJS from "exceljs";
import logoAsset from "@/assets/logo-enfok.png.asset.json";

export interface ListagemDiarista {
  cpf: string;
  nome: string;
}

export interface ListagemInput {
  cliente: string;
  endereco: string;
  cidadeUf: string;
  data: string;
  turno: string;
  entrada: string;
  saida: string;
  diaristas: ListagemDiarista[];
  titulo?: string;
}

function fmtData(v: string): string {
  if (!v) return "";
  if (v.includes("/") || v.includes(".")) return v;
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return v;
  return `${d}.${m}.${y.slice(-2)}`;
}

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

const THIN = { style: "thin" as const, color: { argb: "FF808080" } };
const ALL_BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export async function gerarListagemXLSX(input: ListagemInput): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Enfok";
  const sheetName = (input.turno || "T3").slice(0, 20) || "Listagem";
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });

  // Column widths
  ws.getColumn(1).width = 3.6;
  ws.getColumn(2).width = 4.2;
  ws.getColumn(3).width = 21;
  ws.getColumn(4).width = 42;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 74;
  ws.getColumn(7).width = 7.5;
  ws.getColumn(8).width = 76;

  const logoB64 = await fetchAsBase64(logoAsset.url);
  const imgId = logoB64 ? wb.addImage({ base64: logoB64, extension: "png" }) : null;

  const headers = ["Nº", "CPF", "NOME COMPLETO", "ENTRADA", "ASSINATURA (SEM ABREVIAÇÃO)", "SAÍDA", "ASSINATURA (SEM ABREVIAÇÃO)"];

  // Renderiza o bloco de cabeçalho completo começando em startRow.
  // Ocupa 7 linhas (startRow..startRow+6) + linha do cabeçalho da tabela em startRow+7.
  // Retorna a próxima linha disponível para o corpo.
  function renderHeaderBlock(startRow: number): number {
    if (imgId !== null) {
      ws.addImage(imgId, { tl: { col: 1, row: startRow - 1 }, ext: { width: 140, height: 55 } });
    }

    const titleRow = startRow + 2;
    ws.mergeCells(`E${titleRow}:H${titleRow}`);
    const title = ws.getCell(`E${titleRow}`);
    title.value = input.titulo || "CONTROLE DE PRESTADORES DE SERVIÇO";
    title.font = { bold: true, size: 12 };
    title.alignment = { horizontal: "center", vertical: "middle" };

    const rC = startRow + 3;
    const rE = startRow + 4;
    const rD = startRow + 5;
    const cC = ws.getCell(`C${rC}`); cC.value = `CLIENTE: ${input.cliente || ""}`; cC.font = { bold: true, size: 11 };
    const cE = ws.getCell(`C${rE}`); cE.value = `Endereço: ${input.endereco || ""}`; cE.font = { size: 11 };
    const cD = ws.getCell(`C${rD}`); cD.value = `CIDADE/UF: ${input.cidadeUf || ""}`; cD.font = { size: 11 };
    const eD = ws.getCell(`E${rD}`); eD.value = "DATA:"; eD.font = { bold: true, size: 11 }; eD.alignment = { horizontal: "right" };
    const fD = ws.getCell(`F${rD}`); fD.value = fmtData(input.data); fD.font = { size: 11 }; fD.alignment = { horizontal: "left" };
    const gD = ws.getCell(`G${rD}`); gD.value = input.turno || "T3"; gD.font = { bold: true, size: 11 }; gD.alignment = { horizontal: "left" };

    const tableHeaderRow = startRow + 7;
    headers.forEach((h, i) => {
      const cell = ws.getCell(tableHeaderRow, 2 + i);
      cell.value = h;
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD0D0D0" } };
      cell.border = ALL_BORDERS;
    });
    ws.getRow(tableHeaderRow).height = 26;

    return tableHeaderRow + 1;
  }

  const PAGE_SIZE = 20;
  let currentRow = renderHeaderBlock(1);
  let lastBodyRow = currentRow;

  input.diaristas.forEach((d, i) => {
    // A cada 20 nomes replica o cabeçalho completo (nova "listagem") em nova página
    if (i > 0 && i % PAGE_SIZE === 0) {
      ws.getRow(currentRow - 1).addPageBreak();
      // espaçamento entre blocos
      for (let s = 0; s < 4; s++) {
        const spacer = ws.getRow(currentRow + s);
        spacer.height = 18;
      }
      currentRow = renderHeaderBlock(currentRow + 4);
    }

    const r = currentRow;
    const row = ws.getRow(r);
    row.height = 29;

    const cN = ws.getCell(r, 2); cN.value = i + 1; cN.font = { bold: true, size: 10 }; cN.alignment = { horizontal: "center", vertical: "middle" };
    const cCpf = ws.getCell(r, 3); cCpf.value = d.cpf || ""; cCpf.font = { bold: true, size: 10 }; cCpf.alignment = { vertical: "middle" };
    const cNome = ws.getCell(r, 4); cNome.value = d.nome || ""; cNome.font = { bold: true, size: 10 }; cNome.alignment = { vertical: "middle" };
    const cEnt = ws.getCell(r, 5); cEnt.value = input.entrada || ""; cEnt.font = { bold: true, size: 10 }; cEnt.alignment = { horizontal: "center", vertical: "middle" };
    const cAss1 = ws.getCell(r, 6); cAss1.value = ""; cAss1.alignment = { vertical: "middle" };
    const cSai = ws.getCell(r, 7); cSai.value = input.saida || ""; cSai.font = { bold: true, size: 10 }; cSai.alignment = { horizontal: "center", vertical: "middle" };
    const cAss2 = ws.getCell(r, 8); cAss2.value = ""; cAss2.alignment = { vertical: "middle" };

    for (let col = 2; col <= 8; col++) ws.getCell(r, col).border = ALL_BORDERS;

    lastBodyRow = r;
    currentRow++;
  });

  const sigLine = lastBodyRow + 3;
  const labelRow = sigLine + 1;

  const line = "____________________________________________________";
  const sigCells: Array<[string, string, string]> = [
    ["C", "ASSINATURA RH REGIONAL", "C"],
    ["E", "ASSINATURA FORNECEDOR", "F"],
    ["G", "ASSINATURA LÍDER LOCAL", "H"],
  ];
  sigCells.forEach(([lineCol, label, labelCol]) => {
    const l = ws.getCell(`${lineCol}${sigLine}`);
    l.value = line;
    l.alignment = { horizontal: "center" };
    l.font = { size: 10 };
    const lb = ws.getCell(`${labelCol}${labelRow}`);
    lb.value = label;
    lb.font = { bold: true, size: 10 };
    lb.alignment = { horizontal: "center" };
  });

  ws.pageSetup.printArea = `A1:H${labelRow}`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `listagem-${(input.cliente || "prestadores").replace(/\s+/g, "_")}-${fmtData(input.data).replace(/[./]/g, "-")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
