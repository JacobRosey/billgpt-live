import axios from 'axios';
import PDFParser from 'pdf2json';
import dotenv from 'dotenv';
dotenv.config();

const legiscan_key = process.env.LEGI_API_KEY;


const searchForBills = async (text) => {
  const queryText = encodeURIComponent(text)
  const url = `https://api.legiscan.com/?key=${encodeURIComponent(legiscan_key)}&op=getSearch&state=US&query=${queryText}`;
  console.log("searching for bills including text: ", queryText)
  try {
    const response = await axios.get(url)
    console.log("afjdkl;afjioqeapnjfokipdasnfponapoweifnjkoapdsnjfkpanefkojapsnfkojpanefmoasenjfo")
    console.log(response.data)
    return response.data
  } catch (error){
    throw new Error(`Error fetching bill data: ${error.message}`);
  }
}

async function getBillData(docId) {
  if (!docId) {
    throw new Error('Invalid document ID provided');
  }
  const idEncoded = encodeURIComponent(docId);
  const url = `https://api.legiscan.com/?key=${encodeURIComponent(legiscan_key)}&op=getBillText&id=${idEncoded}`;

  try {
    const response = await axios.get(url);
    return response.data
  } catch (error) {
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
  const keyEncoded = encodeURIComponent(legiscan_key);
  const opEncoded = encodeURIComponent('getBill');
  const idEncoded = encodeURIComponent(billId);

  // Build the URL with encoded parameters
  const url = `https://api.legiscan.com/?key=${keyEncoded}&op=${opEncoded}&id=${idEncoded}`;
  console.log('Fetching Bill text from:', url);

  try {
    // Fetch docId 
    const response = await axios.get(url);
    const parsedData = response.data;

    if (!parsedData.bill?.texts?.[0]?.doc_id) {
      console.log("No doc id!")
      return false
    }

    const docId = parsedData.bill.texts[0].doc_id;
    console.log("Fetched docId:", docId);

    // Fetch bill data with the docId
    const billData = await getBillData(docId);

    let billText;
    try {
      console.log("Parsing pdf...")
      billText = await parsePdf(billData.text.doc);
    } catch (parseError) {
      console.error('Document parsing error details:', parseError);
      throw new Error(`Document parsing error: ${parseError.message}`);
    }

    if (!billText?.trim()) {
      throw new Error('No text extracted from document');
    }

    // Summarize
    console.log('Parsed pdf, now returning original bill text...');
    return billText;

  } catch (error) {
    console.error('Full error details:', error);
    throw new Error(`Failed to get bill text: ${error.message}`);
  }
};

export default {getBillText, searchForBills};
