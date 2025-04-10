import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../.env") });

// Helper function for reading cost data from API
async function readCostData(): Promise<any | null> {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:8000/api/v1/costs/info');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching cost data from API:", error);
    return null;
  }
}

// Create server instance
const server = new McpServer({
  name: "cloud-cost",
  version: "1.0.0",
});

server.tool(
  "get-cost",
  "Get cloud cost summary for multiple vendors and months",
  {
    vendors: z.array(z.string()).optional().describe("List of cloud vendor names (e.g. ['AWS', 'Azure'])"),
    months: z.array(z.string()).optional().describe("List of months in YYYY-MM format (e.g. ['2024-04', '2024-05'])"),
  },
  async ({ vendors, months }) => {

    const data = await readCostData();
    if (!data || !data.Data) {
      return {
        content: [
          { type: "text", text: "Failed to load cost data" }
        ],
      };
    }
    
    const costData = data.Data;
    const selectedVendors = vendors && vendors.length > 0 ? vendors : Object.keys(costData);
    
    let responseText = "";
    
    for (const vendor of selectedVendors) {
      if (!costData[vendor]) continue;
      responseText += `Vendor: ${vendor}\n`;
      const vendorMonths = costData[vendor];
      const selectedMonths = months && months.length > 0 ?
         Object.keys(vendorMonths).filter(m => months.includes(m)) :
         Object.keys(vendorMonths);
      
      for (const month of selectedMonths) {
        responseText += `  Month: ${month}\n`;
        const entries = vendorMonths[month];
        if (Array.isArray(entries) && entries.length > 0) {
          for (const entry of entries) {
            responseText += `    Date: ${entry.date}\n`;
            responseText += `    Cost: $${entry.cost} USD\n`;
            responseText += `    Account ID: ${entry.accountId}\n`;
            responseText += `    Product Name: ${entry.productName}\n`;
            responseText += `    Region Name: ${entry.regionName}\n`;
            responseText += `\n`;
          }
        } else {
          responseText += `    No cost data available\n`;
        }
      }
      responseText += `\n`;
    }
    
    if (!responseText.trim()) {
      responseText = "No cost data found for the given parameters.";
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }
);

// Start the server
async function main() {
  const args = process.argv.slice(2);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cloud Cost MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
