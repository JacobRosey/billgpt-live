import { parentPort } from 'worker_threads';
import PDFParser from 'pdf2json';

parentPort.on('message', (b64) => {
  try {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let extractedText = '';

        pdfData.Pages.forEach(page => {
          page.Texts.forEach(textItem => {
            const decodedText = decodeURIComponent(textItem.R[0].T);
            extractedText += decodedText + ' ';
          });
          extractedText += '\n\n';
        });

        parentPort.postMessage({
          ok: true,
          text: extractedText.trim()
        });
      } catch (err) {
        parentPort.postMessage({ ok: false, error: err.message });
      }
    });

    pdfParser.on('pdfParser_dataError', (err) => {
      parentPort.postMessage({ ok: false, error: err });
    });

    const buffer = Buffer.from(b64, 'base64');
    pdfParser.parseBuffer(buffer);
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err.message });
  }
});
