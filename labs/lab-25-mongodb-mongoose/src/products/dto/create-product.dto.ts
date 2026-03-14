export class CreateProductDto {
  name: string;
  description?: string;
  price: number;
  category: string;
  inStock?: boolean;
  tags?: string[];
}
