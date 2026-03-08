import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Widget' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'A nice widget',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Product price', example: 9.99 })
  @IsNumber()
  @Min(0)
  price: number;
}
