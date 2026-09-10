export async function downloadAndExtractPdfText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CercaInterpelliPadova/1.0 (serverless-nextjs-app)'
      }
    });

    if (!response.ok) {
      console.warn(`Download PDF fallito, HTTP ${response.status} per ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Importazione dinamica diretta di lib/pdf-parse per evitare il file di test di pdf-parse v1
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');

    const pdfData = await pdfParse(buffer);
    const fullText = pdfData.text || '';

    // Pulizia del testo (unione lettere staccate es "I S T I T U T O" -> "ISTITUTO")
    const cleanedText = fullText.replace(/(\b[A-Za-z0-9])\s+(?=[A-Za-z0-9]\b)/g, '$1');

    return cleanedText;
  } catch (error) {
    console.error(`Errore estrazione testo PDF da ${url}:`, error);
    return null;
  }
}
