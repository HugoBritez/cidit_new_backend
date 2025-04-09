import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MoodleService } from '../services/moodle.service';
import { DatabaseService } from '../services/database.service';

@Module({
  imports: [ConfigModule],
  controllers: [UsersController],
  providers: [UsersService, MoodleService, DatabaseService],
  exports: [UsersService]
})
export class UsersModule {}
