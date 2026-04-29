import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-slug',
    ],
    credentials: true,
  });
  // DTO validáció + tisztítás (enterprise alap)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // csak a DTO-ban megadott mezők maradnak
      forbidNonWhitelisted: true, // extra mezők -> 400
      transform: true, // string->number, date, stb. (ha DTO engedi)
    })
  );

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();