import * as readline from 'readline';

// Конфигурация
interface MCPConfig {
    baseUrl: string;
    serverInfo: {
        name: string;
        version: string;
    };
    tools: any[];
}

const mcpConfig: MCPConfig = {
    baseUrl: '',
    serverInfo: {
        name: "1C-MCP-Server-NodeJS",
        version: "1.0.0"
    },
    tools: []
};

// Флаг для определения режима работы (командная строка vs stdio)
let isStdioMode = false;

// Функция для логирования (в stderr если stdio режим)
function writeLog(message: string, level: string = "Info"): void {
    const logMessage = `[${level}] ${message}`;
    
    if (isStdioMode) {
        // В stdio режиме все логи направляем в stderr
        process.stderr.write(logMessage + '\n');
    } else {
        // В командной строке можем использовать цветной вывод
        const colors: { [key: string]: string } = {
            "Error": "\x1b[31m",
            "Warning": "\x1b[33m",
            "Success": "\x1b[32m",
            "Info": "\x1b[90m",
            "Debug": "\x1b[36m"
        };
        const color = colors[level] || "\x1b[37m";
        const reset = "\x1b[0m";
        console.log(`${color}${logMessage}${reset}`);
    }
}

// Функция для HTTP запросов к 1С
async function invoke1CRequest(
    url: string,
    method: string = "GET",
    body: any = null
): Promise<any> {
    try {
        const headers: HeadersInit = {
            "Accept": "application/json; charset=utf-8"
        };

        const options: RequestInit = {
            method: method,
            headers: headers
        };

        if (method === "POST" && body) {
            options.body = JSON.stringify(body);
            (options.headers as Record<string, string>)["Content-Type"] = "application/json; charset=utf-8";
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`HTTP request failed: ${errorMessage}`);
    }
}

// Инициализация - получение списка инструментов от 1С
async function initializeMCPServer(): Promise<any> {
    try {
        const toolsUrl = `${mcpConfig.baseUrl}/tools`;
        const response = await invoke1CRequest(toolsUrl, "GET");
        
        if (response && response.tools) {
            mcpConfig.tools = response.tools;
        }
        
        return {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: { listChanged: false },
                resources: { subscribe: false, listChanged: false }
            },
            serverInfo: mcpConfig.serverInfo
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to initialize MCP server: ${errorMessage}`);
    }
}

// Получение списка инструментов
async function getMCPTools(): Promise<any> {
    if (mcpConfig.tools.length === 0) {
        await initializeMCPServer();
    }
    
    return { tools: mcpConfig.tools };
}

// Вызов инструмента 1С
async function invokeMCPTool(toolName: string, toolArguments: any = null): Promise<any> {
    try {
        const callUrl = `${mcpConfig.baseUrl}/call`;
        const requestBody = {
            name: toolName,
            arguments: toolArguments || {}
        };
        
        const response = await invoke1CRequest(callUrl, "POST", requestBody);
        
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Tool call failed: ${errorMessage}`);
    }
}

// Обработка MCP JSON-RPC запроса
async function handleMCPRequest(request: any): Promise<any> {
    switch (request.method) {
        case "initialize":
            return await initializeMCPServer();
        case "tools/list":
            return await getMCPTools();
        case "tools/call":
            return await invokeMCPTool(request.params.name, request.params.arguments);
        case "resources/list":
            return { resources: [] };
        default:
            throw new Error(`Unknown method: ${request.method}`);
    }
}

// Обработка командной строки
function handleCommandLine(args: CommandLineArgs): void {
    if (args.help) {
        console.log(`
MCP Server для 1С на Node.js/TypeScript

Использование:
  node dist/index.js --initialize
  node dist/index.js --list-tools
  node dist/index.js --method "get_metadata_structure" --arguments '{"object_type":"Справочники"}'
  
Параметры:
  --baseUrl       URL базы 1С
  --initialize    Инициализация сервера
  --list-tools    Показать список доступных инструментов
  --method        Имя метода для вызова
  --arguments     Аргументы в JSON формате
  --help          Показать эту справку
`);
        return;
    }
    
    if (args.initialize) {
        initializeMCPServer()
            .then(result => console.log(JSON.stringify(result, null, 2)))
            .catch(err => {
                writeLog(err.message, "Error");
                process.exit(1);
            });
        return;
    }
    
    if (args.listTools) {
        getMCPTools()
            .then(result => console.log(JSON.stringify(result, null, 2)))
            .catch(err => {
                writeLog(err.message, "Error");
                process.exit(1);
            });
        return;
    }
    
    if (args.method) {
        let argsObj: any = {};
        if (args.arguments) {
            try {
                argsObj = JSON.parse(args.arguments);
            } catch (e) {
                writeLog("Invalid JSON in arguments", "Error");
                process.exit(1);
            }
        }
        
        invokeMCPTool(args.method, argsObj)
            .then(result => console.log(JSON.stringify(result, null, 2)))
            .catch(err => {
                writeLog(err.message, "Error");
                process.exit(1);
            });
        return;
    }
}

interface CommandLineArgs {
    baseUrl?: string;
    initialize?: boolean;
    listTools?: boolean;
    method?: string;
    arguments?: string;
    help?: boolean;
}

// Парсинг аргументов командной строки
function parseArgs(args: string[]): CommandLineArgs {
    const result: CommandLineArgs = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--baseUrl' && args[i + 1]) {
            result.baseUrl = args[++i];
        } else if (arg === '--initialize') {
            result.initialize = true;
        } else if (arg === '--list-tools') {
            result.listTools = true;
        } else if (arg === '--method' && args[i + 1]) {
            result.method = args[++i];
        } else if (arg === '--arguments' && args[i + 1]) {
            result.arguments = args[++i];
        } else if (arg === '--help') {
            result.help = true;
        }
    }
    
    return result;
}

// Основная функция
async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    
    // Если есть параметры командной строки, обрабатываем их
    if (args.initialize || args.listTools || args.method || args.help) {
        if (args.baseUrl) {
            mcpConfig.baseUrl = args.baseUrl;
        }
        handleCommandLine(args);
        return;
    }
    
    // Режим JSON-RPC через stdin/stdout
    isStdioMode = true;
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', async (line: string) => {
        if (!line.trim()) {
            return;
        }
        
        try {
            const request = JSON.parse(line);
            const result = await handleMCPRequest(request);
            
            const response = {
                jsonrpc: "2.0",
                id: request.id,
                result: result
            };
            
            process.stdout.write(JSON.stringify(response) + '\n');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const request = (() => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })();
            
            const errorResponse = {
                jsonrpc: "2.0",
                id: request?.id ?? null,
                error: {
                    code: -32603,
                    message: errorMessage
                }
            };
            
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
    });

    rl.on('close', () => {
        // Завершение работы при закрытии stdin
    });
}

// Запуск
main().catch(err => {
    writeLog(`Fatal error: ${err.message}`, "Error");
    process.exit(1);
});
