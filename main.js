import { program } from 'commander';
import fs from 'fs';
import http from 'http';

// Усунення конфлікту -h
program.helpOption('--help', 'відобразити довідку');

program
  .requiredOption('-i, --input <path>', 'шлях до файлу даних')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .option('-o, --output <path>', 'файл, у який записується остання надіслана відповідь');
  
program.parse(process.argv);
const options = program.opts();

// Асинхронна перевірка наявності файлу
fs.access(options.input, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('Cannot find input file');
    process.exit(1);
  }

  // Створення HTTP-сервера
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${options.host}:${options.port}`);

    // Перевірка шляху запиту
    if (parsedUrl.pathname !== '/') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Помилка 404: Маршрут не знайдено.');
    }

    // Розбір параметрів запиту
    const paymentFlag = parsedUrl.searchParams.get('payment') === 'true';
    let minValueParam = parsedUrl.searchParams.get('min_value');
    let minValue = null;

    if (minValueParam !== null) {
      minValue = Number(minValueParam);
      if (isNaN(minValue)) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Помилка 400: Параметр min_value має бути числом.');
      }
    }

    // Читання файлу
    fs.readFile(options.input, 'utf-8', (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Помилка 500: Неможливо прочитати файл.');
      }

      try {
        const jsonData = JSON.parse(data);
        const result = [];

        // Обробка та фільтрація даних
        for (let i = 0; i < jsonData.length; i++) {
          const item = jsonData[i];
          const bookingValue = Number(item.Booking_Value);

          if (minValue !== null && bookingValue <= minValue) {
            continue;
          }

          const mappedItem = {
            booking_id: item.Booking_ID,
            vehicle_type: item.Vehicle_Type,
            booking_value: bookingValue
          };

          if (paymentFlag) {
            mappedItem.payment_method = item.Payment_Method;
          }
          result.push(mappedItem);
        }

        const jsonResponse = JSON.stringify(result, null, 2);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(jsonResponse);

        // Запис у файл виводу
        if (options.output) {
          fs.writeFile(options.output, jsonResponse, 'utf-8', (writeErr) => {
            if (writeErr) {
              console.error('Не вдалося записати файл виводу:', writeErr);
            }
          });
        }
      } catch (parseErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Помилка 500: Пошкоджений JSON-файл.');
      }
    });
  });

  server.listen(options.port, options.host, () => {
    console.log(`Сервер запущено на http://${options.host}:${options.port}`);
  });
});