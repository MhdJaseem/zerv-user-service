import { Injectable } from "@nestjs/common";
import { IMongoDBServices } from "../../repository/mongodb-repository/abstract.repository";
import { IActionLogs } from "../../interfaces/action-log.interface";
import { CollectionNames } from "../../enums/common.enum";
import { IModifier } from "src/common/repository/entities/modifier.embed.entity";

@Injectable()
export class ActionLogService {
    constructor(
        private dbService: IMongoDBServices
    ) { }

    async logCreateAction(
        collectionName: CollectionNames,
        newState: Record<string, any>,
        documentId: string,
        performedBy: IModifier,
    ) {
        const log: IActionLogs = {
            collectionName,
            action: 'create',
            previousState: null,
            newState,
            performedBy: performedBy,
            documentId,
        };
        return await this.dbService.actionLogs.create(log);
    }

    async logUpdateAction(
        collectionName: CollectionNames,
        previousState: Record<string, any>,
        newState: Record<string, any>,
        documentId: string,
        performedBy: IModifier,
    ) {
        const log: IActionLogs = {
            collectionName,
            action: 'update',
            previousState,
            newState,
            performedBy: performedBy,
            documentId,
        };
        return await this.dbService.actionLogs.create(log);
    }

    async logDeleteAction(
        collectionName: CollectionNames,
        previousState: Record<string, any>,
        documentId: string,
        performedBy: IModifier,
    ) {
        const log: IActionLogs = {
            collectionName,
            action: 'delete',
            previousState,
            newState: null,
            performedBy: performedBy,
            documentId,
        };
        return await this.dbService.actionLogs.create(log);
    }
}