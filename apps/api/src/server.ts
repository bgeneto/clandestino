import { configWarnings, loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = await createApp(config);

for (const warning of configWarnings) {
  app.log.warn(warning);
}

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
