import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';

/** Legacy `CollectionController::get_followup_template_lists()`'s own inline
 * convention (`2=>SMS, 3=>WHATSAPP, 4=>EMAIL`) — not `master_followup_type`
 * row ids, a separate local enum for this one picker. WhatsApp is accepted
 * here (matching legacy's `in_array($followup_type_id, [2, 3, 4])` check)
 * but never returns templates — see `CollectionService.listFollowupTemplates()`. */
export class FollowupTemplateTypeQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([2, 3, 4])
  typeId: 2 | 3 | 4;
}
