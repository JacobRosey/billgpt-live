import axios from 'axios';
import PDFParser from 'pdf2json';
import dotenv from 'dotenv';
dotenv.config();

const legi_key = process.env.LEGI_API_KEY;

async function getBillData(docId) {
  if (!docId) {
    throw new Error('Invalid document ID provided');
  }

  const keyEncoded = encodeURIComponent(legi_key);
  const opEncoded = encodeURIComponent('getBillText');
  const idEncoded = encodeURIComponent(docId);
  const url = `https://api.legiscan.com/?key=${keyEncoded}&op=${opEncoded}&id=${idEncoded}`;
  console.log('Fetching Bill Data from:', url);

  try {
    const response = await axios.get(url);
    const billData = response.data;
    return billData;
  } catch (error) {
    console.error('Error fetching bill data:', error);
    throw new Error(`Error fetching bill data: ${error.message}`);
  }
}

function parsePdf(b64) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on("pdfParser_dataReady", function (pdfData) {
      try {
        let extractedText = '';
        pdfData.Pages.forEach(page => {
          page.Texts.forEach(textItem => {
            const decodedText = decodeURIComponent(textItem.R[0].T);
            extractedText += decodedText + ' ';
          });
          extractedText += '\n\n';
        });
        resolve(extractedText.trim());
      } catch (err) {
        reject(new Error(`Error processing PDF data: ${err.message}`));
      }
    });

    pdfParser.on("pdfParser_dataError", function (error) {
      reject(new Error(`PDF parsing error: ${error}`));
    });

    try {
      const data = Buffer.from(b64, 'base64');
      pdfParser.parseBuffer(data);
    } catch (err) {
      reject(new Error(`Error preparing PDF data: ${err.message}`));
    }
  });
}

const getBillText = async (billId) => {
  if (!billId) {
    throw new Error('Invalid bill ID provided');
  }
  const keyEncoded = encodeURIComponent(legi_key);
  const opEncoded = encodeURIComponent('getBill');
  const idEncoded = encodeURIComponent(billId);

  // Build the URL with encoded parameters
  const url = `https://api.legiscan.com/?key=${keyEncoded}&op=${opEncoded}&id=${idEncoded}`;
  console.log('Fetching Bill text from:', url);

  try {
    // Fetch docId using axios
    const response = await axios.get(url);
    const parsedData = response.data;

    if (!parsedData?.bill?.texts?.[0]?.doc_id) {
      throw new Error('Document ID not found in response');
    }

    const docId = parsedData.bill.texts[0].doc_id;
    console.log("Fetched docId:", docId);

    // Fetch bill data with the docId
    const billData = await getBillData(docId);

    let billText;
    try {
      console.log("Converting pdf to base64...")
      billText = await parsePdf(billData.text.doc);
    } catch (parseError) {
      console.error('Document parsing error details:', parseError);
      throw new Error(`Document parsing error: ${parseError.message}`);
    }

    if (!billText?.trim()) {
      throw new Error('No text extracted from document');
    }

    // Summarize
    console.log('Attempting to summarize parsed text...');
    return billText;

  } catch (error) {
    console.error('Full error details:', error);
    throw new Error(`Failed to summarize bill: ${error.message}`);
  }
};

export default getBillText;
