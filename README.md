**Notes to self**
need to separate the document parsing functions, legiscan api functions, and openai api function into their own files just to make everything cleaner and easier to navigate.

I also don't think I need to worry about any files besides pdf, but make sure before deleting code 

Need to handle server responses more explicitly, like right now i'm checking if typeof response is an object but I should just 
return an object for everything with properties like 'success: true, content: summarized bill' or something

add to footer when site is live (because gpt is in the name of the site) - Disclaimer: "This website is not affiliated with OpenAI. It utilizes OpenAI's API to generate content and provide summaries, but it operates independently and is not officially endorsed by OpenAI."

maybe use https://codepen.io/mbxtr/pen/OJPOYg for show/hide summary text. 

I think I have gone as far as I can in terms of functionality without moving the data to a database for faster access

So it is nearly time to move over to an SQL database (csv files are set up for this, just need to load them into the db). Then I can do things like search for keywords in a bill title, sort by date, etc. 

Mainly need to do this because the way it is now, requests take incredibly long if I'm trying to get data from a bill deep in the csv 

**How it works**
Uses legiscan.com api to retrieve information about US congress bills, including a pdf version of the bill itself. It then parses a chosen bill's pdf and sends the extracted text to openai's api, then renders the received summary which outlines key information in the bill.

probably should be more in depth here in case a fucking employer actually reads it

if you're an employer and saw what I just wrote, i apologize for the profanity also please give me a job pleaseeee