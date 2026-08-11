import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { patchNestJsSwagger } from "nestjs-zod";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Dev-only: the throwaway dev-console runs on a different Vite port.
  // Not a production CORS policy.
  app.enableCors({ origin: true, credentials: true });

  app.setGlobalPrefix("api/v1", { exclude: ["api/docs", "api/docs-json"] });

  patchNestJsSwagger();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("PULSE-Core API")
      .setDescription("PULSE-Core REST API (foundation iteration). OpenAPI is the canonical contract.")
      .setVersion("0.0.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`PULSE-Core API listening on http://localhost:${port}/api/v1`);
  console.log(`OpenAPI docs at http://localhost:${port}/api/docs`);
}

bootstrap();
