// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import getBillText from './apis/legiscan.js';
import getBillSummary from './apis/openai.js'
import mysql from 'mysql2';
import cors from 'cors'
import { fileURLToPath } from 'url';

// Initialize the Express application
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(cors())


const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// MySQL database connection configuration
const db = mysql.createConnection({
    host: 'localhost', // Change this to your MySQL host
    user: 'root', // Change this to your MySQL username
    password: 'password', // Change this to your MySQL password
    database: 'legiscan_api', // Change this to your database name
});

// Connect to the MySQL database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database: ', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Define the route to get existing bill summaries from the database
app.post('/get-existing-summaries', async (req, res) => {
    try {
        const { billId } = req.body;

        // Query the database to find the summary for the given billId
        const query = 'SELECT summary FROM ls_summaries WHERE bill_id = ?';
        db.query(query, [billId], (err, results) => {
            if (err) {
                console.error('Database query error: ', err);
                return res.status(500).json({ message: 'Error fetching data from the database' });
            }
            if (results.length > 0) {
                return res.status(200).json({ summary: atob(results[0].summary) });
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

        if (!billId) {
            // not sure how this would occur but might as well make sure
            return res.status(400).send(JSON.stringify('Missing bill or doc ID'));
        }

        const billText = await getBillText(billId);
        const summary = await getBillSummary(billText);
        
        // Send the response to the client
        res.status(200).send(summary.content);

        // Now handle database operation (do not affect response)
        const tob64 = btoa(summary.content);
        db.query(
            `INSERT INTO ls_summaries (bill_id, summary) VALUES (?, ?)`,
            [billId, tob64],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return; // Handle error appropriately (log it or return a response if necessary)
                }
                // Optionally, you can log the result of the insert query if needed
                console.log('Summary inserted into database successfully');
            }
        );

    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal server error');
    }
});


//Summarize text needs work next
// also "not like" condition not working here. will SR types be skipped and not count towards limit?
app.post('/get-bill-data', async (req, res) => {
    try {
        const { recordStart, billsPerPage } = req.body;

        const query = "SELECT * FROM ls_bill WHERE bill_number NOT LIKE 'SR' LIMIT ? OFFSET ?;"

        // Pass both parameters in a single array
        db.query(query, [billsPerPage, recordStart], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).send('Error retrieving bill data');
            }

            // Return the data in the response
            return res.status(200).json(results);
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return res.status(500).send('Error retrieving bill data');
    }
});



// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

