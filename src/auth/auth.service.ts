import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MoodleService } from '../services/moodle.service';
import { UsersService } from '../users/users.service';
import axios from 'axios';
import { RegisterDto } from './dto/registrer.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private moodleService: MoodleService,
    private usersService: UsersService,
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
      
      // Determinar el rol basado en userissiteadmin
      const role = userInfo.userissiteadmin ? 'admin' : 'student';

      // 3. Crear o actualizar usuario local
      await this.usersService.createLocalUser({
        id: userInfo.userid,
        username: username,
        firstname: userInfo.firstname,
        lastname: userInfo.lastname,
        email: userInfo.email,
        auth: 'manual',
        suspended: 0,
        confirmed: 1
      }, role);

      // 4. Actualizar último login
      await this.usersService.updateLastLogin(userInfo.userid.toString());

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

      // 1. Crear usuario en Moodle
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

      const userId = moodleResponse[0].id;

      // 2. Asignar rol de estudiante por defecto en Moodle
      await this.moodleService.callMoodleApi(
        'core_role_assign_roles',
        await this.getMoodleAdminToken(),
        {
          assignments: [{
            roleid: 5,
            userid: userId,
            contextid: 1
          }]
        }
      );

      // 3. Crear usuario local
      await this.usersService.createLocalUser({
        id: userId,
        username: registerDto.username,
        firstname: registerDto.firstname,
        lastname: registerDto.lastname,
        email: registerDto.email,
        auth: 'manual',
        suspended: 0,
        confirmed: 1
      }, 'student');

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
          role: 'student'
        }
      };
    } catch (error) {
      console.error('Error en registro:', error);
      throw new BadRequestException('Error al registrar usuario');
    }
  }

  private async getMoodleAdminToken(): Promise<string> {
    return this.configService.get('MOODLE_TOKEN') || '';
  }
}
