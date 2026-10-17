import net from "node:net";

const MAX_ATTEMPTS = 50;

function isFreeOn(port: number, host?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

// Vite слушает localhost, Node по умолчанию — все адреса (::): на macOS занятый 127.0.0.1 не мешает слушать ::,
// поэтому проверяем оба.
async function isFree(port: number): Promise<boolean> {
  return (await isFreeOn(port)) && (await isFreeOn(port, "127.0.0.1"));
}

export async function findFreePort(start: number): Promise<number> {
  for (let port = start; port < start + MAX_ATTEMPTS; port++) {
    if (await isFree(port)) return port;
    console.log(`[word-drill] порт ${port} занят, пробую ${port + 1}`);
  }
  throw new Error(
    `Нет свободного порта в диапазоне ${start}–${start + MAX_ATTEMPTS - 1}`,
  );
}
