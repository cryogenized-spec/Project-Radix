import { FunctionDeclaration, Type } from "@google/genai";
import { getFileIndex } from "./db";
import { fsManager } from "./filesystem";

export const FILE_TOOLS: FunctionDeclaration[] = [
  {
    name: "file_search",
    description: "Search for files in the mounted local file system by name or extension.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query (e.g., 'report', '.txt', 'index.ts'). Leave empty to list all files.",
        },
      },
    },
  },
  {
    name: "file_read",
    description: "Read the content of a specific file from the mounted local file system.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "The full path of the file to read (e.g., 'src/main.ts').",
        },
      },
      required: ["path"],
    },
  },
];

export async function fileToolsHandler(functionCall: any): Promise<any> {
  const { name, args } = functionCall;

  if (name === "file_search") {
    try {
      if (!await fsManager.verifyPermission()) {
          await fsManager.loadFromStorage();
      }
      const files = await getFileIndex();
      const query = args.query?.toLowerCase() || "";
      
      const results = files
        .filter(f => f.filePath.toLowerCase().includes(query))
        .map(f => ({ path: f.filePath, modified: new Date(f.lastModified).toISOString() }))
        .slice(0, 50); // Limit to 50 to avoid blowing up context
        
      return {
        success: true,
        totalFound: results.length,
        files: results,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  if (name === "file_read") {
    try {
      if (!await fsManager.verifyPermission()) {
          await fsManager.loadFromStorage();
      }
      
      const content = await fsManager.getFileContent(args.path);
      if (content === null) {
          return { success: false, error: "File not found or access denied." };
      }
      
      const truncated = content.length > 20000 ? content.substring(0, 20000) + "\n...[Truncated]" : content;
      return {
        success: true,
        content: truncated,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  return { error: "Unknown function" };
}
