import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Laptop Pro' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'A powerful laptop for developers' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 999.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 50 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  categoryId?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Laptop Pro Max' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'An even more powerful laptop' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 1299.99 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  categoryId?: number;
}
