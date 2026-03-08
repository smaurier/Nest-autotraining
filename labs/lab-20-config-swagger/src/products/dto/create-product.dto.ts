// TODO: Add Swagger and class-validator decorators to this DTO
// Import ApiProperty from '@nestjs/swagger'
// Import IsString, IsNumber, IsOptional, Min from 'class-validator'
//
// For each property, add:
//   @ApiProperty({ description: '...', example: '...' })
//   @IsString() / @IsNumber() / etc.
//
// Hint:
//   @ApiProperty({ description: 'Product name', example: 'Widget' })
//   @IsString()
//   name: string;

export class CreateProductDto {
  name: string;

  description?: string;

  price: number;
}
