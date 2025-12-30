import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.VM_AI_KEY
});

async function getBillSummary(billText) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    store: true,
    messages: [
      {
        role: "system",
        content: `
          You are a helpful assistant that reads US congress bills and returns a brief, thorough summary in clear, simple language.
          Your users want to understand the bill quickly without having to read the entire bill.
          Remain bipartisan and neutral.
          Include key issues the bill aims to address, potential concerns, and any relevant context. If the bill includes the allocation of funds to 
          any organizations, make sure to include the specific dollar amounts.
          Mention important people and organizations, with party and state affiliations appended in parentheses, e.g. (D-TX) or (R-NY).
          Use full names like "FirstName LastName" rather than using prefixes like "Mr. LastName".
          Give the response in markdown format.
          Do not include greetings or preambles.
        `
      },
      {
        role: "user",
        content: `Please summarize this US congress bill. Here is the text:\n\n${billText}`
      }
    ],
  });

  return completion.choices[0].message;
}

export default getBillSummary;
