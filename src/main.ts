import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // DTO validáció + tisztítás (enterprise alap)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // csak a DTO-ban megadott mezők maradnak
      forbidNonWhitelisted: true, // extra mezők -> 400
      transform: true, // string->number, date, stb. (ha DTO engedi)
    })
  );

  await app.listen(3000);
}
bootstrap();