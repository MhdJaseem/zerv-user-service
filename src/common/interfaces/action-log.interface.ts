import { CollectionNames } from "../enums/common.enum";
import { IModifier } from "../repository/entities/modifier.embed.entity";

export interface IActionLogs {
    collectionName: CollectionNames;
    action: 'create' | 'update' | 'delete';
    previousState?: Object | null;
    newState?: Object | null;
    performedBy: IModifier;
    documentId: string;
    createdAt?: Date;
  }