import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export interface Task {
  id: number;
  title: string;
  description: string;
  done: boolean;
}

@Injectable()
export class TasksService {
  // TODO: Declare a private array to store tasks in memory
  // Hint: private tasks: Task[] = [];

  // TODO: Declare a private counter for auto-incrementing IDs
  // Hint: private idCounter = 0;

  // TODO: Implement findAll()
  // It should return all tasks
  findAll(): Task[] {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findOne(id)
  // It should return a single task by its id
  // If the task is not found, throw a NotFoundException
  // Hint: Use this.tasks.find(t => t.id === id)
  findOne(id: number): Task {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(createTaskDto)
  // It should create a new task with an auto-incremented id
  // Set done to false by default, description to '' if not provided
  // Push the task to the array and return it
  create(createTaskDto: CreateTaskDto): Task {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement update(id, updateTaskDto)
  // It should find the task by id (use findOne)
  // Then update only the provided fields using Object.assign
  // Return the updated task
  update(id: number, updateTaskDto: UpdateTaskDto): Task {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement remove(id)
  // It should find the task by id (use findOne to check it exists)
  // Then remove it from the array
  // Hint: Use this.tasks.splice(index, 1) or filter
  remove(id: number): void {
    throw new Error('TODO: Not implemented');
  }
}
