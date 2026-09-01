import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as categorias do usuário' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.categoriesService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova categoria' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.id, dto);
  }

  @Post('ensure-defaults')
  @ApiOperation({ summary: 'Cria as categorias padrão caso o usuário ainda não tenha nenhuma' })
  ensureDefaults(@CurrentUser() user: { id: string }) {
    return this.categoriesService.ensureDefaults(user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita uma categoria (nome, cor, ícone)' })
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Exclui definitivamente uma categoria (transações vinculadas mantêm o lançamento, só perdem a categoria)' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.categoriesService.remove(id, user.id);
  }
}
