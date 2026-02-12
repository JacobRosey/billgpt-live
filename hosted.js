import express from 'express';
import path from 'path';
import legiscan from './apis/legiscan.js';  
import getBillSummary from './apis/openai.js'
import cors from 'cors'
import { fileURLToPath } from 'url';
import { pdfWorkerPool } from './workers/pdfWorkerPool.js';

const { getBillText, searchForBills } = legiscan;
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors())

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

// Instantiate the worker pool
const workerPool = pdfWorkerPool;

db.query('SELECT NOW()', (err, res) => {
    if(err){
        console.err('Error connecting to database: ', err)
    } else {
        console.log('Connected to PostgreSQL database')
    }
})

// Get existing bill summaries from the database
app.post('/get-existing-summaries', async (req, res) => {
    try {
        const { billId } = req.body;

        const query = 'SELECT summary FROM ls_summaries WHERE bill_id = $1';
        db.query(query, [billId], (err, results) => {
            if (err) {
                console.error('Database query error: ', err);
                return res.status(500).json({ message: 'Error fetching data from the database' });
            }

            if (results.rows.length > 0) {
                return res.status(200).json({ summary: results.rows[0].summary });
            } else {
                return res.status(200).json({ message: 'Bill summary not found' });
            }
        });
    } catch (err) {
        console.error('Error processing request: ', err);
        return res.status(500).json({ message: 'Error processing request' });
    }
});


// Handle requests for bill summaries
app.post('/summarize-bill', async (req, res) => {
    try {
        const { billId } = req.body;

        console.log("Getting bill text...")
        const start = Date.now();
        const billText = await getBillText(billId);
        if (!billText) {
            console.log("Bill text not found, returning early...");
            return res.status(404).send('Bill text not available at this time');
        }
        console.log("Got bill text in ", Date.now() - start, " milliseconds")
        console.log("Summarizing bill text...");
        const summary = await getBillSummary(billText);
        console.log("Got bill summary in ", Date.now() - start, " milliseconds")

        res.status(200).send(summary.content);

        console.log("Saving summary to db...")
        const tob64 = summary.content;

        db.query(
            `INSERT INTO ls_summaries (bill_id, summary) VALUES ($1, $2)`,
            [billId, tob64],
            (err, results) => {
                if (err) {
                    console.error("Error adding summary to database: ", err);
                    return;
                }
                console.log('Summary inserted into database successfully. Finished in ', Date.now() - start, ' milliseconds');
            }
        );

    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal server error');
    }
});

//Summarize text needs work next
app.post('/get-bill-data', async (req, res) => {
    try {
        const { recordStart, billsPerPage, sortMode } = req.body;
        
        const baseQuery = "SELECT * FROM ls_bill WHERE bill_number NOT LIKE 'SR%'";
        const conditions = {
            'engrossed': ' AND status_id = 2',
            'passed': ' AND status_id = 4',
            'vetoed': ' AND status_id = 5' // Currently no vetoed bills for 2025 
        };
    
        const condition = conditions[sortMode] || ''; // Default to 'engrossed'
        
        // Build the final query
        const query = `${baseQuery}${condition} ORDER BY status_date DESC LIMIT $1 OFFSET $2;`;

        db.query(query, [billsPerPage, recordStart], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).send('Error retrieving bill data');
            }

            return res.status(200).json(results.rows);
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).send('Error retrieving bill data');
    }
});

app.post('/search-for-bills', async (req, res) => {
    try {
        const { queryText } = req.body;

        const response = await searchForBills(queryText);

        if(response){
            return res.status(200).json(response)
        } else {
            return res.status(404).text()
        }
    } catch (err) {
        console.error('Error processing request: ', err);
        return res.status(500).json({ message: 'Error processing request' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

