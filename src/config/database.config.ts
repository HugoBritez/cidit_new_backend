import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService) => ({
  host: configService.get('DB_HOST', 'localhost'),
  port: parseInt(configService.get('DB_PORT', '3306')),
  user: configService.get('DB_USER', 'moodle'),
  password: configService.get('DB_PASSWORD', 'moodle'),
  database: configService.get('DB_NAME', 'moodle'),
}); 