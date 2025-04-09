import { Controller, Post, Param, Get, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async getAllUsers(
    @Query('field') field?: string,
    @Query('value') value?: string
  ) {
    return this.usersService.getAllUsers({ field, value });
  }

  @Post('change-role')
  async changeUserRole(@Body() data: { userId: string; newRole: string }) {
    return this.usersService.changeRole(data.userId, data.newRole);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }
}