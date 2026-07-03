import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  if (v.includes("/")) return v;
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y.slice(-2)}`;
}

async function loadDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarListagemPDF(input: ListagemInput): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 8;

  // Logo
  const logoDataUrl = await loadDataUrl(logoAsset.url);
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", marginX, 6, 30, 12); } catch { /* ignore */ }
  }

  // Título centralizado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(input.titulo || "CONTROLE DE PRESTADORES DE SERVIÇO", pageW / 2, 12, { align: "center" });

  // Bloco cabeçalho
  doc.setFontSize(9);
  const yc = 22;
  const lh = 4.5;

  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE:", marginX, yc);
  doc.setFont("helvetica", "normal");
  doc.text(input.cliente || "", marginX + 18, yc);

  doc.setFont("helvetica", "bold");
  doc.text("Endereço:", marginX, yc + lh);
  doc.setFont("helvetica", "normal");
  doc.text(input.endereco || "", marginX + 18, yc + lh);

  doc.setFont("helvetica", "bold");
  doc.text("CIDADE/UF:", marginX, yc + lh * 2);
  doc.setFont("helvetica", "normal");
  doc.text(input.cidadeUf || "", marginX + 22, yc + lh * 2);

  doc.setFont("helvetica", "bold");
  doc.text("DATA:", marginX + 90, yc + lh * 2);
  doc.setFont("helvetica", "normal");
  doc.text(fmtData(input.data), marginX + 100, yc + lh * 2);

  doc.setFont("helvetica", "bold");
  doc.text(input.turno || "T3", pageW - marginX - 8, yc + lh * 2);

  // Tabela
  const rows = input.diaristas.map((d, i) => [
    String(i + 1),
    d.cpf || "",
    d.nome || "",
    input.entrada,
    "",
    input.saida,
    "",
  ]);

  autoTable(doc, {
    startY: yc + lh * 2 + 4,
    head: [["Nº", "CPF", "NOME COMPLETO", "ENTRADA", "ASSINATURA (SEM ABREVIAÇÃO)", "SAÍDA", "ASSINATURA (SEM ABREVIAÇÃO)"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [120, 120, 120], lineWidth: 0.1, minCellHeight: 8, valign: "middle" },
    headStyles: { fillColor: [210, 210, 210], textColor: 0, halign: "center", fontStyle: "bold", lineWidth: 0.1, lineColor: [120, 120, 120] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 28, fontStyle: "bold" },
      2: { cellWidth: 60, fontStyle: "bold" },
      3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 65 },
      5: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 65 },
    },
    margin: { left: marginX, right: marginX },
    theme: "grid",
  });

  // Rodapé
  const pageH = doc.internal.pageSize.getHeight();
  const yFoot = pageH - 18;
  const colW = (pageW - marginX * 2) / 3;
  doc.setDrawColor(0);
  for (let i = 0; i < 3; i++) {
    const x1 = marginX + colW * i + 10;
    const x2 = marginX + colW * (i + 1) - 10;
    doc.line(x1, yFoot, x2, yFoot);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ASSINATURA RH REGIONAL", marginX + colW / 2, yFoot + 5, { align: "center" });
  doc.text("ASSINATURA FORNECEDOR", marginX + colW * 1.5, yFoot + 5, { align: "center" });
  doc.text("ASSINATURA LÍDER LOCAL", marginX + colW * 2.5, yFoot + 5, { align: "center" });

  const nomeArq = `listagem-${(input.cliente || "prestadores").replace(/\s+/g, "_")}-${fmtData(input.data).replace(/\//g, "-")}.pdf`;
  doc.save(nomeArq);
}
