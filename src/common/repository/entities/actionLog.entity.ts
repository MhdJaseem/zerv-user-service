import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Collection, Document } from 'mongoose';
import { Modifier } from './modifier.embed.entity';
import { IModifier } from './modifier.embed.entity';
import { IActionLogs } from 'src/common/interfaces/action-log.interface';
import { CollectionNames } from 'src/common/enums/common.enum';

export type ActionLogsDocument = ActionLogs & Document;

@Schema({
  timestamps: { createdAt: true, updatedAt: false }
})
export class ActionLogs extends Document implements IActionLogs {

  @Prop({ required: true })
  collectionName: CollectionNames;

  @Prop({ required: true })
  action: 'create' | 'update' | 'delete';

  @Prop({ type: Object })
  previousState?: Record<string, any>;

  @Prop({ type: Object })
  newState: Record<string, any>;

  @Prop({ type: Modifier, required: false })
  performedBy: IModifier;

  @Prop({ required: true })
  documentId: string;
}

export const ActionLogsSchema = SchemaFactory.createForClass(ActionLogs);
ActionLogsSchema.index({ documentId: 1 });
