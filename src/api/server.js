import { createServer } from 'node:http';
import { createTodoApiHandler } from './todoApi.js';
import { createTodoRepository } from '../db/todoRepository.js';

const PORT = Number(process.env.PORT ?? '4174');
const HOST = process.env.HOST ?? '127.0.0.1';

function parseHostAndPort() {
  if (!Number.isInteger(PORT) || PORT <= 0) {
    return {
      port: 4174,
      host: HOST,
    };
  }

  return {
    port: PORT,
    host: HOST,
  };
}

const { port, host } = parseHostAndPort();

const repository = createTodoRepository();
const handler = createTodoApiHandler({ repository });
const server = createServer((request, response) => {
  handler(request, response).catch((error) => {
    response.statusCode = 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(
      JSON.stringify({
        error: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

server.listen(port, host, () => {
  console.log(`Todo API server listening on http://${host}:${port}`);
  console.log(`DATABASE_URL configured: ${Boolean(process.env.DATABASE_URL)}`);
});

export { server };
