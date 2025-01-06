// State management for dummies
let page = 0;
const billsPerPage = 30;
const billListElement = document.getElementById('billList');

var sortMode = 'recent';

var cachedBills = {}

function sortBills(mode){
  if(mode == sortMode) return; //Clicked the already active button
  const btn = document.getElementById(sortMode);
  btn.classList.remove('sort-btn-active')
  const newBtn = document.getElementById(mode);
  newBtn.classList.add('sort-btn-active');
  sortMode = mode;
  const list = document.querySelector('.bill-list');
  list.innerHTML = '';
  fetchBills(0);
}

// Check if bill has already been summarized (should know if summary exists when receiving from backend)
// and if so change button to 'view summary' and render it
async function fetchBills(page) {
  
  // Check if we already have the data cached for the current sort mode
  if (cachedBills[sortMode] && cachedBills[sortMode].length > page * billsPerPage) {
    console.log("Rendering cached bills in sort mode: ", sortMode)
    return renderCachedBills(page);
  }

  console.log("fetching new bills in sort mode: ", sortMode);

  try {
    const recordStart = page * billsPerPage;
    const response = await fetch('http://localhost:3000/get-bill-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recordStart: recordStart,
        billsPerPage: billsPerPage,
        sortMode: sortMode
      }),
    });

    const bills = await response.json();

    // Add the fetched bills to the cachedBills map
    if (!cachedBills[sortMode]) {
      cachedBills[sortMode] = []; // Initialize the array for the current sort mode if it doesn't exist
    }

    for (const bill of bills) { 
      let id = bill.bill_id;
      const summarized = await isSummarized(id);

      const billItem = document.createElement('div');
      billItem.setAttribute('id', id);
      billItem.classList.add('bill-item');

      const billContent = document.createElement('div');
      billContent.classList.add('bill-content');

      const titleSpan = document.createElement('span');
      titleSpan.textContent = bill.title;

      const button = document.createElement('button');
      if (!summarized) {
        button.classList.add('summarizable-btn');
        button.textContent = 'Get Summary';
        button.onclick = () => handleGetSummary(id);
      } else {
        button.textContent = 'View Summary';
        button.classList.add('summarized-btn');
        button.onclick = () => renderSummary(id, summarized);
        bill.summary = summarized;
      }

      billContent.appendChild(titleSpan);
      billContent.appendChild(button);

      const summaryItem = document.createElement('div');
      summaryItem.classList.add('summary-item');

      billItem.appendChild(billContent);
      billItem.appendChild(summaryItem);

      // Ensure the parent element exists
      document.querySelector('.bill-list').appendChild(billItem);
    }
    cachedBills[sortMode] = cachedBills[sortMode].concat(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);
  }
}

function renderCachedBills(){
  for (const bill of cachedBills[sortMode]) { 
    let id = bill.bill_id;

    const billItem = document.createElement('div');
    billItem.setAttribute('id', id);
    billItem.classList.add('bill-item');

    const billContent = document.createElement('div');
    billContent.classList.add('bill-content');

    const titleSpan = document.createElement('span');
    titleSpan.textContent = bill.title;

    const button = document.createElement('button');
    if (!bill.summary) {
      button.classList.add('summarizable-btn');
      button.textContent = 'Get Summary';
      button.onclick = () => handleGetSummary(id);
    } else {
      button.textContent = 'View Summary';
      button.classList.add('summarized-btn');
      button.onclick = () => renderSummary(id, bill.summary);
    }

    billContent.appendChild(titleSpan);
    billContent.appendChild(button);

    const summaryItem = document.createElement('div');
    summaryItem.classList.add('summary-item');

    billItem.appendChild(billContent);
    billItem.appendChild(summaryItem);

    // Ensure the parent element exists
    document.querySelector('.bill-list').appendChild(billItem);
  }
}

// Lazy load more bills when scrolling
billListElement.addEventListener('scroll', () => {
  if (billListElement.scrollTop + billListElement.clientHeight >= billListElement.scrollHeight) {
    // Fetch more bills if scrolled to the bottom
    page += 1;
    fetchBills(page, sortMode);
  }
});

async function isSummarized(billId){
  try {
    const response = await fetch('http://localhost:3000/get-existing-summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ billId: billId }),
    });

    if (!response.ok) {
      console.error(response);
    }

    const data = await response.json(); 
    return data.message ? null : data.summary;
  } catch (err) {
    console.error(err);
  }
}

async function summarizeBillText(billId) {
  try {
    const response = await fetch('http://localhost:3000/summarize-bill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ billId })
    });

    if(response == false){
      alert("Sorry, no pdf was found for this bill")
      // const bill = getElementById(billId)
      // const btn = bill.querySelector('btn');
      // btn.innerHTML = "No summary available!"
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
        console.error('Failed to summarize bill. Response:', errorText);
        throw new Error(`Failed to summarize bill: ${errorText}`);
    }

    const textResponse = await response.text();
    try {
      return textResponse; 
    } catch (jsonError) {
      console.error('Error parsing JSON:', jsonError);
      throw jsonError;
    }
  } catch (error) {
    console.error('Error summarizing bill:', error);
    throw error;
  }
}

async function handleGetSummary(billId) {
  const bill = document.getElementById(billId);
  const button = bill.querySelector('button');
  button.disabled = true;
  button.classList.remove('summarizable-btn')
  button.classList.add('summarizing-btn')
  button.innerHTML = "Summarizing...";

  try {
    const result = await summarizeBillText(billId);
    renderSummary(billId, result);
  } catch (error) {
    console.error('Error occurred in handleGetSummary:', error);
  }
}

function hideSummary(id) {
  const bill = document.getElementById(id);
  const summaryItem = bill.querySelector('.summary-item');
  const button = bill.querySelector('button');

  button.innerHTML = 'View Summary';
  button.classList.remove('rendered-summary-btn')
  button.classList.add('summarized-btn')

  // Add the event listener for showing the summary again
  button.onclick = () => renderSummary(id, summaryItem.innerHTML);

  if (summaryItem) {
    summaryItem.classList.remove('show');
  }
}

function renderSummary(id, content) {
  const bill = document.getElementById(id);
  const summaryItem = bill.querySelector('.summary-item');
  const button = bill.querySelector('button');
  const billList = document.querySelector('.bill-list'); // The scrollable container

  // Overwrite previous click listener
  button.onclick = () => hideSummary(id);

  button.innerHTML = 'Hide Summary';
  button.classList.remove('summarized-btn')
  button.classList.remove('summarizing-btn')
  button.classList.add('rendered-summary-btn');

   // Scroll the .bill-list container to bring the summary into view
   const billPosition = bill.offsetTop; 
 
   // Smoothly scroll the container
   billList.scrollTo({
     top: billPosition - 90,
     behavior: 'smooth',
   });

  if (bill) {
    summaryItem.classList.add('show');
    summaryItem.innerHTML = convertMarkdownToHtml(content);
  }

  button.disabled = false;
}

function convertMarkdownToHtml(text) {
  return text.split('\n').map(line => {
    // Convert "**Text**" to "<strong>Text</strong>"
    line = line.replace(/^### (.*)/, '<h3>$1</h3>');
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return line
  }).join('<br>');
}

// Fetch bills on page load
fetchBills(page);
