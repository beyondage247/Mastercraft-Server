import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './setup-swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  const host = '0.0.0.0';

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://portal-mastercraft-products-com.onrender.com',
      'https://portal.mastercraft-products.com',
      'https://dev-portal.mastercraft-products.com',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  setupSwagger(app);
  await app.listen(port, host);
  console.log(`Server listening on ${host}:${port}`);
}
bootstrap();
