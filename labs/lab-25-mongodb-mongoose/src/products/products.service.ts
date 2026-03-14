import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  // TODO: Implement findAll()
  // It should return all products
  // Hint: return this.productModel.find().exec();
  async findAll(): Promise<Product[]> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findOne(id)
  // It should return a single product by its MongoDB _id
  // If not found, throw NotFoundException
  // Hint: Use this.productModel.findById(id).exec()
  async findOne(id: string): Promise<Product> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(createProductDto)
  // It should create and save a new product
  // Hint: const product = new this.productModel(createProductDto); return product.save();
  async create(createProductDto: CreateProductDto): Promise<Product> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement update(id, updateProductDto)
  // It should find a product by id and update it
  // Return the updated product, throw NotFoundException if not found
  // Hint: Use this.productModel.findByIdAndUpdate(id, updateProductDto, { new: true }).exec()
  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement remove(id)
  // It should delete a product by id
  // Throw NotFoundException if not found
  // Hint: Use this.productModel.findByIdAndDelete(id).exec()
  async remove(id: string): Promise<void> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement search(query)
  // It should search products by name or description using a regex
  // Hint: Use this.productModel.find({ $or: [{ name: regex }, { description: regex }] })
  async search(query: string): Promise<Product[]> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement statsByCategory()
  // It should return aggregation stats: for each category, count products and calculate average price
  // Hint: Use this.productModel.aggregate([
  //   { $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
  //   { $sort: { _id: 1 } }
  // ])
  async statsByCategory(): Promise<any[]> {
    throw new Error('TODO: Not implemented');
  }
}
