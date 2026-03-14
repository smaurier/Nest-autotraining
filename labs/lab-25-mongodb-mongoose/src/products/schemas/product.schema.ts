import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

// TODO: Add the @Schema() decorator to enable Mongoose schema generation
// Hint: @Schema({ timestamps: true })
export class Product {
  // TODO: Define the 'name' property
  // It should be a required string
  // Hint: @Prop({ required: true })
  name: string;

  // TODO: Define the 'description' property
  // It should be an optional string, default ''
  description: string;

  // TODO: Define the 'price' property
  // It should be a required number, minimum 0
  // Hint: @Prop({ required: true, min: 0 })
  price: number;

  // TODO: Define the 'category' property
  // It should be a required string
  category: string;

  // TODO: Define the 'inStock' property
  // It should be a boolean, default true
  inStock: boolean;

  // TODO: Define the 'tags' property
  // It should be an array of strings, default []
  // Hint: @Prop({ type: [String], default: [] })
  tags: string[];
}

// TODO: Generate the schema using SchemaFactory
// Hint: export const ProductSchema = SchemaFactory.createForClass(Product);
export const ProductSchema = null as any;
