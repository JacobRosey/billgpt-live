
## BillGPT

**Live Demo:** https://billgpt.onrender.com

BillGPT is a web application that allows users to receive summaries of U.S. Congressional bills.

### Overview
- Backed by a **PostgreSQL database** hosted on Render
- Database schema is based on **LegiScan’s official schema** and seeded using their bulk import tooling
- Contains **all U.S. Congress bills from 2024 to present**

### Data Flow & Architecture
- Bills are fetched from the database and displayed in **reverse chronological order**, grouped by bill status (e.g. engrossed, passed, vetoed)
- Each rendered bill includes its **LegiScan bill ID**, which is used to retrieve the official PDF text on demand
- When a user requests a summary:
  - The bill PDF is fetched from **LegiScan’s API**
  - The text is extracted using **pdf2json**
  - The extracted text is summarized using the **OpenAI API**
  - The resulting summary is rendered directly under the bill title

### Caching & Persistence
- Generated summaries are stored in a dedicated database table keyed by bill ID
- On subsequent page loads, the application checks for an existing summary:
  - If one exists, a **“View Summary”** button is shown instead of re-summarizing
  - This avoids redundant API calls and improves performance

### Search
- Includes keyword-based bill search powered by **LegiScan’s search API**
- Only results with a **relevance score above 50** are returned to ensure meaningful matches

### Frontend Performance
- Bills are **lazy-loaded** in batches of 30 to reduce initial load time
- An offset-based pagination system ensures correct data ordering:
  - First load: bills 0–29
  - Second load: bills 30–59
  - And so on

### Technologies
- PostgreSQL
- LegiScan API
- OpenAI API
- pdf2json
- Vanilla JS frontend
- Node.js backend
