import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const accessToken = process.env.MCP_TEST_ACCESS_TOKEN?.trim();
const familyId = process.env.MCP_TEST_FAMILY_ID?.trim();

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(process.cwd(), "dist", "src", "index.js")],
  cwd: process.cwd(),
  stderr: "inherit",
});

const client = new Client({ name: "familyos-local-smoke", version: "1.0.0" });

async function main() {
  try {
    await client.connect(transport);

    const listed = await client.listTools();
    const toolNames = listed.tools.map((tool) => tool.name);
    console.log(`tools/list OK: ${toolNames.length} ferramentas`);

    if (!toolNames.includes("get_dashboard")) {
      throw new Error("get_dashboard nao apareceu em tools/list");
    }

    const health = await client.callTool({ name: "health", arguments: {} });
    console.log("tools/call health OK");
    console.log(JSON.stringify(health.content, null, 2));

    if (!accessToken) {
      throw new Error(
        "Defina MCP_TEST_ACCESS_TOKEN com um access token Supabase valido para testar get_dashboard.",
      );
    }

    const dashboard = await client.callTool({
      name: "get_dashboard",
      arguments: {},
      _meta: {
        "familyos/authorization": `Bearer ${accessToken}`,
        "familyos/capabilities": "dashboard.read",
        "familyos/client-name": "familyos-local-smoke",
        "familyos/client-version": "1.0.0",
        ...(familyId ? { "familyos/family-id": familyId } : {}),
      },
    });

    const text = dashboard.content
      .filter((item): item is { type: "text"; text: string } => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    if (text.includes('"error"')) {
      throw new Error(`get_dashboard retornou erro:\n${text}`);
    }

    console.log("tools/call get_dashboard OK");
    console.log(text);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
