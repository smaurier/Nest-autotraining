import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // TODO: Implement GET /tasks
  // It should return all tasks by calling this.tasksService.findAll()
  // Hint: Use the @Get() decorator
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /tasks/:id
  // It should return a single task by calling this.tasksService.findOne(id)
  // Hint: Use @Get(':id') and @Param('id', ParseIntPipe)
  findOne(id: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /tasks
  // It should create a task by calling this.tasksService.create(createTaskDto)
  // Hint: Use @Post() and @Body()
  create(createTaskDto: CreateTaskDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement PATCH /tasks/:id
  // It should update a task by calling this.tasksService.update(id, updateTaskDto)
  // Hint: Use @Patch(':id'), @Param('id', ParseIntPipe), and @Body()
  update(id: number, updateTaskDto: UpdateTaskDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement DELETE /tasks/:id
  // It should delete a task by calling this.tasksService.remove(id)
  // Hint: Use @Delete(':id') and @Param('id', ParseIntPipe)
  remove(id: number) {
    throw new Error('TODO: Not implemented');
  }
}
