import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  MUSIC_DIR: z.string().default('music'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // 启动失败时的进程级错误，pino logger 尚未初始化
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
