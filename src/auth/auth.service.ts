import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MoodleService } from '../services/moodle.service';
import axios from 'axios';
import { RegisterDto } from './dto/registrer.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private moodleService: MoodleService,
  ) {}

  async validateMoodleToken(token: string): Promise<boolean> {
    try {
      await this.moodleService.getUserInfo(token);
      return true;
    } catch {
      return false;
    }
  }

  async login(username: string, password: string) {
    try {
      const moodleBaseUrl = this.configService.get('MOODLE_URL');
      console.log('URL base de Moodle:', moodleBaseUrl);

      // 1. Intentar obtener token de Moodle
      const loginUrl = `${moodleBaseUrl}/login/token.php`;
      console.log('Intentando login en:', loginUrl, 'con usuario:', username);

      const loginResponse = await axios.get(loginUrl, {
        params: {
          username,
          password,
          service: 'moodle_mobile_app'
        }
      });

      console.log('Respuesta completa de Moodle:', loginResponse.data);

      if (loginResponse.data.error) {
        console.error('Error de Moodle:', loginResponse.data.error);
        throw new UnauthorizedException(loginResponse.data.error);
      }

      const moodleToken = loginResponse.data.token;
      console.log('Token obtenido:', moodleToken);

      // 2. Obtener información del usuario
      try {
        const userInfo = await this.moodleService.getUserInfo(moodleToken);
        console.log('Info del usuario:', userInfo);

        // 3. Crear JWT
        const payload = {
          username,
          moodleToken,
          userId: userInfo.userid,
        };

        return {
          access_token: this.jwtService.sign(payload),
          user: {
            id: userInfo.userid,
            username,
            fullname: userInfo.fullname,
          }
        };
      } catch (userError) {
        console.error('Error al obtener info del usuario:', userError);
        throw userError;
      }
    } catch (error) {
      console.error('Error completo:', error.response?.data || error);
      if (error.response?.data?.error) {
        throw new UnauthorizedException(error.response.data.error);
      }
      throw new UnauthorizedException('Error en la autenticación');
    }
  }

  async validateToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const isValid = await this.validateMoodleToken(decoded.moodleToken);
      return isValid ? decoded : null;
    } catch {
      return null;
    }
  }

  async register(userData: RegisterDto) {
    try {
      const moodleToken = await this.getMoodleAdminToken();
      
      // Crear usuario en Moodle
      const response = await axios.get(
        `${this.configService.get('MOODLE_URL')}/webservice/rest/server.php`,
        {
          params: {
            wstoken: moodleToken,
            wsfunction: 'core_user_create_users',
            moodlewsrestformat: 'json',
            'users[0][username]': userData.username,
            'users[0][password]': userData.password,
            'users[0][firstname]': userData.firstname,
            'users[0][lastname]': userData.lastname,
            'users[0][email]': userData.email,
            'users[0][auth]': 'manual'
          }
        }
      );

      console.log('Respuesta de creación de usuario:', response.data);

      if (response.data.exception) {
        throw new Error(response.data.message);
      }

      // Hacer login automáticamente después del registro
      return this.login(userData.username, userData.password);
    } catch (error) {
      console.error('Error en registro:', error.response?.data || error);
      throw new BadRequestException(
        error.response?.data?.message || error.message || 'Error al crear usuario'
      );
    }
  }

  private async getMoodleAdminToken(): Promise<string> {
    // Usamos el token que ya tenemos configurado para el admin
    return this.configService.get('MOODLE_TOKEN') || '';
  }
}
