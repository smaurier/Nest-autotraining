import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  // TODO: Implement the transform method
  // It should:
  // 1. Parse the value as an integer using parseInt(value, 10)
  // 2. Check if the result is NaN or less than 1
  // 3. If invalid, throw a BadRequestException with a descriptive message
  // 4. If valid, return the parsed number
  // Hint:
  // const val = parseInt(value, 10);
  // if (isNaN(val) || val < 1) throw new BadRequestException('...');
  // return val;
  transform(value: string, metadata: ArgumentMetadata): number {
    throw new Error('TODO: Not implemented');
  }
}
