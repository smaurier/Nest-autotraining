export class CreateOrderItemDto {
  productId: number;
  quantity: number;
  price: number;
}

export class CreateOrderDto {
  items: CreateOrderItemDto[];
}
