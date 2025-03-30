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
      
      // 1. Obtener token de Moodle
      const loginResponse = await axios.get(`${moodleBaseUrl}/login/token.php`, {
        params: {
          username,
          password,
          service: 'moodle_mobile_app'
        }
      });

      if (loginResponse.data.error) {
        throw new UnauthorizedException(loginResponse.data.error);
      }

      const moodleToken = loginResponse.data.token;

      // 2. Obtener información del usuario
      const userInfo = await this.moodleService.getUserInfo(moodleToken);
      
      // Usar userissiteadmin para determinar el rol
      const role = userInfo.userissiteadmin ? 'admin' : 'student';

      const payload = {
        username,
        moodleToken,
        userId: userInfo.userid,
        role
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: userInfo.userid,
          username,
          fullname: userInfo.fullname,
          role
        }
      };

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

  async register(registerDto: RegisterDto) {
    try {
      console.log('Iniciando registro de usuario:', {
        username: registerDto.username,
        email: registerDto.email
      });

      // Crear usuario
      const moodleResponse = await this.moodleService.callMoodleApi(
        'core_user_create_users',
        await this.getMoodleAdminToken(),
        {
          users: [{
            username: registerDto.username,
            password: registerDto.password,
            firstname: registerDto.firstname,
            lastname: registerDto.lastname,
            email: registerDto.email,
            auth: 'manual'
          }]
        }
      );

      // Asignar rol de estudiante por defecto
      const userId = moodleResponse[0].id; // Moodle devuelve el ID del usuario creado
      await this.moodleService.callMoodleApi(
        'core_role_assign_roles',
        await this.getMoodleAdminToken(),
        {
          assignments: [{
            roleid: 5, // 5 es el ID por defecto del rol estudiante en Moodle
            userid: userId,
            contextid: 1 // Contexto del sistema
          }]
        }
      );

      // Generar token JWT incluyendo el rol
      const payload = { 
        username: registerDto.username,
        role: 'student',
        userId: userId
      };

      return {
        access_token: await this.jwtService.signAsync(payload),
        user: {
          username: registerDto.username,
          email: registerDto.email,
          firstname: registerDto.firstname,
          lastname: registerDto.lastname,
          role: payload.role
        }
      };
    } catch (error) {
      console.error('Error detallado en registro:', {
        error: error.response?.data || error,
        message: error.message,
        stack: error.stack
      });

      // Si es un error de BadRequest, lo propagamos
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Para otros tipos de errores
      throw new BadRequestException({
        message: 'Error al registrar usuario en Moodle',
        details: error.response?.data?.message || error.message
      });
    }
  }

  private async getMoodleAdminToken(): Promise<string> {
    // Usamos el token que ya tenemos configurado para el admin
    return this.configService.get('MOODLE_TOKEN') || '';
  }

  async changeRole(userId: string, newRole: string) {
    try {
      // Validar que el rol sea válido
      if (!['student', 'teacher', 'admin'].includes(newRole)) {
        throw new BadRequestException('Rol no válido');
      }

      // Actualizar rol en Moodle
      await this.moodleService.callMoodleApi(
        'core_role_assign_roles',
        await this.getMoodleAdminToken(),
        {
          assignments: [{
            roleid: this.getRoleId(newRole),
            userid: userId,
            contextid: 1
          }]
        }
      );

      return {
        success: true,
        message: `Rol actualizado a ${newRole}`,
        role: newRole
      };
    } catch (error) {
      throw new BadRequestException('Error al cambiar el rol del usuario');
    }
  }

  private getRoleId(role: string): number {
    // Mapeo simple de roles a IDs de Moodle
    const roleMap = {
      'student': 5,
      'teacher': 3,
      'admin': 1
    };
    return roleMap[role] || 5; // 5 (estudiante) por defecto
  }
}
