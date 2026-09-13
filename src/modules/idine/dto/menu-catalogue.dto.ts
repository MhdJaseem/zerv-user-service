import { IsArray, IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * iDine menu catalogue upload payload (see partner doc: Menu catalogue upload).
 * Nested objects are accepted as-is so optional fields from POS are not dropped by validation.
 */
export class MenuCatalogueDto {
  @IsBoolean()
  flush_categories: boolean;

  @IsBoolean()
  flush_items: boolean;

  @IsBoolean()
  flush_options: boolean;

  @IsBoolean()
  flush_option_groups: boolean;

  @IsArray()
  @IsObject({ each: true })
  categories: Record<string, unknown>[];

  @IsArray()
  @IsObject({ each: true })
  items: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  taxes?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  option_groups?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  options?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  charges?: Record<string, unknown>[];

  @IsOptional()
  ErrorMessage?: string | null;
}
