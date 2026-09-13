import { AggregateOptions, FilterQuery, Model, PipelineStage, ProjectionType, QueryOptions, UpdateQuery } from "mongoose";
import { BulkWriteOpResult, UpdatedModel, WriteOperation } from "./mongo-lib.types";
import { IMongoRepository } from "./repository.abstract";

export class MongoRepository<T, K, L> implements IMongoRepository<T, K, L> {
    private _repository: Model<T>;

    constructor(repository: Model<T>) {
        this._repository = repository;
    }

    findOne(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K> {
        return this._repository.findOne(filters, projections, options).lean() as unknown as Promise<K>;
    }

    find(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K[]> {
        return this._repository.find(filters, projections, options).lean();
    }

    findOneAndUpdate(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>, options?: QueryOptions<T>): Promise<K> {
        return this._repository.findOneAndUpdate(filters, updateQuery, options).lean() as unknown as Promise<K>;
    }

    findOneAndDelete(filters: FilterQuery<T>, options?: QueryOptions<T>): Promise<K | null> {
        return this._repository.findOneAndDelete(filters, options).lean() as unknown as Promise<K | null>;
    }

    updateMany(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>): Promise<UpdatedModel> {
        return this._repository.updateMany(filters, updateQuery);
    }

    countDocuments(filters: FilterQuery<T>, options?: Partial<QueryOptions>): Promise<number> {
        return this._repository.countDocuments(filters, options).lean();
    }

    async create(payload: Partial<K>): Promise<L> {
        const instance = new this._repository(payload);
        const savedInstance = await instance.save();
        return savedInstance.toJSON() as Promise<L>
    }

    aggregate<L>(pipeline: PipelineStage[], options?: AggregateOptions): Promise<L[]> {
        return this._repository.aggregate(pipeline, options);
    }

    bulkWrite(operations: WriteOperation[]): Promise<BulkWriteOpResult> {
        return this._repository.bulkWrite(operations);
    }

    distinct(field: string, filters?: FilterQuery<T>): Promise<any> {
        return this._repository.distinct(field, filters)
    }

    deleteMany(operation: FilterQuery<T>): Promise<any> {
        return this._repository.deleteMany(operation);
    }

    insertMany(payload: Partial<K>) {
        return this._repository.insertMany(payload);
    }
} 