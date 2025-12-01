import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ParserService } from './parser/parser.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ParserService],
})
export class AppModule {}
