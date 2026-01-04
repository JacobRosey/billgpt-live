import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

let renderToken = 0;
const billsPerPage = 15;

const billListElement = document.getElementById('billList');

var sortMode = 'engrossed';
var activeMode = 'sort';

var cachedBills = {}

// Track whether a network fetch is in progress to prevent duplicate requests
let isFetching = false;
// Track if we've reached the end of results for a given mode/search term
let noMoreBills = {}

// Track current page per sort mode
let currentPage = {};

document.getElementById('engrossed').addEventListener('click', function () {
  sortBills('engrossed');
});

document.getElementById('passed').addEventListener('click', function () {
  sortBills('passed');
});

document.getElementById('vetoed').addEventListener('click', function () {
  sortBills('vetoed');
});

document.getElementById('search-button').addEventListener('click', searchBills);

function sortBills(mode) {
  if (mode == sortMode && activeMode == 'sort') return; //Clicked the already active button
  renderToken++
  const button = document.getElementById(sortMode);
  button.classList.remove('sort-btn-active')
  const newButton = document.getElementById(mode);
  newButton.classList.add('sort-btn-active');
  activeMode = 'sort'
  // Only reset currentPage and clear billListElement if switching to a new mode
  if (sortMode !== mode) {
    currentPage[mode] = currentPage[mode] || 0;
    billListElement.innerHTML = '';
  }
  sortMode = mode;
  // Also clear noMoreBills for this mode so it can try to fetch again if needed
  noMoreBills[sortMode] = false;
  fetchBills(currentPage[sortMode] || 0);
}

// Check if bill has already been summarized (should know if summary exists when receiving from backend)
// and if so change button to 'view summary' and render it
async function fetchBills(page) {

  //Avoid cache pollution by not using the mutable sortMode during this function's execution
  const modeAtRequestTime = sortMode;
  const token = renderToken;

  // When fetching, update currentPage for this mode
  currentPage[sortMode] = page;

  // If we already have enough cached items for this page, render only that page slice
  if (cachedBills[modeAtRequestTime] && cachedBills[modeAtRequestTime].length >= (page + 1) * billsPerPage) {
    // If there are no cached bills at all, show the empty message
    if (cachedBills[modeAtRequestTime].length === 0 && page === 0) {
      billListElement.innerHTML = `<br><br><br><h2>Sorry, we could not find any bills with status: ${modeAtRequestTime}</h2>`;
      return;
    }
    return renderCachedBills(modeAtRequestTime, page);
  }

  // If we've previously detected there are no more bills for this mode, skip fetching
  if (noMoreBills[modeAtRequestTime]) {
    console.log(`No more bills to fetch for mode: ${modeAtRequestTime}`);
    return;
  }

  // Prevent concurrent fetches
  if (isFetching) return;
  isFetching = true;

  console.log("fetching new bills in sort mode: ", modeAtRequestTime);

  try {
    const recordStart = page * billsPerPage;
    const response = await fetch('https://billgpt.onrender.com/get-bill-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recordStart: recordStart,
        billsPerPage: billsPerPage,
        sortMode: modeAtRequestTime
      }),
    });

    const bills = await response.json();

    if (sortMode !== modeAtRequestTime) {
      console.log(`User changed sort mode during bill fetching, discarding stale bills for ${modeAtRequestTime}`)
      isFetching = false;
      return
    }

    // If fewer bills were returned than requested, mark that there are no more results
    if (!bills || bills.length < billsPerPage) {
      noMoreBills[modeAtRequestTime] = true;
      // If this is the first page and no bills, show the empty message
      if ((!bills || bills.length === 0) && page === 0) {
        billListElement.innerHTML = `<br><br><br><h2>Sorry, we could not find any bills with status: ${modeAtRequestTime}</h2>`;
        isFetching = false;
        return;
      }
    }

    // Add the fetched bills to the cachedBills map
    if (!cachedBills[modeAtRequestTime]) {
      cachedBills[modeAtRequestTime] = []; // Initialize the array for the current sort mode if it doesn't exist
    }

    // Ensure the list for the current page is visible; when fetching for page 0 the container was already cleared
    if (page === 0) {
      billListElement.innerHTML = bills.length == 0 ? `<br><br><br><h2>Sorry, we could not find any bills with status: ${sortMode}</h2>` : '';
    }

    for (const bill of bills) {
      if (token !== renderToken) {
        isFetching = false;
        return;
      }
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

      billListElement.appendChild(billItem);
    }
    cachedBills[modeAtRequestTime] = cachedBills[modeAtRequestTime].concat(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);
  } finally {
    isFetching = false;
  }
}

function renderCachedBills(arg, page = 0) {
  activeMode = arg ? 'search' : 'sort'

  const list = cachedBills[arg ? arg : sortMode] || [];
  const start = page * billsPerPage;
  const end = start + billsPerPage;

  // When rendering, update currentPage for this mode
  if (!arg) currentPage[sortMode] = page;

  // Append only the slice for the requested page to avoid duplicating previously-rendered items
  for (const bill of list.slice(start, end)) {
    const id = bill.bill_id;

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

    billListElement.appendChild(billItem);
  }
}

async function searchBills() {
  const query = document.getElementById('search').value;
  const button = document.getElementById('search-button');
  button.classList.add('searching-button');
  button.disabled = true;

  try {
    const response = await fetch('https://billgpt.onrender.com/search-for-bills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ queryText: query }),
    });

    if (!response.ok) {
      console.error("Error: Failed to fetch bills", response.status, response.statusText);
      button.disabled = false;
      return;
    }

    const data = await response.json();
    if (!data) {
      console.error("Error: Response body is empty");
      button.disabled = false;
      return;
    } else {
      console.log(data);
    }

    const searchMode = query.trim();

    if (!cachedBills[searchMode]) {
      cachedBills[searchMode] = []
      const billsArr = Object.values(data.searchresult)
      for (let i = 0; i < billsArr.length - 1; i++) {
        const bill = { bill_id: billsArr[i].bill_id, title: billsArr[i].title, summary: await isSummarized(billsArr[i].bill_id) }
        cachedBills[searchMode].push(bill)
      }
    }

    billListElement.innerHTML = ''
    renderCachedBills(searchMode);
    if (billListElement.innerHTML == '') {
      billListElement.innerHTML =
        `
      <br><br><br>
      <h2>Sorry, we could not find any bills related to your search term!</h2>
      `
    }
    activeMode = 'search';
    button.disabled = false;
  } catch (err) {
    console.error(err);
  }
}

// Lazy load more bills when scrolling
billListElement.addEventListener('scroll', () => {
  if (activeMode == 'search') return;

  // If we've already determined there are no more bills for current mode do nothing
  //if (noMoreBills[sortMode]) return;

  if (billListElement.scrollTop + billListElement.clientHeight >= billListElement.scrollHeight - 10) {
    // Fetch more bills if scrolled to the bottom (small threshold)
    // Use currentPage for this mode
    const nextPage = (currentPage[sortMode] || 0) + 1;
    fetchBills(nextPage);
  }
});

async function isSummarized(billId) {
  try {
    const response = await fetch('https://billgpt.onrender.com/get-existing-summaries', {
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
    const response = await fetch('https://billgpt.onrender.com/summarize-bill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ billId })
    });

    if (!response.ok) {
      return "\n\n\n**Sorry, no text is currently available for this bill. Please try again later! **\n\n\n\n"
    }

    const textResponse = await response.text();
    try {
      if (activeMode === 'search') {
        const searchMode = document.getElementById('search').value.trim(); // Adjusted to get the correct search term
        const bill = cachedBills[searchMode]?.find(b => b.bill_id === billId);
        if (bill) {
          bill.summary = textResponse; // Update the summary in the cache
        }
      }
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

  summaryItem.classList.remove('show');
}

function renderSummary(id, content) {
  console.log("summary content: ", content)
  const bill = document.getElementById(id);
  const summaryItem = bill.querySelector('.summary-item');
  const button = bill.querySelector('button');

  // Overwrite previous click listener
  button.onclick = () => hideSummary(id);

  button.classList.remove('summarized-btn')
  button.classList.remove('summarizing-btn')

  button.innerHTML = 'Hide Summary';
  button.classList.add('rendered-summary-btn');

  // Scroll the .bill-list container to bring the summary into view
  const billPosition = bill.offsetTop;

  // Smoothly scroll the container
  billListElement.scrollTo({
    top: billPosition - 90,
    behavior: 'smooth',
  });

  if (bill) {
    summaryItem.classList.add('show');
    summaryItem.innerHTML = marked.parse(content);
  }

  button.disabled = false;
}

// Fetch bills on initial page load
fetchBills(currentPage[sortMode] || 0);
